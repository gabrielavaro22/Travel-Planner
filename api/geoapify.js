function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

function getQueryParam(req, name) {
  if (req.query?.[name]) {
    return req.query[name];
  }

  const requestUrl = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  return requestUrl.searchParams.get(name);
}

function formatCategory(categories = []) {
  if (categories.some((category) => category.includes("tourism"))) return "Atractie turistica";
  if (categories.some((category) => category.includes("museum"))) return "Muzeu";
  if (categories.some((category) => category.includes("gallery"))) return "Galerie de arta";
  if (categories.some((category) => category.includes("theatre"))) return "Teatru";
  if (categories.some((category) => category.includes("restaurant"))) return "Restaurant";
  if (categories.some((category) => category.includes("cafe"))) return "Cafenea";
  if (categories.some((category) => category.includes("park") || category.includes("natural"))) return "Parc / natura";
  if (categories.some((category) => category.includes("commercial") || category.includes("market"))) {
    return "Shopping / piata locala";
  }

  return "Locatie";
}

function formatAddress(properties) {
  const addressParts = [
    properties.address_line2,
    properties.address_line1,
    properties.city,
    properties.state,
    properties.postcode,
    properties.country
  ].filter(Boolean);

  const address = addressParts.join(", ");
  return address.length > 110 ? `${address.slice(0, 107)}...` : address;
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Geoapify request failed with ${response.status}`);
  }

  return response.json();
}

async function fetchGeocodeCandidates(destination, apiKey) {
  const queries = [destination];
  const looksAmbiguous = !destination.includes(",") && destination.split(/\s+/).length <= 2;

  if (looksAmbiguous) {
    queries.push(`${destination} country`, `${destination} island`);
  }

  const responses = await Promise.all(
    queries.map(async (query) => {
      const geocodeUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&limit=8&apiKey=${encodeURIComponent(apiKey)}`;

      try {
        return await fetchJson(geocodeUrl);
      } catch {
        return { features: [] };
      }
    })
  );

  const seen = new Set();

  return responses
    .flatMap((response) => response.features || [])
    .filter((feature) => {
      const properties = feature.properties || {};
      const key = `${properties.lat},${properties.lon},${properties.formatted}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreDestinationFeature(feature, destination) {
  const properties = feature.properties || {};
  const query = normalizeText(destination);
  const formatted = normalizeText(properties.formatted);
  const name = normalizeText(properties.name);
  const country = normalizeText(properties.country);
  const resultType = properties.result_type || "";
  const rank = properties.rank || {};

  let score = 0;

  if (country === query) score += 120;
  if (name === query) score += 80;
  if (formatted === query || formatted.startsWith(`${query} `)) score += 35;

  const typeScores = {
    country: 90,
    state: 45,
    county: 10,
    city: 55,
    municipality: 35,
    district: 5,
    suburb: 0,
    street: -40,
    amenity: -50,
    postcode: -60
  };

  score += typeScores[resultType] ?? 0;
  score += Math.round((rank.confidence || 0) * 25);
  score += Math.round((rank.popularity || 0) * 10);

  if (formatted.includes("united states") && !query.includes("united states") && !query.includes("usa")) {
    score -= 35;
  }

  return score;
}

function selectDestinationFeature(features = [], destination) {
  return [...features].sort(
    (a, b) => scoreDestinationFeature(b, destination) - scoreDestinationFeature(a, destination)
  )[0];
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return sendJson(res, 405, { error: "Metoda permisa este GET." });
  }

  const destination = String(getQueryParam(req, "destination") || "").trim();

  if (!destination) {
    return sendJson(res, 400, { error: "Parametrul destination este obligatoriu." });
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;

  if (!apiKey) {
    return sendJson(res, 503, { error: "GEOAPIFY_API_KEY lipseste in environment." });
  }

  try {
    const geocodeFeatures = await fetchGeocodeCandidates(destination, apiKey);
    const selectedFeature = selectDestinationFeature(geocodeFeatures, destination);
    const center = selectedFeature?.properties;

    if (!center?.lon || !center?.lat) {
      return sendJson(res, 404, { error: "Destinatia nu a fost gasita." });
    }

    const categories = [
      "tourism.attraction",
      "entertainment.museum,entertainment.culture,entertainment.gallery,entertainment.theatre",
      "catering.restaurant,catering.cafe",
      "leisure.park,natural",
      "commercial.shopping_mall,commercial.marketplace"
    ];

    const placeResponses = await Promise.all(
      categories.map(async (category) => {
        const placesUrl = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(category)}&filter=circle:${center.lon},${center.lat},7000&bias=proximity:${center.lon},${center.lat}&limit=8&apiKey=${encodeURIComponent(apiKey)}`;

        try {
          return await fetchJson(placesUrl);
        } catch {
          return { features: [] };
        }
      })
    );

    const seen = new Set();
    const places = placeResponses
      .flatMap((response) => response.features || [])
      .map((feature) => {
        const properties = feature.properties || {};
        const name = properties.name || properties.address_line1 || "Locatie recomandata";
        const normalizedName = name.toLowerCase();

        if (seen.has(normalizedName)) {
          return null;
        }

        seen.add(normalizedName);

        return {
          name,
          category: formatCategory(properties.categories || []),
          address: formatAddress(properties),
          distance: Math.round(properties.distance || 0),
          lat: properties.lat,
          lon: properties.lon,
          mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${properties.lat},${properties.lon}`)}`
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 12);

    return sendJson(res, 200, {
      destination: center.formatted || destination,
      center: {
        lat: center.lat,
        lon: center.lon
      },
      places
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "Nu am putut incarca locatiile Geoapify."
    });
  }
};

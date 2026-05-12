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
    const geocodeUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(destination)}&limit=1&apiKey=${encodeURIComponent(apiKey)}`;
    const geocodeData = await fetchJson(geocodeUrl);
    const center = geocodeData.features?.[0]?.properties;

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

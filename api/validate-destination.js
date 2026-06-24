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

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasEnoughDestinationSignal(destination) {
  const normalized = normalizeText(destination);
  const blockedSingleWords = new Set([
    "arma",
    "arme",
    "weapon",
    "weapons",
    "gun",
    "guns",
    "pistol",
    "rifle",
    "knife",
    "drug",
    "drugs"
  ]);

  if (normalized.length < 3) return false;
  if (blockedSingleWords.has(normalized)) return false;
  return /[a-z]/.test(normalized);
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Geoapify validation failed with ${response.status}`);
  }

  return response.json();
}

async function fetchGeocodeCandidates(destination, apiKey) {
  const queries = [destination];
  const looksAmbiguous = !destination.includes(",") && destination.split(/\s+/).length <= 2;

  if (looksAmbiguous) {
    queries.push(`${destination} city`, `${destination} country`, `${destination} island`);
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

function scoreDestinationFeature(feature, destination) {
  const properties = feature.properties || {};
  const query = normalizeText(destination);
  const formatted = normalizeText(properties.formatted);
  const name = normalizeText(properties.name);
  const country = normalizeText(properties.country);
  const city = normalizeText(properties.city);
  const state = normalizeText(properties.state);
  const resultType = properties.result_type || "";
  const rank = properties.rank || {};

  const typeScores = {
    country: 110,
    state: 80,
    county: 40,
    city: 95,
    municipality: 75,
    village: 50,
    town: 65,
    district: -25,
    suburb: -30,
    street: -90,
    amenity: -100,
    building: -100,
    postcode: -100
  };

  let score = typeScores[resultType] ?? -20;

  if (country === query) score += 80;
  if (name === query) score += 65;
  if (city === query) score += 55;
  if (state === query) score += 45;
  if (formatted === query || formatted.startsWith(`${query} `)) score += 25;

  score += Math.round((rank.confidence || 0) * 40);
  score += Math.round((rank.popularity || 0) * 18);

  return score;
}

function isDestinationLike(feature, destination) {
  const properties = feature.properties || {};
  const resultType = properties.result_type || "";
  const rank = properties.rank || {};
  const query = normalizeText(destination);
  const name = normalizeText(properties.name);
  const country = normalizeText(properties.country);
  const city = normalizeText(properties.city);
  const state = normalizeText(properties.state);
  const formatted = normalizeText(properties.formatted);
  const acceptedTypes = new Set(["country", "state", "county", "city", "municipality", "town", "village"]);

  if (!acceptedTypes.has(resultType)) return false;
  if ((rank.confidence || 0) < 0.45 && (rank.popularity || 0) < 0.35) return false;

  return (
    name === query ||
    country === query ||
    city === query ||
    state === query ||
    formatted === query ||
    formatted.startsWith(`${query} `)
  );
}

function selectValidDestination(features, destination) {
  return features
    .filter((feature) => isDestinationLike(feature, destination))
    .sort((a, b) => scoreDestinationFeature(b, destination) - scoreDestinationFeature(a, destination))[0];
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

  if (!hasEnoughDestinationSignal(destination)) {
    return sendJson(res, 200, {
      valid: false,
      reason: "Destinatia nu pare sa fie un oras, tara sau regiune reala."
    });
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;

  if (!apiKey) {
    return sendJson(res, 503, { valid: false, error: "GEOAPIFY_API_KEY lipseste in environment." });
  }

  try {
    const features = await fetchGeocodeCandidates(destination, apiKey);
    const selected = selectValidDestination(features, destination);
    const properties = selected?.properties || {};

    if (!selected) {
      return sendJson(res, 200, {
        valid: false,
        reason: "Nu am gasit o destinatie turistica reala pentru termenul introdus."
      });
    }

    return sendJson(res, 200, {
      valid: true,
      destination: properties.formatted || destination,
      resultType: properties.result_type || "",
      center: {
        lat: properties.lat,
        lon: properties.lon
      }
    });
  } catch (error) {
    return sendJson(res, 500, {
      valid: false,
      error: error.message || "Nu am putut valida destinatia."
    });
  }
};

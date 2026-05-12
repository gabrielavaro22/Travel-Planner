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

function getPexelsKey() {
  const key = process.env.PEXELS_API_KEY;

  if (key && key !== "your_pexels_api_key_here") {
    return key;
  }

  return "";
}

function normalizePhoto(photo) {
  const src = photo.src || {};
  const imageUrl = src.large2x || src.large || src.medium || src.landscape;

  if (!imageUrl) {
    return null;
  }

  return {
    id: photo.id,
    alt: photo.alt || "Destination travel photo",
    src: imageUrl,
    photographer: photo.photographer || "",
    photographerUrl: photo.photographer_url || "",
    pexelsUrl: photo.url || ""
  };
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

  const apiKey = getPexelsKey();
  const destination = String(getQueryParam(req, "destination") || "").trim();

  if (!destination || !apiKey) {
    return sendJson(res, 200, { photos: [] });
  }

  const query = `${destination} travel`;
  const searchUrl = new URL("https://api.pexels.com/v1/search");
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("per_page", "8");
  searchUrl.searchParams.set("orientation", "landscape");
  searchUrl.searchParams.set("locale", "en-US");

  try {
    const pexelsResponse = await fetch(searchUrl, {
      headers: {
        Authorization: apiKey
      }
    });

    if (!pexelsResponse.ok) {
      return sendJson(res, 200, { photos: [] });
    }

    const data = await pexelsResponse.json();
    const photos = (data.photos || [])
      .map(normalizePhoto)
      .filter(Boolean)
      .slice(0, 8);

    return sendJson(res, 200, { photos });
  } catch {
    return sendJson(res, 200, { photos: [] });
  }
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

function hasGeminiKey() {
  return Boolean(getGeminiKey());
}

function getGeminiKey() {
  const configuredKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (configuredKey && configuredKey !== "your_gemini_api_key_here") {
    return configuredKey;
  }

  return "";
}

function normalizeRequest(body) {
  const parsedBody = typeof body === "string" ? JSON.parse(body) : body;

  return {
    payload: parsedBody.payload || {},
    localPlan: parsedBody.localPlan || null
  };
}

function validateRequest(payload, localPlan) {
  if (!payload.destination) return "Destinatia este obligatorie.";
  if (!Number.isInteger(Number(payload.days)) || Number(payload.days) < 1 || Number(payload.days) > 30) {
    return "Numarul de zile trebuie sa fie intre 1 si 30.";
  }
  if (!payload.budget) return "Bugetul este obligatoriu.";
  if (!payload.vacationType) return "Tipul vacantei este obligatoriu.";
  if (!localPlan?.days?.length) return "Planul local de baza lipseste.";
  return "";
}

function buildPrompt(payload, localPlan) {
  return `
Esti un travel planner. Rescrie si imbunatateste planul de vacanta in limba romana.

Date utilizator:
- Destinatie: ${payload.destination}
- Zile: ${payload.days}
- Buget: ${payload.budget}
- Tip vacanta: ${payload.vacationType}
- Preferinte: ${(payload.preferences || []).join(", ") || "fara preferinte speciale"}
- Detalii extra: ${payload.extraDetails || "fara detalii extra"}

Plan local de baza:
${JSON.stringify(localPlan, null, 2)}

Reguli stricte:
- Returneaza doar JSON valid.
- Pastreaza exact structura: title, summary, days, estimatedBudget, tips.
- Campul days trebuie sa aiba exact ${payload.days} elemente.
- Fiecare zi trebuie sa aiba: day, title, morning, afternoon, evening.
- Nu repeta aceeasi activitate sau aceeasi formulare intre zile.
- Foloseste locatiile recomandate din planul local, dar distribuie-le natural.
- Nu inventa preturi exacte, rezervari garantate sau informatii imposibil de verificat.
- Tonul trebuie sa fie practic, clar si prietenos.
`;
}

function extractGeminiText(data) {
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
}

function parseGeminiJson(text) {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned);
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Metoda permisa este POST." });
  }

  if (!hasGeminiKey()) {
    return sendJson(response, 503, { error: "GEMINI_API_KEY lipseste. Se foloseste fallback-ul local." });
  }

  let parsed;

  try {
    parsed = normalizeRequest(request.body || {});
  } catch {
    return sendJson(response, 400, { error: "Body-ul requestului trebuie sa fie JSON valid." });
  }

  const validationError = validateRequest(parsed.payload, parsed.localPlan);

  if (validationError) {
    return sendJson(response, 400, { error: validationError });
  }

  try {
    const geminiResponse = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "x-goog-api-key": getGeminiKey(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(parsed.payload, parsed.localPlan) }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      return sendJson(response, 503, {
        error: data.error?.message || "Gemini API nu a putut genera planul. Se foloseste fallback-ul local."
      });
    }

    const generatedPlan = parseGeminiJson(extractGeminiText(data));

    return sendJson(response, 200, {
      ...generatedPlan,
      source: "gemini",
      recommendedLocations: parsed.localPlan.recommendedLocations || []
    });
  } catch (error) {
    return sendJson(response, 503, {
      error: error.message || "Gemini API a esuat. Se foloseste fallback-ul local."
    });
  }
};

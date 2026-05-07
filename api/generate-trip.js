const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const tripSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "days", "estimatedBudget", "tips"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    estimatedBudget: { type: "string" },
    tips: {
      type: "array",
      minItems: 3,
      maxItems: 7,
      items: { type: "string" }
    },
    days: {
      type: "array",
      minItems: 1,
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "title", "morning", "afternoon", "evening"],
        properties: {
          day: { type: "integer" },
          title: { type: "string" },
          morning: { type: "string" },
          afternoon: { type: "string" },
          evening: { type: "string" }
        }
      }
    }
  }
};

function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

function normalizeRequest(body) {
  const parsedBody = typeof body === "string" ? JSON.parse(body) : body;

  return {
    destination: String(parsedBody.destination || "").trim(),
    days: Number(parsedBody.days),
    budget: String(parsedBody.budget || "").trim(),
    vacationType: String(parsedBody.vacationType || "").trim(),
    preferences: Array.isArray(parsedBody.preferences)
      ? parsedBody.preferences.map((item) => String(item).trim()).filter(Boolean)
      : String(parsedBody.preferences || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
    extraDetails: String(parsedBody.extraDetails || "").trim()
  };
}

function validateRequest(payload) {
  if (!payload.destination) return "Destinatia este obligatorie.";
  if (!Number.isInteger(payload.days) || payload.days < 1 || payload.days > 30) {
    return "Numarul de zile trebuie sa fie intre 1 si 30.";
  }
  if (!payload.budget) return "Bugetul este obligatoriu.";
  if (!payload.vacationType) return "Tipul vacantei este obligatoriu.";
  return "";
}

function hasOpenAiKey() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "your_openai_api_key_here");
}

function buildPrompt(payload) {
  const preferences = payload.preferences.length ? payload.preferences.join(", ") : "fara preferinte speciale";
  const extra = payload.extraDetails || "fara detalii suplimentare";

  return `
Genereaza un itinerariu turistic in limba romana.

Date utilizator:
- Destinatie: ${payload.destination}
- Numar de zile: ${payload.days}
- Buget: ${payload.budget}
- Tip vacanta: ${payload.vacationType}
- Preferinte: ${preferences}
- Alte detalii: ${extra}

Reguli:
- Creeaza exact ${payload.days} zile in campul days.
- Pentru fiecare zi include activitati pentru dimineata, pranz/dupa-amiaza si seara.
- Respecta bugetul si explica realist cum se poate incadra calatoria.
- Pastreaza tonul clar, practic si prietenos.
- Nu inventa rezervari, preturi exacte sau disponibilitati garantate.
`;
}

function extractOutputText(data) {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  const message = data.output?.find((item) => item.type === "message");
  const textPart = message?.content?.find((item) => item.type === "output_text");
  return textPart?.text || "";
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Metoda permisa este POST." });
  }

  if (!hasOpenAiKey()) {
    return sendJson(response, 500, {
      error: "Lipseste variabila OPENAI_API_KEY. Adauga cheia in .env local sau in Vercel."
    });
  }

  let payload;

  try {
    payload = normalizeRequest(request.body || {});
  } catch {
    return sendJson(response, 400, { error: "Body-ul requestului trebuie sa fie JSON valid." });
  }

  const validationError = validateRequest(payload);

  if (validationError) {
    return sendJson(response, 400, { error: validationError });
  }

  try {
    const openAiResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        instructions:
          "Esti un consultant de turism. Raspunde doar cu JSON valid care respecta schema primita.",
        input: buildPrompt(payload),
        text: {
          format: {
            type: "json_schema",
            name: "travel_plan",
            strict: true,
            schema: tripSchema
          }
        }
      })
    });

    const data = await openAiResponse.json();

    if (!openAiResponse.ok) {
      return sendJson(response, openAiResponse.status, {
        error: data.error?.message || "OpenAI API a returnat o eroare."
      });
    }

    const outputText = extractOutputText(data);
    const plan = JSON.parse(outputText);

    return sendJson(response, 200, plan);
  } catch (error) {
    return sendJson(response, 500, {
      error: error.message || "A aparut o eroare la generarea itinerariului."
    });
  }
};

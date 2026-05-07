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

function pickByPreference(payload, options) {
  const joinedPreferences = `${payload.vacationType} ${payload.preferences.join(" ")} ${payload.extraDetails}`.toLowerCase();
  const match = options.find((option) => option.keywords.some((keyword) => joinedPreferences.includes(keyword)));
  return match || options[0];
}

function buildLocalDay(payload, dayNumber) {
  const themes = [
    {
      keywords: ["cultural", "muzee", "istorie", "arta"],
      title: "Descoperiri culturale",
      morning: `Incepe ziua cu centrul istoric din ${payload.destination}, observand cladirile reprezentative si oprindu-te la un muzeu sau monument important.`,
      afternoon: "Alege o zona pietonala pentru pranz si continua cu o galerie, o piata locala sau un tur scurt al principalelor obiective.",
      evening: "Incheie cu o plimbare relaxata intr-un cartier cunoscut si o cina cu preparate locale."
    },
    {
      keywords: ["natura", "aventura", "drumetie", "plaja"],
      title: "Natura si miscare",
      morning: `Porneste catre o zona verde, parc, plaja sau punct panoramic din apropiere de ${payload.destination}.`,
      afternoon: "Pastreaza dupa-amiaza pentru o activitate usoara in aer liber si un pranz simplu intr-o zona accesibila.",
      evening: "Alege o seara linistita, cu apus, promenada sau o terasa potrivita bugetului."
    },
    {
      keywords: ["gastronomie", "mancare", "restaurant", "culinar"],
      title: "Gusturi locale",
      morning: `Viziteaza o piata locala sau o zona cu cafenele din ${payload.destination}, ideala pentru mic dejun si observarea atmosferei orasului.`,
      afternoon: "Rezerva timp pentru un pranz traditional si pentru cateva opriri la magazine sau locuri recomandate de localnici.",
      evening: "Incheie ziua cu o cina specifica destinatiei, alegand un restaurant cu recenzii bune si preturi potrivite bugetului."
    },
    {
      keywords: ["shopping", "lux", "romantic", "relaxare"],
      title: "Relaxare si experiente placute",
      morning: `Ia ziua mai lejer, cu mic dejun tarziu si o plimbare printr-o zona frumoasa din ${payload.destination}.`,
      afternoon: "Adauga timp pentru shopping, cafenele, fotografii si pauze dese, fara program prea incarcat.",
      evening: "Alege o activitate memorabila: cina cu priveliste, spectacol, promenada sau un loc potrivit pentru fotografii."
    }
  ];

  const selectedTheme = pickByPreference(payload, themes);
  const isFirstDay = dayNumber === 1;
  const isLastDay = dayNumber === payload.days;

  return {
    day: dayNumber,
    title: isFirstDay
      ? `Sosire si prima impresie in ${payload.destination}`
      : isLastDay
        ? `Ultimele opriri si suveniruri`
        : selectedTheme.title,
    morning: isFirstDay
      ? `Ajungi in ${payload.destination}, te cazezi daca este posibil si faci o prima plimbare de orientare in zona centrala.`
      : selectedTheme.morning,
    afternoon: isLastDay
      ? "Pastreaza dupa-amiaza pentru suveniruri, o masa relaxata si obiective ramase aproape de cazare."
      : selectedTheme.afternoon,
    evening: isFirstDay
      ? "Alege o cina simpla aproape de cazare si stabileste traseul pentru zilele urmatoare."
      : selectedTheme.evening
  };
}

function generateLocalTrip(payload) {
  const preferenceText = payload.preferences.length
    ? payload.preferences.join(", ")
    : "un ritm echilibrat, cu obiective populare si pauze suficiente";

  return {
    source: "local",
    title: `${payload.days} zile in ${payload.destination}`,
    summary: `Plan gratuit generat local pentru o vacanta de tip ${payload.vacationType}, cu buget de ${payload.budget} si preferinte: ${preferenceText}.`,
    days: Array.from({ length: payload.days }, (_, index) => buildLocalDay(payload, index + 1)),
    estimatedBudget: `Pentru bugetul de ${payload.budget}, recomand cazare simpla sau medie, transport public unde este disponibil, mese mixte intre localuri accesibile si cateva experiente speciale. Pastreaza aproximativ 10-15% din buget pentru cheltuieli neprevazute.`,
    tips: [
      "Verifica programul obiectivelor inainte de plecare, deoarece orele pot varia in functie de sezon.",
      "Cumpara bilete online pentru atractiile populare ca sa eviti cozile.",
      "Foloseste transportul public sau mersul pe jos pentru a controla costurile.",
      "Pastreaza o copie digitala a documentelor si rezervarilor.",
      "Lasa cel putin o activitate flexibila pe zi pentru vreme, oboseala sau descoperiri spontane."
    ]
  };
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

  if (!hasOpenAiKey()) {
    return sendJson(response, 200, generateLocalTrip(payload));
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
      return sendJson(response, 200, generateLocalTrip(payload));
    }

    const outputText = extractOutputText(data);
    const plan = JSON.parse(outputText);

    return sendJson(response, 200, plan);
  } catch (error) {
    return sendJson(response, 200, generateLocalTrip(payload));
  }
};

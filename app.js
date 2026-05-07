const STORAGE_KEY = "aiTravelPlanner.history";

const form = document.querySelector("#planner-form");
const message = document.querySelector("#form-message");
const result = document.querySelector("#result");
const generateButton = document.querySelector("#generate-button");
const historyList = document.querySelector("#history-list");
const clearHistoryButton = document.querySelector("#clear-history");

let currentPlan = null;

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 10)));
}

function setMessage(text, type = "error") {
  message.textContent = text;
  message.classList.toggle("success", type === "success");
}

function getFormData() {
  const data = new FormData(form);
  const preferences = data.getAll("preferences");

  return {
    destination: data.get("destination").trim(),
    days: Number(data.get("days")),
    budget: data.get("budget").trim(),
    vacationType: data.get("vacationType").trim(),
    preferences,
    extraDetails: data.get("extraDetails").trim()
  };
}

function validateTripRequest(payload) {
  if (!payload.destination) return "Completeaza destinatia.";
  if (!Number.isInteger(payload.days) || payload.days < 1 || payload.days > 30) {
    return "Alege un numar de zile intre 1 si 30.";
  }
  if (!payload.budget) return "Completeaza bugetul.";
  if (!payload.vacationType) return "Alege tipul vacantei.";
  return "";
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getDestinationData(destination) {
  const destinations = window.TRAVEL_DESTINATIONS || {};
  const normalizedDestination = normalizeText(destination);
  const exactKey = Object.keys(destinations).find((key) => normalizeText(key) === normalizedDestination);

  if (exactKey) {
    return destinations[exactKey];
  }

  return Object.values(destinations).find((entry) => normalizedDestination.includes(normalizeText(entry.name)));
}

function pickItems(items, count, offset = 0) {
  if (!items.length) return [];

  return Array.from({ length: Math.min(count, items.length) }, (_, index) => items[(index + offset) % items.length]);
}

function getPreferenceTags(payload) {
  const tags = new Set(payload.preferences);
  const vacationTypeTags = {
    relaxare: ["relaxare", "natura"],
    aventura: ["aventura", "natura"],
    cultural: ["cultural", "muzee"],
    romantic: ["romantic", "relaxare"],
    familie: ["familie", "natura"],
    "city break": ["cultural", "gastronomie"],
    lux: ["lux", "shopping"],
    "buget redus": ["buget redus", "gratuit"]
  };

  for (const tag of vacationTypeTags[payload.vacationType] || []) {
    tags.add(tag);
  }

  return [...tags];
}

function scoreLocation(location, preferenceTags) {
  const tagScore = location.tags.reduce((score, tag) => score + (preferenceTags.includes(tag) ? 8 : 0), 0);
  const categoryScore = preferenceTags.includes(normalizeText(location.category)) ? 4 : 0;
  return location.priority + tagScore + categoryScore;
}

function getRecommendedLocations(payload, destinationData) {
  if (!destinationData) return [];

  const preferenceTags = getPreferenceTags(payload);

  return destinationData.locations
    .map((location) => ({
      ...location,
      score: scoreLocation(location, preferenceTags),
      mapUrl: createMapUrl(destinationData.name, location.name)
    }))
    .sort((a, b) => b.score - a.score || b.priority - a.priority)
    .slice(0, Math.min(14, destinationData.locations.length));
}

function createMapUrl(destination, location) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location} ${destination}`)}`;
}

function pickByPreference(payload, options) {
  const joinedPreferences = `${payload.vacationType} ${payload.preferences.join(" ")} ${payload.extraDetails}`.toLowerCase();
  const match = options.find((option) => option.keywords.some((keyword) => joinedPreferences.includes(keyword)));
  return match || options[0];
}

function categoryLabel(location) {
  return `${location.name} (${location.category})`;
}

function splitLocationsByDay(locations, days) {
  const queue = [...locations];

  return Array.from({ length: days }, () => ({
    morning: queue.shift(),
    afternoon: queue.shift(),
    evening: queue.shift()
  }));
}

function buildLocalDay(payload, dayNumber, destinationData, dayPlan) {
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
  const morningStop = dayPlan?.morning ? ` Recomandare: ${categoryLabel(dayPlan.morning)}.` : "";
  const afternoonStop = dayPlan?.afternoon ? ` Include in traseu: ${categoryLabel(dayPlan.afternoon)}.` : "";
  const eveningStop = dayPlan?.evening ? ` Oprire potrivita: ${categoryLabel(dayPlan.evening)}.` : "";

  return {
    day: dayNumber,
    title: isFirstDay
      ? `Sosire si prima impresie in ${payload.destination}`
      : isLastDay
        ? "Ultimele opriri si suveniruri"
        : selectedTheme.title,
    morning: isFirstDay
      ? `Ajungi in ${destinationData?.name || payload.destination}, te cazezi daca este posibil si faci o prima plimbare de orientare in zona centrala.${morningStop}`
      : `${selectedTheme.morning}${morningStop}`,
    afternoon: isLastDay
      ? `Pastreaza dupa-amiaza pentru suveniruri, o masa relaxata si obiective ramase aproape de cazare.${afternoonStop}`
      : `${selectedTheme.afternoon}${afternoonStop}`,
    evening: isFirstDay
      ? `Alege o cina simpla aproape de cazare si stabileste traseul pentru zilele urmatoare.${eveningStop}`
      : `${selectedTheme.evening}${eveningStop}`
  };
}

function generateLocalTrip(payload) {
  const destinationData = getDestinationData(payload.destination);
  const recommendedLocations = getRecommendedLocations(payload, destinationData);
  const dayPlans = splitLocationsByDay(recommendedLocations, payload.days);
  const preferenceText = payload.preferences.length
    ? payload.preferences.join(", ")
    : "un ritm echilibrat, cu obiective populare si pauze suficiente";

  return {
    source: "local",
    title: `${payload.days} zile in ${destinationData?.name || payload.destination}`,
    summary: destinationData
      ? `Plan gratuit generat local pentru ${destinationData.name}, cu recomandari prioritizate dupa preferinte. Vacanta este de tip ${payload.vacationType}, cu buget de ${payload.budget} si preferinte: ${preferenceText}.`
      : `Plan gratuit generat local pentru o vacanta de tip ${payload.vacationType}, cu buget de ${payload.budget} si preferinte: ${preferenceText}. Pentru aceasta destinatie folosim recomandari generale.`,
    days: Array.from({ length: payload.days }, (_, index) =>
      buildLocalDay(payload, index + 1, destinationData, dayPlans[index])
    ),
    recommendedLocations,
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

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderTrip(plan) {
  currentPlan = plan;
  const dayCards = plan.days
    .map((day) => {
      const activities = [
        ["Dimineata", day.morning],
        ["Pranz / dupa-amiaza", day.afternoon],
        ["Seara", day.evening]
      ]
        .map(
          ([label, text]) => `
            <div class="activity">
              <strong>${label}</strong>
              <p>${escapeHtml(text)}</p>
            </div>
          `
        )
        .join("");

      return `
        <article class="day-card">
          <h3>Ziua ${escapeHtml(day.day)}: ${escapeHtml(day.title)}</h3>
          <div class="activity-grid">${activities}</div>
        </article>
      `;
    })
    .join("");

  const tips = plan.tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("");
  const recommendations = (plan.recommendedLocations || [])
    .map(
      (location) => `
        <a class="location-card" href="${escapeHtml(location.mapUrl)}" target="_blank" rel="noreferrer">
          <span>${escapeHtml(location.name)}</span>
          <small>${escapeHtml(location.category)} - scor ${escapeHtml(location.score)}</small>
          <small>Vezi pe harta</small>
        </a>
      `
    )
    .join("");
  const sourceLabel =
    plan.source === "gemini"
      ? '<span class="source-badge">Generat cu Gemini AI</span>'
      : '<span class="source-badge">Generat local gratuit</span>';

  result.className = "result-content";
  result.innerHTML = `
    <div class="trip-header">
      ${sourceLabel}
      <h3>${escapeHtml(plan.title)}</h3>
      <p>${escapeHtml(plan.summary)}</p>
    </div>
    ${
      recommendations
        ? `
          <div class="locations-box">
            <h3>Locatii recomandate</h3>
            <div class="locations-grid">${recommendations}</div>
          </div>
        `
        : ""
    }
    <div class="days-list">${dayCards}</div>
    <div class="budget-box">
      <h3>Buget estimat</h3>
      <p>${escapeHtml(plan.estimatedBudget)}</p>
    </div>
    <div class="tips-box">
      <h3>Sfaturi utile</h3>
      <ul>${tips}</ul>
    </div>
  `;
}

function addTripToHistory(plan, request) {
  const history = getHistory();
  const item = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    request,
    plan
  };

  saveHistory([item, ...history]);
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  clearHistoryButton.disabled = history.length === 0;

  if (history.length === 0) {
    historyList.innerHTML = '<p class="result-empty">Nu ai inca itinerarii salvate.</p>';
    return;
  }

  historyList.innerHTML = history
    .map(
      (item) => `
        <article class="history-item">
          <h3>${escapeHtml(item.plan.title)}</h3>
          <p>${escapeHtml(item.request.destination)} - ${escapeHtml(item.request.days)} zile - ${escapeHtml(item.request.budget)}</p>
          <div class="history-actions">
            <button class="small-button" type="button" data-action="open" data-id="${item.id}">Deschide</button>
            <button class="small-button" type="button" data-action="delete" data-id="${item.id}">Sterge</button>
          </div>
        </article>
      `
    )
    .join("");
}

async function generateTrip(payload) {
  const localPlan = generateLocalTrip(payload);

  try {
    const response = await fetch("/api/generate-trip", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ payload, localPlan })
    });

    if (!response.ok) {
      return localPlan;
    }

    const geminiPlan = await response.json();

    return {
      ...localPlan,
      ...geminiPlan,
      recommendedLocations: localPlan.recommendedLocations
    };
  } catch {
    return localPlan;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = getFormData();
  const validationError = validateTripRequest(payload);

  if (validationError) {
    setMessage(validationError);
    return;
  }

  setMessage("Generez itinerariul...", "success");
  generateButton.disabled = true;
  generateButton.textContent = "Se genereaza...";

  try {
    const plan = await generateTrip(payload);
    renderTrip(plan);
    addTripToHistory(plan, payload);
    setMessage("Itinerariul a fost generat si salvat in istoric.", "success");
  } catch (error) {
    setMessage(error.message);
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = "Genereaza vacanta";
  }
});

historyList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const history = getHistory();
  const item = history.find((entry) => entry.id === button.dataset.id);
  if (!item) return;

  if (button.dataset.action === "open") {
    renderTrip(item.plan);
    window.location.hash = "planner";
    setMessage("Itinerariul salvat a fost deschis.", "success");
  }

  if (button.dataset.action === "delete") {
    saveHistory(history.filter((entry) => entry.id !== item.id));
    renderHistory();
  }
});

clearHistoryButton.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  setMessage(currentPlan ? "Istoricul a fost sters." : "", "success");
});

renderHistory();

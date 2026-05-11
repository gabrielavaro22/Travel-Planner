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

function generateRainyDayOptions(payload, dayNumber) {
  const destination = payload.destination || "orasul tau";
  const rainyActivities = [
    { type: "Muzeu", example: `Muzeul National de ${destination}` },
    { type: "Centrul comercial", example: `Centrul Comercial ${destination} Mall` },
    { type: "Cafenea", example: `Cafenea Literara ${destination}` },
    { type: "Restaurant", example: `Restaurantul Tradițional ${destination}` }
  ];

  const lowEnergyActivities = [
    { type: "Cafenea cu carte", example: `Carturesti Carusel - ${destination}` },
    { type: "Parc acoperit", example: `Conservatorul Botanic ${destination}` },
    { type: "Terasa acoperita", example: `Terasa Central ${destination}` },
    { type: "Atelier artizant", example: `Atelierul de Artizant ${destination}` }
  ];

  const rainItem = rainyActivities[dayNumber % rainyActivities.length];
  const lowEnergyItem = lowEnergyActivities[dayNumber % lowEnergyActivities.length];

  return {
    rainy: `Alternativa pentru vreme rea: ${rainItem.example} (${rainItem.type}).`,
    lowEnergy: `Alternativa low-energy: ${lowEnergyItem.example} (${lowEnergyItem.type}).`
  };
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

  const flexOptions = generateRainyDayOptions(payload, dayNumber);

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
      : `${selectedTheme.evening}${eveningStop}`,
    rainyOption: flexOptions.rainy,
    lowEnergyOption: flexOptions.lowEnergy,
    optionalActivities: ["Plimbare prin cartier / Fotografii", "Vizită scurtă muzeu / Piata locala"][dayNumber % 2]
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
      ],
      flexibility: generateFlexibilitySuggestions(payload, destinationData)
    };
}

function generateFlexibilitySuggestions(payload, destinationData) {
  const destination = payload.destination || "orașul tau";
  const destinationName = destinationData?.name || destination;
  const days = payload.days?.length || 1;
  const budgetValue = payload.budget?.match(/(\d+(?:\s*\d+)*(?:\.\d+)?)/i)?.[1].replace(/\s/g, '') || '500';
  const currencyMatch = payload.budget?.match(/(\d+(?:\s*\d+)*(?:\.\d+)?)\s*(EUR|RON|USD|GBP)/i);
  const currency = currencyMatch ? currencyMatch[2].toUpperCase() : 'EUR';
  
  // Parse preferences for more specific suggestions
  const preferences = payload.preferences || [];
  const vacationType = payload.vacationType || '';
  
  // Helper function to get destination-specific places
  function getDestinationSpecific(placeType, genericName) {
    if (destinationData && destinationData.locations && destinationData.locations.length > 0) {
      // Try to find matching locations from our data
      const matching = destinationData.locations.filter(loc => 
        loc.category.toLowerCase().includes(placeType.toLowerCase()) || 
        loc.name.toLowerCase().includes(placeType.toLowerCase())
      );
      if (matching.length > 0) {
        return matching.slice(0, 3).map(loc => loc.name);
      }
    }
    // Return generic but destination-aware suggestions
    return [`un ${placeType} local în ${destinationName}`];
  }
  
  // Rainy day suggestions - indoor activities
  const rainyDayBackup = [
    ...getDestinationSpecific('muzeu', 'muzeu'),
    ...getDestinationSpecific('galerie de artă', 'galerie'),
    ...getDestinationSpecific('piață acoperită', 'piață acoperită'),
    ...getDestinationSpecific('atelier culinar', 'atelier de gătit'),
    ...getDestinationSpecific('spa urban', 'spa'),
    ...getDestinationSpecific('centru de cultura', 'centru cultural'),
    ...getDestinationSpecific('cinema', 'cinema'),
    ...getDestinationSpecific('escape room', 'escape room')
  ].slice(0, 3);
  
  // Low energy suggestions - relaxing activities
  const lowEnergyOptions = [
    `cafenea liniștită în zona centrală a ${destinationName}`,
    `plimbare scurtă în parcul/localitatea apropiată de ${destinationName}`,
    `cină la hotel/cazare (serviciu în cameră)`,
    `viewpoint/ușor accesibil pentru relaxare în ${destinationName}`,
    ...(vacationType.includes('spa') || preferences.includes('relaxare') ? [`spa/local de wellness în ${destinationName}`] : []),
    `activitate scătoare de energie: lectură în bibliotecă locală`,
    `seară liberă la hotel cu film sau joc de societate`
  ].slice(0, 3);
  
  // Extra time suggestions - short activities
  const extraTimeSuggestions = [
    `explorare cartier istoric în ${destinationName}`,
    `piață locală de produse tradiționale`,
    `punct de vizitare pentru apus/landscape`,
    `food stop la truck de street food local`,
    `obiectiv secundar mai puțin cunoscut`,
    `plimbare pe marginea râului/lacului din apropiere`,
    `loc pentru foto cu panoramă urbană`,
    `experiție locală rapidă: degustare vin/paștele locale`
  ].slice(0, 3);
  
  // Backup pool - diverse alternatives for real problems
  const backupActivityPool = [
    // Atracție închisă
    `alternativă similară la atracția anulată: ${getDestinationSpecific('muzeu', 'muzeu')[0] || `un alt muzeu în ${destinationName}`}`,
    // Vreme schimbă
    `activitate indoor pentru schimbare bruscă de vreme: ${getDestinationSpecific('galerie', 'galerie')[0] || `o galerii de artă în ${destinationName}`}`,
    // Nu mai are energie
    `opțiune de odihnă: ${getDestinationSpecific('parc', 'parc')[0] || `un parc verde în apropiere`}`,
    // Transport durează prea mult
    `activitate la distanță de mers: explorare cartier pe jos în raza de 1km`,
    // Buget limitat
    `activitate gratuitoare: ${getDestinationSpecific('piață', 'piață')[0] || `piață locală pentru observare`}`,
    // Loc aglomerat
    `alternativă mai puțin cunoscută: ${getDestinationSpecific('monument', 'monument')[0] || `monument/localitate istorică mai puțin turistată`}`,
    // Vrea ceva spontan
    `activitate spontană: explorare fără plan, cu ghid local recomandat de hotel`,
    // Probleme tehnice
    `soluanță tehnică: utilizarea aplicației locale de transport/public transport`,
    // Obiectiv oversold
    `alternativă la obiectiv populare: ${getDestinationSpecific('parc tematic', 'parc')[0] || `un parc/zoo local`}`,
    // Schimbare de plan de ultima oră
    `plan B de rezervă: activitate recomandată de personalul hotelului/hostelului`
  ];
  
  return {
    rainyDayBackup: rainyDayBackup.join(', '),
    lowEnergyOptions: lowEnergyOptions.join(', '),
    backupActivityPool: backupActivityPool,
    extraTimeSuggestions: extraTimeSuggestions.join(', ')
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

function cleanMarkdown(text) {
  if (!text) return "";
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em")
    .replace(/__(.*?)__/g, "<strong>$1</strong>")
    .replace(/_(.*?)_/g, "<em>$1</em")
    .replace(/`(.*?)`/g, "<code>$1</code>");
}

function summarizeBudget(budgetText) {
  if (!budgetText) return null;
  const lines = budgetText
    .split(".")
    .map(s => s.trim())
    .filter(s => s.length > 10)
    .slice(0, 4);
  return lines;
}

function formatTipText(tip) {
  const cleaned = cleanMarkdown(tip);
  return cleaned;
}

function formatPlanSummary(plan, mode = "detailed") {
  const dayLines = (plan.days || [])
    .map(
      (day) =>
        `Ziua ${day.day}: ${day.title}\n- Dimineata: ${day.morning}\n- Pranz / dupa-amiaza: ${day.afternoon}\n- Seara: ${day.evening}`
    )
    .join("\n\n");
  const tips = (plan.tips || []).map((tip) => `- ${tip}`).join("\n");
  const lines = [
    plan.title,
    "",
    plan.summary,
    "",
    dayLines,
    "",
    "Buget estimat:",
    plan.estimatedBudget,
    "",
    "Sfaturi utile:",
    tips
  ];

  if (mode === "detailed" && plan.recommendedLocations?.length) {
    const locationLines = plan.recommendedLocations.map(l => `- ${l.name} (${l.category})`).join("\n");
    lines.push("", "Locatii recomandate:", locationLines);
  }

  return lines.filter(Boolean).join("\n");
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
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
          ([label, text], index) => `
            <div class="activity timeline-step">
              <span class="timeline-marker">${index + 1}</span>
              <div>
                <strong>${label}</strong>
                <p>${escapeHtml(text)}</p>
              </div>
            </div>
          `
        )
        .join("");

      const flexInfo = day.rainyOption || day.lowEnergyOption || day.optionalActivities
        ? `
            <div class="flexibility-info">
              <small><strong>Plan B:</strong> ${escapeHtml(day.rainyOption || "")}</small>
              <small><strong>Opțional:</strong> ${escapeHtml(day.optionalActivities || "")}</small>
            </div>
          `
        : "";

      return `
        <article class="day-card">
          <div class="day-card-header">
            <span class="day-number">Ziua ${escapeHtml(day.day)}</span>
            <h3>${escapeHtml(day.title)}</h3>
          </div>
          <div class="activity-grid timeline-list">${activities}</div>
          ${flexInfo}
        </article>
      `;
    })
    .join("");

  const tips = plan.tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("");
  const thingsToVerify = [
    "Programul obiectivelor si zilele de inchidere",
    "Vremea cu 24-48h inainte de plecare",
    "Transportul local si timpii reali intre opriri",
    "Biletele pentru atractiile populare",
    "Sarbatorile locale sau evenimentele speciale"
  ]
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
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
  const sourceText = plan.source === "gemini" ? "Gemini AI" : "Fallback local";
  const dayCount = Array.isArray(plan.days) ? plan.days.length : 0;
  const locationCount = Array.isArray(plan.recommendedLocations) ? plan.recommendedLocations.length : 0;

result.className = "result-content";
   result.innerHTML = `
     <div class="trip-header">
       <div class="trip-title-row">
         <div class="trip-actions">
           <span class="trip-kicker">Itinerariu personalizat</span>
           <label for="pdf-mode" class="pdf-mode-label">Mod PDF:</label>
           <select id="pdf-mode" class="pdf-mode-select">
             <option value="detailed">Detaliat</option>
             <option value="compact">Compact</option>
           </select>
           <button class="copy-summary-button" type="button" data-action="copy-summary">Copiaza sumar</button>
           <button class="export-pdf-button" type="button" data-action="export-pdf">Export PDF</button>
         </div>
       </div>
       <h3>${escapeHtml(plan.title)}</h3>
       <p>${escapeHtml(plan.summary)}</p>
       <div class="trip-snapshot" aria-label="Sumar itinerariu">
           <div class="snapshot-item">
             <span>Zile</span>
             <strong>${escapeHtml(dayCount)}</strong>
           </div>
           <div class="snapshot-item">
             <span>Locatii</span>
             <strong>${escapeHtml(locationCount)}</strong>
           </div>
           <div class="snapshot-item wide">
             <span>Buget</span>
             <strong>${escapeHtml(plan.estimatedBudget ? "Estimare inclusa" : "Nespecificat")}</strong>
           </div>
         </div>
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
   `;

const budgetSidebar = document.getElementById("budget-sidebar");
  const tipsSidebar = document.getElementById("tips-sidebar");
  if (plan.estimatedBudget) {
    const budgetMatch = plan.estimatedBudget.match(/(\d+(?:\s*\d+)*(?:\.\d+)?)\s*(EUR|RON|USD|GBP)/i);
    const budgetValue = budgetMatch ? budgetMatch[1].replace(/\s/g, '') : '';
    const currency = budgetMatch ? budgetMatch[2].toUpperCase() : '';
    const days = plan.days?.length || 1;
    const perDay = budgetValue ? Math.round(parseFloat(budgetValue) / days) : 0;
    
    budgetSidebar.innerHTML = `
      <div class="section-heading compact">
        <p class="eyebrow">Buget</p>
        <h3>Buget estimat</h3>
      </div>
      <div class="budget-dashboard">
        <div class="budget-summary">
          <div class="budget-amount">${budgetValue} ${currency}</div>
          <div class="budget-meta">${days} zile · aprox. ${perDay} ${currency}/zi</div>
        </div>
        <div class="budget-grid">
          <div class="budget-item">
            <span class="budget-icon">🏨</span>
            <div class="budget-item-content">
              <h4>Cazare</h4>
              <p>pensiuni, hosteluri sau B&B</p>
            </div>
          </div>
          <div class="budget-item">
            <span class="budget-icon">🚌</span>
            <div class="budget-item-content">
              <h4>Transport</h4>
              <p>transport public și taxiuri partajate</p>
            </div>
          </div>
          <div class="budget-item">
            <span class="budget-icon">🍽️</span>
            <div class="budget-item-content">
              <h4>Mâncare</h4>
              <p>local food, piețe, street food</p>
            </div>
          </div>
          <div class="budget-item">
            <span class="budget-icon">🛡️</span>
            <div class="budget-item-content">
              <h4>Rezervă</h4>
              <p>păstrează 15–20% pentru neprevăzute</p>
            </div>
          </div>
        </div>
        <button class="budget-details-toggle" type="button">Vezi detalii buget</button>
        <div class="budget-details">
          <p class="budget-short">${escapeHtml(plan.estimatedBudget)}</p>
        </div>
      </div>
    `;
  } else {
    budgetSidebar.innerHTML = `
      <div class="section-heading compact">
        <p class="eyebrow">Buget</p>
        <h3>Buget estimat</h3>
      </div>
      <div class="sidebar-empty">Nu exista informatii despre buget.</div>
    `;
  }
if (tipsSidebar) {
    const tips = plan.tips || [];
    const tipCards = tips.map((tip, i) => `
      <div class="tips-card" style="display: ${i === 0 ? 'block' : 'none'}">
        <div class="tips-counter">Sfat ${i + 1} / ${tips.length}</div>
        <div class="tips-content">${escapeHtml(tip)}</div>
      </div>
    `).join("");
    tipsSidebar.innerHTML = tips.length
      ? `<div class="section-heading compact">
           <p class="eyebrow">Sfaturi</p>
           <h3>Sfaturi utile</h3>
         </div>
         <div class="tips-carousel" data-tips-count="${tips.length}">
           <button class="tips-nav tips-prev" type="button" aria-label="Sfat anterior">←</button>
           <div class="tips-card-container">${tipCards}</div>
           <button class="tips-nav tips-next" type="button" aria-label="Sfat următor">→</button>
         </div>
         <div class="tips-dots">${tips.map((_, i) => `<button class="tips-dot ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Sfat ${i + 1}"></button>`).join("")}</div>`
      : `<div class="section-heading compact">
           <p class="eyebrow">Sfaturi</p>
           <h3>Sfaturi utile</h3>
         </div>
         <div class="sidebar-empty">Nu exista sfaturi disponibile.</div>`;
    tipsSidebar.dataset.currentTip = 0;
  }

if (plan.flexibility) {
    const flexContainer = document.createElement("section");
    flexContainer.className = "flexibility-full";
    flexContainer.innerHTML = `
      <div class="flexibility-header">
        <h3>Plan B & Flexibilitate</h3>
        <p class="flexibility-subtitle">Călătoriile se pot schimba rapid. Ai variante de rezervă pentru vreme rea, oboseală sau timp liber.</p>
      </div>
      <div class="flexibility-grid">
        <div class="flex-card" data-flex-card="rain">
          <div class="flex-card-inner">
            <div class="flex-card-face flex-card-front">
              <span class="flex-icon">☔</span>
              <h4>Dacă plouă</h4>
            </div>
            <div class="flex-card-face flex-card-back">
              <p class="flex-back-subtitle">Activități indoor</p>
              <ul class="flex-back-list">${plan.flexibility.rainyDayBackup.split(/[,.]+/).slice(0, 4).map(item => `<li>${escapeHtml(item.trim())}</li>`).join("")}</ul>
            </div>
          </div>
        </div>
        <div class="flex-card" data-flex-card="tired">
          <div class="flex-card-inner">
            <div class="flex-card-face flex-card-front">
              <span class="flex-icon">☕</span>
              <h4>Dacă ești obosit</h4>
            </div>
            <div class="flex-card-face flex-card-back">
              <p class="flex-back-subtitle">Alternative relaxate</p>
              <ul class="flex-back-list">${plan.flexibility.lowEnergyOptions.split(/[,.]+/).slice(0, 4).map(item => `<li>${escapeHtml(item.trim())}</li>`).join("")}</ul>
            </div>
          </div>
        </div>
        <div class="flex-card" data-flex-card="extra">
          <div class="flex-card-inner">
            <div class="flex-card-face flex-card-front">
              <span class="flex-icon">⏱</span>
              <h4>Dacă ai timp extra</h4>
            </div>
            <div class="flex-card-face flex-card-back">
              <p class="flex-back-subtitle">Idei rapide</p>
              <ul class="flex-back-list">${plan.flexibility.extraTimeSuggestions.split(/[,.]+/).slice(0, 4).map(item => `<li>${escapeHtml(item.trim())}</li>`).join("")}</ul>
            </div>
          </div>
        </div>
        <div class="flex-card" data-flex-card="backup">
          <div class="flex-card-inner">
            <div class="flex-card-face flex-card-front">
              <span class="flex-icon">🎒</span>
              <h4>Activități de rezervă</h4>
            </div>
            <div class="flex-card-face flex-card-back">
              <p class="flex-back-subtitle">Backup pool</p>
              <ul class="flex-back-list">${plan.flexibility.backupActivityPool.slice(0, 4).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
            </div>
          </div>
        </div>
      </div>
    `;
    const workspace = document.querySelector('.workspace');
    if (workspace) {
      workspace.parentNode.insertBefore(flexContainer, workspace.nextSibling);
    }
  }
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
             <button class="small-button" type="button" data-action="export-pdf-history" data-id="${item.id}">Export PDF</button>
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

   if (button.dataset.action === "export-pdf-history") {
     renderTrip(item.plan);
     setTimeout(() => {
       const mode = "detailed";
       document.body.classList.add(`pdf-mode-${mode}`);
       window.print();
       setTimeout(() => {
         document.body.classList.remove('pdf-mode-compact', 'pdf-mode-detailed');
       }, 1000);
     }, 100);
   }

   if (button.dataset.action === "delete") {
    saveHistory(history.filter((entry) => entry.id !== item.id));
    renderHistory();
  }
});

result.addEventListener("click", async (event) => {
   const button = event.target.closest("button[data-action='copy-summary']");
   if (!button || !currentPlan) return;

   const mode = document.getElementById('pdf-mode')?.value || 'detailed';
   try {
     await copyTextToClipboard(formatPlanSummary(currentPlan, mode));
     setMessage("Sumarul itinerariului a fost copiat.", "success");
   } catch {
     setMessage("Nu am putut copia sumarul. Incearca din nou.");
   }
 });

result.addEventListener("click", async (event) => {
   const button = event.target.closest("button[data-action='export-pdf']");
   if (!button || !currentPlan) return;

   const mode = document.getElementById('pdf-mode').value;
   try {
     // Add print mode class to body
     document.body.classList.add(`pdf-mode-${mode}`);
     // Trigger print dialog
     window.print();
   } catch (error) {
     setMessage("Nu am putut genera PDF-ul. Incearca din nou.");
   } finally {
     // Remove print mode classes
     document.body.classList.remove('pdf-mode-compact', 'pdf-mode-detailed');
   }
 });

clearHistoryButton.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  setMessage(currentPlan ? "Istoricul a fost sters." : "", "success");
});

result.addEventListener("click", (event) => {
    const toggle = event.target.closest(".tip-toggle");
    if (!toggle) return;

    const sidebar = toggle.closest(".sidebar-content");
    sidebar.classList.toggle("tips-expanded");
    toggle.textContent = sidebar.classList.contains("tips-expanded") ? "Ascunde sfaturi" : "Vezi toate sfaturile";
  });

document.addEventListener("click", (event) => {
    const tipNav = event.target.closest(".tips-nav");
    if (!tipNav) return;

    const carousel = tipNav.closest(".tips-carousel");
    const sidebar = carousel.closest(".sidebar-content");
    const tips = sidebar.querySelectorAll(".tips-content");
    const dots = sidebar.querySelectorAll(".tips-dot");
    const counter = sidebar.querySelector(".tips-counter");
    const tipsCount = parseInt(carousel.dataset.tipsCount);
    let currentIndex = parseInt(sidebar.dataset.currentTip) || 0;

    if (tipNav.classList.contains("tips-next")) {
      currentIndex = (currentIndex + 1) % tipsCount;
    } else {
      currentIndex = (currentIndex - 1 + tipsCount) % tipsCount;
    }

    sidebar.dataset.currentTip = currentIndex;

    const tipCards = sidebar.querySelectorAll(".tips-card");
    tipCards.forEach((card, idx) => {
      card.style.display = idx === currentIndex ? "block" : "none";
    });

    dots.forEach((dot, idx) => {
      dot.classList.toggle("active", idx === currentIndex);
    });

    counter.textContent = `Sfat ${currentIndex + 1} / ${tipsCount}`;
  });

  document.addEventListener("click", (event) => {
    const tipDot = event.target.closest(".tips-dot");
    if (!tipDot) return;

    const sidebar = tipDot.closest(".sidebar-content");
    const index = parseInt(tipDot.dataset.index);
    const tipsCount = parseInt(sidebar.querySelector(".tips-carousel").dataset.tipsCount);
    const counter = sidebar.querySelector(".tips-counter");
    const dots = sidebar.querySelectorAll(".tips-dot");

    sidebar.dataset.currentTip = index;

    const tipCards = sidebar.querySelectorAll(".tips-card");
    tipCards.forEach((card, idx) => {
      card.style.display = idx === index ? "block" : "none";
    });

    dots.forEach((dot, idx) => {
      dot.classList.toggle("active", idx === index);
    });

    counter.textContent = `Sfat ${index + 1} / ${tipsCount}`;
  });

  document.addEventListener("click", (event) => {
    const budgetToggle = event.target.closest(".budget-details-toggle");
    if (budgetToggle) {
      const details = budgetToggle.nextElementSibling;
      details.classList.toggle("expanded");
      budgetToggle.textContent = details.classList.contains("expanded") ? "Ascunde detalii" : "Vezi detalii buget";
    }
  });

  document.addEventListener("click", (event) => {
    const flexCard = event.target.closest(".flexibility-full .flex-card");
    if (!flexCard || event.target.closest(".flex-card-back")) return;
    flexCard.classList.toggle("flipped");
  });

renderHistory();

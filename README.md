# AI Travel Planner

Aplicatie web statica in HTML, CSS si JavaScript care genereaza itinerarii de vacanta in limba romana. Aplicatia functioneaza gratuit cu un generator local, direct in browser.

## Functionalitati

- Formular pentru destinatie, numar de zile, buget, tip de vacanta, preferinte si detalii extra.
- Generare itinerariu detaliat pe zile cu activitati dimineata, pranz/dupa-amiaza si seara.
- Recomandari de locatii pentru destinatii populare, cu scor calculat dupa preferinte si link direct catre Google Maps.
- Itinerariu mai realist, cu opriri distribuite pe zile fara repetari.
- Estimare de buget si sfaturi utile.
- Istoric salvat in browser cu `localStorage`.
- Mod gratuit fara cheie API, prin generator local.

## Rulare locala

1. Instaleaza dependentele:

```powershell
npm install
```

2. Porneste aplicatia local cu serverul Node inclus:

```powershell
npm run dev
```

3. Deschide:

```text
http://localhost:3000
```

Aplicatia functioneaza gratuit si nu are nevoie de `.env` sau cheie API.

Optional, pentru a testa exact mediul Vercel:

```powershell
npm run vercel:dev
```

## Deploy pe Vercel

1. Incarca proiectul pe GitHub.
2. Creeaza un proiect nou in Vercel si conecteaza repository-ul.
3. Ruleaza deploy-ul.

# AI Travel Planner

Aplicatie web in HTML, CSS si JavaScript care genereaza itinerarii de vacanta in limba romana. Aplicatia functioneaza gratuit cu un generator local si poate folosi optional OpenAI API printr-o functie server-side Vercel.

## Functionalitati

- Formular pentru destinatie, numar de zile, buget, tip de vacanta, preferinte si detalii extra.
- Generare itinerariu detaliat pe zile cu activitati dimineata, pranz/dupa-amiaza si seara.
- Estimare de buget si sfaturi utile.
- Istoric salvat in browser cu `localStorage`.
- Mod gratuit fara cheie API, prin generator local.
- OpenAI API optional, fara expunerea cheii in frontend.

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

Aplicatia functioneaza gratuit si fara `.env`. Daca vrei sa folosesti OpenAI API real mai tarziu, creeaza fisierul `.env` pornind de la `.env.example`:

```powershell
copy .env.example .env
```

si adauga cheia:

```env
OPENAI_API_KEY=sk-...
```

Optional, pentru a testa exact mediul Vercel:

```powershell
npm run vercel:dev
```

## Deploy pe Vercel

1. Incarca proiectul pe GitHub.
2. Creeaza un proiect nou in Vercel si conecteaza repository-ul.
3. Optional, adauga variabila de mediu `OPENAI_API_KEY` in setarile proiectului Vercel daca vrei generare OpenAI reala.
4. Ruleaza deploy-ul.

## Endpoint API

`POST /api/generate-trip`

Body:

```json
{
  "destination": "Barcelona",
  "days": 5,
  "budget": "800 EUR",
  "vacationType": "city break",
  "preferences": ["muzee", "gastronomie"],
  "extraDetails": "Vreau sa folosesc transport public."
}
```

Raspunsul contine titlu, rezumat, zilele itinerariului, buget estimat si sfaturi. Daca nu exista `OPENAI_API_KEY`, endpoint-ul foloseste automat generatorul local gratuit.

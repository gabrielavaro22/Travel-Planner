---
title: 'Light vibrant travel homepage redesign'
type: 'feature'
created: '2026-05-12'
status: 'done'
baseline_commit: '9cfbacca7a71f1af0f99df2ee5222b927c17da42'
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-design-specification.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The current AI Travel Planner visual direction is dark, premium, and cinematic, but the approved UX direction is now light, vibrant, fresh, friendly, and travel-inspired. The app should feel easier to scan and more optimistic while preserving the exact existing product flow and functionality.

**Approach:** Refresh the homepage styling through the existing custom lightweight HTML/CSS/JavaScript design system. Keep the current DOM structure and application logic intact, but update the visual language of the hero, planner form, weather widget, generated itinerary, budget dashboard, tips flashcards, Plan B cards, recommended places, and history section with a bright travel palette, soft cards, pastel badges, airy spacing, and accessible light-theme contrast.

## Boundaries & Constraints

**Always:** Preserve the existing AI Travel Planner flow: user enters trip details, generates itinerary, views itinerary, weather, budget, tips, Plan B, recommended places, and history. Keep the app lightweight and suitable for Vercel. Use a custom CSS-based design system, not a full UI framework. Keep responsive behavior for desktop, tablet, and mobile. Keep text concise and scannable. Use color intentionally: coral/orange for primary action, turquoise/ocean blue for supporting information, and small yellow/green accents only where helpful.

**Ask First:** Ask before changing HTML structure beyond small class or asset-version updates. Ask before adding external libraries, replacing images, changing content wording broadly, or removing any visual component.

**Never:** Do not modify backend files, Gemini integration, Geoapify integration, Open-Meteo/weather logic, localStorage/history behavior, API endpoints, itinerary generation logic, or existing user-facing features. Do not rebuild the app from scratch. Do not introduce a dark-mode toggle or a full component framework. Do not make the palette chaotic or dominated by a single hue.

</frozen-after-approval>

## Code Map

- `styles.css` -- primary implementation surface for the light visual redesign, tokens, components, layout colors, cards, buttons, form fields, weather, result, budget, tips, Plan B, locations, and history styling.
- `index.html` -- only acceptable for cache-busting stylesheet/script version query updates if needed; no structural rewrite planned.
- `app.js` -- should remain behaviorally unchanged; only inspect if generated class names require matching CSS.

## Tasks & Acceptance

**Execution:**
- [x] `styles.css` -- replace dark-theme design tokens with light travel-inspired tokens and adjust global background/text/line/shadow variables -- establishes the new visual identity while preserving component selectors.
- [x] `styles.css` -- restyle hero/topbar/buttons/nav to feel bright, airy, travel-inspired, and professional -- updates the first impression without altering hero structure.
- [x] `styles.css` -- restyle planner form, inputs, chips, integrated weather widget, and sidebar panels with white/off-white cards, coral actions, turquoise support accents, visible focus states, and soft shadows -- aligns the main planning area with the approved direction.
- [x] `styles.css` -- restyle generated result cards, itinerary sections, budget mini-dashboard, tips flashcards, Plan B flip cards, recommended places, and history cards with a consistent light card system and pastel category accents -- makes generated output easier to scan.
- [x] `styles.css` -- update responsive and print-safe styles only where existing dark assumptions would break readability -- keeps desktop, tablet, and mobile polished.
- [x] `index.html` -- update asset query strings only if needed so Vercel/browser cache loads the new CSS -- ensures the live app reflects the redesign.

**Acceptance Criteria:**
- Given the homepage loads, when the user views the app, then the overall impression is light, vibrant, fresh, friendly, and travel-inspired rather than dark/cinematic.
- Given the planner form is visible, when the user scans it, then the card, inputs, chips, primary button, and weather widget use the same bright design language and remain easy to read.
- Given an itinerary has been generated, when the user reviews results, then itinerary, weather, budget, tips, Plan B, recommended places, and history remain present and visually consistent.
- Given the app is used on mobile, when the layout stacks, then tap targets, text contrast, and card spacing remain readable and usable.
- Given the implementation is complete, when code is reviewed, then no backend, API, Gemini, Geoapify, Open-Meteo, localStorage, or itinerary-generation logic has changed.

## Design Notes

The approved palette should move toward warm white/cream/pale-sky backgrounds, deep navy or charcoal text, coral/orange primary actions, turquoise/ocean blue secondary support, and small sunny yellow/soft green accents. Cards should be white or off-white with soft shadows and subtle light borders. Category chips and badges should feel pastel and travel-friendly, not neon. Red/orange should guide action; blue/teal should support informational elements such as weather and map/location surfaces.

## Verification

**Commands:**
- `node --check app.js` -- expected: JavaScript remains syntactically valid because behavior should not change.
- `git diff --check` -- expected: no whitespace or patch-format issues.
- `git diff --name-only` -- expected: only `styles.css` and optional `index.html` changed.

**Manual checks:**
- Open the app locally and inspect the hero, planner form, weather widget, generated result area, budget sidebar, tips, Plan B cards, recommended locations, and history section in desktop and narrow/mobile widths.

## Suggested Review Order

**Light Theme Foundation**

- Start with the token layer that turns the app light and travel-inspired.
  [`styles.css:1816`](../../styles.css#L1816)

- Hero keeps the existing image but changes the mood with light overlays.
  [`styles.css:1869`](../../styles.css#L1869)

**Planner And Weather**

- Planner form becomes an airy off-white card with travel accents.
  [`styles.css:1942`](../../styles.css#L1942)

- Focus states stay visible for keyboard users in the light theme.
  [`styles.css:1992`](../../styles.css#L1992)

- Weather widget uses the ocean accent as a supporting mini-card.
  [`styles.css:2031`](../../styles.css#L2031)

**Generated Results**

- Budget cards get pastel category treatments.
  [`styles.css:2100`](../../styles.css#L2100)

- Trip header and snapshot shift to soft cream/white cards.
  [`styles.css:2213`](../../styles.css#L2213)

- Recommended places use rotating pastel card colors.
  [`styles.css:2240`](../../styles.css#L2240)

- Plan B cards move to a pale sky treatment.
  [`styles.css:2192`](../../styles.css#L2192)

**Support And Cache**

- Print hides sidebar and interactive flip-card surfaces.
  [`styles.css:2321`](../../styles.css#L2321)

- Stylesheet cache key forces Vercel/browser refresh.
  [`index.html:8`](../../index.html#L8)

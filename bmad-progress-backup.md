# BMAD Progress Backup — AI Travel Planner

## Product goal
AI Travel Planner is a responsive web application that helps users generate personalized travel itineraries from a simple trip-planning form.

The app should remain an AI Travel Planner, not become a travel agency or booking website.

## Existing core features to preserve
- Navbar with Planifică and Istoric
- Trip planning form
- Destination input
- Number of days input
- Budget input
- Vacation type selector
- Preferences input/selection
- Additional details field
- Generate itinerary button
- AI/fallback itinerary generation
- Generated itinerary display
- Saved itinerary history using browser/localStorage
- Clear history action

## Core experience
Users enter travel preferences, generate an itinerary, review the plan, save it to history, and optionally generate another one.

Core loop:
Enter trip details → Generate itinerary → Review itinerary → Save to history → Adjust or generate again.

## Primary user action
The most important action is generating a personalized itinerary from the form.

This interaction must feel:
- fast
- reliable
- clear
- personalized
- visually pleasant

## Platform
Primary platform:
- Web application

Supported devices:
- Desktop/laptop
- Tablet
- Mobile browser

Interaction:
- Mouse and keyboard on desktop
- Touch-friendly controls on mobile/tablet

Offline:
- Full offline support is not required
- Saved history can remain available through localStorage
- New itinerary generation requires internet/API access

## Emotional goals
Users should feel:
- inspired
- confident
- in control
- calm
- delighted

Before using the app:
“I don’t know how to organize this trip.”

After using the app:
“I have a clear and personalized travel plan.”

## UX inspiration
### Google Maps
Use as inspiration for clarity, speed, reliability, and actionable travel information.

### Booking.com
Use as inspiration for filtering, comparison, user control, and confidence.

### Airbnb
Use as inspiration for visual discovery, destination cards, emotional browsing, and travel inspiration.

Travel Planner should feel:
- as clear as Google Maps
- as controllable as Booking.com
- as visually inspiring as Airbnb

## Redesign direction
The homepage should be inspired mainly by the “Visit New Zealand” reference:
- cinematic dark hero
- large travel background image
- bold white/red title
- clear CTA button
- scroll to planning form
- recommended locations carousel
- modern cards
- responsive layout

The planning form should:
- preserve all current fields and behavior
- use a premium dark/glassmorphism card design
- keep all existing IDs/classes needed by JavaScript unless updated carefully
- be easy to use on mobile

The generated itinerary should:
- preserve existing generated data
- preserve generation logic
- display results more beautifully
- use cards/timeline/day sections
- avoid adding unrelated booking/tour package features

The history section should:
- preserve localStorage logic
- display saved itineraries as modern cards
- keep clear history functionality

## Design system decision
No new CSS framework for now.

Use the existing frontend stack and plain CSS/custom CSS.

Recommended CSS approach:
- CSS variables
- reusable utility/component classes
- responsive media queries

Main colors:
- black
- white
- dark gray
- red accent

Components:
- navbar
- hero
- CTA buttons
- recommendation carousel
- planning form card
- itinerary result cards
- history cards

## Constraints
Do not:
-change the functions, expecially the APY GEMINI KEY
- rewrite the app from zero
- modify backend unless absolutely necessary
- modify API endpoints
- modify itinerary generation logic
- modify localStorage/history behavior
- modify generated data structure
- add booking/payments/flights/hotels/guides/about-the-tour functionality
- turn the app into a travel agency website

## Suggested implementation epics
### Epic 1 — Homepage redesign
- Story 1.1: Cinematic hero section
- Story 1.2: CTA scroll to planning form
- Story 1.3: Recommended locations horizontal carousel

### Epic 2 — Planning form redesign
- Story 2.1: Dark glassmorphism form card
- Story 2.2: Modern inputs/selects/textareas
- Story 2.3: Mobile responsive form layout

### Epic 3 — Generated itinerary redesign
- Story 3.1: Itinerary summary card
- Story 3.2: Day-by-day itinerary cards or timeline
- Story 3.3: Better visual hierarchy for generated content

### Epic 4 — History redesign
- Story 4.1: Saved itinerary cards
- Story 4.2: Styled clear history action
- Story 4.3: Empty history state

## Recommended implementation workflow
1. Implement only one story at a time
2. Test existing functionality after every story
3. Commit after each working step
4. Do not apply the full redesign in one large change
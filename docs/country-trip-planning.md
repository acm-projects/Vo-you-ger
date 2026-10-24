# Country trip planning: implementation walkthrough

For the current frontend rollback, backend API handoff and verification status, start with [Simple travel flow](simple-travel-flow.md). This document also retains API walkthrough examples.

The changes are on `feature/country-trip-planning`. For the current worldwide registry, deterministic matching, direct-country API, provider limits and persistence contract, read [Worldwide planning](worldwide-planning.md). This walkthrough follows the existing user flow.

## 1. Configure and run the existing app

No new backend dependencies or DynamoDB indexes are required. The frontend additions and their globe/browser-test dependencies have been rolled back. Keep the existing server environment configuration: DynamoDB table/region and AWS credentials, JWT secret, Gemini key/model configuration, Google Places key, and visa-service configuration when visa-free filtering is requested. Do not put server keys in the client.

Run the backend from `server`:

```sh
npm run dev
```

Run the frontend from `client`, in another terminal:

```sh
npm run dev
```

The frontend uses `http://localhost:8080/api` by default. A client `.env.local` may set `VITE_API_URL` for another API origin; update the server's existing CORS configuration for another frontend origin as needed.

The original frontend pages have been restored, including the assessment, loading screen and recommendation cards. They retain their prior prototype behavior. The following walkthrough describes the retained backend API; integrating it into those existing designs is a separate task. No replacement planner or globe UI remains active.

Users provide an arrival date and number of nights. Days mean **calendar days at the destination**, including light arrival and departure days. Four nights means five days. International travel is additional. The shared policy supports 1–21 days, including zero-night one-day visits.

## 2. Review the planning catalog

Code: `server/data/destinations.json`, `server/data/planningCatalog.json`, and `server/services/planningDataService.js`.

`destinations.json` is now the source of truth for both destination facts and overnight-base readiness. Country identity comes from `countries.json`; operational availability is derived from enabled, verified bases. There is no separate planning country allowlist.

```json
{
  "id": "dublin-ie",
  "name": "Dublin",
  "type": "city",
  "country": "Ireland",
  "countryCode": "IE",
  "planning": {
    "enabled": true,
    "lat": 53.3498,
    "lng": -6.2603,
    "region": "Dublin area",
    "minNights": 3,
    "radiusKm": 15,
    "locationPrecision": "approximate_city_center"
  }
}
```

The example omits existing interest, budget, seasonality, safety, and practical-information fields. Those remain in the same destination record. Enabled location anchors are verified GeoNames points; they define conservative search areas rather than official city boundaries. Stay minima and search radii are editorial planning rules.

`planningCatalog.json` now contains sourced domestic connections, excursions, and optional `countryOverrides` for country display names and pin positions. The overrides are **not an allowlist**. Countries without a display override use the first enabled base as a representative pin location. The previously duplicated base list has been removed from this file.

The worldwide registry has 249 ISO entries and the dataset has 1,227 destination records, including 1,186 gazetteer-verified records. Five verified settlements are present for 224 countries/territories; 25 have explicit exceptions/source gaps. There are currently **62 enabled countries/territories and 88 overnight bases**; 187 registry entries have no enabled base. Previously present codes still lacking enabled base metadata include JO, MV, CR, ZW, NA, and MU. Switzerland now has five separately reviewed city bases. Broad records such as the Swiss Alps or an entire island country are not automatically treated as a specific overnight location. Argentina currently supports Buenos Aires only; broad Patagonia records remain excluded.

The planner has **26 domestic connections and 44 multi-city combinations: 26 pairs, 11 triples, five four-city and two five-city combinations**. This counts combinations without direction, at durations long enough to fit, before assessment constraints. Fifteen countries support multiple bases; many others support single-base trips only. France and Switzerland each have a reviewed five-base route for 21-day trips. New sources and review limitations are documented in [SOURCES.md](../server/data/SOURCES.md).

Each connection stores its source URL and review date. New sources include [Amtrak](https://www.amtrak.com/northeast-regional-train), [VIA Rail](https://www.viarail.ca/en/explore-our-destinations/trains/ontario-and-quebec/montreal-quebec-city), [Poland's infrastructure ministry](https://www.gov.pl/web/infrastruktura/regularne-godziny-kursowania-i-wiecej-polaczen-do-najwiekszych-miast-w-kraju-pkp-intercity-zaprezentowaly-rozklad-jazdy-20262027), [Tourism New Zealand](https://traveltrade.newzealand.com/training-and-inspiration/explore-nz-discount-program/explore-itineraries/6-days-rotorua-taupo-waikato/), and [Chile Travel](https://chile.travel/destinos/valparaiso/). Planning-minute values remain conservative editorial allowances, not sourced live journey times or service guarantees.

To expand operational coverage, geographically verify a concrete destination, review travel attributes and document their provenance, then set an eligible review status, `planning.enabled: true`, a minimum stay and a search radius. Geographic-only imports remain disabled. Its country becomes available automatically. Add a supported domestic connection separately to enable multi-base routes. A country name alone is not enough, and geographic proximity does not prove a usable transport connection.

To see current counts without manually counting JSON entries, run from `server`:

```sh
npm run planning:coverage
```

## 3. Generate country recommendations

Code:

- `server/services/countryRecommendationService.js` and `countryScoringService.js`
- `server/services/tripOutlineService.js` → `countryCandidates`
- `server/controllers/recommendationController.js` → `createRecommendations`
- `server/models/tripModel.js` → `createTrip`

The backend applies hard visa, budget, minimum stay and safety constraints and deterministically ranks the quality of each country's best bounded feasible route. Exactly three fixed country IDs are supplied to Gemini for explanations only. Invalid explanation output or provider outages retain the selected IDs and use deterministic fallback text. Fewer than three eligible countries returns HTTP 422; eligibility is never relaxed to fill the list.

New country trips have `schemaVersion: 2`, with recommendation IDs such as `country-es`. Older saved city trips retain their existing handling. Country recommendations are the new default, so any other consumers of the recommendation API must expect country IDs.

Example authenticated requests (JSON bodies; add `Authorization: Bearer YOUR_TOKEN` in your API client):

```http
POST /api/quiz
Content-Type: application/json

{
  "minNights": 6,
  "maxNights": 6,
  "startDate": "2027-05-08",
  "dailyBudget": "$$",
  "riskTolerance": 3,
  "travelAlterEgo": "Foodie",
  "seeAllOrDeeply": "seeAll",
  "intercityTransportModes": ["train"],
  "willingToGetVisa": true
}
```

```http
POST /api/recommendations
Content-Type: application/json

{}
```

Keep the returned `trip.tripId` and choose a `destinationId` from its recommendations. The next requests must use an actually recommended country, not an arbitrary catalog ID.

## 4. Preview the trip outline

Code:

- `server/services/tripOutlineService.js` → `buildOutline`, `validateOutline`
- `server/controllers/countryTripController.js` → `previewCountryRoute`
- `server/routes/tripRoutes.js`

```http
POST /api/trips/YOUR_TRIP_ID/route
Content-Type: application/json

{
  "countryId": "country-pt",
  "numberOfNights": 6,
  "startDate": "2027-05-08"
}
```

The planner is deterministic. API consumers can preview the automatic route or generate it directly as part of itinerary generation. It searches complete supported domestic routes with a bounded beam before selecting a starting city. Routes compete on quiz interest scores, seasonal fit, variety, and the time consumed changing bases. Four-day trips use one base. Five-day trips may use two bases when minimum stays fit. Trips of 10–15 days may use up to three bases, 16–20 up to four, and 21 up to five; minimum stays and actual connections can require fewer. `seeAllOrDeeply: "deeply"` keeps one overnight base and can still include a nearby day trip.

Nights start at each base's curated minimum; remaining nights go toward balancing stays and traveler fit. Explicit `intercityTransportModes` controls connections independently of transport used to reach the country. Older assessments fall back to `transportModes`. No supported connection means no transfer; the model does not invent one.

The output contains stops, nights, day allocation, transfers, and arrival/departure destinations. Two-base trips may depart from a different base; the overview states this rather than silently assuming return travel to the first base.

Preview is read-only. Nothing is saved or invalidated here. `numberOfNights` is the preferred explicit duration, within the saved quiz's night bounds. `numberOfDays` remains a compatibility option; contradictory values are rejected. The arrival date is used for seasonal scoring. Use the same override when requesting the itinerary; otherwise both calls use the saved duration. Arbitrary stop editing is not exposed in this version.

For a five-day Argentina trip, the result is one Buenos Aires base with four nights and no intercity transfers.

## 5. Discover real activities for each base

Code:

- `server/services/stopDiscoveryService.js`
- Existing query builder, Google Places client, place normalizer, geographic grouping, and neighborhood recommendation services

The server runs the existing discovery pipeline for each base and scheduled excursion location, requests up to 15 results per category and caps each location at 36 unique candidates, then filters places by returned country code and distance from the base. Missing or inconsistent locations are excluded. Every candidate carries a `stopId` (overnight base) and `locationId` (actual visit location). A day-trip venue cannot be used on an ordinary base day.

The existing places endpoint supports country selection:

```http
POST /api/recommendations/YOUR_TRIP_ID/places
Content-Type: application/json

{
  "countryId": "country-pt",
  "numberOfNights": 6,
  "startDate": "2027-05-08"
}
```

It returns `{ tripId, outline, stops }`, with candidates, groups, and neighborhood suggestions per location. Excursion entries retain their parent overnight `stopId` and have a separate `locationId`. `destinationId` is also accepted as an alias for country selection. Legacy city trips retain the previous response format.

This discovery request is optional. Itinerary generation performs its own server-side discovery, so calling both repeats external work. There is no place cache in this version. The Google key must support the existing Places Text Search API and billing. Unknown dietary suitability, prices, and availability are not converted into verified facts.

## 6. Build and validate the daily itinerary

Code:

- `server/schemas/countryItinerarySchema.js`
- `server/services/countryItineraryService.js`
- `server/services/dailyPlanService.js`
- `server/services/venueHoursService.js`
- `server/controllers/countryTripController.js` → `createCountryItinerary`
- `server/controllers/itineraryController.js` → country dispatch

```http
POST /api/itinerary/YOUR_TRIP_ID
Content-Type: application/json

{
  "countryId": "country-pt",
  "numberOfNights": 6,
  "startDate": "2027-05-08"
}
```

A real `startDate` is required for country itinerary generation, either in the request or saved assessment. The server assigns the calendar, overnight base, and allowed activity slots before generation. Arrival/transfer days allow at most one evening suggestion; departure allows at most one morning suggestion. Full days allow one to four activities, capped at three for relaxed travelers. Empty slots are intentionally unscheduled time. Supported excursions (Sintra from Lisbon, Versailles from Paris, and Nara from Kyoto) reserve morning/evening for return travel and allow one or two afternoon suggestions at the excursion location. Each excursion requires at least four nights at its parent base. Excursions do not create accommodation changes; their venues do not influence stay-area ranking for the base.

The backend reserves one distinct open venue for each sightseeing day before filling extras, using matching to avoid starving scarce days. It respects hours, slot capacity, pace and pairwise geography. Gemini only rewrites the title, summary, themes and descriptions of this fixed plan. It cannot change venue IDs or time slots. The independently validated plan rejects:

- Wrong day count/order or wrong stop assignment.
- Unknown, duplicate, or wrong-stop venue IDs.
- Sightseeing in reserved travel windows or overpacked days.
- A day's venues spread more than eight kilometers apart in straight-line distance.
- Known closed days or recognized regular hours with no overlap with the proposed slot.

Dates and canonical names, addresses, coordinates, ratings, and opening hours come from the server or Google data. Stay areas are ranked from neighborhood labels associated with the actual scheduled activities. Missing area data produces `null` with an explanation, not an invented neighborhood. There are no hotel selections or booking details.

`hoursCheck: "regular_hours_overlap"` checks overlap with a broad slot; it does not prove an entire visit fits. Unknown or unparseable hours remain `unknown`. Holidays, reservations, accessibility, dietary suitability, and descriptive model text are not independently verified. Transport remains a mode suggestion with an approximate planning allowance.

The narrative request allows at most two HTTP attempts on distinct models, with time reserved for fallback and no SDK retries. Defaults are a 90-second total budget and a 90-second per-attempt ceiling. The first of two attempts gets at most half the total budget; the fallback can use unused time after a fast failure. If Gemini changes the schedule, returns invalid text/JSON or is unavailable, validated neutral descriptions are used with `narrativeSource: "deterministic_fallback"` and a safe `narrativeFallbackReason`. No model error can remove venues, overpack a day or block an otherwise valid itinerary. Genuine venue/hour shortages return `INSUFFICIENT_VENUES` (422) before the narrative call; no invented venues are persisted. Storage still refuses invalid plan structures.

## 7. Save, display, and reopen

Code:

- `client/src/services/api.js`
- `server/controllers/tripController.js`
- `server/services/tripSummaryService.js`

The backend exposes country recommendations, automatic route outlines, expandable-day data, area advice and save/reopen actions. The original frontend design is restored; connecting these contracts to its pages is pending frontend integration.

Outline, dates, app-authored text and Place IDs are stored together under `trip.itinerary`: a single conditional put for a new draft or a conditional update for an existing draft. Raw Google venue fields and provider-derived neighborhood lists are omitted from new schema-v2 persistence. On reopening a day, fetch `GET /api/trips/:tripId/days/:day/places` for fresh names, addresses, hours and area suggestions. The fresh generation response contains richer transient data. Stored structure:

```js
{
  schemaVersion: 2,
  destination: "Portugal",
  countryCode: "PT",
  outline: { stops: [], transfers: [], numberOfDays: 7, numberOfNights: 6 },
  stays: [],
  days: [],
  tripSummary: { countryCode: "PT", displayTitle: "Portugal — May 2027", startDate: "2027-05-08", numberOfNights: 6 },
  planningNotes: []
}
```

The existing save endpoint remains:

```http
PUT /api/trips/YOUR_TRIP_ID/save
```

Unsaving still preserves the itinerary. Existing city-based saved records remain readable without a migration. Country stays and transfers use the new nested format; consumers must not assume one top-level `recommendedStayArea`.

Generating again from an already saved country trip creates a new unsaved draft and returns its new `tripId`. The original saved itinerary remains intact. This lets users retain multiple trips to the same country rather than overwriting a globe entry. Generation on an unsaved draft continues to update that draft.

## Globe data endpoint

```http
GET /api/trips/globe
Authorization: Bearer YOUR_TOKEN
```

The response has `countries`, `unmappedTrips`, and `tripCount`. Each country contains a representative display `pin`, its country code/name, and lightweight trip summaries. Multiple saved trips in the same country share one pin. Summaries use titles such as `France — June 2027`; month/year labels avoid guessing a season across hemispheres. Selecting a trip then calls `GET /api/trips/:tripId` for the full itinerary.

New itineraries store `tripSummary` atomically with the outline and days. The globe query projects summary/outline metadata rather than activity arrays, and follows DynamoDB pagination even when a filtered page is empty. Older records fall back to known destination/country fields and the first date; missing durations remain unknown. Countries outside the planning catalog may return `pin: null` for the frontend to resolve from its country map; records with no resolvable country appear in `unmappedTrips`.

This endpoint supplies the data contract for a future globe and side panel; the replacement frontend implementation was rolled back. Projection reduces response payload, not DynamoDB read capacity. A dedicated summary record/index can be added later if necessary.

## 8. Verify your changes

From `server`:

```sh
npm test
```

From `client`:

```sh
npm run build
npx eslint src/services/api.js src/App.jsx
```

`server/test/countryPlanning.test.js` covers geographic feasibility, nights versus days, restricted transport, strict eligibility, calendar validation, reserved transfer windows, wrong-stop/invented venues, hours conflicts, neighborhood fallback, geographic filtering, ownership, and mocked discovery-to-persistence integration. Existing recommendation fixtures now return country IDs. Existing city itinerary and saved-trip tests remain in place.

Automated tests mock paid external APIs and DynamoDB, including the HTTP lifecycle test. October 24 live checks passed a structured Gemini response and a seven-day Portugal itinerary with real Google venues, two bases, 19 activities and accepted Gemini copy. Storage projection passed; no live database writes or venue refresh were performed. See [current verification](planning-reliability-verification.json) and the [terminal walkthrough](backend-flow-testing.md). Earlier provider failures remain recorded in the historical reports.

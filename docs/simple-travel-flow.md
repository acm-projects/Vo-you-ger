# Backend handoff with the original frontend

The frontend redesign has been rolled back at the user's request. The original
landing page, navbar, assessment, loading screen and recommendation-card layout
are restored. The replacement planner, rotating globe, sidebar, assessment form,
CSS, globe data and UI-specific browser tests were removed. No new frontend
runtime or test dependencies remain. Compatible dependency security patches stay
in the lockfile without changing the UI.

The existing `client/src/services/api.js` retains the backend API helpers. The
login page's missing `validation.js` reference is corrected to the existing
`validation.jsx`; the login/signup and assessment layouts are unchanged.

The original assessment and recommendation cards retain their earlier prototype
behavior. Connecting those existing designs to the backend is a separate frontend
integration task. This rollback does not claim that the old screens now save an
assessment or display live country recommendations.

## Backend retained

All 100 server files were verified byte-for-byte unchanged during the frontend
rollback. The backend still provides:

- Assessment storage and deterministic top-three country recommendations.
- Single-country route planning that applies preferences, duration, budget,
  safety and visa constraints; relaxed trips retain one base.
- A deterministic daily scheduler that reserves open, distinct venues, enforces
  activity counts/travel windows and keeps every pair of same-day venues within
  eight kilometers. Structured Gemini prompts describe this fixed plan only;
  malformed or unavailable narrative output retains validated neutral copy.
- Google-grounded activities/restaurants, neighborhood advice and supported
  transport modes/allowances, without hotel, flight or train bookings.
- Owner-protected draft generation, save/unsave, saved-trip summaries and day-level
  venue refresh. Saved-trip regeneration forks a new draft.
- Country facts, flags and licensed photo references for all 249 ISO entries,
  independently of planning availability. Planning remains available in 62
  countries, with 88 bases and 44 multi-city combinations across 15 countries.

## Contracts for the existing frontend

| Endpoint | Purpose |
|---|---|
| `POST /api/quiz` | Save assessment answers |
| `POST /api/recommendations` | Obtain three supported country choices |
| `POST /api/itinerary/:tripId` | Generate the selected recommended country |
| `POST /api/countries/:code/itinerary` | Generate directly using saved preferences |
| `GET /api/countries` | Public country summaries and planning flags |
| `GET /api/countries/:code` | Public facts, photo credits and planning availability |
| `GET /api/trips/globe` | Saved trips grouped by country for future pins |
| `GET /api/trips/:tripId` | Retrieve the owner's saved itinerary |
| `GET /api/trips/:tripId/days/:day/places` | Refresh venue metadata for an expanded day |
| `PUT /api/trips/:tripId/save` | Save a generated itinerary |
| `DELETE /api/trips/:tripId/save` | Unsave while retaining the itinerary |

When the frontend is integrated, show country information for every selection,
show planning controls only for `planningAvailable: true`, and retain access to
existing saved trips even when that country is no longer supported. The backend
also enforces eligibility; hiding the button is not the authorization boundary.
New schema-v2 saved itineraries contain Place IDs and authored text. Consumers
must fetch current venue names, addresses and area suggestions through the day
endpoint and display the required Google Maps/third-party attribution.

Country information comes from local GeoNames and Wikimedia metadata snapshots;
it does not invoke paid providers at request time. `SOURCES.md` records provenance,
licenses and the importer. Its optional display-asset generation can recreate the
archived globe geometry later, when a globe UI is deliberately integrated.

## Verification and remaining integration

- All 311 JavaScript tests across 45 suites pass. They cover empty/overpacked model
  output, invented/repeated IDs, wrong bases/travel slots, provider outages,
  scarce-day venue allocation and more than 700 country/duration/pace cases.
- HTTP regression tests exercise the production itinerary, Google discovery,
  Gemini SDK, storage projection, save and retrieve code. Only network provider
  responses and DynamoDB are mocked. Broken Gemini output still yields a valid
  saved/retrieved seven-day trip. Genuine shortages return `INSUFFICIENT_VENUES`
  before requesting AI copy; venues are never invented to fill a day.
- A real seven-day Poland generation passed with Google Places and Gemini in
  6.4 seconds: two bases, 19 activities, four on each full day and one on arrival,
  transfer and departure days. Google venue IDs/factual data were real. Storage
  projection passed; the agent did not write to DynamoDB or refresh live venues.
- `narrativeSource` records `gemini` or `deterministic_fallback`. Copy is accepted
  only if it keeps every assigned venue/slot unchanged. A rejected or unavailable
  narrative uses neutral descriptions without changing the validated plan.
- Prompt version is `2026-10-23.4`; scheduler version is `2026-10-23.1`. There is
  one narrative HTTP attempt, bounded by the configured request timeout. SDK
  hidden retries are disabled. Server deadlines respect Google's ten-second
  minimum while client abort signals enforce shorter budgets.
- Prefer `gemini-3.5-flash-lite`, then `gemini-3.8-flash`; the latter timed out on
  an earlier tiny diagnostic. The existing provider-schema simplification remains.
- Additional real-provider cases passed: four-day relaxed Portugal (one base,
  3.5 seconds) and five-day Argentina (one base, 4.7 seconds). An existing user-run
  resume-test result confirms a saved/retrieved seven-day trip. See
  `planning-scenario-verification.json` for the expanded matrix and limitations.
- Cumulative live agent requests: 21 Google, 14 Gemini and 1 visa, zero database
  writes. All current paid-call allowances are exhausted. See
  `planning-live-verification.json` for the redacted historical and latest checks.
- Six importer tests passed before these service changes. The restored frontend
  build and smoke check previously passed; frontend files were not changed by
  this scheduler fix. Connecting the original screens to the backend is pending.
- To resume a previous terminal test without creating another account, run
  `node scripts/resume-trip-test.js --test-dir=/path/to/voyouger-test-folder --allow-live`
  from `server`. For the new offline scenario matrix alone run
  `node --test test/tripScenarios.test.js`. The live resume command calls providers through the backend, saves
  the trip, and confirms retrieval. Its account token is read locally, never logged.

Run `npm test` and `npm run planning:data-test` from `server`; run `npm run build`
from `client`. For local development, run `npm run dev` in each directory and open
`http://localhost:5173`. The Vite configuration and production entry structure are
restored to their prior form; expanding production frontend routing is deferred.

The removed frontend implementation was backed up outside the repository at
`/private/tmp/voyouger-frontend-before-revert-8hocifkq` before removal. Git's branch,
HEAD, staged diff and stash were preserved; no commit or push was performed.

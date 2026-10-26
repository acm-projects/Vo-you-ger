# Worldwide planning architecture and API

For the current frontend rollback and backend handoff, see [Simple travel flow](simple-travel-flow.md). This document describes the backend architecture. The earlier walkthrough in
`country-trip-planning.md` describes the same entry flow; this document adds the
worldwide registry, deterministic matching, five-base policy and storage contract.
No new backend dependency, DynamoDB table or index is required. The original
frontend has been restored; the added globe/test dependencies were removed.

## Data authority

- `server/data/countries.json`: standardized country identity, currency/language
  metadata, registry scope, source hashes and geographic coverage exceptions.
- `server/data/destinations.json`: destination identity, geography/provenance,
  legacy travel attributes and per-location `planning` eligibility.
- `server/data/planningCatalog.json`: explicit domestic edges, excursions and
  optional display pins. Country overrides are not an eligibility allowlist.
- `planningDataService`: validates and indexes these sources at startup; builds
  ID, country/base and adjacency maps. Older duplicated display names and country
  descriptions remain for compatibility; registry identity governs new APIs.

Geographic coverage and planning readiness are independent. There are 1,227
destination records, 1,186 gazetteer-verified records and 224 registry entries with
five verified settlements. There are 25 explicit exceptions/source gaps.
There are 65 countries with enabled bases (114 total); 184 remain unavailable.
Most existing bases retain legacy editorial safety/budget tiers. Six newly
reviewed bases in Switzerland and France have explicit travel-review sources,
conservative high budget tiers and country-advisory snapshots with limitations.
These are not city safety guarantees or verified spending estimates. Read
`server/data/SOURCES.md` before importing or activating additional destinations.
Startup validation recomputes geographic coverage, rejects duplicate enabled
settlements and displaced anchors, and checks connection/excursion review dates.
The catalog version includes a content fingerprint, so an unversioned data edit
still changes recommendation snapshot metadata.

## One shared policy

`server/config/tripPolicy.js` owns duration, minimum nights, route search bounds,
transfer allowances, provider concurrency, timeouts and candidate limits.

| Calendar days at destination | Maximum bases |
|---|---|
| 1–4 | 1 |
| 5–9 | 2 |
| 10–15 | 3 |
| 16–20 | 4 |
| 21 | 5 |

Nights equal days minus one. A one-day visit has a `stopType: "visit"`, zero
nights and no accommodation entry. A two-day trip may use one night despite a
base's ordinary minimum. Longer trips must meet curated minimum stays; a country
can be unsuitable for a particular short duration. Relaxed (`deeply`) trips keep
one overnight base through seven days and use two connected bases from eight
days. Explicit see-all trips of seven or more days require at least two bases.
See [route coverage rules](route-coverage-and-variety.md). Transfer days reserve the day
until evening; arrival is light and departure only allows a morning suggestion.
International travel and flight times are outside destination-day calculations.

## Recommendations and routing

1. Authenticate; load the profile and saved or supplied validated assessment.
2. If visa unwillingness is explicitly false, resolve all usable citizenships
   through TravelBuddy and union confirmed green/visa-free results. Unknown or
   unavailable eligibility fails closed. A willingness to apply does not promise
   admission. Transit permissions remain outside this filter.
3. Exclude countries without feasible enabled bases, incompatible safety tiers
   when risk is explicitly declined, insufficient stays, or usable transport
   under stated modes. Openness to risk retains all lower-risk choices.
4. Score destinations using normalized interest overlap (45), seasonal fit (15),
   budget fit (10), safety suitability (10) and optional preferences (20).
   Budget never excludes a country, base or excursion. At/below the preferred
   tier earns ten points; one tier above earns five; two tiers above earns zero.
   Higher-tier selected bases get a cost-tradeoff note in recommendation reasons.
   `interestTags.js` validates aliases and maps the existing four assessment
   personas. Unknown information receives neutral scoring and never establishes
   hard eligibility. Dietary restrictions influence venue searches, not admission
   or unverified promises about restaurants.
5. Search supported complete routes before choosing the starting base. Route
   scores average destination quality, reward variety, and penalize changes and
   transfer time. Country scores average the chosen route's destination scores,
   add a bounded variety bonus and subtract transfer burden. Country catalog
   size is never summed into the score. Stable country/route IDs resolve ties.
6. Return exactly the top three distinct eligible countries, or
   `INSUFFICIENT_COUNTRIES` (422). Store IDs and scoring/catalog/policy versions.
7. Gemini receives only those three fixed IDs and selected metadata to write
   explanations. Invalid IDs, duplicates or outages produce deterministic
   fallback text. Gemini cannot choose countries or change their final order.

The route planner caps candidate bases at 24, retains at most 64 paths per depth,
and searches at most five bases. It prunes repeats, missing edges and minimum
stays before expansion. This bounded beam is deterministic, not an exhaustive
global optimizer. Routes cannot cross borders. Every transfer uses a supported
domestic edge with a source URL, review date, mode and editorial planning duration;
geodesic distance cannot create a connection. No usable edge means fewer bases.

Nights are allocated to curated minima then balanced by traveler fit. An
independent validator rechecks country, distinct bases, duration tiers, night
totals, dates/day allocation, exact supported transfers and excursion rules.
Supported day trips retain their parent overnight base and reserve return travel
time. Current coverage is 55 two-base, 25 three-base, six four-base and two
five-base combinations: 88 combinations across 26 countries. Reversing a route
is not counted twice. Real five-base routes include Paris–Lyon–Avignon–Marseille–Nice
and Zürich–Basel–Bern–Lausanne–Geneva, in either direction when permitted. They
fit 21 days with four nights per base. Shorter or relaxed trips use fewer bases.

## Two API entry paths

All endpoints are prefixed by `/api`. Protected endpoints require
`Authorization: Bearer <token>`. Server keys never belong in the frontend.

| Method/path | Purpose |
|---|---|
| `POST /recommendations` | Top-three recommendations; optional `{quiz}` or saved assessment |
| `POST /trips/:tripId/route` | Read-only preview of a recommended country |
| `POST /itinerary/:tripId` | Generate from a trip's saved assessment/recommendations |
| `GET /countries` | Public country cards and planning flags for all 249 entries |
| `GET /countries/:countryCode` | Public country facts, photograph credits and planning availability |
| `GET /countries/:countryCode/planning` | Public readiness, geographic counts and exceptions |
| `POST /countries/:countryCode/route` | Protected direct-country read-only preview |
| `POST /countries/:countryCode/itinerary` | Protected direct generation using the same engine |
| `GET /trips/:tripId/days/:day/places` | Owner-only fresh venue details for one saved day |
| `GET /trips/:tripId` | Owner-only persisted itinerary and route |
| `PUT /trips/:tripId/save` | Save generated draft, idempotently |
| `DELETE /trips/:tripId/save` | Unsave while retaining itinerary |
| `GET /trips/globe` | Country-grouped saved-trip summaries and representative pins |

Route/generation bodies accept `{countryId, startDate, numberOfNights}` on the
recommendation path; direct paths take the country from the URL. `numberOfDays`
is a compatibility alternative, must agree with nights if both are supplied, and
must fit assessment bounds. Dates use a real `YYYY-MM-DD` arrival date; generation
requires it, previews can omit it. Direct requests may supply a validated quiz
when no saved one exists, but cannot supply an existing `tripId`. Citizenship
comes from the authenticated profile when present; country membership, visa
checks and route selection remain server-owned. Client places and stop allocations
are ignored. A direct country need not be among previous recommendations.

Example direct preview:

```http
POST /api/countries/PT/route
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{"startDate":"2027-06-05","numberOfNights":6}
```

Availability is deliberately not a promise of feasibility for a particular user:

```json
{"countryCode":"CH","name":"Switzerland","coverageStatus":"minimum_met","verifiedSettlementCount":5,"supportedOvernightBases":5,"planningAvailable":true,"furtherFeasibilityChecksRequired":true,"coverageException":null}
```

## Places discovery, AI and persistence

Only selected bases/excursions trigger discovery: three deterministic category
searches per location, no LLM query-building call, up to 15 results/category,
36 unique candidates/location. Locations run sequentially and category requests
use at most two concurrent calls per planning request. Results require coordinates
and the selected country and must lie within the base radius. Permanently closed
places and duplicates are removed. The capped pool alternates between categories
so numerous attractions do not crowd out restaurants. Unknown hours remain unknown.
An empty usable pool returns `NO_USABLE_PLACES`; it cannot produce invented venues.

The backend owns the complete daily plan: distinct open venues, fixed slots,
protected travel windows, activity counts, and pairwise daily spread of at most
8 km. It reserves a feasible venue for every sightseeing day before allocating
extras. Genuine candidate shortages return `INSUFFICIENT_VENUES` (422).

A structured narrative prompt receives only the fixed plan and selected venues,
with a 240 KB guard. Gemini supplies title, summary, themes and descriptions; it
cannot alter any venue/slot assignment. Invalid or unavailable copy retains the
validated plan with neutral descriptions and `narrativeSource: deterministic_fallback`.
There are at most two transport attempts on distinct models, no semantic regeneration loop. Canonical venue
facts, calendar and area rankings come from the backend/provider data.

New schema-v2 persistence stores route, summary, dates, application-authored text
and Place IDs/category. It excludes raw Google names, addresses, coordinates,
ratings, opening hours, third-party attributions and provider-derived neighborhood
lists. Read responses for persisted records therefore differ from the fresh
generation response. Frontend consumers should call the owner-protected day-details endpoint on
expansion to refresh canonical venue data and nearby areas, retaining it only in
transient display state. The original frontend still needs this integration. At most four unique details calls are allowed per day,
with concurrency two, exact Place ID/country/radius checks, regular-hours checks
and daily-spread revalidation. Excursions retain their own reviewed radius. Show Google Maps and any
returned third-party attribution alongside that data. Do not place Google venue
results on a non-Google globe; country pins come from the independent catalog.
See [Google's Places policy](https://developers.google.com/maps/documentation/places/web-service/policies).

AI-authored text remains subject to factual review; this projection is not a
blanket license clearance for every possible derived use. Existing older saved
records remain readable and are not rewritten automatically. The public product
still needs appropriate Terms of Use and Privacy Policy for launch.

Generation from an already saved trip forks a new unsaved draft. Unsaved trips
update in place; a conditional write rejects a concurrent save with `TRIP_CHANGED`
(409). Direct generation and saved-trip forks create the complete draft and
itinerary with one atomic conditional put after successful generation; there is
no separate empty-draft write. Existing drafts use one conditional update.
Trip queries remain scoped to the authenticated user's DynamoDB partition. Globe
queries paginate and project summary metadata, reducing payload rather than read
capacity. The backend supports a future globe and country panels. The replacement UI was removed to preserve the existing frontend design; see the handoff guide.

## Errors, configuration and verification

New planning errors use `{error, code, message}` with stable codes including
`INVALID_DURATION`, `INVALID_ASSESSMENT`, `INVALID_COUNTRY_CODE`,
`COUNTRY_NOT_FOUND`, `COUNTRY_NOT_READY`, `NO_FEASIBLE_ROUTE`,
`CITIZENSHIP_REQUIRED`, `VISA_UNAVAILABLE`, `VISA_INELIGIBLE`,
`INSUFFICIENT_COUNTRIES`, `INSUFFICIENT_VENUES`, `INVALID_AI_OUTPUT`, `PLACES_NOT_CONFIGURED`,
`PLACES_RATE_LIMIT`, `PLACES_UNAVAILABLE`, `PLACES_TIMEOUT`,
`VENUE_NO_LONGER_ELIGIBLE`, `TRIP_CHANGED`, and `GENERATION_RATE_LIMIT`.
Legacy endpoints retain their prior error contract. Internal exceptions do not
expose provider responses or credentials.

Keep existing `.env` credentials; no values were changed. Optional limits are in
`.env.example`. Google/visa requests default to 15-second timeouts; Google retries
one network/429/5xx failure. Gemini makes at most two HTTP attempts on distinct
configured models, reserving time for fallback; SDK automatic retries are off.
Explanations default to a 60-second total budget and itinerary copy to 90 seconds,
with a 90-second per-attempt maximum. The first of two attempts receives at most
half the total budget; the fallback can use time left by a fast failure. All
three budgets are configurable.
Timeouts do not disable a model for later requests. Explicit quota/provider/model
failures can trigger a 60-second cooldown, with safe diagnostics distinguishing
those skips from timeouts and configuration rejections. Generation uses low
thinking effort where supported and at most 16,384 output tokens. Invalid or
unavailable copy retains the validated plan with local text fallback. Discovery calls are
bounded but sequential locations and slow providers can still produce long
end-to-end latency; there is no queue or global request cancellation yet.
The local generation limiter defaults to 12 costly requests/minute per user with
`Retry-After`; use shared infrastructure before multiple server replicas.

`PLANNING_METRICS=1` emits stage durations (`routeSelection`, `countryRanking`,
`placesDiscovery`, `geminiGeneration`, `overall`) and counts, without quiz/profile
or venue payloads. Offline checks from `server`:

```sh
npm test
npm run planning:data-test
npm run planning:coverage
npm run planning:benchmark
npm run planning:live-check
npm run planning:verify
```

Both provider scripts are dry runs by default. For a cumulative capped check, use
`planning:verify` with explicit `--allow-live`, `--budget-file=/path/budget.json`
and `--report-file=/path/report.json`. Reuse that budget file on retries: each
outbound HTTP attempt is reserved before sending. Defaults cap Google/Gemini/visa
at 6/2/1; increased `--max-google`/`--max-gemini` values require authorization.
`--only=dynamodb|visa|recommendations|itinerary|google-details` selects one check.
The DynamoDB check only describes the table. Successful generation is projected
in memory; the script never writes a trip. See [the recorded live results](planning-live-verification.json).

The authorized October 23 checks used nine Google requests, six Gemini requests
and one visa request, with zero database writes. Google discovery and visa lookup
worked; DynamoDB reported an active table with the expected ownership keys.
The primary Gemini model returned 504 and the fallback returned 400; neither a
real generated itinerary nor a subsequent saved-day refresh was verified live. Recommendation fallback remains usable. This branch
is locally verified but **not verified for successful live itinerary generation**.
Tests cover the full lifecycle with mocked providers and database operations.

Development helpers are safe by default: `debug-recommendations.js` is offline;
`create-test-user.js` requires `--allow-write` plus explicitly supplied
`TEST_USER_EMAIL` and `TEST_USER_PASSWORD`. It does not print passwords or tokens.

The benchmark reports p50/p95 CPU timings separately from provider latency. Set
`PLANNING_RANK_P95_MAX_MS`, `PLANNING_ROUTE_P95_MAX_MS`, or
`PLANNING_DENSE_P95_MAX_MS` to positive values to fail on a measured p95 regression
in the corresponding case; choose thresholds for the CI machine rather than
treating one developer laptop's timings as a service-level guarantee.

From `client`, run `npm run build`. The original assessment, loading page and
recommendation-card design are restored with their earlier prototype behavior.
They still need to be wired to the retained backend API helpers. The temporary
replacement planner and its browser tests were removed.

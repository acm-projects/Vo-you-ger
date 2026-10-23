# Worldwide backend implementation report

Implementation date: 2026-10-23. Changes remain local for review. The frontend redesign has been rolled back; the retained backend and current handoff are described in [Simple travel flow](simple-travel-flow.md).

## A. Summary

Implemented a worldwide geographic registry and an extended, deterministic
country-first planning engine. Country ranking no longer depends on Gemini.
Both recommendation-based and direct-country planning share the route and daily
itinerary engine. Duration policy, bounded provider discovery, AI validation,
ownership and saved-trip protection are enforced in backend code.

**Worldwide travel readiness is incomplete.** Geographic verification does not
establish travel suitability, current safety, accommodation availability or usable
transport. Newly imported destinations stay disabled rather than acquiring
invented travel attributes. The agreed branch scope is a finished backend with a
broader curated catalog; activating every ISO entry remains a separate data project.
Live Google discovery, visa lookup and read-only DynamoDB schema checks worked.
**Live Gemini returned 504 on the primary model and 400 on fallback; successful live itinerary generation remains unverified.**

## B. Main files changed

| Area | Files / responsibility |
|---|---|
| Geographic data | `server/data/countries.json`, `destinations.json`, `planningCatalog.json`, `SOURCES.md`: registry, verified locations, review/provenance metadata and sourcing |
| Policy and scoring | `server/config/tripPolicy.js`, `interestTags.js`, `scoringWeights.js`: shared limits, normalized personas/tags and transparent weights |
| Selection and routing | `planningDataService.js`, `destinationScoringService.js`, `countryScoringService.js`, `countryRecommendationService.js`, `travelEligibilityService.js`, `tripOutlineService.js`: indexed catalog, hard filters, deterministic matching and bounded paths |
| Provider and AI pipeline | `googlePlacesService.js`, `placesQueryBuilder.js`, `placeNormalizer.js`, `stopDiscoveryService.js`, `llmclient.js`, `visaService.js`, `countryItineraryService.js`, `server/prompts/`: bounded calls, factual grounding and structured validation |
| Stored/read representation | `itineraryStorageService.js`, `savedVenueService.js`, `tripSummaryService.js`, `server/models/tripModel.js`: Place ID persistence, refresh, globe summaries and conditional saved-state protection |
| API and guards | `countryPlanningController.js`, `countryTripController.js`, existing recommendation/itinerary/trip controllers, `countryRoutes.js`, existing affected routes, `apiError.js`, `telemetryService.js`, `generationLimiter.js`, `authMiddleware.js`, `server.js`: entry paths, ownership, errors, metrics and request limits |
| Validation and identity | `recommendationSchema.js`, `countryItinerarySchema.js`, `server/utils/countryCodes.js`: shared duration limits and registry-backed normalization, retaining signup aliases |
| Compatibility prompt | `countryRecommendationPromptBuilder.js`: delegates to deterministic selection and fixed-ID explanation template |
| Frontend | Original pages restored; replacement planner/globe, CSS, data and UI tests removed. Backend API helpers and the missing login-script reference fix remain. |
| Tooling | `import-geography.py`, `planning-coverage.js`, `planning-benchmark.js`, `verify-planning-integrations.js`, `live-planning-check.js`, `server/package.json`: repeatable import/reporting, CPU baselines and opt-in capped live checks |
| Tests and documentation | Updated recommendation/planning tests; new `worldwidePlanning.test.js`, `branchCompletion.test.js`, `llmclient.test.js`, `planningHttp.test.js`, `import_geography_test.py`; updated walkthrough, architecture guide, live results and this report |
| Configuration | `server/.env.example`: optional timeout/metrics/request-limit settings; `.gitignore`: Python test artifacts |

Service/controller/schema filenames above are relative to their corresponding
`server/services`, `server/controllers`, `server/schemas` directories. Existing
merged frontend work is preserved. The original App routing and signup assessment
redirect are restored; the pre-existing staged diff remains unchanged. The developer user-creation helper now defaults
to a dry run, requires explicit credentials/write opt-in and prints no token.
The recommendation debugger now runs deterministic ranking offline. Their safe
default paths were exercised; no development account was written.

## C. Verified coverage

| Metric | Result |
|---|---:|
| Registry scope | 249 ISO 3166-1 entries including territories/dependencies |
| Total destination records | 1,227 |
| Gazetteer-verified destination records | 1,186 |
| Existing legacy IDs retained | 157 |
| Legacy records matched to qualifying settlements | 116 |
| Registry entries with at least five verified settlements | 224 |
| Entries below five, explicitly reported | 25 |
| Countries with enabled planning bases | 62 |
| Countries without an enabled planning base | 187 |
| Enabled overnight bases | 88 |
| Reviewed domestic connection records | 26 |
| Countries with multi-base route combinations | 15 |
| Two / three / four / five-base combinations | 26 / 11 / 5 / 2 |

Combinations ignore direction and reflect the current bounded planner before
user-specific restrictions. There are **44 supported multi-city combinations**.
Different dates, night allocations, personas and venues create
more itinerary variations without creating new curated routes.

Four explicit geographic exceptions are Antarctica (no permanent cities counted)
and the city-states Monaco, Singapore and Vatican City. The other 21 below-five
entries are source gaps in the selected GeoNames populated-place snapshot, not a
claim that five real settlements cannot exist there:

`BL, BM, BV, CC, CK, CX, FK, GI, GS, HM, IO, MS, NF, NU, PM, PN, SJ, TF, TK, UM, VG`.

`planning:coverage -- --all` lists every country, count and exception. Source hashes,
per-record URLs, source dates, licenses and the repeatable importer are included.
GeoNames feature-class filtering excludes neighborhoods/landmarks/airports from
the settlement import. Existing broad legacy records remain descriptive. Later
editorial enrichment survives import refreshes; retired IDs are retained but
disabled, including aliases now represented by legacy IDs. Same-input import
idempotency was checked against the actual downloads twice after the new reviews,
and independently with synthetic importer fixtures. Startup validation recomputes
coverage, rejects duplicate enabled settlements and displaced anchors, and validates
edge/excursion review dates. Catalog snapshots include a content fingerprint.

## D. Deterministic scoring

Hard filters run before ranking: confirmed visa-free access when required,
reviewed planning availability, known budget compatibility, safety tier, duration,
stay minimum and permitted domestic connections. Multiple citizenships union
confirmed green results; service uncertainty never broadens eligibility.
The country-name/code helper now uses all 249 registry codes and supports official
and common names, diacritics and existing signup aliases.

Destination scores normalize interest overlap (45), season (15), budget (10),
safety (10) and optional preferences (20). Preferences include the existing
country-interest, temperature, fame/hidden-gem, crowds/space, nightlife/sunrise
and walking signals where coarse catalog data supports them. Unknown information
does not become a travel fact. Detailed weather, accessibility and dietary
certainty remain unsupported as factual guarantees.

Routes compare normalized destination quality, variety and transfer burden.
Country scores average their chosen feasible destinations, add at most five
variety points and subtract transfer minutes / 600. A larger country's tag totals
do not automatically improve its score. Stable country IDs resolve ties. Exactly
three fixed eligible country IDs and version metadata are stored, or the API
returns `INSUFFICIENT_COUNTRIES` (422).

## E. Route planning

The shared policy enforces 1–21 calendar days: at most one base on days 1–4, two
on 5–9, three on 10–15, four on 16–20 and five on day 21. Nights equal days minus
one. Zero-night visits have no accommodation; only one-/two-day visits relax the
ordinary stay minimum. Relaxed travelers keep one overnight base.

The deterministic beam considers up to 24 candidate bases and retains 64 paths
per depth. It prunes repeats, missing domestic edges and insufficient stays
before further expansion. It is bounded and scalable, not an exhaustive optimizer.
It never infers transport connectivity from straight-line distance. Existing
edge sources/review dates and editorial planning allowances are retained.
Minimum stays and transfer windows are validated independently after selection.
Excursions retain the overnight base and reserve return-travel time.

The real catalog now supports five-base routes in France and Switzerland. A
21-day route can use Nice–Marseille–Avignon–Lyon–Paris or
Zürich–Basel–Bern–Lausanne–Geneva, with four nights per base and all calendar days
allocated. Official tourism, SBB, SNCF and country-advisory sources support the six
new bases and six connections; see [the source record](../server/data/SOURCES.md).
Planning durations include editorial buffers rather than live timetable claims.
Both production graphs pass independent outline/calendar tests. Synthetic
five-base generation/validation/persistence tests remain separately labeled.

## F. Google Places and AI

Three deterministic category searches run only for selected bases/excursions,
with 15 results/category, 36 unique candidates/location, and at most two concurrent
Google calls per planning request. Country, coordinates, radius, supported venue
type and permanent-closure checks run before AI. Category-balanced truncation
keeps restaurant suggestions in the pool. There is no persistent provider-content cache.

Gemini writes explanations for fixed country IDs and copy for a backend-owned
daily plan. The scheduler assigns distinct venues with compatible hours, reserves
travel windows, caps activity counts and enforces pairwise geography. A matching
step protects scarce sightseeing days before extras are filled. The narrative
cannot change IDs or slots. Invalid/unavailable copy uses neutral descriptions;
it does not discard a valid itinerary. Genuine venue shortages fail explicitly.
Canonical metadata and accommodation areas come from provider data. Descriptions
remain suggestions, not guarantees. See `simple-travel-flow.md` for current checks.

New schema-v2 database writes omit raw Google names, addresses, coordinates,
ratings, hours, attributions and provider-derived neighborhood lists. They store
Place IDs, route/calendar metadata and app-authored text. The owner-only day
refresh endpoint retrieves fresh details for display, rechecking exact IDs,
country, location radius, regular hours and daily spread. An unverifiable saved
schema-v2 location fails closed. Frontend consumers must display the
required Google Maps attribution and returned provider credit when integrating
the saved-day details endpoint. Legacy
records are read compatibly and are not destructively migrated.

Protected direct-country preview/generation reuses the same engine without
requiring membership in a previous top three. Public country readiness has no
profile dependency. New direct drafts and saved-trip forks use one atomic
conditional put containing the complete itinerary. Existing drafts use a
conditional update that protects an itinerary saved concurrently. No booking,
payment, train departure or flight inventory feature was introduced.

## G. Performance

Offline benchmark: Node **v24.20.0**, **darwin/arm64**, 50 measured iterations after
five warmups, 2026-10-23. These are CPU timings on this machine, not HTTP latency
or promises for external services. Snapshot: `planning-benchmark.json`.

| Operation | p50 ms | p95 ms |
|---|---:|---:|
| Rank supported countries for a 21-day trip | 5.010 | 5.778 |
| France 21-day outline | 0.780 | 0.862 |
| Synthetic dense 80-node graph, up to five bases | 1.890 | 2.533 |

The dense case returns at most 280 retained paths after pruning. Optional
`PLANNING_*_P95_MAX_MS` thresholds can make the benchmark fail on regressions.
`PLANNING_METRICS=1` emits count/timing fields for country ranking, route selection,
discovery, Gemini and overall generation. Raw assessment/profile/provider content
is not emitted by that instrumentation.

Google calls default to 15-second timeouts and at most one transient retry.
Gemini fallback is capped at three configured models and a 45-second deadline
per structured call. Country itinerary copy uses one HTTP attempt within the
configured request timeout, with local text fallback. Timeout settings are
configurable within caps. SDK hidden retries are disabled; the application is the
only retry owner. Explanations use one request with an eight-second deadline and
local fallback. Generation uses low thinking where supported and a 16,384 output
token cap. Slow sequential locations can still make full generation
slow. Per-request concurrency and a per-user limiter do not establish a global
distributed provider quota. Live check timings are recorded separately; failed
Gemini requests do not establish successful generation latency.

## H. Testing

Executed successfully:

```sh
cd server
npm test
npm run planning:data-test
```

Executed from the repository root (the corresponding npm shortcuts are also
defined in `server/package.json`):

```sh
node server/scripts/planning-coverage.js --all
node server/scripts/planning-benchmark.js
node server/scripts/live-planning-check.js
node server/scripts/verify-planning-integrations.js
```

- JavaScript: **196 tests passed, 40 suites, 0 failed**.
- Offline importer: **6 Python tests passed**.
- Same-input actual worldwide import: two refreshes preserved byte-identical
  outputs, including newly reviewed travel data.
- Developer helper dry runs and the offline recommendation debugger passed.
- Restored-frontend Chrome smoke check: home/navbar, original assessment, login
  and loading-to-postcard navigation passed, with mocked auth and no paid calls.
- Frontend `npm run build`: passed, 26 modules transformed.
- The seven redesign-specific browser tests and added packages were removed
  during the frontend rollback; they are not current UI coverage.
- `git diff --check`: passed.

Tests cover all exact duration boundaries, one-day visits, a complete five-base
synthetic trip, independent route validation, relaxed/single-base fallbacks,
disconnected graphs, catalog-size neutrality, deterministic fixed country IDs,
visa fail-closed behavior, multi-citizenship, optional AI explanations, geographic
filtering, known hours, protected transfer slots, retries and candidate/concurrency
bounds, direct preview/generation, JWT/ownership guards, IDs-only persistence,
saved-trip forking/concurrent-save conflicts, legacy compatibility and globe
summaries. The real-HTTP integration test exercises mounted Express routes,
authentication, malformed JSON, preview, generate/save/reopen/refresh, foreign
ownership denial and saved-trip forking. SDK tests use its actual serializer with
mocked fetch to verify request counts, thinking settings, timeouts and errors.
These automated tests mock external providers and DynamoDB operations.

The user separately authorized capped live checks. Cumulative HTTP requests were
**9 Google, 6 Gemini and 1 visa**, within approved limits of 10/6/1; **database
writes were zero**. Results are preserved in
[planning-live-verification.json](planning-live-verification.json):

| Live check | Result |
|---|---|
| Google discovery | Usable candidates reached the itinerary generation step on both runs |
| TravelBuddy, US passport | Passed; 122 confirmed green country codes |
| DynamoDB DescribeTable | Passed; ACTIVE with expected PK/SK ownership keys |
| Gemini explanations | Timed out; deterministic recommendation fallback used |
| Gemini itinerary generation | Latest primary HTTP 504, fallback HTTP 400 (`GEMINI_CONFIGURATION`); no itinerary written |
| Fresh saved-day venue details | Not reached live; covered with mocked HTTP lifecycle tests |

The trace contains no credentials, profiles, venue payloads or table names.
DynamoDB CRUD permissions and successful live itinerary generation are not proven
by these read-only checks. No further live calls were made after the final cap.

## I. Remaining gaps

1. **187 registry entries have no enabled planning base.** Geographic-only imports
   need sourced interests, travel suitability, budget/safety limitations, stay
   minima and radius review before activation. Most existing safety tiers remain
   legacy editorial estimates; new French/Swiss snapshots have explicit scope.
2. **21 source gaps plus four geographic exceptions** remain below five verified
   settlements. Smaller-country gazetteers or official sources can resolve some
   source gaps; do not relabel neighborhoods to meet the count.
3. **62 enabled countries do not imply 62 multi-city countries.** Fifteen have
   supported connections; additional countries need separately sourced regional
   edges. Keep the 26 existing edges under periodic review.
4. **Successful live Gemini generation is unresolved.** The latest approved attempt
   received 504 followed by 400, after disabling hidden retries, lowering thinking
   effort and reducing prompt payloads. The exact configuration rejection is not
   established; sanitized error categories are now available for future diagnosis. Resolve this and inspect an actual itinerary and
   refreshed day before calling the system launch-ready. Remote CRUD was not tested.
5. Regular hours do not establish holiday opening, visit duration, reservation
   inventory, dietary suitability, accessibility or actual walking routes.
6. There is no background job queue, global request cancellation, distributed
   limiter or cross-replica provider budget. These are scaling limits; complete
   new drafts are now atomic rather than a separate create-then-update sequence.
7. The original frontend is restored. The globe, country panels and wiring the existing assessment/recommendation designs to the backend remain frontend work.
   Deployed Terms of Use/Privacy Policy and applicable provider display/storage
   requirements still need product review. Existing legacy provider-rich records
   are intentionally not rewritten automatically.

## J. Git state

- Branch: `feature/country-trip-planning`, unchanged.
- HEAD: `5b0c29a9fccc2b48793ed8a32b2413babb44c354`, unchanged.
- No commits, pushes, PRs, merges, branch switches or automatic staging.
- The existing staged diff is byte-for-byte unchanged (SHA-256 comparison).
- Original stash object `73961fe9ac8988fe8b0189d0a6a7ce93710fa376` remains unchanged.
- Existing staged/unstaged/untracked work remains present; new changes are local.
- `.env` credential values were not changed or printed.

## K. User review checklist

1. Review the geographic import and its source manifest, particularly exceptions
   and the difference between geographic coverage and operational readiness.
2. Review the 1–21-day policy, scoring weights, direct-country API and route
   examples for one, seven and 21 days, including relaxed travelers.
3. Inspect the new saved-itinerary contract and day-details refresh with your
   frontend collaborator; consumers cannot assume stored raw venue fields.
4. Review the latest successful real Poland generation in
   `planning-live-verification.json`; use the resume script to verify persistence
   against your development account. Live agent checks did not write database
   records or recheck venue refresh. Further paid agent calls require new approval.
5. Inspect both `git diff` and the already-staged work. Commit/push only after
   your own review; neither operation was performed here.

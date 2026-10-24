# Test the backend without the homepage

This walkthrough calls the existing API directly. It requires Node, the installed
server dependencies, and the backend's existing environment configuration. No
frontend or globe is required or changed.

The live commands create a test account and recommendation draft, call Google
Places/Gemini, and save a trip to the configured database. Visa willingness is
enabled in these examples, so they do not request a visa lookup. Responses and
test credentials are written to the selected temporary directory with private
file permissions. Passwords and authentication tokens are never printed. Do not
share `account.json`, `login.json`, `credentials.json`, or `session.json`.

## Start the server

In terminal 1:

```sh
cd /Users/conradmurrell/Voyouger/Vo-you-ger/server
npm run dev
```

## Walk through each step

In terminal 2, set up a fresh test directory and a shell helper:

```sh
cd /Users/conradmurrell/Voyouger/Vo-you-ger/server
export VOYOUGER_TEST_DIR="$(mktemp -d)"
voyo_flow() { node scripts/backend-flow-test.js "$@" --state "$VOYOUGER_TEST_DIR" --allow-live; }
```

Run each command after the previous one succeeds:

```sh
voyo_flow signup --scenario foodie
voyo_flow login
voyo_flow assessment
voyo_flow recommend
voyo_flow route --choice 1
voyo_flow generate
voyo_flow save
voyo_flow retrieve
voyo_flow day --day 2
voyo_flow saved
```

At `route`, `--choice 1`, `2`, or `3` selects one of the recommended countries.
The first example requests June 5–11, 2027: six nights, seven calendar days,
moderate budget, vegetarian food preferences, and a Foodie/see-all profile.
Route feasibility still determines the number of overnight bases.

| Command | Backend behavior | Response files |
|---|---|---|
| `signup` | Create account; obtain authentication token | `account.json`, private `credentials.json` and `session.json` |
| `login` | Authenticate the same test account | `login.json`; update private session |
| `assessment` | POST answers to `/quiz`; GET them back and check equality | `assessment-input.json`, `assessment-saved.json`, `assessment-retrieved.json` |
| `recommend` | Use the saved assessment to produce three distinct countries and a draft | `recommendations.json` |
| `route` | Preview the selected country's bases, nights, dates, transfers and excursions | `selection.json`, `route.json` |
| `generate` | Discover real places, schedule them and request Gemini descriptions; attach practical information and activity tips | `itinerary.json` |
| `save` | Mark the actual generated trip ID as saved | `saved.json` |
| `retrieve` | Reopen it; assert route, practical info, descriptions and tips were preserved | `retrieved.json` |
| `day` | Refresh venue metadata; join it to saved text by place ID, without persisting provider details | `day-places.json`, `day-display.json` |
| `saved` | Verify the saved-trip list contains the generated trip | `saved-list.json` |

`generate` prints country practical information, stay areas, a sample day, and
the narrative source. `retrieve` prints the stored version and reports the
preservation checks. `day` prints a complete example day with refreshed venue
details and neighborhood suggestions. Display the returned Google attribution
when the frontend is connected.

Stop on a failed command and inspect its error before continuing. After fixing
configuration or service availability, rerun that command with the same test
directory. Do not repeat `signup` in that directory. A real venue shortage or a
venue's changed hours can still produce an explicit error; the test does not
invent replacement data. Each AI operation can make at most two HTTP attempts,
one on each of two different configured models; hidden SDK retries are disabled.

By default, recommendation explanations and itinerary descriptions must come
from accepted Gemini output. A successful HTTP response containing backup text
is saved for inspection but fails the verification command. To deliberately test
the degraded path, pass `--allow-fallback`; it is not proof that Gemini worked.

Gemini defaults are 60 seconds total for recommendation explanations, 90 seconds
total for itinerary copy and 90 seconds maximum per HTTP attempt. The first
model receives at most half of the remaining operation budget when a second model
is available: normally 45 seconds for itinerary copy. If it fails quickly, the
second model can use the unused time within the same 90-second total deadline.
Configure `PLANNING_EXPLANATION_TIMEOUT_MS`,
`PLANNING_GEMINI_DEADLINE_MS` and `PLANNING_GEMINI_REQUEST_TIMEOUT_MS` in
`server/.env` if needed; the supported maxima are 120, 180 and 90 seconds
respectively. Existing explicit settings override the new defaults. Restart the
server after updating them. The walkthrough's outer request deadline is ten
minutes to accommodate long multi-base discovery plus configured AI budgets.

Client aborts and provider HTTP 504 errors are reported as `request_timeout` and
do not put a model on cooldown. Server logs include the allocated attempt budget
and distinguish `timeout client` from `timeout provider`; the public fallback
reason remains unchanged. Explicit quota, model-not-found and provider
failures can enter a 60-second cooldown; skips are reported separately. Auth or
configuration rejections stop immediately. Logs contain reason categories,
status, model and elapsed time, never raw provider errors, keys or traveler text.

## Inspect complete responses

```sh
cat "$VOYOUGER_TEST_DIR/route.json"
cat "$VOYOUGER_TEST_DIR/itinerary.json"
cat "$VOYOUGER_TEST_DIR/retrieved.json"
cat "$VOYOUGER_TEST_DIR/day-display.json"
```

| Data | Immediately generated | Saved/retrieved | Day refresh |
|---|---|---|---|
| Route, dates, cities, nights and transfer allowances | Yes | Yes | Unchanged |
| Currency and practical-information provenance | Yes | Yes | Unchanged |
| Payment/cultural guidance | Yes; reviewed or clearly marked editorial/unknown | Yes | Unchanged |
| Activity descriptions and `travelTip` | Yes | Yes | Joined to refreshed facts by place ID |
| Place IDs and categories | Yes | Yes | Used for lookup |
| Google venue names, addresses, ratings and hours | Available when returned by Google | Removed from the persisted activity | Fetched again; still may be unknown |
| Provider-derived neighborhood suggestions | Available when discovery supplies enough data | Refreshed instead of stored | Returned for the expanded day |

The generation response contains two useful views: `itinerary` is the enriched
display response; `trip.itinerary` is the smaller persisted representation.
`GET /trips/:tripId` returns the latter, supplemented with practical guidance
when an older country itinerary was saved without it. That compatibility step
does not rewrite the database or query Google.

## Two additional scenarios

Each `all` command repeats the complete account-to-saved-trip flow with its own
temporary account and real provider calls:

```sh
node scripts/backend-flow-test.js all --scenario relaxed --state "$(mktemp -d)" --allow-live
node scripts/backend-flow-test.js all --scenario variety --state "$(mktemp -d)" --allow-live
```

- `relaxed`: three nights/four days, Historian, moderate budget, one base.
- `variety`: nine nights/ten days, Explorer, higher budget; the backend chooses
  multiple bases where the selected country's supported routes make sense.

Use `--choice 2` or `--choice 3` with `all` to select a different recommendation.
Without `--allow-live`, the script only prints usage and makes no requests.

## Restored guidance contract

- `itinerary.practicalInfo.currency`: `code`, English `name`, display `symbol`.
  The code comes from the local GeoNames country snapshot; display labels use
  Node's Intl data. No live conversion rates are claimed.
- `practicalInfo.paymentMethods`: familiar `cardsAccepted`, `cardsLimited`,
  `popularEWallets`, `cashAdvice`, and an acceptance note. Lists contain only
  recorded guidance. Empty lists mean unknown/unrecorded, not non-acceptance.
- `practicalInfo.culturalTips`: reviewed country-level tips, where available.
- `practicalInfo.byStop[]`: advice scoped to each selected overnight base, with
  its destination ID. Existing city-specific tips are not promoted to national
  facts. Coarse legacy budget/safety tiers remain local to each base.
- `practicalInfo.provenance` and each stop's `provenance`: `source_reviewed`
  with URLs/review date, `legacy_editorial` without independent source review,
  or `unknown`. Six countries currently have source-reviewed payment guidance;
  three of those also have reviewed cultural tips. Other existing catalog advice
  is explicitly editorial and should not be displayed as verified current facts.
- Activity `travelTip`: server-authored practical checks based on available
  regular hours, food category, dietary uncertainty and reserved travel time.
  `travelTipSource` is `planning_guidance`. Gemini cannot override these tips
  or the country facts. Missing venue rules stay unknown.
- `narrativeSource`: `gemini` or `deterministic_fallback`.
  `narrativeFallbackReason`: null on success; otherwise `schedule_changed`,
  `invalid_response`, `provider_configuration`, `rate_limited`,
  `request_timeout`, `provider_unavailable`, `cooldown_skipped`,
  `model_unavailable`, or `prompt_too_large`.
  These are safe broad categories, without private provider error contents.
  Recommendation `selectionMetadata` now also exposes `explanationFallbackReason`.

Discovery accepts positive visitor/food types and excludes tour/travel agencies
and generic office listings; it does not treat an operator's address as the
activity or a safari departure point. Google structured regular-hour periods
take priority over display text. Shared AM/PM ranges such as `1:30–11:30 PM` are
also understood; ambiguous or genuinely missing hours remain unknown. Listing
hours still do not establish ticket availability or visit duration.

An explicit see-all preference rewards countries with feasible multi-base routes
more strongly in ranking. This is a preference bonus, not permission to bypass
visa, budget, transport or minimum-stay constraints. Short and relaxed trips
retain one base. Single-base countries remain eligible where they fit the user.

Legacy city itineraries retain their existing structure. This change does not
restore cost estimates, meal labels or late-night scheduling, and does not
change the frontend. Sources and refresh limitations are in
[`server/data/SOURCES.md`](../server/data/SOURCES.md).

## Offline regression checks

These mock external providers and database operations:

```sh
cd /Users/conradmurrell/Voyouger/Vo-you-ger/server
node --test test/travelGuidance.test.js test/backendFlow.test.js test/planningHttp.test.js
npm test
```

The latest live checks and scope are recorded in
[`planning-reliability-verification.json`](planning-reliability-verification.json).

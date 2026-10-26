# Route coverage and trip length

Policy and scoring version: `2026-10-25.2`. These are product planning rules, not statements
about how long a country or city is worth visiting.

| Calendar days at destination | New recommendation/route behavior |
|---|---|
| 1–4 | One overnight base, or a zero-night visit on a one-day trip |
| 5–6 | Prefer a feasible two-base route; a single base remains eligible |
| 7+ with a see-all preference | Every recommendation requires at least two connected overnight bases |
| Relaxed/deeply, through 7 | One base; existing supported excursions can still be included |
| Relaxed/deeply, 8–21 | Exactly two connected bases, with the nights balanced between them |

Limits live in `server/config/tripPolicy.js`: the variety threshold is seven
days, the relaxed single-base maximum is seven days, and the relaxed maximum is
two bases. No city-specific exceptions have been added. For travelers without
either pace preference, existing duration caps and route scoring remain in use.
Fourteen calendar days means thirteen nights.

## Eligibility is based on the actual route

The route engine filters bases by explicit risk exclusions, uses only
reviewed domestic connections in the allowed transport modes, and enforces each
base's minimum stay. Its selected route must then meet the base-count rule.
Having two cities in the catalog is insufficient if their connection is missing,
over the transfer allowance, or incompatible with the traveler. A day excursion
does not count as a second overnight base.

Country ranking skips ineligible routes and continues through the remaining
countries. If fewer than three qualify, the existing `INSUFFICIENT_COUNTRIES`
HTTP 422 response explains that the traveler must adjust duration or constraints.
Neither the route policy nor visa/risk requirements are weakened to fill the
three cards. Direct-country route/generation uses the same engine and returns
`NO_FEASIBLE_ROUTE` (422) for an incompatible selection. A longer date override
on an earlier draft is rechecked under the same rules.

Budget is a ranking preference for countries, overnight bases and excursions,
not an exclusion. At or below the requested tier earns the full ten budget-fit
points, one tier above earns five, and two tiers above earns zero; unknown tiers
are neutral. Stronger overall interest/route fit can outweigh this difference.
When a selected overnight base is above the requested tier, the existing
recommendation reason includes a server-authored cost-tradeoff note, with either
Gemini or fallback text. No daily prices or affordability guarantees are invented.
Venue selection continues to favor the traveler's budget.

Risk willingness is one-way: being open to higher-risk destinations retains
lower-risk destinations and does not reward danger. An explicit unwillingness
retains the existing conservative tier-1-only screening rule. No safety tiers
or country approvals were changed by the budget-policy update.

Gemini still receives three fixed country IDs and their feasible regional routes
for explanations, and a fixed venue/day/slot plan for itinerary descriptions.
It cannot supply missing bases or invent connections. API paths remain unchanged;
country information adds field-scoped currency provenance for reviewed corrections.
Existing saved itineraries retain their snapshots and
can still be opened and refreshed; generating a new itinerary uses current rules.

## Curated catalog expansion

| Country | Supported overnight bases |
|---|---|
| Czechia | Prague, Brno, Pilsen |
| Denmark | Copenhagen, Odense, Århus |
| Sweden | Stockholm, Gothenburg, Malmö |
| Ireland | Dublin, Cork, Galway |
| Hungary | Budapest, Pécs, Szeged |
| Slovenia | Ljubljana, Maribor, Koper |
| South Korea | Seoul, Daegu, Busan |
| Morocco | Marrakech, Essaouira |
| Poland | Kraków, Warsaw, Wrocław, Poznań |
| Romania | Bucharest, Braşov, Constanţa |
| Bulgaria | Sofia, Plovdiv, Stara Zagora |
| Lithuania | Vilnius, Kaunas, Klaipėda |

The two October 25 reviews add 26 bases and 29 reviewed connections, including
three newly enabled planning countries. Totals: 65 planning countries, 114 bases,
55 domestic connections, and 26 countries with multi-base routes. The bounded
coverage report counts 88 combinations without direction: 55 pairs, 25 triples,
six four-base and two five-base combinations. Counts are
before individual assessment constraints; they do not promise every combination
for every duration or transport preference. Marrakech → Essaouira is enabled
only in the reviewed direction.

Coordinates and stable IDs come from the existing GeoNames snapshot. Tourism
boards and operators support base suitability and connections; sources and
limitations are in [SOURCES.md](../server/data/SOURCES.md). Budget tiers, search
radii, minimum stays, and buffered transfer minutes are editorial planning rules.
The eight-country advisory review supplies a consistent conservative screening
floor for both old and new bases. It does not establish city-specific safety.
Missing climate, seasonal, payment, or cultural data remains unknown.

## Validation and timed walkthrough

`server/test/routeVariety.test.js` covers the cutoff boundaries, actual route
connectivity, slow relaxed trips, soft budget ranking, visa/risk/transport constraints, insufficient
recommendation pools, and each expanded country. Existing broad routing and daily
scheduling checks now distinguish eligible routes from expected policy refusals.
All automated tests mock provider calls and database operations.

October 25 verification passed 390 JavaScript tests (56 suites) and all eight
Python importer tests. The offline 50-iteration benchmark measured supported
country ranking at 7.4 ms p95 on the development machine. This measures local
planning CPU work only, not Google/Gemini or end-to-end generation latency.
The implementation checks used no paid-provider requests or live database writes.

On October 26, the user also completed a live Canada test: 14 days/13 nights,
with six nights in Montreal and seven in Quebec City. Both recommendation
explanations and itinerary descriptions used accepted Gemini output with no
fallback. Generation took 10.90 seconds. Saving, retrieval, day-place refresh and
saved-trip listing succeeded; route, practical information, descriptions and tips
survived persistence. This test used live providers and database writes. It does
not live-verify the newly added countries. Day 2's nearby viewpoints/backtracking
and Canada's unreviewed legacy payment wording remain known quality limitations.

### Assessment coverage check

Run `npm run planning:assessment-coverage` from `server` for an offline audit.
It returns a nonzero exit code when any checked profile has fewer than three
eligible countries. The same check runs in the normal backend test suite, so
catalog changes cannot silently reintroduce these specific coverage gaps.

The October 25 audit checked 1,008 profiles: every exact duration from 1–21
calendar days, both quiz paces, all three budgets, both risk choices, and all
four personas. It allowed visas and unrestricted domestic transport. All 1,008
now have three distinct eligible countries, and all selected outlines pass
duration, stay-minimum and connection validation. Additional budget routes in
Poland, Romania and Bulgaria close the gaps found in the first audit. There is
also a regression check restricted to just those three eligible countries.

This is not exhaustive proof for every possible assessment. The audit does not
cover all passport-specific visa restrictions, transport subsets, other scoring
preferences, or dates. It validates eligible routes, not subjective quality,
restaurant dietary suitability, or live provider availability. Explicit risk
exclusions and transport choices remain hard filters alongside visa eligibility
and route feasibility; budget no longer excludes countries or routes. A
genuinely restricted eligible pool can still return
`INSUFFICIENT_COUNTRIES`; no restriction is silently ignored to fill three cards.

The frontend's text-form dietary restrictions (including `None` and comma-separated
choices) are now accepted by venue discovery and activity tips alongside arrays.
Bulgaria's newly enabled planning data uses EUR with ECB source provenance,
correcting the older GeoNames currency snapshot. Geography refreshes preserve
that reviewed correction. See [SOURCES.md](../server/data/SOURCES.md) for source
scope and the limitations of the budget tiers.

The walkthrough uses the assessment fields now on main: `budgetLevel`,
`visaWillingness`, and `walkAmount`. Its optional `--nights` setting at signup
persists across all steps. Use a fresh state directory:

```sh
cd /Users/conradmurrell/Voyouger/Vo-you-ger/server
export VOYOUGER_TEST_DIR="$(mktemp -d)"
voyo_flow() { /usr/bin/time -p node scripts/backend-flow-test.js "$@" --state "$VOYOUGER_TEST_DIR" --allow-live; }
voyo_flow signup --scenario variety --nights 13
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

Those opt-in commands create a real account, use paid providers, and save a trip.
Stop at an error. The default test requires accepted Gemini copy, not just HTTP
success. A fourteen-day relaxed test uses `--scenario relaxed --nights 13`
instead; Estonia is now excluded from those long-trip recommendations because
our current catalog has only one enabled base there. This reflects coverage,
not the country's actual tourism potential.

Discovery still checks real venue availability/hours after route selection;
it can report explicit shortages. This change does not resolve overlapping
Google listings, unknown neighborhood data, or unreviewed legacy practical
guidance exposed in earlier live tests.

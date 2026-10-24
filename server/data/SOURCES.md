# Catalog sources and refresh procedure

Snapshot date: **2026-10-23**. Source checksums are in `countries.json.sources`.
Public downloads were retrieved; no paid travel API was used for catalog creation.

| Input | Source | Use / license |
|---|---|---|
| `iso_3166-1.json` | [iso-codes JSON](https://raw.githubusercontent.com/sailfishos-mirror/iso-codes/master/data/iso_3166-1.json) | ISO alpha-2/alpha-3/numeric codes; [LGPL-2.1-or-later notice](https://github.com/sailfishos-mirror/iso-codes/blob/main/REUSE.toml), copyright 2016 Dr. Tobias Quathamer. Upstream: Debian iso-codes team. |
| `countryInfo.txt` | [GeoNames country info](https://download.geonames.org/export/dump/countryInfo.txt) | Country display names, currencies, language codes. GeoNames CC BY 4.0. |
| `cities500.zip` | [GeoNames populated places](https://download.geonames.org/export/dump/cities500.zip) | Settlement identity, country, point coordinates, population and modification date. GeoNames CC BY 4.0. |
| `admin1CodesASCII.txt` | [GeoNames subdivisions](https://download.geonames.org/export/dump/admin1CodesASCII.txt) | Administrative region names. GeoNames CC BY 4.0. |

Attribution: **GeoNames, https://www.geonames.org/, CC BY 4.0**. The data was
modified by selecting populated places, filtering feature codes, selecting
population-ranked settlements at least 1 km apart, and merging existing IDs.
See the [source readme](https://download.geonames.org/export/dump/readme.txt),
[GeoNames terms](https://www.geonames.org/export/), and
[CC BY 4.0 license](https://creativecommons.org/licenses/by/4.0/).
The country registry is transformed from iso-codes; preserve its license notice
when redistributing the registry. The source data is provided without warranty.

## Scope and verification

The registry includes all **249 ISO 3166-1 entries**, including dependencies and
territories. This is not a claim that there are 249 sovereign states. Non-ISO
extensions such as XK are outside the chosen registry.

The importer accepts GeoNames feature class P and codes PPLC, PPLA, PPLA2,
PPLA3, PPLA4, PPL and PPLG. Neighborhood sections (PPLX), abandoned places,
landmarks, hotels and airports do not qualify. Gazetteer assignment remains a
source-based verification, not an independent municipal-boundary audit.
Monaco, Vatican City and Singapore have explicit city-state exceptions; their
quarters/planning areas are not counted as five separate cities. Antarctica's
research stations are not counted as permanent towns. Other below-five entries
are marked `source_gap`, not declared geographically impossible.

Imported records use `gn-<geonameId>`, provenance with a per-record GeoNames URL,
and initially unknown budget/safety/tags/seasonality. They remain **disabled**
unless separately reviewed below. Default stay/radius fields are proposed planning defaults,
not reviewed travel facts. Existing 157 IDs remain present; 116 were matched to
qualifying settlements, with their existing travel tiers labeled legacy editorial.
The remaining broad legacy records stay descriptive and unverified.

## Reproduce or refresh

Download the four files above into a local directory using their original names.
Keep a copy of those inputs if exact byte-for-byte reproduction matters: upstream
daily files and the mirror's branch are mutable. Compare their SHA-256 values with
the manifest before calling a run an exact reproduction.

From the repository root:

```sh
python3 server/scripts/import-geography.py --source-dir /path/to/source-files --snapshot-date 2026-10-23
node server/scripts/planning-coverage.js --all
```

Python's standard library is sufficient. `--data-dir /path/to/catalog-copy`
supports a disposable output directory containing a copy of `destinations.json`.
The importer is idempotent with the same inputs/date/catalog. Later editorial
enrichment of imported IDs is preserved. Source-retired IDs are retained but
disabled for new planning. A former imported ID that becomes a legacy record's
alias is retained as a disabled alias rather than deleted. A source move over
5 km disables readiness for review. Review coordinate changes before enabling transport
edges or accepting a refreshed catalog. It never generates facts with Gemini.

To activate an imported destination, review its travel suitability and actual
assessment-compatible tags, budget, safety limitations, stay minimum and search
radius; document their provenance, then change its review status and enable it.
Add separately sourced domestic connections to `planningCatalog.json`. A verified
settlement without a connection can support a reviewed single-base trip; proximity
alone never creates a transport edge.

## Reviewed route expansion: October 23, 2026

Six formerly geographic-only records are enabled after a separate travel review:
Zürich, Basel, Bern, Lausanne, Geneva and Marseille. Their records include
`provenance.travelReview`, source URLs, review dates and field limitations.

- [Switzerland Tourism city guide](https://www.myswitzerland.com/en-ch/destinations/holiday-destinations/summer-destinations/summer-destinations-search/cities/)
  supports city identity and broad culture/history/lake/nature interests.
- [Switzerland Tourism cost guidance](https://www.myswitzerland.com/en-ch/planning/about-switzerland/general-facts/money-and-shopping/prices-and-quality-of-life/)
  supports conservative high-cost classification. The `$$$` tier is an editorial
  filter, not a verified daily price or promise of affordability. Marseille also
  uses this conservative tier rather than claiming an unsupported lower cost.
- [Marseille tourism](https://www.marseille-tourisme.com/en/experience/visit-marseille/)
  and its [city pass guide](https://www.marseille-tourisme.com/en/experience/citypass-marseille/)
  support broad history/culture/coast/food interests.
- US State Department advisory snapshots for
  [Switzerland](https://travel.state.gov/en/international-travel/travel-advisories/switzerland.html)
  and [France](https://travel.state.gov/en/international-travel/travel-advisories/france.html)
  inform coarse tiers 1 and 2. All verified French bases/excursions use at least
  tier 2. These are country-level snapshots, not city-specific safety guarantees.
  Dates, travel conditions and nationality-specific advice require later review.
- Official SBB network connections support
  [Zürich–Basel](https://network.sbb.ch/en/station/ZUE/target/BS),
  [Basel–Bern](https://network.sbb.ch/en/station/BS/target/BN),
  [Bern–Lausanne](https://network.sbb.ch/en/station/BN/target/LS) and
  [Lausanne–Geneva](https://network.sbb.ch/en/station/LS/target/GE).
- SNCF route pages support
  [Avignon–Marseille](https://www.sncf-connect.com/en-en/train/route/avignon/marseille)
  and [Marseille–Nice](https://www.sncf-connect.com/en-en/train/route/marseille/nice).

The six new domestic edges include conservative editorial access, travel and
accommodation-change allowances. They are not timetables, fares or bookings.
Newly reviewed destinations retain unknown seasonality where no separate review
established it. They are not filled with generated weather claims.

## Display data and attribution

### Informational country cards and globe

`countryInfo.json` projects capital, area, population estimate and continent from
the same GeoNames country-info snapshot. Currency/language codes remain in
`countries.json`. Population reference years vary; these are source estimates,
not uniformly current census figures. Display facts do not enable trip planning.

All 249 registry entries include a representative landscape reference with
plain-text author credit, license, file-description URL and Wikivoyage context URL.
Sources are [Wikivoyage](https://en.wikivoyage.org/) banner templates and
[Wikimedia Commons image information](https://www.mediawiki.org/wiki/API:Imageinfo).
Each photograph has its own license; preserve the visible credit and license link.
Compound territories use a representative component. Iran uses Tehran's banner
because the country-page file was missing. Unavailable remote images have an
explicit frontend fallback. Four representative image URLs were checked live;
this is not a perpetual availability guarantee for all remote media.

`client/src/data/world.json` contains rounded, minimal ISO-matched geometry from
[Natural Earth 1:110m countries](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson),
whose map data is [public domain](https://www.naturalearthdata.com/about/terms-of-use/).
The snapshot hash and source URL are recorded in `countryInfo.json.mapSource`.
The map has 175 matching boundary features; independently sourced location dots
and the complete country selector support smaller/omitted entries. These display
coordinates are independent of Google Places.

Run `server/scripts/import-country-display.py --source-dir /path/to/sources`
with the recorded `countryInfo.txt` and `world-source.geojson` to rebuild offline,
preserving current photo metadata. `--refresh-images` explicitly refreshes public
image metadata using a disk cache, pacing and Retry-After handling. This importer
never changes planning readiness or calls paid services.

### Itinerary practical information: October 24, 2026

`practicalGuidance.json` contains paraphrased, field-scoped guidance reviewed
against the official sources below. Each entry records its review date and
separate payment/tip source URLs. These are snapshots and general travel
guidance, not live confirmation of a specific business's acceptance or policies.

| Country | Payment source | Cultural-tip source |
|---|---|---|
| Portugal | [Turismo de Portugal useful information](https://www.visitportugal.com/en/sobre-portugal/info-util), [Banco de Portugal card acceptance](https://clientebancario.bportugal.pt/en/acceptance-cards) | The same tourism-board page's tipping guidance |
| Poland | [Polish Tourism Organisation money guide](https://www.poland.travel/en/money-in-poland-notes-and-coins/) | No reviewed country-level tips in this snapshot |
| Japan | [JNTO cashless payments](https://www.japan.travel/en/plan/cashless-payments-in-japan/), [JNTO FAQ](https://www.japan.travel/en/faq/) | [JNTO tipping guide](https://www.japan.travel/en/plan/tipping-in-japan/) |
| Switzerland | [Switzerland Tourism currency/payment guide](https://www.myswitzerland.com/en-us/planning/about-switzerland/general-facts/money-and-shopping/currency/) | [Switzerland Tourism tipping guide](https://www.myswitzerland.com/en-us/planning/about-switzerland/general-facts/money-and-shopping/tipping/) |
| Argentina | [Official national tourism FAQ, Money section](https://inprotur-prod.turismo.gob.ar/en/faqs) | No reviewed country-level tips in this snapshot |
| France | [Official Service Public business payment guide](https://entreprendre.service-public.gouv.fr/vosdroits/F22929) | No reviewed country-level tips in this snapshot |

Only the reviewed claims are used. Old prices, visa statements, ATM counts,
exchange rates and unrelated material on those pages are not imported.
Argentina/France's reviewed entries do not establish particular card networks,
so their `cardsAccepted` lists remain empty rather than borrowing unsourced lists.
Unrecorded wallets/limited networks likewise have empty lists meaning unknown.

Currency codes come from the existing GeoNames country snapshot, independent of
Gemini and destination-level currency fields. English names/symbols use Node's
Intl/CLDR display labels, with the code retained to disambiguate shared symbols.
No exchange rates or card-conversion benefits are calculated or claimed.

Existing `destinations.json` payment and cultural notes have no recorded source
reviews. They are preserved only as `legacy_editorial` guidance for the selected
bases; missing-city notes are never copied from another city's record. A country
payment summary can show networks shared by all selected bases, clearly marked
editorial. City customs stay in `practicalInfo.byStop`. Reviewed country payment
guidance takes precedence; reviewed country cultural guidance also takes
precedence over potentially conflicting legacy cultural notes.

To extend reviewed coverage, inspect a primary tourism/government source, add
only supported fields and source URLs, and record the real review date. Do not
promote imported geography or Gemini output to reviewed practical facts.
If policy or acceptance guidance changes, revise the entry and review date.
Saved itineraries retain their guidance/provenance snapshot; missing fields in
older country trips are supplemented on read without a database migration.

Activity `travelTip` text is application-authored planning guidance derived from
available regular hours, food category, dietary uncertainty and travel-day type.
It does not assert specific ticket, dress-code, access or reservation rules.
Google metadata remains subject to the display/refresh rules below.

### Google Places display

Country discovery now applies a conservative visitor-venue classification using
Google's [documented place types](https://developers.google.com/maps/documentation/places/web-service/place-types).
Tour/travel agencies and generic establishments are not treated as scheduled
visitor activities merely because they have an address or 24-hour office hours.
The filter is an application planning rule, not an independent inspection of a
business. Unclassified listings are omitted rather than guessed into activities.

Regular hours prefer Google's [structured weekly periods](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places#OpeningHours),
using local weekday/hour values and week/overnight rollover. English display
text is a fallback, including shared AM/PM markers. Neither representation
verifies special holiday hours, ticket availability or actual visit duration.

Google Places is queried at runtime, not used as a static catalog source. New
country itineraries persist place IDs and application-authored itinerary text;
raw names, addresses, ratings, hours, coordinates and derived provider neighborhood
lists are refreshed for display rather than stored. Existing saved legacy records
are not automatically rewritten.

The unmodified `client/src/assets/google-maps-attribution.svg` comes from
[Google's official attribution asset archive](https://developers.google.com/static/maps/documentation/images/Google_Maps_Attribution_Assets.zip),
`GoogleMaps_Logo_DarkGray.svg`. It is a Google brand asset, not a CC-licensed
application illustration. Use only according to the
[Places attribution policy](https://developers.google.com/maps/documentation/places/web-service/policies).
The UI also displays returned third-party attribution. Review deployed Terms of
Use, Privacy Policy and any billing-region-specific terms before launch.

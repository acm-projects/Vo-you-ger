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

## Reviewed route expansion: October 25, 2026

Fifteen existing gazetteer-verified records are newly enabled. No settlements or
coordinates were generated. This expands eight existing planning countries:

| Country | Enabled bases after review | Official tourism review |
|---|---|---|
| Czechia | Prague, Brno, Pilsen | [Brno](https://www.visitczechia.com/en-us/things-to-do/places/landmarks/cities/t-brno), [Pilsen](https://www.visitczechia.com/en-us/campaigns/2025/expo/pilsen-region) |
| Denmark | Copenhagen, Odense, Århus | [Odense](https://www.visitdenmark.com/denmark/destinations/fyn/odense), [Aarhus](https://www.visitdenmark.com/denmark/destinations/jutland/aarhus) |
| Sweden | Stockholm, Gothenburg, Malmö | [Gothenburg](https://visitsweden.com/where-to-go/southern-sweden/goteborg/), [Malmö](https://visitsweden.com/where-to-go/southern-sweden/malmo/) |
| Ireland | Dublin, Cork, Galway | [Cork](https://www.ireland.com/en-gb/home/destinations/county/cork/cork-city/), [Galway](https://www.ireland.com/en-gb/destinations/county/galway/galway-city/) |
| Hungary | Budapest, Pécs, Szeged | [Pécs](https://visithungary.com/destination/pecs), [Szeged](https://visithungary.com/destination/szeged-region) |
| Slovenia | Ljubljana, Maribor, Koper | [Slovenian Tourism Board city guide](https://www.slovenia.info/en/places-to-go/cities-and-destinations) |
| South Korea | Seoul, Daegu, Busan | [Daegu](https://english.visitkorea.or.kr/svc/contents/contentsView.do?menuSn=219&vcontsId=1590230), [Busan](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=1589997) |
| Morocco | Marrakech, Essaouira | [Moroccan National Tourist Office](https://visitmorocco.com/en/travel/essaouira-mogador) |

Nineteen connections were reviewed against the following primary sources.
Their stored minutes are **editorial door-to-door planning allowances**, including
local access and changing accommodation. They are not copied journey times,
departure schedules, fares, bookings or guarantees of service on a future date.

- Czech Railways: [Prague–Brno](https://www.cd.cz/trasy/trasy-ceska-republika/praha-brno/-30125/)
  and [Prague–Pilsen InterJet](https://www.cd.cz/nase-vlaky/interjet/interjet/-35817/).
- DSB: [Copenhagen–Odense](https://www.dsb.dk/en/train-rides-in-denmark/copenhagen-odense/),
  [Odense–Aarhus](https://www.dsb.dk/en/travelling-in-the-cities/odense/), and
  [VisitDenmark's Copenhagen–Aarhus guide](https://www.visitdenmark.com/denmark/plan-your-trip/transport/public-transport).
- Visit Sweden's city transport sections: [Stockholm–Gothenburg](https://visitsweden.com/where-to-go/southern-sweden/goteborg/)
  and [Gothenburg–Malmö / Stockholm–Malmö](https://visitsweden.com/where-to-go/southern-sweden/malmo/).
- Irish Rail's [Dublin–Cork and Dublin–Galway route timetables](https://www.irishrail.ie/en-ie/train-timetables/timetables-by-route).
  Tourism Ireland's [Cork transport section](https://www.ireland.com/en-gb/home/destinations/county/cork/cork-city/)
  separately supports the Cork–Galway **bus** connection; no direct train is claimed.
- MÁV: [Budapest–Pécs Mecsek service](https://www.mavcsoport.hu/mav-szemelyszallitas/szolgaltatasok/kerekparszallitas/belfold/turisztikai-kerekparszallitas/mecsek)
  and [Budapest–Szeged Napfény service](https://www.mavcsoport.hu/mav-csoport/bovitett-kapacitassal-es-ejszakai-jaratokkal-keszul-mav-csoport-szegedi-ifjusagi-napokra).
  Event-specific extra trains are not imported or promised.
- [Slovenian Tourism Board rail guide](https://www.slovenia.info/en/plan-your-trip/getting-to-and-around-slovenia/to-slovenia-by-train)
  and [Slovenian Railways route timetables](https://potniski.sz.si/vozni-redi/vozni-redi-po-relacijah/):
  Ljubljana–Maribor and Ljubljana–Koper.
- Korea Tourism Organization's [Gyeongbu rail guide](https://english1.visitkorea.or.kr/enu/TRP/TP_ENG_4.jsp)
  and [Seoul–Busan transport guide](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=1589997):
  Seoul–Daegu, Daegu–Busan and Seoul–Busan. Daegu uses Dongdaegu for this line;
  the allowance includes local access rather than promising a downtown station.
- CTM's [Marrakech–Essaouira coach result](https://booking.ctm.ma/journeys?dCity=5595&fareClasses=BONUS_SCHEME_GROUP.ADULT%2C1&oCity=5686&oDate=2026-06-06)
  confirms the forward connection. Only Marrakech → Essaouira is enabled;
  the reverse direction has not been separately reviewed. No fares or fixed
  departures from this result are imported.

New budget tiers (`$$` or conservatively `$$$`) are explicitly labeled
`editorial_planning_tier`: they are coarse app screening judgments, not sourced
daily-spend amounts or guarantees that particular accommodation is affordable.
New imported bases retain unknown seasonality and climate. No payment guidance,
cultural advice, hotels or venue facts were copied from another city.

The review also applies the same country-advisory floor to existing and new bases
in these eight countries, using the U.S. State Department snapshots checked on
October 25: [Czechia (1)](https://travel.state.gov/en/international-travel/travel-advisories/czechia.html),
[Denmark (2)](https://travel.state.gov/en/international-travel/travel-advisories/denmark.html),
[Sweden (2)](https://travel.state.gov/en/international-travel/travel-advisories/sweden.html),
[Ireland (1)](https://travel.state.gov/en/international-travel/travel-advisories/ireland.html),
[Hungary (1)](https://travel.state.gov/en/international-travel/travel-advisories/hungary.html),
[Slovenia (1)](https://travel.state.gov/en/international-travel/travel-advisories/slovenia.html),
[South Korea (1)](https://travel.state.gov/en/international-travel/travel-advisories/south-korea.html),
and [Morocco (2)](https://travel.state.gov/en/international-travel/travel-advisories/morocco.html).
Existing higher editorial tiers are retained. These are country-level screening
snapshots, not city safety measurements or future-travel guarantees.

## Additional assessment-coverage review: October 25, 2026

Eleven more existing, gazetteer-verified records are enabled. They add planning
in Romania, Bulgaria and Lithuania and expand Poland. No coordinates or new IDs
were generated. All new bases have a two-night editorial minimum and separately
reviewed country-level advisory screening at tier 1.

| Country | New bases | Tourism sources |
|---|---|---|
| Poland | Wrocław, Poznań | [Wrocław tourism organization](https://visitwroclaw.eu/en/), [Poznań tourism organization](https://visitpoznan.pl/en/poznan-top-10) |
| Romania | Bucharest, Braşov, Constanţa | [Bucharest](https://romaniatourism.com/bucharest.html), [Braşov](https://romaniatourism.com/brasov.html), [Constanţa](https://romaniatourism.com/constanta.html) |
| Bulgaria | Sofia, Plovdiv, Stara Zagora | [Sofia](https://visitbulgaria.com/sofia/), [Plovdiv](https://visitbulgaria.com/plovdiv-city/), [Stara Zagora](https://visitbulgaria.com/stara-zagora/) |
| Lithuania | Vilnius, Kaunas, Klaipėda | [Vilnius](https://lithuania.travel/en/where-to-visit/major-cities/vilnius), [Kaunas](https://lithuania.travel/en/where-to-visit/major-cities/kaunas), [Klaipėda](https://lithuania.travel/en/where-to-visit/major-cities/klaipeda-major-cities) |

RomaniaTourism is a tourism publisher; it is not the Romanian government or the
source of safety/visa decisions. Broad city interests and transport corridors
are paraphrased. Individual attractions are still discovered through Google.

The `$` tiers for the new Polish, Romanian and Bulgarian bases are editorial
budget-oriented planning judgments informed by
[Eurostat's 2025 national price-level review](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260618-2),
published June 18, 2026. It identifies those three countries as the EU's lowest
overall household-consumption price levels. Household expenditure is **not** a
tourist daily budget: these tiers do not establish accommodation prices, total
trip cost, or affordability for every traveler. Lithuanian bases conservatively
use `$$`. No existing destination has been made cheaper to pass the audit.

Country-advisory sources checked for this review:
[Poland](https://travel.state.gov/en/international-travel/travel-advisories/poland.html),
[Romania](https://travel.state.gov/en/international-travel/travel-advisories/romania.html),
[Bulgaria](https://travel.state.gov/en/international-travel/travel-advisories/bulgaria.html),
and [Lithuania](https://travel.state.gov/en/international-travel/travel-advisories/lithuania.html).
These country-level snapshots do not guarantee city safety or future conditions.

Ten additional connections use buffered editorial allowances, not timetables:

- [POLREGIO's published Wrocław–Poznań corridor](https://polregio.pl/pl/rozklad-jazdy-i-mapa-polaczen/rozklad-jazdy/): train, 240 minutes.
- [Polish Tourism Organisation's rail guide](https://www.poland.travel/en/timetables/): Warsaw–Wrocław (360) and Warsaw–Poznań (300), train.
- FlixBus's [Kraków–Wrocław](https://global.flixbus.com/bus-routes/bus-krakow-wroclaw)
  and [reverse route](https://global.flixbus.com/bus-routes/bus-wroclaw-krakow): bus, 360 minutes.
- [CFR's Bucharest–Ploiești–Braşov corridor notice](https://www.cfrcalatori.ro/comunicate/intarzieri-in-circulatia-trenurilor-de-calatori-pe-relatia-bucuresti-ploiesti-brasov/): train, 300 minutes.
- [RomaniaTourism's Constanţa transport guide](https://romaniatourism.com/constanta.html): Bucharest–Constanţa, train, 300 minutes.
- [BDZ's Sofia route list](https://www.bdz.bg/bg): Sofia–Plovdiv, train, 360 minutes.
- [BDZ's published corridor table](https://p.bdz.bg/www/0/4/04-plovdiv-sofiia-2-499.pdf): Stara Zagora–Plovdiv corridor, train, 240 minutes.
- [Go Vilnius's rail guide](https://www.govilnius.lt/visit-vilnius/plan-your-trip/arrival/trains): Vilnius–Kaunas (210) and Vilnius–Klaipėda (360), train.

Historical timetable tables and disruption notices establish corridors; they do
not verify future departures. The allowances include access and changing
accommodation. Booking remains the traveler's responsibility. New regions retain
unknown climate/seasonality and missing practical guidance rather than invented
values. No new route has been tested against live Google/Gemini requests here.

Bulgaria's GeoNames snapshot still reported BGN. The country registry now has a
field-scoped, source-reviewed EUR correction based on the
[ECB's January 1, 2026 announcement](https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.pr260101~c830245e42.en.html).
Country information and itinerary currency provenance expose that source. The
geography importer preserves reviewed currency corrections once effective; it
does not infer currency from tourism pages or generate exchange rates.

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

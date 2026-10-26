#!/usr/bin/env python3
"""Reproducible offline GeoNames/ISO importer. Never creates travel/safety claims.
Inputs: iso_3166-1.json, countryInfo.txt, cities500.zip, admin1CodesASCII.txt.
Geographic datasets: GeoNames CC BY 4.0; iso-codes registry LGPL-2.1-or-later.
"""
import argparse, hashlib, json, math, unicodedata, zipfile
from datetime import date
from collections import defaultdict
from pathlib import Path


def normalized(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value.casefold()) if c.isalnum())


def distance(a, b):
    lat1, lat2 = math.radians(a[0]), math.radians(b[0])
    h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(math.radians(b[1]-a[1])/2)**2
    return 12742 * math.asin(min(1, math.sqrt(h)))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--source-dir', type=Path, required=True)
    ap.add_argument('--snapshot-date', required=True)
    ap.add_argument('--data-dir', type=Path, default=Path(__file__).resolve().parents[1]/'data')
    args = ap.parse_args()
    try:
        if date.fromisoformat(args.snapshot_date).isoformat() != args.snapshot_date:
            raise ValueError()
    except ValueError:
        ap.error('--snapshot-date must be a real YYYY-MM-DD date')
    sources = args.source_dir
    iso = json.loads((sources/'iso_3166-1.json').read_text())['3166-1']
    iso_by_code = {c['alpha_2']: c for c in iso}
    info = {}
    for line in (sources/'countryInfo.txt').read_text().splitlines():
        if line and not line.startswith('#'):
            row = line.split('\t'); info[row[0]] = row
    admins = {}
    for line in (sources/'admin1CodesASCII.txt').read_text().splitlines():
        row = line.split('\t'); admins[row[0]] = row[1]
    destinations_path = args.data_dir/'destinations.json'
    destinations = json.loads(destinations_path.read_text())
    registry_path = args.data_dir/'countries.json'
    prior_countries = {c['countryCode']: c for c in json.loads(registry_path.read_text())['countries']} if registry_path.exists() else {}
    # Preserve later editorial enrichment of imported IDs across source refreshes.
    prior_imports = {d['id']: d for d in destinations if d.get('id','').startswith('gn-')}
    legacy = [d for d in destinations if not d.get('id','').startswith('gn-')]
    expected = defaultdict(set)
    for d in legacy:
        expected[d['countryCode']].add(normalized(d['name']))
    aliases = {'new-york-us':['New York City'], 'quebec-city-ca':['Quebec'], 'washington-dc-us':['Washington','Washington D.C.']}
    for d in legacy:
        for name in aliases.get(d['id'], []): expected[d['countryCode']].add(normalized(name))
    pool, matches = defaultdict(list), defaultdict(list)
    allowed = {'PPLC','PPLA','PPLA2','PPLA3','PPLA4','PPL','PPLG'}
    with zipfile.ZipFile(sources/'cities500.zip') as archive:
        with archive.open('cities500.txt') as stream:
            for raw in stream:
                r = raw.decode('utf-8').rstrip('\n').split('\t')
                if len(r) < 19 or r[8] not in iso_by_code or r[6] != 'P' or r[7] not in allowed: continue
                point = dict(id=int(r[0]),name=r[1],ascii=r[2],lat=float(r[4]),lng=float(r[5]),featureCode=r[7],code=r[8],admin=r[10],population=int(r[14] or 0),updated=r[18])
                pool[r[8]].append(point)
                names = {normalized(n) for n in [r[1],r[2]]+r[3].split(',')}
                if names & expected[r[8]]: matches[r[8]].append((point,names))
    def geography(point):
        return dict(status='verified_gazetteer',geonameId=point['id'],featureCode=point['featureCode'],sourceUrl=f"https://www.geonames.org/{point['id']}/",sourceUpdatedOn=point['updated'],snapshotDate=args.snapshot_date,license='CC-BY-4.0',verificationScope='Named populated place and country assignment in GeoNames; not travel/safety approval')
    used_ids = set()
    points_by_id = {point['id']: point for points in pool.values() for point in points}
    canonical_ids = {}
    for d in legacy:
        names = {normalized(d['name'])} | {normalized(n) for n in aliases.get(d['id'],[])}
        possible = [p for p,n in matches[d['countryCode']] if n & names]
        planning = d.get('planning')
        if planning:
            possible = [p for p in possible if distance((planning['lat'],planning['lng']),(p['lat'],p['lng'])) < 25]
        possible.sort(key=lambda p:(-p['population'],p['id']))
        provenance = d.setdefault('provenance',{})
        provenance.setdefault('budget', {'status':'editorial_legacy' if d.get('budget') else 'unknown','limitation':'Coarse catalog tier; not verified current prices'})
        provenance.setdefault('safety', {'status':'editorial_legacy' if d.get('safety') is not None else 'unknown','limitation':'Legacy editorial tier; not a current advisory or guarantee'})
        prior_id = provenance.get('geography',{}).get('geonameId')
        if prior_id:
            prior_point = points_by_id.get(prior_id)
            possible = [prior_point] if prior_point and prior_point['code']==d['countryCode'] else []
        if possible and (d['type'] in ('city','town') or planning):
            point = possible[0]; used_ids.add(point['id']); canonical_ids[point['id']] = d['id']; provenance['geography'] = geography(point)
            d['coordinates'] = {'lat':point['lat'],'lng':point['lng']}
            if planning:
                moved = distance((planning['lat'],planning['lng']),(point['lat'],point['lng'])) > 5
                planning.update(lat=point['lat'],lng=point['lng'],locationPrecision='gazetteer_point')
                if moved: planning.update(enabled=False,reviewStatus='needs_geographic_review')
                else: planning.setdefault('reviewStatus','legacy_editorial')
        else:
            if prior_id:
                provenance['geography']['status'] = 'source_record_missing'
            else:
                provenance['geography'] = {'status':'unverified_legacy','limitation':'Not matched to a qualifying named settlement; may be a region or landmark'}
            if planning: planning.update(enabled=False,reviewStatus='needs_geographic_review')
    additions, registry = [], []
    # City states and uninhabited Antarctica need explicit settlement exceptions.
    exceptions = {'MC':('city_state','Monaco is a single municipality; quarters are not counted as independent towns.'),'VA':('city_state','Vatican City is one city-state.'),'SG':('city_state','Singapore is a city-state; planning areas/neighborhoods are not counted as separate cities.'),'AQ':('no_permanent_cities','Research stations are not counted as permanent cities or towns.')}
    for code, country in sorted(iso_by_code.items()):
        rows = sorted(pool[code],key=lambda p:(-p['population'],p['id']))
        selected = []
        if code != 'AQ':
            limit = 1 if code in exceptions else 5
            for point in rows:
                if all(distance((point['lat'],point['lng']),(p['lat'],p['lng'])) >= 1 for p in selected): selected.append(point)
                if len(selected) >= limit: break
        selected_ids = {point['id'] for point in selected}
        for point in rows:
            if f"gn-{point['id']}" in prior_imports and point['id'] not in selected_ids:
                selected.append(point)
                selected_ids.add(point['id'])
        for point in selected:
            if point['id'] in used_ids: continue
            used_ids.add(point['id'])
            region = admins.get(f"{code}.{point['admin']}",point['name'])
            additions.append(dict(id=f"gn-{point['id']}",name=point['name'],country=info.get(code,['','','','',country['name']])[4],countryCode=code,type='city' if point['featureCode'] in ('PPLC','PPLA') else 'town',coordinates={'lat':point['lat'],'lng':point['lng']},region=region,tags=[],budget=None,bestMonths=[],climate=None,safety=None,description='',provenance={'geography':geography(point),'budget':{'status':'unknown'},'safety':{'status':'unreviewed','limitation':'Gazetteer presence does not establish safe or feasible travel'}},planning={'enabled':False,'potentialOvernightBase':True,'lat':point['lat'],'lng':point['lng'],'region':region,'minNights':2,'radiusKm':15,'reviewStatus':'pending_travel_review','locationPrecision':'gazetteer_point'}))
            imported = additions[-1]
            previous = prior_imports.get(imported['id'])
            if previous:
                for field in ['tags','budget','bestMonths','climate','safety','description']:
                    if field in previous: imported[field] = previous[field]
                imported['provenance'].update({key:value for key,value in previous.get('provenance',{}).items() if key != 'geography'})
                imported['planning'].update(previous.get('planning',{}))
                if distance((imported['planning']['lat'],imported['planning']['lng']),(point['lat'],point['lng'])) > 5:
                    imported['planning'].update(enabled=False,reviewStatus='needs_geographic_review')
                imported['planning'].update(lat=point['lat'],lng=point['lng'])
        row = info.get(code)
        exception = exceptions.get(code)
        registry.append(dict(id=f"country-{code.lower()}",countryCode=code,alpha3=country['alpha_3'],numeric=country['numeric'],name=row[4] if row else country['name'],isoName=country['name'],officialName=country.get('official_name',country['name']),currencyCode=row[10] if row else None,languages=row[15].split(',') if row and row[15] else [],coverageException={'code':exception[0],'reason':exception[1]} if exception else None))
        # Preserve explicit reviewed corrections when the upstream snapshot lags
        # a currency change. Do not infer currencies from an enabled city.
        correction = prior_countries.get(code, {}).get('currencyProvenance', {})
        corrected_code = correction.get('currencyCode', '')
        if (correction.get('status') == 'source_reviewed' and
                len(corrected_code) == 3 and corrected_code.isascii() and corrected_code.isalpha() and corrected_code.isupper() and
                correction.get('effectiveFrom', '9999-12-31') <= args.snapshot_date and correction.get('sources')):
            registry[-1].update(currencyCode=corrected_code, currencyProvenance=correction)
    # Retired or reclassified source records keep their IDs but lose readiness.
    # Never silently remove a destination referenced by a saved trip.
    generated_ids = {d['id'] for d in additions}
    for previous in prior_imports.values():
        if previous['id'] in generated_ids: continue
        geoname_id = previous.get('provenance',{}).get('geography',{}).get('geonameId')
        previous['planning'].update(enabled=False,reviewStatus='needs_geographic_review')
        if geoname_id in canonical_ids:
            previous['planning'].update(reviewStatus='alias_record',canonicalDestinationId=canonical_ids[geoname_id])
        else:
            previous['provenance']['geography']['status'] = 'source_record_missing'
        additions.append(previous)
    result = legacy + sorted(additions,key=lambda d:(d['countryCode'],d['id']))
    for country in registry:
        records = [d for d in result if d['countryCode']==country['countryCode'] and d.get('provenance',{}).get('geography',{}).get('status')=='verified_gazetteer']
        if country['countryCode'] in exceptions:
            cap = 0 if country['countryCode']=='AQ' else 1
            records = records[:cap]
        country['verifiedSettlementCount'] = len({d['provenance']['geography']['geonameId'] for d in records})
        country['geographicCoverage'] = 'minimum_met' if country['verifiedSettlementCount']>=5 else 'exception' if country['coverageException'] else 'source_gap'
        if country['verifiedSettlementCount']<5 and not country['coverageException']:
            country['coverageException']={'code':'insufficient_qualifying_source_records','reason':'Fewer than five qualifying distinct settlements in this source snapshot; not a claim that no other settlements exist.'}
    manifest = dict(version=args.snapshot_date,scope='ISO 3166-1 alpha-2, including territories/dependencies; excludes non-ISO extensions such as XK. Geographic coverage is separate from operational planning readiness.',sources=[dict(file=name,sha256=hashlib.sha256((sources/name).read_bytes()).hexdigest()) for name in ['iso_3166-1.json','countryInfo.txt','cities500.zip','admin1CodesASCII.txt']],attribution='GeoNames (https://www.geonames.org), CC BY 4.0; country-code registry from iso-codes (LGPL-2.1-or-later). Data transformed by filtering settlements, selecting geographically distinct population-ranked records, and merging legacy IDs.',countries=registry)
    destinations_path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    (args.data_dir/'countries.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'registryCountries':len(registry),'withFiveSettlements':sum(c['verifiedSettlementCount']>=5 for c in registry),'belowFive':sum(c['verifiedSettlementCount']<5 for c in registry),'destinations':len(result),'matchedLegacy':sum(d['provenance']['geography']['status']=='verified_gazetteer' for d in legacy)},indent=2))

if __name__=='__main__': main()

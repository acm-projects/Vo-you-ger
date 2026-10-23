#!/usr/bin/env python3
"""Build informational country cards from GeoNames and free Wikivoyage banners.
Does not change planning eligibility. Network access requires --refresh-images.
"""
import argparse, hashlib, html, json, re, time, urllib.parse, urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = None
AGENT = 'Voyouger/1.0 (country information snapshot; educational travel planner)'
CONTINENTS = {'AF':'Africa','AS':'Asia','EU':'Europe','NA':'North America','SA':'South America','OC':'Oceania','AN':'Antarctica'}
# Iran's country page currently refers to a missing banner; use its capital's
# travel-page landscape. Compound territories use a representative component.
TITLES = {'CG':'Republic of the Congo','CD':'Democratic Republic of the Congo','GE':'Georgia (country)','FM':'Federated States of Micronesia','KP':'North Korea','KR':'South Korea','PS':'Palestinian territories','TL':'East Timor','CI':"Côte d'Ivoire",'VA':'Vatican City','MM':'Myanmar','SZ':'Eswatini','CZ':'Czech Republic','BQ':'Bonaire','SJ':'Svalbard','TF':'Kerguelen','UM':'Midway Islands','IR':'Tehran'}

def request(host, params):
    url = f'https://{host}/w/api.php?' + urllib.parse.urlencode({'format':'json','formatversion':2, **params})
    cached=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.json')
    if cached.exists(): return json.loads(cached.read_text())
    req = urllib.request.Request(url, headers={'User-Agent':AGENT})
    for attempt in range(4):
        try:
            time.sleep(2)
            with urllib.request.urlopen(req, timeout=25) as response: result = json.load(response)
            break
        except urllib.error.HTTPError as error:
            if error.code!=429 or attempt==3: raise
            delay=min(60,max(15,int(error.headers.get('Retry-After','30'))))
            print(f'Public image API rate limit; waiting {delay}s before retry.',flush=True)
            time.sleep(delay)
    if 'error' in result: raise RuntimeError('Public media API returned an error')
    cached.write_text(json.dumps(result))
    return result

def plain(value):
    return html.unescape(re.sub('<[^>]+>', '', value or '')).strip()[:600]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', required=True, type=Path)
    parser.add_argument('--refresh-images', action='store_true')
    args = parser.parse_args()
    global CACHE
    CACHE=args.source_dir/'country-media-cache'; CACHE.mkdir(exist_ok=True)
    registry = json.loads((ROOT/'server/data/countries.json').read_text())
    rows = {r[0]:r for line in (args.source_dir/'countryInfo.txt').read_text().splitlines() if line and not line.startswith('#') for r in [line.split('\t')]}
    world_path = args.source_dir/'world-source.geojson'
    source_world = json.loads(world_path.read_text())
    world=[]; labels={}
    for feature in source_world['features']:
        p=feature['properties']; code=p.get('ISO_A2_EH') or p.get('ISO_A2')
        if not code or code=='-99': continue
        labels[code]={'lat':p['LABEL_Y'],'lng':p['LABEL_X']}
        def rounded(item):
            return [rounded(x) for x in item] if isinstance(item,list) else round(item,3)
        world.append({'type':'Feature','id':code,'properties':{'countryCode':code},'geometry':{'type':feature['geometry']['type'],'coordinates':rounded(feature['geometry']['coordinates'])}})
    existing_path=ROOT/'server/data/countryInfo.json'
    previous=json.loads(existing_path.read_text()).get('countries',{}) if existing_path.exists() else {}
    info={}
    for c in registry['countries']:
        code=c['countryCode']; row=rows.get(code)
        info[code]={'capital':row[5] or None if row else None,'continent':CONTINENTS.get(row[8]) if row else None,
                    'areaKm2':float(row[6]) if row and row[6] else None,'population':int(row[7]) if row and row[7] else None,
                    'displayPin':labels.get(code), 'photo':previous.get(code,{}).get('photo')}
        if not info[code]['displayPin']:
            destinations=json.loads((ROOT/'server/data/destinations.json').read_text())
            record=next((d for d in destinations if d['countryCode']==code and d.get('coordinates')),None)
            if record: info[code]['displayPin']=record['coordinates']
    if args.refresh_images:
        names={c['countryCode']:TITLES.get(c['countryCode'],c['name'].strip()) for c in registry['countries']}
        banners={}
        codes=list(names)
        for offset in range(0,len(codes),25):
            batch=codes[offset:offset+25]
            params={'action':'query','titles':'|'.join(names[c] for c in batch),'prop':'images','imlimit':500,'redirects':1}
            aliases={names[c]:c for c in batch}
            for _ in range(4):
                result=request('en.wikivoyage.org',params)
                for redirect in result.get('query',{}).get('redirects',[]):
                    if redirect['from'] in aliases: aliases[redirect['to']]=aliases[redirect['from']]
                for page in result.get('query',{}).get('pages',[]):
                    code=aliases.get(page['title'])
                    options=[i['title'] for i in page.get('images',[]) if re.search(r'banner.*\.(jpg|jpeg|png)$',i['title'],re.I) and 'default' not in i['title'].lower()]
                    if code and options: banners[code]=options[0]
                if 'continue' not in result: break
                params.update(result['continue'])
                time.sleep(.1)
            print(f'Country image titles: {min(offset+25,len(codes))}/{len(codes)}',flush=True)
        # Some actual banner filenames do not contain the word 'banner'. Read
        # only missing pages' banner templates, rather than picking random images.
        missing=[code for code in codes if code not in banners]
        for offset in range(0,len(missing),20):
            batch=missing[offset:offset+20]; aliases={names[c]:c for c in batch}
            result=request('en.wikivoyage.org',{'action':'query','titles':'|'.join(aliases),'prop':'revisions','rvprop':'content','rvslots':'main','redirects':1})
            for redirect in result.get('query',{}).get('redirects',[]):
                if redirect['from'] in aliases: aliases[redirect['to']]=aliases[redirect['from']]
            for page in result.get('query',{}).get('pages',[]):
                code=aliases.get(page['title'])
                revisions=page.get('revisions',[])
                text=revisions[0].get('slots',{}).get('main',{}).get('content','') if revisions else ''
                template=re.search(r'\{\{\s*pagebanner\s*\|([^}]+)\}\}',text,re.I)
                options=[part.strip() for part in template[1].split('|') if re.search(r'\.(jpg|jpeg|png)$',part.strip(),re.I) and '=' not in part] if template else []
                if code and options and 'default' not in options[0].lower(): banners[code]='File:'+options[0].removeprefix('File:').strip()
        files=list(dict.fromkeys(banners.values())); metadata={}
        for offset in range(0,len(files),20):
            result=request('commons.wikimedia.org',{'action':'query','titles':'|'.join(files[offset:offset+20]),'prop':'imageinfo','iiprop':'url|extmetadata','iiurlwidth':1200})
            for page in result.get('query',{}).get('pages',[]):
                image=next(iter(page.get('imageinfo',[])),None)
                if not image: continue
                meta=image.get('extmetadata',{}); field=lambda key:plain(meta.get(key,{}).get('value'))
                if not field('LicenseShortName'): continue
                metadata[page['title'].replace('_',' ')]={'url':image.get('thumburl',image['url']),'sourceUrl':image['descriptionurl'],
                                        'credit':field('Artist') or field('Credit') or 'Wikimedia Commons contributors',
                                        'license':field('LicenseShortName'),'licenseUrl':meta.get('LicenseUrl',{}).get('value') or None,
                                        'alt':field('ImageDescription') or 'Country landscape banner from Wikivoyage'}
            time.sleep(.1)
        for code,title in banners.items():
            info[code]['photo']=metadata.get(title.replace('_',' '))
            if info[code]['photo']: info[code]['photo']['contextUrl']='https://en.wikivoyage.org/wiki/'+urllib.parse.quote(names[code].replace(' ','_'))
    output={'snapshotDate':date.today().isoformat(),'source':'https://download.geonames.org/export/dump/countryInfo.txt',
            'mapSource':{'url':'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson','sha256':hashlib.sha256(world_path.read_bytes()).hexdigest(),'license':'Public domain'},
            'sourceSha256':hashlib.sha256((args.source_dir/'countryInfo.txt').read_bytes()).hexdigest(),
            'license':'CC-BY-4.0','populationNote':'Source snapshot estimate; reference years vary by country.','countries':info}
    existing_path.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'client/src/data').mkdir(exist_ok=True)
    (ROOT/'client/src/data/world.json').write_text(json.dumps({'type':'FeatureCollection','features':world},separators=(',',':'))+'\n')
    print(json.dumps({'countries':len(info),'photos':sum(bool(c['photo']) for c in info.values()),'boundaries':len(world)}))

if __name__=='__main__': main()

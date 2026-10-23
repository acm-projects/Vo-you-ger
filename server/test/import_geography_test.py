"""Offline importer tests using explicitly synthetic gazetteer fixtures."""
import json
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path

IMPORTER = Path(__file__).resolve().parents[1] / 'scripts' / 'import-geography.py'


class GeographyImporterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.data = self.root / 'data'
        self.data.mkdir()
        self.legacy = dict(id='legacy-town', name='Test Town 0', country='Test Country',
                           countryCode='XX', type='city', tags=['food'], budget='$$', safety=2,
                           planning=dict(enabled=True, lat=10, lng=20, region='Test Region', minNights=2, radiusKm=15))
        (self.data / 'destinations.json').write_text(json.dumps([self.legacy]))
        (self.root / 'iso_3166-1.json').write_text(json.dumps({'3166-1': [dict(alpha_2='XX', alpha_3='XXX', numeric='000', name='Test Country')]}))
        row=['']*19
        row[0]='XX'; row[4]='Test Country'; row[10]='XXX'; row[15]='en'
        (self.root / 'countryInfo.txt').write_text('\t'.join(row)+'\n')
        (self.root / 'admin1CodesASCII.txt').write_text('XX.01\tTest Region\tTest Region\t1\n')
        rows=[]
        for index in range(7):
            row=['']*19
            row[0]=str(index+1);row[1]=row[2]=f'Test Town {index}'
            row[4]=str(10+index/10);row[5]='20';row[6]='P'
            row[7]='PPLX' if index==6 else 'PPL';row[8]='XX';row[10]='01'
            row[14]=str(10000-index);row[18]='2026-10-20'
            rows.append('\t'.join(row))
        with zipfile.ZipFile(self.root / 'cities500.zip', 'w') as archive:
            archive.writestr('cities500.txt','\n'.join(rows)+'\n')

    def run_import(self):
        subprocess.run(['python3',str(IMPORTER),'--source-dir',str(self.root),
                        '--snapshot-date','2026-10-23','--data-dir',str(self.data)],
                       check=True, capture_output=True, text=True)
        return json.loads((self.data / 'destinations.json').read_text())

    def test_identity_provenance_and_idempotency(self):
        result=self.run_import()
        self.assertEqual(len(result),5)
        self.assertEqual(result[0]['id'],'legacy-town')
        self.assertEqual(result[0]['provenance']['geography']['geonameId'],1)
        self.assertTrue(all(d['name']!='Test Town 6' for d in result))
        before={p.name:p.read_bytes() for p in self.data.iterdir()}
        self.run_import()
        self.assertEqual(before,{p.name:p.read_bytes() for p in self.data.iterdir()})

    def test_imports_do_not_become_reviewed_travel_claims(self):
        result=self.run_import()
        for destination in result[1:]:
            self.assertIsNone(destination['budget'])
            self.assertIsNone(destination['safety'])
            self.assertEqual(destination['tags'],[])
            self.assertFalse(destination['planning']['enabled'])
            self.assertEqual(destination['planning']['reviewStatus'],'pending_travel_review')

    def test_later_editorial_enrichment_is_preserved(self):
        result=self.run_import()
        result[1]['tags']=['food']
        result[1]['description']='Manually reviewed description'
        result[1]['planning']['minNights']=3
        (self.data/'destinations.json').write_text(json.dumps(result))
        refreshed=self.run_import()
        self.assertEqual(refreshed[1]['tags'],['food'])
        self.assertEqual(refreshed[1]['description'],'Manually reviewed description')
        self.assertEqual(refreshed[1]['planning']['minNights'],3)

    def test_reviewed_legacy_metadata_is_not_downgraded(self):
        result=self.run_import()
        result[0]['planning']['reviewStatus']='reviewed'
        result[0]['provenance']['budget']={'status':'reviewed','sourceUrl':'https://example.test/costs'}
        (self.data/'destinations.json').write_text(json.dumps(result))
        refreshed=self.run_import()
        self.assertEqual(refreshed[0]['planning']['reviewStatus'],'reviewed')
        self.assertEqual(refreshed[0]['provenance']['budget']['status'],'reviewed')

    def test_legacy_match_keeps_imported_alias_id(self):
        result=self.run_import()
        former=result[1]
        alias=dict(self.legacy,id='second-legacy',name=former['name'],planning=dict(self.legacy['planning'],lat=former['coordinates']['lat'],lng=former['coordinates']['lng']))
        result.insert(1,alias)
        (self.data/'destinations.json').write_text(json.dumps(result))
        refreshed=self.run_import()
        retained=next(d for d in refreshed if d['id']==former['id'])
        self.assertFalse(retained['planning']['enabled'])
        self.assertEqual(retained['planning']['canonicalDestinationId'],'second-legacy')
        country=json.loads((self.data/'countries.json').read_text())['countries'][0]
        self.assertEqual(country['verifiedSettlementCount'],5)

    def test_reclassified_source_record_keeps_id_without_readiness(self):
        result=self.run_import()
        removed=result[1]
        with zipfile.ZipFile(self.root/'cities500.zip') as archive:
            lines=archive.read('cities500.txt').decode().splitlines()
        source_id=str(removed['provenance']['geography']['geonameId'])
        with zipfile.ZipFile(self.root/'cities500.zip','w') as archive:
            archive.writestr('cities500.txt','\n'.join(line for line in lines if line.split('\t')[0]!=source_id)+'\n')
        refreshed=self.run_import()
        retained=next(d for d in refreshed if d['id']==removed['id'])
        self.assertEqual(retained['provenance']['geography']['status'],'source_record_missing')
        self.assertFalse(retained['planning']['enabled'])


if __name__ == '__main__':
    unittest.main()

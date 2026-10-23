const {it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {resumeTest}=require('../scripts/resume-trip-test');

function fixture(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'voyouger-resume-fixture-'));
 fs.writeFileSync(path.join(directory,'account.json'),JSON.stringify({token:'mock-only'}));
 fs.writeFileSync(path.join(directory,'recommendations.json'),JSON.stringify({trip:{tripId:'draft',recommendations:[{destinationId:'country-pl',name:'Poland'}]}}));
 return directory;
}
it('resumes generation, saving and retrieval without creating another account',async()=>{
 const directory=fixture(),calls=[],logs=[];
 try{
  await resumeTest({directory,log:message=>logs.push(message),request:async(context,method,route,body)=>{
   assert.equal(context.token,'mock-only');calls.push({method,route,body});
   if(method==='POST')return {trip:{tripId:'generated'},itinerary:{days:[{day:1}]}};
   return {trip:{tripId:'generated',isSaved:true}};
  }});
  assert.deepEqual(calls.map(call=>call.route),['/itinerary/draft','/trips/generated/save','/trips/generated']);
  assert.deepEqual(calls[0].body,{countryId:'country-pl'});
  assert.ok(fs.existsSync(path.join(directory,'retrieved.json')));
  assert.ok(!logs.join(' ').includes('mock-only'));
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
it('does not report success when retrieval does not confirm a saved trip',async()=>{
 const directory=fixture();
 try{
  await assert.rejects(resumeTest({directory,log:()=>{},request:async(_context,method)=>method==='POST'?{trip:{tripId:'generated'},itinerary:{days:[{}]}}:{trip:{isSaved:false}}}),/not marked as saved/);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

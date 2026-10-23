// Reuse an existing terminal test account and recommendation draft. Never prints
// credentials. Live execution is opt-in and saves the generated trip.
const fs=require('node:fs');
const path=require('node:path');

async function send({baseUrl,token},method,route,body) {
  const response=await fetch(`${baseUrl}${route}`,{
    method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(180000),
  });
  const data=await response.json();
  if(!response.ok)throw new Error(`${method} ${route} failed (${response.status}): ${data.code||'REQUEST_FAILED'} — ${data.message||'Request failed'}`);
  return data;
}

async function resumeTest({directory,request=send,log=console.log}) {
  const read=name=>JSON.parse(fs.readFileSync(path.join(directory,`${name}.json`),'utf8'));
  const save=(name,data)=>fs.writeFileSync(path.join(directory,`${name}.json`),JSON.stringify(data,null,2)+'\n',{mode:0o600});
  const account=read('account'),recommendations=read('recommendations');
  const draft=recommendations.trip?.tripId,country=recommendations.trip?.recommendations?.[0];
  if(typeof account.token!=='string'||typeof draft!=='string'||!/^country-[a-z]{2}$/.test(country?.destinationId||''))throw new Error('The directory must contain account.json and recommendations.json from the earlier test.');
  const context={baseUrl:'http://localhost:8080/api',token:account.token};
  log(`Generating the existing ${country.name} recommendation...`);
  const generated=await request(context,'POST',`/itinerary/${draft}`,{countryId:country.destinationId});
  save('itinerary',generated);
  const tripId=generated.trip?.tripId;
  if(typeof tripId!=='string'||!generated.itinerary?.days?.length)throw new Error('Generation response did not include a trip and itinerary.');
  log(`Generated ${generated.itinerary.days.length} days. Saving trip...`);
  save('saved',await request(context,'PUT',`/trips/${tripId}/save`,{}));
  const retrieved=await request(context,'GET',`/trips/${tripId}`);
  save('retrieved',retrieved);
  if(retrieved.trip?.isSaved!==true)throw new Error('Retrieved trip was not marked as saved.');
  log(`SUCCESS: Generated, saved and retrieved ${tripId}. Results: ${directory}`);
  return retrieved;
}

async function main() {
  const directory=process.argv.find(arg=>arg.startsWith('--test-dir='))?.slice('--test-dir='.length);
  if(!process.argv.includes('--allow-live')||!directory){
    console.log('Usage: node scripts/resume-trip-test.js --test-dir=/path/to/voyouger-test-folder --allow-live');
    console.log('Uses the existing account/draft, calls Google/Gemini through the backend, and saves the generated trip. No account is created.');
    return;
  }
  await resumeTest({directory:path.resolve(directory)});
}
if(require.main===module)main().catch(error=>{console.error(`TEST FAILED: ${error.message}`);process.exitCode=1;});
module.exports={resumeTest};

// Capped, opt-in integration verification. Never writes to DynamoDB.
// The budget file survives retries so a repeated run cannot silently spend more.
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
require('dotenv').config({ path:path.resolve(__dirname,'../.env'), quiet:true });

const LIMITS=Object.freeze({google:6,gemini:2,visa:1});
const option=name=>process.argv.find(arg=>arg.startsWith(`--${name}=`))?.slice(name.length+3);

function providerFor(url) {
  const host=new URL(typeof url==='string'||url instanceof URL?url:url.url).hostname;
  if(host==='places.googleapis.com')return 'google';
  if(host==='generativelanguage.googleapis.com')return 'gemini';
  if(host==='visa-requirement.p.rapidapi.com')return 'visa';
  throw Object.assign(new Error('Unexpected network destination'),{code:'UNEXPECTED_PROVIDER'});
}

function budgetFetch(original,counts,save=()=>{},limits=LIMITS,onResult=()=>{}) {
  return async (url,init)=>{
    const provider=providerFor(url);
    if(counts[provider]>=limits[provider]) throw Object.assign(new Error('Approved request budget exhausted'),{code:'LIVE_BUDGET_EXHAUSTED'});
    counts[provider]++;
    save(counts); // Reserve before sending, including failures/retries.
    const start=performance.now();
    try {
      const response=await original(url,init);
      onResult({provider,status:response.status,elapsedMs:Number((performance.now()-start).toFixed(1))});
      return response;
    } catch(error) {
      onResult({provider,errorType:error.name||'NetworkError',elapsedMs:Number((performance.now()-start).toFixed(1))});
      throw error;
    }
  };
}

async function main() {
  if(!process.argv.includes('--allow-live')) {
    console.log(JSON.stringify({status:'offline',limits:LIMITS,note:'Use --allow-live --budget-file=/path/to/budget.json --report-file=/path/to/report.json after authorizing these capped API calls. DynamoDB checks only describe its table.'},null,2));
    return;
  }
  const budgetFile=option('budget-file'),reportFile=option('report-file');
  if(!budgetFile||!reportFile)throw new Error('Explicit budget and report files are required');
  const counts=fs.existsSync(budgetFile)?JSON.parse(fs.readFileSync(budgetFile,'utf8')):{google:0,gemini:0,visa:0};
  if(Object.keys(LIMITS).some(key=>!Number.isInteger(counts[key])||counts[key]<0))throw new Error('Invalid budget state');
  const original=global.fetch;
  const limits=Object.fromEntries(Object.entries(LIMITS).map(([provider,limit])=>[provider,Number(option(`max-${provider}`)||limit)]));
  if(Object.values(limits).some(limit=>!Number.isInteger(limit)||limit<1||limit>100))throw new Error('Invalid limits');
  const report=fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile,'utf8')):{checks:{}};
  if(report.checkedOn) {
    report.previousRuns ||= [];
    report.previousRuns.push({checkedOn:report.checkedOn,requests:{...report.requests},checks:structuredClone(report.checks)});
  }
  Object.assign(report,{checkedOn:new Date().toISOString(),limits,requests:counts,databaseWrites:0});
  report.networkAttempts ||= [];
  global.fetch=budgetFetch(original,counts,state=>fs.writeFileSync(budgetFile,JSON.stringify(state,null,2)+'\n'),limits,event=>{
    report.networkAttempts.push(event);
    fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
  });
  const only=option('only');
  if(only&&!['dynamodb','visa','recommendations','itinerary','google-details','gemini'].includes(only))throw new Error('Unknown check');
  async function check(name,work) {
    const start=performance.now();
    try {report.checks[name]={status:'passed',...await work(),elapsedMs:Number((performance.now()-start).toFixed(1))};}
    catch(error){report.checks[name]={status:'failed',code:error.code||error.statusCode||error.status||'PROVIDER_CHECK_FAILED',...(error.providerStatus?{providerStatus:error.providerStatus,providerCategory:error.providerCategory,providerReason:error.providerReason}:{}),elapsedMs:Number((performance.now()-start).toFixed(1))};}
    fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
  }
  try {
    // Explicit diagnostic only: one tiny structured request, no traveler data,
    // Places discovery, database access, or model/SDK retry attempts.
    if(only==='gemini')await check('gemini',async()=>{
      const {z}=require('zod');
      const schema=z.object({ok:z.boolean()}),jsonSchema=z.toJSONSchema(schema);delete jsonSchema.$schema;
      const result=await require('../services/llmclient').generateStructured({prompt:'Return {"ok":true}.',zodSchema:schema,jsonSchema,maxAttempts:1,timeoutMs:20000,maxOutputTokens:128});
      if(!result.data.ok)throw Object.assign(new Error('Unexpected diagnostic output'),{code:'INVALID_DIAGNOSTIC_OUTPUT'});
      return {model:result.model,structuredOutputVerified:true};
    });
    if(!only||only==='dynamodb')await check('dynamodb',async()=>{
      const {DescribeTableCommand}=require('@aws-sdk/client-dynamodb');
      const {client,TABLE_NAME}=require('../db/dynamo');
      const result=await client.send(new DescribeTableCommand({TableName:TABLE_NAME}),{abortSignal:AbortSignal.timeout(15000)});
      if(!result.Table?.KeySchema?.some(key=>key.AttributeName==='PK'&&key.KeyType==='HASH')||!result.Table.KeySchema.some(key=>key.AttributeName==='SK'&&key.KeyType==='RANGE'))throw Object.assign(new Error('Unexpected table schema'),{code:'INCOMPATIBLE_TABLE'});
      return {tableStatus:result.Table.TableStatus,ownershipKeysVerified:true};
    });
    if(!only||only==='visa')await check('visa',async()=>{
      const codes=await require('../services/visaService').getVisaFreeCountries(['US']);
      if(!codes.size)throw Object.assign(new Error('No confirmed visa-free results'),{code:'NO_CONFIRMED_ELIGIBILITY'});
      return {confirmedCountryCount:codes.size};
    });
    if(!only||only==='recommendations')await check('recommendations',async()=>{
      const quiz={willingToGetVisa:true,minNights:3,maxNights:3,dailyBudget:'$$',riskTolerance:3,travelAlterEgo:'Historian',startDate:'2027-06-05',seeAllOrDeeply:'seeAll'};
      const result=await require('../services/countryRecommendationService').recommendCountries({nationalities:['US']},quiz);
      if(!result.model)throw Object.assign(new Error('Provider explanation was not verified'),{code:'EXPLANATION_FALLBACK_ONLY'});
      return {countryCount:result.recommendations.length,countryIds:result.recommendations.map(country=>country.destinationId),model:result.model};
    });
    if(!only||only==='itinerary')await check('itinerary',async()=>{
      const country=(option('country')||'PT').toUpperCase(),nights=Number(option('nights')??3),pace=option('pace')||'seeAll';
      if(!/^[A-Z]{2}$/.test(country)||!Number.isInteger(nights)||nights<0||nights>20||!['seeAll','deeply'].includes(pace))throw new Error('Invalid country, nights or pace');
      const quiz={willingToGetVisa:true,minNights:nights,maxNights:nights,dailyBudget:'$$',riskTolerance:3,travelAlterEgo:option('persona')||'Historian',dietaryRestrictions:['Vegetarian'],startDate:'2027-06-05',seeAllOrDeeply:pace};
      const outline=require('../services/tripOutlineService').buildOutline({countryId:`country-${country.toLowerCase()}`,quiz});
      const {itinerary,model}=await require('../services/countryItineraryService').generateCountryItinerary({outline,quiz,startDate:outline.startDate});
      const stored=require('../services/itineraryStorageService').storedItinerary(itinerary);
      const first=itinerary.days.find(day=>['morning','afternoon','evening'].some(slot=>day[slot].length));
      let venueRefreshVerified=false;
      if(first && !process.argv.includes('--skip-venue-refresh') && counts.google<limits.google) {
        await require('../services/savedVenueService').refreshDay({itinerary:stored},first.day);
        venueRefreshVerified=true;
      }
      return {model,narrativeSource:itinerary.narrativeSource,countryCode:outline.countryCode,days:itinerary.days.length,bases:outline.stops.length,dailyActivities:itinerary.days.map(day=>({day:day.day,type:day.type,activities:['morning','afternoon','evening'].reduce((sum,slot)=>sum+day[slot].length,0)})),persistenceProjectionVerified:stored.placesStoredAs==='ids_only',venueRefreshVerified};
    });
    if(only==='google-details')await check('googleDetails',async()=>{
      const places=await require('../services/googlePlacesService').searchPlaces('museums in Lisbon Portugal',{pageSize:1});
      if(!places.length)throw new Error('No provider venues');
      const outline=require('../services/tripOutlineService').buildOutline({countryId:'country-pt',numberOfDays:1,startDate:'2027-06-05',quiz:{famousOrHiddenGem:'famous'}});
      const day={day:1,dayOfWeek:'Saturday',stopId:outline.stops[0].stopId,morning:[{placeId:places[0].id,category:'attractions'}],afternoon:[],evening:[]};
      const details=await require('../services/savedVenueService').refreshDay({itinerary:{schemaVersion:2,countryCode:'PT',outline,days:[day]}},1);
      return {verifiedVenueCount:details.places.length,persisted:false};
    });
  } finally {global.fetch=original;}
  console.log(JSON.stringify(report,null,2));
  if(Object.values(report.checks).some(check=>check.status!=='passed'))process.exitCode=1;
}

if(require.main===module)main().catch(()=>{console.error('Integration check could not start. Credentials and upstream messages are not printed.');process.exitCode=1;});
module.exports={budgetFetch,providerFor,LIMITS};

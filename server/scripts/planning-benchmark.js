// Offline CPU benchmark. No provider calls and no database operations.
const { performance } = require('node:perf_hooks');
const { rankCountries } = require('../services/countryScoringService');
const { buildOutline, enumerateRoutes } = require('../services/tripOutlineService');
const { TRIP_POLICY } = require('../config/tripPolicy');

function benchmark(name, work, iterations = 50) {
  for (let i=0;i<5;i++) work();
  const samples=[];let result;
  for (let i=0;i<iterations;i++) { const start=performance.now(); result=work(); samples.push(performance.now()-start); }
  samples.sort((a,b)=>a-b);
  return {name,iterations,p50Ms:Number(samples[Math.floor(iterations*0.5)].toFixed(3)),p95Ms:Number(samples[Math.ceil(iterations*0.95)-1].toFixed(3)),resultCount:result.length??result.stops?.length};
}
const quiz={travelAlterEgo:'Foodie',minNights:20,maxNights:20,budgetLevel:'$$$',seeAllOrDeeply:'seeAll',startDate:'2027-06-05'};
const dense=Array.from({length:80},(_,i)=>({id:`synthetic-${i}`,tags:['food'],minNights:2}));
const report={timestamp:new Date().toISOString(),runtime:process.version,platform:`${process.platform}/${process.arch}`,policyVersion:TRIP_POLICY.version,externalServices:'Not exercised by this offline benchmark; no API calls',benchmarks:[
  benchmark('Rank supported countries, 21 days',()=>rankCountries(quiz)),
  benchmark('France 21-day outline',()=>buildOutline({countryId:'country-fr',quiz})),
  benchmark('Synthetic dense 80-node graph, up to five bases',()=>enumerateRoutes(dense,quiz,21,()=>({planningMinutes:60}))),
]};
const thresholds=['PLANNING_RANK_P95_MAX_MS','PLANNING_ROUTE_P95_MAX_MS','PLANNING_DENSE_P95_MAX_MS'];
report.thresholdFailures=report.benchmarks.flatMap((result,index)=>{
  const limit=Number(process.env[thresholds[index]]);
  return Number.isFinite(limit)&&limit>0&&result.p95Ms>limit ? [{name:result.name,p95Ms:result.p95Ms,limitMs:limit}] : [];
});
console.log(JSON.stringify(report,null,2));
if(report.thresholdFailures.length)process.exitCode=1;

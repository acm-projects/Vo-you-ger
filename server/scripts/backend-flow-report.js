// Local-only summary of backend-flow-test artifacts. Never reads credentials.
const fs=require('node:fs');
const path=require('node:path');
const {mealLimit}=require('../services/dailyPlanService');

function report(directory) {
  const read=name=>{const file=path.join(directory,`${name}.json`);return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;};
  const generated=read('itinerary'),itinerary=generated?.itinerary,retrieved=read('retrieved')?.trip;
  const quiz=read('assessment-input'),recommendations=read('recommendations')?.trip;
  const timings=read('timings') || [],slots=['morning','afternoon','evening'];
  const meals=[],descriptionSources={};let unknownHours=0,activities=0;
  for(const day of itinerary?.days || []){
    let count=0;
    for(const slot of slots){
      const entries=day[slot] || [],food=entries.filter(p=>p.category==='food');count+=food.length;
      if(food.length>1)meals.push({day:day.day,slot,reason:'multiple_restaurants_in_one_block'});
      for(const entry of entries){activities++;if(entry.hoursCheck==='unknown')unknownHours++;
        const source=entry.descriptionSource || itinerary.narrativeSource || 'unknown';descriptionSources[source]=(descriptionSources[source] || 0)+1;}
    }
    if(count>mealLimit(quiz || {}))meals.push({day:day.day,reason:'daily_meal_limit_exceeded'});
  }
  const missingStayAreas=(itinerary?.stays || []).filter(stay=>!stay.recommendedStayArea).map(stay=>stay.name);
  const complete=!!(itinerary && retrieved?.isSaved && read('day-places') && read('saved-list'));
  const savedMatches=itinerary && retrieved?.itinerary ? JSON.stringify(itinerary.days.map(day=>slots.map(slot=>day[slot].map(p=>[p.placeId,p.activityDescription,p.travelTip,p.descriptionSource ?? null])))) ===
    JSON.stringify(retrieved.itinerary.days.map(day=>slots.map(slot=>day[slot].map(p=>[p.placeId,p.activityDescription,p.travelTip,p.descriptionSource ?? null])))) : false;
  const validLength=itinerary && quiz ? itinerary.days.length===quiz.minNights+1 && itinerary.outline.numberOfNights===quiz.minNights : false;
  const aiComplete=itinerary?.narrativeSource==='gemini' && recommendations?.selectionMetadata?.explanationSource==='gemini';
  return {status:!complete?'incomplete':!validLength||!savedMatches||meals.length||missingStayAreas.length||timings.some(t=>!t.success)?'failed':aiComplete?'passed':'degraded',
    tripId:generated?.trip?.tripId,flowComplete:complete,exactLengthVerified:!!validLength,savedDescriptionsAndTipsMatch:!!savedMatches,
    recommendationsSource:recommendations?.selectionMetadata?.explanationSource || null,
    recommendationsFallbackReason:recommendations?.selectionMetadata?.explanationFallbackReason || null,
    narrativeSource:itinerary?.narrativeSource || null,narrativeFallbackReason:itinerary?.narrativeFallbackReason || null,
    narrativeCacheHit:itinerary?.narrativeCacheHit ?? null,narrativeDiagnostics:itinerary?.narrativeDiagnostics || null,
    descriptionSources,quality:{activities,unknownHours,mealConflicts:meals,missingStayAreas},
    stays:itinerary?.stays,days:itinerary?.days.length,nights:itinerary?.outline.numberOfNights,
    requestSeconds:Number((timings.reduce((sum,t)=>sum+t.elapsedMs,0)/1000).toFixed(2)),timings,
    note:'passed requires the complete saved/retrieved flow, Gemini copy for recommendations and itinerary, and these structural checks. This does not verify every descriptive claim, holiday hours, or dietary suitability.',
  };
}
if(require.main===module){
  const index=process.argv.indexOf('--state'),directory=process.argv[index+1];
  if(index<0 || !directory){console.error('Usage: node scripts/backend-flow-report.js --state /path/to/test-state');process.exitCode=1;}
  else try{const result=report(path.resolve(directory));console.log(JSON.stringify(result,null,2));if(result.status!=='passed')process.exitCode=1;}
  catch{console.error('Unable to read the local test artifacts. No credentials or provider messages printed.');process.exitCode=1;}
}
module.exports={report};

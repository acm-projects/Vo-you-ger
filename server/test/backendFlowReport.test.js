const {it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {report}=require('../scripts/backend-flow-report');

function fixture(work) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'voyouger-report-test-'));
  const write=(name,value)=>fs.writeFileSync(path.join(directory,name+'.json'),JSON.stringify(value));
  const itinerary={days:[{day:1,morning:[],afternoon:[],evening:[{placeId:'venue',category:'food',activityDescription:'A meal',descriptionSource:'gemini',travelTip:'Check requirements',hoursCheck:'unknown'}]}],
    outline:{numberOfNights:0},narrativeSource:'gemini',narrativeFallbackReason:null,narrativeCacheHit:false,stays:[]};
  write('itinerary',{trip:{tripId:'test-trip'},itinerary});
  write('retrieved',{trip:{isSaved:true,itinerary}});
  write('recommendations',{trip:{selectionMetadata:{explanationSource:'gemini'}}});
  write('assessment-input',{minNights:0});write('day-places',{});write('saved-list',{});
  write('timings',[{step:'generate',success:true,elapsedMs:1234}]);
  try{work({directory,write,itinerary});}finally{fs.rmSync(directory,{recursive:true,force:true});}
}

it('reports a completed matching saved flow and shows uncertainty separately from structural success',()=>fixture(({directory})=>{
  const result=report(directory);
  assert.equal(result.status,'passed');assert.equal(result.quality.unknownHours,1);
  assert.equal(result.savedDescriptionsAndTipsMatch,true);assert.equal(result.requestSeconds,1.23);
}));
it('does not count an HTTP-successful partial AI response as a full success',()=>fixture(({directory,write,itinerary})=>{
  itinerary.narrativeSource='partial';write('itinerary',{itinerary});
  assert.equal(report(directory).status,'degraded');
}));
it('detects meal conflicts, missing stay areas, and changed saved text',()=>fixture(({directory,write,itinerary})=>{
  itinerary.days[0].evening.push({...itinerary.days[0].evening[0],placeId:'second'});
  itinerary.stays=[{name:'City',recommendedStayArea:null}];write('itinerary',{itinerary});
  const result=report(directory);
  assert.equal(result.status,'failed');assert.equal(result.savedDescriptionsAndTipsMatch,false);
  assert.equal(result.quality.mealConflicts.length,2);assert.deepEqual(result.quality.missingStayAreas,['City']);
}));
it('identifies an unfinished flow without accessing credentials or making network requests',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'voyouger-empty-report-'));
  try{fs.writeFileSync(path.join(directory,'credentials.json'),'unreadable JSON secret');assert.equal(report(directory).status,'incomplete');}
  finally{fs.rmSync(directory,{recursive:true,force:true});}
});

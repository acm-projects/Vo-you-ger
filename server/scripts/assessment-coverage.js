// Offline eligibility audit. No provider requests, credentials, or database access.
const {rankCountries}=require('../services/countryScoringService');
const {buildOutline,validateOutline}=require('../services/tripOutlineService');
const {TRIP_POLICY}=require('../config/tripPolicy');

function assessmentCoverage() {
  let checked=0,passing=0;
  const gaps=new Map();
  for(let days=1;days<=TRIP_POLICY.maxSupportedDays;days++) {
    for(const seeAllOrDeeply of ['See it all','See it deeply']) {
      for(const budgetLevel of ['$','$$','$$$']) {
        for(const highRiskDestWillingness of [false,true]) {
          for(const travelAlterEgo of ['The Explorer','The Historian','The Foodie','The Spa Lover']) {
            const quiz={minNights:days-1,maxNights:days-1,startDate:'2027-06-05',
              seeAllOrDeeply,budgetLevel,highRiskDestWillingness,travelAlterEgo,visaWillingness:true};
            const selected=rankCountries(quiz).slice(0,3);
            checked++;
            if(selected.length===3) {
              if(new Set(selected.map(country=>country.countryCode)).size!==3)throw new Error('Recommendations must be three distinct countries');
              for(const country of selected) {
                const outline=buildOutline({countryId:country.id,quiz});
                validateOutline(outline,quiz);
                if(outline.numberOfDays!==days||outline.stops.reduce((n,stop)=>n+stop.nights,0)!==days-1) {
                  throw new Error(`Incorrect duration for ${country.id}: ${days} days`);
                }
              }
              passing++;
            } else {
              const key=JSON.stringify({seeAllOrDeeply,budgetLevel,highRiskDestWillingness});
              if(!gaps.has(key))gaps.set(key,{...JSON.parse(key),days:new Set(),personas:new Set(),minimumCountryCount:3});
              const gap=gaps.get(key);
              gap.days.add(days);gap.personas.add(travelAlterEgo);
              gap.minimumCountryCount=Math.min(gap.minimumCountryCount,selected.length);
            }
          }
        }
      }
    }
  }
  const report={
    policyVersion:TRIP_POLICY.version,
    checkedProfiles:checked,profilesWithThreeValidRoutes:passing,profilesWithInsufficientCountries:checked-passing,
    scope:'All exact durations 1–21 days × both quiz paces × three budgets × both risk choices × four personas, with visas allowed and unrestricted domestic transport.',
    limitations:[
      'This measures route eligibility and duration, not subjective trip quality or live venue availability.',
      'Other scoring preferences, dates, passport-specific visa restrictions, and restricted transport combinations are not exhaustively tested.',
      'A passing result does not guarantee provider availability or three countries for every possible assessment.'
    ],
    gaps:[...gaps.values()].map(gap=>({...gap,days:[...gap.days],personas:[...gap.personas]})),
  };
  return report;
}

if(require.main===module) {
  const report=assessmentCoverage();
  console.log(JSON.stringify(report,null,2));
  if(report.profilesWithInsufficientCountries)process.exitCode=1;
}
module.exports={assessmentCoverage};

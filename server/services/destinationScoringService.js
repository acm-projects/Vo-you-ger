const { normalizeTag, personaTags } = require('../config/interestTags');
const weights = require('../config/scoringWeights');
const {toCountryCode}=require('../utils/countryCodes');
const BUDGET = Object.freeze({ $:1, $$:2, $$$:3 });
const compact = value => String(value||'').toLowerCase().replace(/[^a-z]/g,'');
const isRelaxed = quiz => compact(quiz.seeAllOrDeeply).includes('deep');
const wantsVariety = quiz => !isRelaxed(quiz) && compact(quiz.seeAllOrDeeply).includes('all');
function scoreDestination(base, quiz={}) {
  const tags=new Set((base.tags||[]).map(normalizeTag));
  const wanted=new Set(personaTags(quiz.travelAlterEgo));
  const imagery=`${quiz.preferredViews||''} ${quiz.photosToPost||''}`.toLowerCase();
  for(const [pattern,tag] of [[/mountain/,'mountains'],[/beach/,'beach'],[/city|street/,'city'],[/histor|cultur/,'history'],[/food/,'food'],[/natural|nature/,'nature']]) if(pattern.test(imagery)) wanted.add(tag);
  const interests=wanted.size ? [...wanted].filter(tag=>tags.has(tag)).length/wanted.size : 0.5;
  const months=quiz.startDate ? [['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(quiz.startDate.slice(5,7))-1]] : quiz.preferredMonths||[];
  const seasonal=months.length&&base.bestMonths?.length ? months.filter(month=>base.bestMonths.some(m=>m.toLowerCase()===month.slice(0,3).toLowerCase())).length/months.length : 0.5;
  // Budget is a preference: modestly higher tiers lose some points, never eligibility.
  const budget=BUDGET[base.budget]&&BUDGET[quiz.budgetLevel]
    ? Math.max(0,1-Math.max(0,BUDGET[base.budget]-BUDGET[quiz.budgetLevel])/2) : 0.5;
  const safety=typeof base.safety==='number' ? (6-base.safety)/5 : 0.5;
  const preferenceChecks=[];
  const temperature={warm:['warm','hot-dry','tropical'],cool:['mild','cool'],chilly:['cold'],sunny:['warm','hot-dry','tropical'],overcast:['mild','cool'],rainy:['mild','cool']};
  if(quiz.preferredWeather && base.climate && base.climate!=='variable') preferenceChecks.push(temperature[compact(quiz.preferredWeather).startsWith('chill')?'chilly':quiz.preferredWeather.toLowerCase().trim()]?.includes(base.climate));
  const wantedCountries=(quiz.preferredCountries||[]).map(toCountryCode).filter(Boolean);
  if(wantedCountries.length) preferenceChecks.push(wantedCountries.includes(base.countryCode));
  if(quiz.enjoyCrowdsOrSpace) preferenceChecks.push(tags.has(compact(quiz.enjoyCrowdsOrSpace).includes('space')?'hidden-gem':'famous'));
  if(quiz.visitFamousLocationOrHiddenGem) preferenceChecks.push(tags.has(compact(quiz.visitFamousLocationOrHiddenGem).includes('hidden')?'hidden-gem':'famous'));
  if(quiz.sleepInOrEarly) preferenceChecks.push(tags.has(compact(quiz.sleepInOrEarly).includes('night')||compact(quiz.sleepInOrEarly).includes('in')?'nightlife':'nature'));
  if(quiz.walkAmount&&compact(quiz.walkAmount)!=='none') preferenceChecks.push(tags.has('walkable'));
  const preference=preferenceChecks.length?preferenceChecks.filter(Boolean).length/preferenceChecks.length:0.5;
  const parts={interest:interests*weights.interest,season:seasonal*weights.season,budget:budget*weights.budget,safety:safety*weights.safety,preferences:preference*weights.preferences};
  return { score:Number(Object.values(parts).reduce((a,b)=>a+b,0).toFixed(3)),parts };
}
module.exports={ scoreDestination,BUDGET,isRelaxed,wantsVariety,compact };

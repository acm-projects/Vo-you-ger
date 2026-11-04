// Explain evidence from the selected route, not a whole-country travel brochure.
const catalog = require('./planningDataService');
const {scoreDestination,BUDGET,isRelaxed,wantsVariety} = require('./destinationScoringService');
const {toCountryCode} = require('../utils/countryCodes');
const {normalizeTag} = require('../config/interestTags');

const LABELS = {
  food:'food',coffee:'cafés',seafood:'seafood',wine:'wine', 'craft-beer':'craft beer',
  history:'history',architecture:'architecture',museums:'museums',culture:'culture',
  nature:'nature',hiking:'hiking',mountains:'mountain scenery',adventure:'outdoor adventure',
  wildlife:'wildlife',safari:'safari experiences',desert:'desert scenery',
  relaxation:'a slower pace',spa:'spa experiences',beach:'beaches',city:'city exploring',
};
const list = values => new Intl.ListFormat('en',{style:'long',type:'conjunction'}).format(values);

function naturalizeCountryReason(reason) {
  // Remove the specific bookkeeping modifiers seen in live responses without
  // changing city names, claims, dates, cost cautions or preference statements.
  return reason
    .replace(/\bcatalog(?:ue)?[- ]recommended\b/gi,'suggested')
    .replace(/\b(?:cataloged|catalogued)\s+(?=(?:across|in|for|within)\b)/gi,'');
}

function countryMatchEvidence(country, quiz = {}) {
  const route=country.suggestedRoute;
  const bases=route.destinationIds.map(id=>catalog.destinationById.get(id)).filter(Boolean);
  const scores=bases.map(base=>({base,...scoreDestination(base,quiz)}));
  const mean=part=>scores.length?scores.reduce((sum,item)=>sum+item.parts[part],0)/scores.length:0;
  const vegetarian=/vegan|vegetarian/i.test(String(quiz.dietaryRestrictions || ''));
  const interestMatches=scores.flatMap(item=>item.evidence.matchedInterests
    .filter(tag=>!(vegetarian && tag==='seafood'))
    .map(tag=>({interest:LABELS[tag] || tag,base:item.base.name})));
  const factors=[];
  if(interestMatches.length)factors.push({kind:'interests',contribution:mean('interest'),
    interests:[...new Set(interestMatches.map(item=>item.interest))],matches:interestMatches,
    scope:'Catalog interests in the selected bases; not verified activities or dietary suitability.'});
  if(wantsVariety(quiz) && bases.length>1)factors.push({kind:'variety',
    contribution:(country.scoreBreakdown?.requestedVarietyBonus || 0)+(country.scoreBreakdown?.varietyBonus || 0),
    bases:route.bases,scope:'A feasible route with multiple overnight bases matches the request for variety.'});
  if((quiz.preferredCountries || []).some(value=>toCountryCode(value)===country.countryCode))factors.push({
    kind:'preferred_country',contribution:mean('preferences'),
    scope:'The traveler explicitly expressed interest in this country; no other preference is inferred.'});
  const season=scores.filter(item=>item.evidence.matchingMonths.length).map(item=>({base:item.base.name,months:item.evidence.matchingMonths}));
  if(season.length)factors.push({kind:'season',contribution:mean('season'),matches:season,
    scope:'The requested month overlaps catalog-recommended months; this is not a weather forecast or availability guarantee.'});
  const requestedBudget=BUDGET[quiz.budgetLevel];
  const budgetCaution=!!requestedBudget && bases.some(base=>BUDGET[base.budget]>requestedBudget);
  if(requestedBudget && bases.length && bases.every(base=>BUDGET[base.budget] && BUDGET[base.budget]<=requestedBudget))factors.push({
    kind:'budget',contribution:mean('budget'),
    scope:'All selected bases fall within the preferred coarse catalog cost tier; actual prices and total affordability are unverified.'});
  factors.sort((a,b)=>b.contribution-a.contribution || a.kind.localeCompare(b.kind));
  let strongestMatches=factors.slice(0,3);
  // Keep one supported personal-interest match even when generic season/cost
  // contributions outweigh a narrow interest match. Scores/order never change.
  const personal=factors.find(factor=>factor.kind==='interests');
  if(personal && !strongestMatches.includes(personal))strongestMatches=[...factors.slice(0,2),personal];
  return {strongestMatches,budgetCaution,
    places:bases.map(base=>({name:base.name,
      character:[...new Set((base.tags || []).map(normalizeTag))]
        .filter(tag=>['history','architecture','museums','culture','art','food','coffee','city','parks','nature','nightlife','design','music','shopping'].includes(tag))
        .map(tag=>LABELS[tag] || tag),
    })),
    route:{bases:route.bases,nights:route.nights,days:route.nights.reduce((sum,n)=>sum+n,0)+1,
      pace:isRelaxed(quiz)?'slower exploration':wantsVariety(quiz)?'variety':'unspecified'},
    dietaryNote:'Dietary answers guide later restaurant searches; no menu or dietary suitability has been verified.'};
}

function getCountryFallbackReason(country, days, bases, quiz = {}, variantIndex) {
  const evidence=countryMatchEvidence(country,quiz);
  const names=bases?.length?bases:evidence.route.bases;
  const routeText=list(names), interests=evidence.strongestMatches.find(factor=>factor.kind==='interests');
  const preference=evidence.strongestMatches.some(factor=>factor.kind==='preferred_country');
  const variant=Number.isInteger(variantIndex) ? variantIndex%3
    : [...(country.countryCode || '')].reduce((sum,c)=>sum+c.charCodeAt(0),0)%3;
  let opening;
  if(interests){
    const interestsText=list(interests.interests.slice(0,2));
    const matchedNames=[...new Set(interests.matches.map(item=>item.base))];
    const matchingBases=list(matchedNames);
    opening=[
      `${country.name} is worth considering for your interest in ${interestsText}, with ${matchingBases} in the suggested route.`,
      `Your interest in ${interestsText} points toward ${country.name}, particularly the suggested ${matchedNames.length===1?'stop':'stops'} in ${matchingBases}.`,
      `For a trip shaped around ${interestsText}, ${country.name} offers a route that includes ${matchingBases}.`,
    ][variant];
  }else if(preference)opening=`You already had ${country.name} in mind, and this ${days}-day route gives you a way to explore ${routeText}.`;
  else opening=[
    `${country.name} gives you a ${days}-day route through ${routeText}.`,
    `You could spend ${days} days exploring ${routeText} in ${country.name}.`,
    `For ${days} days in ${country.name}, the suggested route ${names.length===1?'centres on':'brings together'} ${routeText}.`,
  ][variant];
  let routeSentence;
  if(names.length>1)routeSentence=isRelaxed(quiz)
    ? `You'd divide your time between ${routeText}, keeping overnight changes limited as you explore each stop.`
    : [
      `You'd split ${days} days between ${routeText}, adding a change of scene while leaving time to settle into each stop.`,
      `Spending ${days} days across ${routeText} gives you variety while keeping overnight changes to ${names.length-1}.`,
      `The ${days}-day route links ${routeText}, with time in each base rather than a new overnight stop every day.`,
    ][variant];
  else if(days===1)routeSentence=`The plan stays focused on ${routeText} for the day.`;
  else routeSentence=isRelaxed(quiz)
    ? [
      `Staying in ${routeText} for ${days} days would give you time to explore at a slower pace without changing overnight bases.`,
      `You'd have ${days} days based in ${routeText}, with room to explore without moving between overnight stops.`,
      `Keeping ${routeText} as your base for ${days} days leaves you fewer overnight moves to manage and more flexibility over the pace.`,
    ][variant]
    : `The ${days}-day plan stays in ${routeText}, so you can explore one base without packing up between overnight stops.`;
  return `${opening} ${routeSentence}`;
}

module.exports = {countryMatchEvidence,getCountryFallbackReason,naturalizeCountryReason};

const {it} = require('node:test');
const assert = require('node:assert/strict');
const {rankCountries} = require('../services/countryScoringService');
const {scoreDestination} = require('../services/destinationScoringService');
const {countryMatchEvidence,getCountryFallbackReason} = require('../services/countryHighlights');
const {buildExplanationRequest} = require('../prompts/countryExplanationPrompt');
const catalog = require('../services/planningDataService');

const foodie={travelAlterEgo:'Foodie',seeAllOrDeeply:'seeAll',startDate:'2027-06-05',
  minNights:6,maxNights:6,budgetLevel:'$$',dietaryRestrictions:['Vegetarian']};
function country(code,quiz=foodie) {return rankCountries(quiz).find(item=>item.countryCode===code);}

it('explains only the selected bases and retains a supported personal interest among the strongest matches',()=>{
  const selected=rankCountries(foodie).slice(0,3);
  for(const c of selected){
    const evidence=countryMatchEvidence(c,foodie);
    assert.ok(evidence.strongestMatches.length<=3);
    const interests=evidence.strongestMatches.find(item=>item.kind==='interests');
    assert.ok(interests);assert.ok(interests.interests.includes('food'));
    for(const match of interests.matches){
      const id=c.suggestedRoute.destinationIds.find(id=>catalog.destinationById.get(id).name===match.base);
      assert.ok(id,'No unselected city can justify this recommendation');
      assert.ok(scoreDestination(catalog.destinationById.get(id),foodie).evidence.matchedInterests.length);
    }
  }
});

it('does not treat neutral scoring defaults as evidence of an unstated preference',()=>{
  const quiz={minNights:3,maxNights:3},c=country('PT',quiz);
  assert.deepEqual(countryMatchEvidence(c,quiz).strongestMatches,[]);
  const reason=getCountryFallbackReason(c,4,c.suggestedRoute.bases,quiz);
  assert.ok(!/your interest|food|history|weather|budget/i.test(reason));
});

it('does not claim affordability when a selected base is above the preferred budget',()=>{
  const quiz={...foodie,budgetLevel:'$'},c=country('FR',quiz),evidence=countryMatchEvidence(c,quiz);
  assert.equal(evidence.budgetCaution,true);
  assert.ok(evidence.strongestMatches.every(item=>item.kind!=='budget'));
});

it('distinguishes recommended catalog months from weather and omits absent season data',()=>{
  const c=country('PL');
  const evidence=countryMatchEvidence(c,foodie),season=evidence.strongestMatches.find(item=>item.kind==='season');
  assert.ok(season);assert.match(season.scope,/not a weather forecast/);
  const imported=catalog.destinationById.get('gn-3081368');
  assert.deepEqual(imported.bestMonths,[]);
  assert.deepEqual(scoreDestination(imported,foodie).evidence.matchingMonths,[]);
});

it('personalizes backup copy for the same route without adding dishes, dietary promises or unscheduled places',()=>{
  const c=country('FR');
  const food=getCountryFallbackReason(c,7,c.suggestedRoute.bases,foodie,0);
  const history=getCountryFallbackReason(c,7,c.suggestedRoute.bases,{...foodie,travelAlterEgo:'Historian'},0);
  assert.match(food,/interest in food/);assert.match(history,/history|architecture|museums/);
  assert.notEqual(food,history);
  for(const reason of [food,history]){
    for(const base of c.suggestedRoute.bases)assert.ok(reason.includes(base));
    assert.ok(!/bourguignon|croissant|sardines|seafood|guaranteed|vegan food|vegetarian dishes|paradise|tapestry/i.test(reason));
  }
});

it('varies the backup introductions and route sentences across the three picks',()=>{
  const reasons=rankCountries(foodie).slice(0,3).map((c,i)=>getCountryFallbackReason(c,7,c.suggestedRoute.bases,foodie,i));
  assert.equal(new Set(reasons.map(reason=>reason.split(' ').slice(0,3).join(' '))).size,3);
  assert.equal(reasons.filter(reason=>reason.includes("You'd split")).length,1);
});

it('keeps relaxed and one-day explanations consistent with their actual routes',()=>{
  const quiz={travelAlterEgo:'Historian',seeAllOrDeeply:'deeply',minNights:3,maxNights:3};
  const c=country('PT',quiz),reason=getCountryFallbackReason(c,4,c.suggestedRoute.bases,quiz);
  assert.match(reason,/4 days/);assert.match(reason,/slower pace|overnight stops|overnight moves/);
  const one=country('PT',{minNights:0,maxNights:0});
  assert.match(getCountryFallbackReason(one,1,one.suggestedRoute.bases,{}),/focused.*for the day/);
});

it('gives Gemini a compact conversational brief without raw scores, tiers, or transfer estimates',()=>{
  const request=buildExplanationRequest(rankCountries(foodie).slice(0,3),{...foodie,privateEmail:'secret@example.test'});
  const payload=JSON.parse(request.prompt);
  assert.ok(!request.prompt.includes('secret@example.test'));
  for(const selected of payload.selected){
    assert.ok(selected.strongestMatches.length);assert.equal(selected.matchScore,undefined);
    assert.equal(selected.route.transferMinutes,undefined);assert.equal(selected.supportedBases,undefined);
    assert.ok(selected.strongestMatches.every(match=>match.contribution===undefined));
  }
  assert.match(request.systemPrompt,/40-60 words/);assert.match(request.systemPrompt,/warm, specific and straightforward/);
  assert.match(request.systemPrompt,/Do not mention scores/);
  assert.match(request.systemPrompt,/no.*dietary suitability|not evidence.*meal meets/i);
});

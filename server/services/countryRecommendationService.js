const { rankCountries } = require('./countryScoringService');
const { visaEligibility } = require('./travelEligibilityService');
const { apiError } = require('./apiError');
const llm=require('./llmclient');
const {instrument,measured}=require('./telemetryService');
const { schema,buildExplanationRequest } = require('../prompts/countryExplanationPrompt');
const {TRIP_POLICY}=require('../config/tripPolicy');
const {BUDGET}=require('./destinationScoringService');
const display = require('../data/countryInfo.json');
const { getCountryFallbackReason } = require('./countryHighlights');
async function recommend(user,quiz) {
  const eligible=await visaEligibility(user,quiz);
  const selected=await measured('countryRanking',()=>rankCountries(quiz,eligible).slice(0,3));
  if(selected.length<3) throw apiError('INSUFFICIENT_COUNTRIES','We could not find three countries with routes that fit your trip length, pace, risk preferences, transport preferences and visa eligibility. Try adjusting your preferences or trip length.',422);
  let explanations=new Map(), model=null, explanationFallbackReason='invalid_response';
  try {
    const result=await llm.generateStructured({...buildExplanationRequest(selected,quiz),maxAttempts:TRIP_POLICY.geminiMaxAttempts,timeoutMs:TRIP_POLICY.explanationTimeoutMs,maxOutputTokens:2400});
    const parsed=schema.safeParse(result.data);
    if(parsed.success) {
      for(const item of parsed.data.explanations) {
        const matched = selected.find(c =>
          c.id === item.countryId ||
          c.countryCode.toLowerCase() === String(item.countryId).toLowerCase() ||
          c.name.toLowerCase() === String(item.countryId).toLowerCase() ||
          `country-${c.countryCode.toLowerCase()}` === String(item.countryId).toLowerCase()
        );
        if(matched && !explanations.has(matched.id)) {
          explanations.set(matched.id, { ...item, countryId: matched.id });
        }
      }
      if(explanations.size === 3) {
        model=result.model;
        explanationFallbackReason=null;
      }
    }
  } catch(error) {
    if(![429,502,503,504].includes(error.statusCode))throw error;
    explanationFallbackReason=llm.fallbackReason(error);
  }
  const recommendations=selected.map(country=>{
    const budgetNote=BUDGET[quiz.budgetLevel] && country.supportedBases.some(base=>
      country.suggestedRoute.destinationIds.includes(base.destinationId) && BUDGET[base.budget]>BUDGET[quiz.budgetLevel])
      ? ' Some suggested bases have a higher budget tier than your preference; check accommodation and daily costs before booking.' : '';
    const countryPhoto = display.countries[country.countryCode]?.photo || null;
    const days = country.suggestedRoute.nights.reduce((a,b)=>a+b,0)+1;
    const fallbackReason = getCountryFallbackReason(country, days, country.suggestedRoute.bases);
    return {
      destinationId:country.id,name:country.name,type:'country',country:country.name,countryCode:country.countryCode,
      imageUrl:countryPhoto?.url || null,
      photo:countryPhoto,
      matchScore:country.matchScore,scoreBreakdown:country.scoreBreakdown,
      reason:(explanations.get(country.id)?.reason || fallbackReason)+budgetNote,
      highlights:explanations.get(country.id)?.highlights || country.suggestedRoute.bases,
    };
  });
  return { recommendations,model,title:'Your personalized country matches',summary:'Three countries ranked by the fit of a feasible trip to your preferences.',
    selectionMetadata:{catalogVersion:selected[0].catalogVersion,scoringVersion:selected[0].scoringVersion,policyVersion:selected[0].policyVersion,countryIds:recommendations.map(item=>item.destinationId),explanationSource:model?'gemini':'deterministic_fallback',explanationFallbackReason} };
}
async function recommendCountries(user,quiz){return instrument('recommendations',()=>recommend(user,quiz));}
module.exports={ recommendCountries };

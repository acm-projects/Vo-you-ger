const { rankCountries } = require('./countryScoringService');
const { visaEligibility } = require('./travelEligibilityService');
const { apiError } = require('./apiError');
const llm=require('./llmclient');
const {instrument,measured}=require('./telemetryService');
const { schema,buildExplanationRequest } = require('../prompts/countryExplanationPrompt');
const {TRIP_POLICY}=require('../config/tripPolicy');
async function recommend(user,quiz) {
  const eligible=await visaEligibility(user,quiz);
  const selected=await measured('countryRanking',()=>rankCountries(quiz,eligible).slice(0,3));
  if(selected.length<3) throw apiError('INSUFFICIENT_COUNTRIES','We could not find three eligible countries under your current travel preferences.',422);
  let explanations=new Map(), model=null, explanationFallbackReason='invalid_response';
  try {
    const result=await llm.generateStructured({...buildExplanationRequest(selected,quiz),maxAttempts:TRIP_POLICY.geminiMaxAttempts,timeoutMs:TRIP_POLICY.explanationTimeoutMs,maxOutputTokens:1400});
    const parsed=schema.safeParse(result.data);
    if(parsed.success && new Set(parsed.data.explanations.map(item=>item.countryId)).size===3 && parsed.data.explanations.every(item=>selected.some(country=>country.id===item.countryId))) {
      explanations=new Map(parsed.data.explanations.map(item=>[item.countryId,item])); model=result.model;explanationFallbackReason=null;
    }
  } catch(error) {
    if(![429,502,503,504].includes(error.statusCode))throw error;
    explanationFallbackReason=llm.fallbackReason(error);
  }
  const recommendations=selected.map(country=>({
    destinationId:country.id,name:country.name,type:'country',country:country.name,countryCode:country.countryCode,
    matchScore:country.matchScore,scoreBreakdown:country.scoreBreakdown,
    reason:explanations.get(country.id)?.reason || `${country.name} offers a feasible ${country.suggestedRoute.nights.reduce((a,b)=>a+b,0)+1}-day plan focused on ${country.suggestedRoute.bases.join(' and ')}. These supported bases fit your stated planning constraints; venue details are selected after you choose a country.`,
    highlights:explanations.get(country.id)?.highlights || country.suggestedRoute.bases,
  }));
  return { recommendations,model,title:'Your personalized country matches',summary:'Three countries ranked by the fit of a feasible trip to your preferences.',
    selectionMetadata:{catalogVersion:selected[0].catalogVersion,scoringVersion:selected[0].scoringVersion,policyVersion:selected[0].policyVersion,countryIds:recommendations.map(item=>item.destinationId),explanationSource:model?'gemini':'deterministic_fallback',explanationFallbackReason} };
}
async function recommendCountries(user,quiz){return instrument('recommendations',()=>recommend(user,quiz));}
module.exports={ recommendCountries };

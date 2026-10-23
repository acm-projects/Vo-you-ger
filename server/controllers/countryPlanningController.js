const data=require('../services/planningDataService');
const users=require('../models/userModel');
const { quizSchema }=require('../schemas/recommendationSchema');
const { visaEligibility }=require('../services/travelEligibilityService');
const { apiError,sendError }=require('../services/apiError');
const { buildOutline }=require('../services/tripOutlineService');
const { createCountryItinerary }=require('./countryTripController');

function countryForCode(value) {
  if(typeof value!=='string'||!/^[a-z]{2}$/i.test(value)) throw apiError('INVALID_COUNTRY_CODE','Use an ISO alpha-2 country code');
  const country=data.countries.find(item=>item.countryCode===value.toUpperCase());
  if(!country) throw apiError('COUNTRY_NOT_FOUND','Country is not in the ISO registry',404);
  return country;
}
async function countryAvailability(req,res) {
  try {
    const c=countryForCode(req.params.countryCode);
    return res.json({countryCode:c.countryCode,name:c.name,coverageStatus:c.geographicCoverage,verifiedSettlementCount:c.verifiedSettlementCount,supportedOvernightBases:c.supportedBaseCount,planningAvailable:c.planningAvailable,furtherFeasibilityChecksRequired:true,coverageException:c.coverageException});
  } catch(error) {return sendError(res,error);}
}
async function directContext(req) {
  if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)) throw apiError('INVALID_BODY','A JSON object body is required');
  if(req.body.tripId) throw apiError('INVALID_BODY','Use the trip endpoint to operate on an existing trip');
  const country=countryForCode(req.params.countryCode);
  if(!country.planningAvailable) throw apiError('COUNTRY_NOT_READY','Country is registered but has no reviewed planning bases',422);
  const user=await users.findUserById(req.user.userId);
  if(!user) throw apiError('USER_NOT_FOUND','User not found',404);
  const raw=req.body.quiz??user.quizResponse;
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||!Object.keys(raw).length) throw apiError('ASSESSMENT_REQUIRED','A saved or supplied assessment is required');
  const parsed=quizSchema.safeParse(raw);
  if(!parsed.success) throw apiError('INVALID_ASSESSMENT','Assessment does not match the supported schema');
  const allowed=await visaEligibility(user,parsed.data);
  if(allowed&&!allowed.has(country.countryCode)) throw apiError('VISA_INELIGIBLE','This country is not confirmed visa-free for your supplied citizenships',422);
  const trip={quizSnapshot:parsed.data,recommendations:[{destinationId:country.id,type:'country',name:country.name,country:country.name,countryCode:country.countryCode}],selectionMetadata:{source:'direct_country',catalogVersion:data.version}};
  return {country,trip,body:{...req.body,countryId:country.id}};
}
async function directRoute(req,res) {
  try {
    const {country,trip,body}=await directContext(req);
    const outline=buildOutline({countryId:country.id,quiz:trip.quizSnapshot,startDate:body.startDate,numberOfDays:body.numberOfDays,numberOfNights:body.numberOfNights});
    return res.json({outline});
  } catch(error) {return sendError(res,error);}
}
async function directItinerary(req,res) {
  try {
    const {trip,body}=await directContext(req);
    return await createCountryItinerary({...req,body},res,trip);
  } catch(error) {return sendError(res,error);}
}
module.exports={countryAvailability,directRoute,directItinerary,countryForCode};

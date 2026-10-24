const visa = require('./visaService');
const { toCountryCode } = require('../utils/countryCodes');
const { apiError } = require('./apiError');
async function visaEligibility(user, quiz) {
  if (quiz.visaWillingness !== false) return null;
  const nationalities=Array.isArray(user.nationalities) && user.nationalities.length ? user.nationalities : quiz.nationalities || [];
  if(!Array.isArray(nationalities) || !nationalities.some(value=>toCountryCode(value))) throw apiError('CITIZENSHIP_REQUIRED','Citizenship information is required to recommend visa-free destinations');
  try { return await visa.getVisaFreeCountries(nationalities); }
  catch { throw apiError('VISA_UNAVAILABLE','The visa verification service is temporarily unavailable. Please try again in a moment.',503); }
}
module.exports={ visaEligibility };

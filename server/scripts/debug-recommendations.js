// Offline diagnostic using the current deterministic country engine.
const {rankCountries}=require('../services/countryScoringService');
const quiz={dailyBudget:'$$',riskTolerance:2,travelAlterEgo:'Foodie',minNights:4,maxNights:7,temperaturePreferences:['warm'],willingToGetVisa:true};
const countries=rankCountries(quiz);
console.log(JSON.stringify({mode:'offline',eligibleCountries:countries.length,recommendations:countries.slice(0,3).map(country=>({countryId:country.id,matchScore:country.matchScore,route:country.suggestedRoute.bases,scoreBreakdown:country.scoreBreakdown})),note:'No Gemini call, visa lookup, profile access or database write. Use verify-planning-integrations.js for explicitly authorized capped live checks.'},null,2));

const info=require('../services/countryInfoService');
const {sendError}=require('../services/apiError');
function list(req,res) {res.set('Cache-Control','public, max-age=600');return res.json({countries:info.listCountries()});}
function details(req,res) {
  try {const country=info.countryDetails(req.params.countryCode);res.set('Cache-Control','public, max-age=600');return res.json(country);}
  catch(error) {return sendError(res,error);}
}
module.exports={list,details};

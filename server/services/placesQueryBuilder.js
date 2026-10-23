const {z}=require('zod');
const {quizSchema}=require('../schemas/recommendationSchema');
const {personaTags}=require('../config/interestTags');
const searchQuerySchema=z.object({attractions:z.string().min(5),food:z.string().min(5),experiences:z.string().min(5)});
function getQueryJsonSchema(){const schema=z.toJSONSchema(searchQuerySchema);delete schema.$schema;return schema;}
async function buildPlacesQueries({destination,quiz={}}){
  if(!destination?.name||!destination?.country)throw new Error('A destination name and country are required');
  const profile=quizSchema.parse(quiz);
  const location=`${destination.name}, ${destination.country}`;
  const interests=personaTags(profile.travelAlterEgo).slice(0,3).join(' ');
  const diets=(profile.dietaryRestrictions||[]).filter(value=>!/none|no restrictions/i.test(value)).map(value=>value.replace(/[^a-z -]/gi,'').slice(0,30)).slice(0,3).join(' ');
  return {destination:{name:destination.name,country:destination.country},model:null,queries:{
    attractions:`${interests} attractions museums parks in ${location}`,
    food:`${diets} restaurants local food in ${location}`,
    experiences:`${interests} cultural experiences activities in ${location}`,
  }};
}
module.exports={buildPlacesQueries,searchQuerySchema,getQueryJsonSchema};

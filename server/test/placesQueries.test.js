const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {buildPlacesQueries}=require('../services/placesQueryBuilder');
const destination={name:'Lisbon',country:'Portugal'};

describe('Venue discovery accepts the frontend assessment diet format',()=>{
  for(const [input,expected] of [
    [undefined,''],['None',''],['No restrictions',''],['',''],
    ['Vegetarian','Vegetarian'],['Vegetarian, Gluten free','Vegetarian Gluten free'],
    [['Vegetarian','Gluten free'],'Vegetarian Gluten free'],
    [['None','Vegetarian'],'Vegetarian'],
  ])it(`builds food queries for ${JSON.stringify(input)}`,async()=>{
    const result=await buildPlacesQueries({destination,quiz:{dietaryRestrictions:input}});
    assert.equal(result.queries.food,`${expected} restaurants local food in Lisbon, Portugal`);
  });
});

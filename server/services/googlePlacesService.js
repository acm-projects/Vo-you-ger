const {TRIP_POLICY}=require('../config/tripPolicy');
const {apiError}=require('./apiError');
const {mapLimit,count}=require('./telemetryService');
const PLACES_URL='https://places.googleapis.com/v1/places';
const FIELDS=['id','displayName','formattedAddress','location','addressComponents','regularOpeningHours','rating','priceLevel','businessStatus','attributions','types','primaryType'];
async function request(url,{body,fields,method='POST',attempts=2,timeoutMs=TRIP_POLICY.externalTimeoutMs}) {
  const apiKey=process.env.GOOGLE_PLACES_API_KEY;
  if(!apiKey)throw apiError('PLACES_NOT_CONFIGURED','Google Places is not configured',503);
  for(let attempt=0;attempt<attempts;attempt++) {
    let response;
    try {
      count('googleRequests');
      response=await fetch(url,{method,headers:{'Content-Type':'application/json','X-Goog-Api-Key':apiKey,...(fields?{'X-Goog-FieldMask':fields}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
    }catch {if(attempt+1<attempts)continue;throw apiError('PLACES_TIMEOUT','Google Places did not respond in time',504);}
    if(response.ok) {
      try { return await response.json(); }
      catch { throw apiError('PLACES_INVALID_RESPONSE','Google Places returned an unreadable response',502); }
    }
    if(attempt+1<attempts&&(response.status===429||response.status>=500)){await new Promise(resolve=>setTimeout(resolve,200));continue;}
    throw apiError(response.status===429?'PLACES_RATE_LIMIT':'PLACES_UNAVAILABLE','Google Places is temporarily unavailable',response.status===429?429:502);
  }
}
async function searchPlaces(query,options={}) {
  if(typeof query!=='string'||!query.trim())throw apiError('INVALID_PLACES_QUERY','A search query is required');
  const {pageSize=10}=options;
  if(!Number.isInteger(pageSize)||pageSize<1||pageSize>20)throw apiError('INVALID_PLACES_QUERY','pageSize must be between 1 and 20');
  const data=await request(`${PLACES_URL}:searchText`,{fields:FIELDS.map(field=>`places.${field}`).join(','),body:{textQuery:query.trim(),pageSize,languageCode:'en'}});
  return (data.places||[]).filter(place=>place.businessStatus!=='CLOSED_PERMANENTLY');
}
async function searchPlacesForQueries(queries,destination,options={}) {
  const categories=['attractions','food','experiences'];
  if(!destination?.name||!destination?.country||categories.some(category=>typeof queries?.[category]!=='string'||!queries[category].trim()))throw apiError('INVALID_PLACES_QUERY','Destination and all three search categories are required');
  const results=await mapLimit(categories,TRIP_POLICY.placesConcurrency,async category=>[category,await searchPlaces(queries[category],options)]);
  return {queries,places:Object.fromEntries(results)};
}
async function getPlaceDetails(placeId) {
  if(typeof placeId!=='string'||!/^[A-Za-z0-9_-]{1,256}$/.test(placeId))throw apiError('INVALID_PLACE_ID','Invalid place ID');
  return request(`${PLACES_URL}/${encodeURIComponent(placeId)}?languageCode=en`,{method:'GET',fields:[...FIELDS,'photos'].join(',')});
}

// Photo names come only from fresh, verified details; never persist them or
// expose the server API key in an image URL. Resolve one photo per visible venue.
async function getPlacePhoto(place) {
  if(!/^[A-Za-z0-9_-]{1,256}$/.test(place?.id||'')) return null;
  const prefix=`places/${place.id}/photos/`;
  const photo=Array.isArray(place.photos)&&place.photos.find(item=>typeof item?.name==='string'&&item.name.startsWith(prefix)&&/^[A-Za-z0-9_-]{1,4096}$/.test(item.name.slice(prefix.length)));
  if(!photo) return null;
  try {
    const result=await request(`https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=1000&skipHttpRedirect=true`,{method:'GET',attempts:1,timeoutMs:Math.min(4000,TRIP_POLICY.externalTimeoutMs)});
    const url=new URL(result.photoUri);
    if(url.protocol!=='https:'||url.username||url.password||!/(^|\.)(googleusercontent\.com|ggpht\.com)$/.test(url.hostname)) return null;
    return {provider:'google_places',url:url.href,illustrative:false,alt:`Photo of ${place.displayName?.text||'this venue'}`,
      authorAttributions:Array.isArray(photo.authorAttributions)?photo.authorAttributions.map(author=>({displayName:author.displayName,uri:author.uri})):[]};
  } catch {
    // Photos are optional: quota limits, missing access and expired references
    // must fall back to an illustration without losing verified venue details.
    return null;
  }
}
module.exports={searchPlaces,searchPlacesForQueries,getPlaceDetails,getPlacePhoto};

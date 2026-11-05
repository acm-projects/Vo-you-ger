const {createHash}=require('node:crypto');
const catalog=require('../data/activityPhotos.json');

const PHOTO_SUBJECTS={
  restaurant:'Restaurant dining', cafe:'Café', park:'Park', museum:'Museum',
  landmark:'Architecture', nature:'Nature', beach:'Beach', city:'City exploration',
};

function photoCategory(activity) {
  const types=[activity.primaryType,...(activity.types||[])].filter(Boolean).join(' ');
  if(/cafe|coffee_shop|bakery|tea_house/.test(types)) return 'cafe';
  if(activity.category==='food'||/restaurant|bar\b|food|meal_takeaway/.test(types)) return 'restaurant';
  if(/beach/.test(types)) return 'beach';
  if(/national_park|state_park|hiking|wildlife|mountain|natural_feature/.test(types)) return 'nature';
  if(/park|garden/.test(types)) return 'park';
  if(/museum|art_gallery|aquarium|planetarium/.test(types)) return 'museum';
  if(/landmark|historical|monument|castle|church|mosque|temple|synagogue|sculpture/.test(types)) return 'landmark';
  return activity.category==='attractions'?'landmark':'city';
}

function activityPhoto(activity) {
  const category=photoCategory(activity);
  const photos=catalog.categories[category]||catalog.categories.city||[];
  if(!photos.length) return null;
  // Stable across reloads, accounts and days; no provider calls at viewing time.
  const key=activity.placeId||activity.name||activity.placeName||category;
  const index=createHash('sha256').update(String(key)).digest().readUInt32BE(0)%photos.length;
  return {...photos[index],illustrative:true,subject:PHOTO_SUBJECTS[category],
    caption:'Illustrative photo',alt:`Illustrative photo: ${PHOTO_SUBJECTS[category].toLowerCase()}`};
}

function withActivityPhotos(itinerary) {
  if(!Array.isArray(itinerary?.days)) return itinerary;
  return {...itinerary,days:itinerary.days.map(day=>{
    const result={...day};
    for(const slot of ['morning','afternoon','evening','lateNight','activities','places']) {
      if(Array.isArray(day[slot])) result[slot]=day[slot].map(activity=>({...activity,photo:activityPhoto(activity)}));
    }
    return result;
  })};
}

module.exports={PHOTO_SUBJECTS,photoCategory,activityPhoto,withActivityPhotos};

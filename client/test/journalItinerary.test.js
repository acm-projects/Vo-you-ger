import {test} from 'node:test';
import assert from 'node:assert/strict';
import {journalTrip, journalDay, dayNotes, journalDate, venueRefreshIssue} from '../src/services/journalItinerary.js';

test('venue refresh explains request limits, session errors, provider failures and changed eligibility separately',()=>{
  const error=(code,status=502,message='Safe service message',headers={})=>({response:{status,data:{code,message},headers}});
  const limited=venueRefreshIssue(error('VENUE_REFRESH_RATE_LIMIT',429,'',{'retry-after':'23'}));
  assert.match(limited.message,/23 seconds/);
  assert.equal(limited.retrySeconds,23);
  assert.equal(venueRefreshIssue(error('GENERATION_RATE_LIMIT',429)).retrySeconds,60);
  assert.match(venueRefreshIssue(error('PLACES_RATE_LIMIT',429)).message,/Google Places has reached/);
  assert.match(venueRefreshIssue(error('PLACES_TIMEOUT',504)).message,/timed out/);
  assert.equal(venueRefreshIssue(error('VENUE_NO_LONGER_ELIGIBLE',502,'A venue has incompatible hours.')).retryable,false);
  assert.match(venueRefreshIssue(error('VENUE_NO_LONGER_ELIGIBLE',502,'A venue has incompatible hours.')).message,/incompatible hours/);
  assert.equal(venueRefreshIssue(error('PLACES_NOT_CONFIGURED',503)).retryable,false);
  assert.match(venueRefreshIssue(error('UNAUTHORIZED',401)).message,/Sign in again/);
  assert.equal(venueRefreshIssue(error('DAY_NOT_FOUND',404)).retryable,false);
  assert.match(venueRefreshIssue(new Error('private connection details')).message,/couldn't be loaded/);
});

test('journal uses the selected trip route and dates, including multiple bases', () => {
  const result = journalTrip({itinerary:{tripTitle:'Portugal in June',
    outline:{country:'Portugal',numberOfNights:2,stops:[{name:'Lisbon'},{name:'Porto'}]},
    days:[{day:1,date:'2027-06-05',locationName:'Lisbon'},
      {day:2,date:'2027-06-06',locationName:'Porto'}, {day:3,date:'2027-06-07',locationName:'Porto'}]}});
  assert.equal(result.country,'Portugal');
  assert.deepEqual(result.bases,['Lisbon','Porto']);
  assert.equal(result.numberOfDays,3);
  assert.equal(result.numberOfNights,2);
  assert.match(result.dates[0],/Saturday, June 5, 2027/);
  assert.equal(result.days[1].city,'Porto');
  assert.throws(()=>journalTrip({itinerary:{days:[]}}),/no itinerary/);
});

test('stored place IDs acquire current venue facts without losing saved descriptions or tips', () => {
  const raw = {day:2,date:'2027-06-06',morning:[{placeId:'venue-a',category:'attractions',
    activityDescription:'Your saved museum visit.',travelTip:'Reserve admission.'}]};
  const waiting = journalDay(raw,1,[],true);
  assert.match(waiting.places[0].placeName,/Loading/);
  const day = journalDay(raw,1,[{placeId:'venue-a',name:'Verified museum',address:'12 Museum Street',
    rating:4.6,openingHours:['Sunday: 10 AM – 5 PM'],priceLevel:'PRICE_LEVEL_MODERATE',
    activityDescription:'A replacement description should not win.'}]);
  assert.equal(day.places[0].placeName,'Verified museum');
  assert.equal(day.places[0].activityDescription,'Your saved museum visit.');
  assert.equal(day.places[0].travelTip,'Reserve admission.');
  assert.equal(day.places[0].rating,4.6);
  assert.equal(day.places[0].estimatedCost,'Moderate price level');
  assert.equal(day.places[0].time,'Morning');
  assert.match(day.places[0].openingHours,/Sunday/);
});

test('missing venue facts are left unknown and unrelated places cannot replace a saved venue', () => {
  const day = journalDay({morning:[{placeId:'saved-id',activityDescription:'Saved description'}]},0,
    [{placeId:'different-id',name:'Unrelated venue',rating:5,priceLevel:'PRICE_LEVEL_FREE'}]);
  assert.equal(day.places[0].placeName,'Venue details unavailable');
  assert.equal(day.places[0].rating,undefined);
  assert.equal(day.places[0].estimatedCost,'');
  assert.equal(day.places[0].openingHours,'');
});

test('illustrations display on saved trips and remain labeled after live venue facts arrive', () => {
  const generic={provider:'unsplash',url:'https://images.unsplash.com/generic',illustrative:true,alt:'Illustrative photo: architecture',credit:'Photographer'};
  const raw={morning:[{placeId:'saved-id',category:'attractions',photo:generic,activityDescription:'Saved visit'}]};
  const initial=journalDay(raw,0,[],true).places[0];
  assert.equal(initial.image,generic.url);
  assert.equal(initial.photo.illustrative,true);
  const park={...generic,url:'https://images.unsplash.com/park',alt:'Illustrative photo: park'};
  const refreshed=journalDay(raw,0,[{placeId:'saved-id',name:'Real park',photo:park}]).places[0];
  assert.equal(refreshed.image,park.url);
  assert.equal(refreshed.photo.alt,'Illustrative photo: park');
  assert.equal(refreshed.placeName,'Real park');
  assert.equal(refreshed.activityDescription,'Saved visit');
});

test('arrival, transfer, departure and day-trip notes preserve reserved time and overnight bases', () => {
  const plan={outline:{stops:[{stopId:'one',name:'Lisbon'},{stopId:'two',name:'Porto'}],
    transfers:[{day:3,fromStopId:'one',toStopId:'two',mode:'train',planningMinutes:180}],
    excursions:[{day:2,name:'Sintra'}]}};
  assert.match(dayNotes({day:1,type:'arrival'},plan).join(' '),/arrival and settling in/);
  assert.match(dayNotes({day:3,type:'transfer'},plan).join(' '),/Lisbon → Porto.*train.*180 minutes/);
  assert.match(dayNotes({day:2,type:'excursion'},plan).join(' '),/Sintra.*overnight base/);
  assert.match(dayNotes({day:4,type:'departure'},plan).join(' '),/free for departure/);
  assert.equal(journalDay({day:4,type:'departure',morning:[]},3).places.length,0);
});

test('fresh Google photos replace illustrations while retaining an Unsplash fallback and saved text',()=>{
  const fallback={provider:'unsplash',url:'https://images.unsplash.com/illustration',illustrative:true};
  const photo={provider:'google_places',url:'https://lh3.googleusercontent.com/actual-venue',illustrative:false,authorAttributions:[{displayName:'Photographer'}]};
  const raw={morning:[{placeId:'venue',photo:fallback,activityDescription:'Saved visit',travelTip:'Saved tip'}]};
  const result=journalDay(raw,0,[{placeId:'venue',placeName:'Verified venue',photo,fallbackPhoto:fallback}]).places[0];
  assert.deepEqual(result.photo,photo);assert.equal(result.image,photo.url);
  assert.deepEqual(result.fallbackPhoto,fallback);
  assert.equal(result.activityDescription,'Saved visit');assert.equal(result.travelTip,'Saved tip');
  assert.equal(raw.morning[0].photo,fallback);
});

test('legacy activity lists remain readable and invalid dates do not crash the page', () => {
  const day = journalDay({city:'Rome',activities:[{name:'A recorded visit',description:'Original description'}]},0);
  assert.equal(day.city,'Rome');
  assert.equal(day.places[0].placeName,'A recorded visit');
  assert.equal(day.places[0].activityDescription,'Original description');
  assert.equal(journalDate('not-a-date'),'');
});

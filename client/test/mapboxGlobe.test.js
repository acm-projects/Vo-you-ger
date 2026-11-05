import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countryFromFeature, configureGlobeStyle, selectCountry, addMapboxTripMarkers,
  COUNTRY_LAYER, COUNTRY_SOURCE, GLOBE_STYLE, GLOBE_BASEMAP_CONFIG } from '../src/services/mapboxGlobe.js';

const countries={type:'FeatureCollection',features:[
  {properties:{ADMIN:'Portugal',ISO_A2_EH:'PT'}},
  {properties:{ADMIN:'Spain',ISO_A2_EH:'ES'}},
]};

test('country clicks use local country identifiers including missing ISO fallbacks',()=>{
  assert.deepEqual(countryFromFeature(countries.features[0]),{name:'Portugal',countryCode:'PT'});
  assert.deepEqual(countryFromFeature({properties:{NAME:'France',ISO_A2_EH:'-99',ISO_A2:'FR'}}),{name:'France',countryCode:'FR'});
  assert.deepEqual(countryFromFeature({properties:{ADMIN:'Unknown',ISO_A2:'-99'}}),{name:'Unknown',countryCode:null});
  assert.equal(countryFromFeature(null),null);
});

test('demo basemap hides labels and space while preserving its native atmosphere and country interaction',()=>{
  const sources=new Map(),layers=[];
  const nativeFog={color:'#ffffff','high-color':'#245cdf','horizon-blend':0.2,
    'space-color':'#010b19','star-intensity':0.35,range:[0.5,10]};
  const map={setProjection:value=>map.projection=value,
    getFog:()=>nativeFog,setFog:value=>map.fog=value,
    addSource:(id,source)=>sources.set(id,source),
    addLayer:layer=>layers.push(layer)};
  configureGlobeStyle(map,countries);
  assert.equal(map.projection,'globe');
  assert.deepEqual(map.fog,{...nativeFog,'space-color':'rgba(0,0,0,0)','star-intensity':0});
  assert.equal(GLOBE_STYLE,'mapbox://styles/mapbox/standard');
  const labelOptions=['showPlaceLabels','showPointOfInterestLabels','showRoadLabels','showTransitLabels',
    'showLandmarkIcons','showLandmarkIconLabels','showIndoorLabels'];
  assert.deepEqual(Object.keys(GLOBE_BASEMAP_CONFIG),['lightPreset',...labelOptions]);
  assert.equal(GLOBE_BASEMAP_CONFIG.lightPreset,'dusk');
  for (const key of labelOptions) {
    assert.equal(GLOBE_BASEMAP_CONFIG[key],false,key);
  }
  assert.equal(sources.get(COUNTRY_SOURCE).data,countries);
  assert.equal(layers[0].id,COUNTRY_LAYER);
});

test('selecting a country and clearing its panel update the country highlights',()=>{
  const updates=[];
  const map={getSource:()=>true,setFeatureState:(target,state)=>updates.push({target,state})};
  selectCountry(map,countries,'ES');
  assert.deepEqual(updates.map(({state})=>state.selected),[false,true]);
  assert.ok(updates.every(({target})=>target.source===COUNTRY_SOURCE));
  updates.length=0;selectCountry(map,countries,null);
  assert.deepEqual(updates.map(({state})=>state.selected),[false,false]);
});

test('trip pins preserve coordinates, coincident trips, accessible selection, and cleanup',()=>{
  class Element extends EventTarget {
    constructor(){super();this.style={};this.attrs={};this.children=[];}
    setAttribute(key,value){this.attrs[key]=value;}
    append(...elements){this.children.push(...elements);}
  }
  const created=[];
  class Marker {
    constructor(options){this.options=options;created.push(this);}
    setLngLat(position){this.position=position;return this;}
    addTo(map){this.map=map;return this;}
    remove(){this.removed=true;}
  }
  const first={tripId:'one',country:'Portugal',startCity:'Lisbon',pin:{lat:38.72,lng:-9.14}};
  const trips=[first,{...first,tripId:'two'},{tripId:'invalid',pin:{lat:100,lng:0}},{tripId:'missing'}];
  const selected=[];
  const pins=addMapboxTripMarkers({},Marker,trips,trip=>selected.push(trip.tripId),{createElement:()=>new Element()});
  assert.equal(created.length,2);
  assert.deepEqual(created[0].position,[-9.14,38.72]);
  assert.equal(created[0].options.occludedOpacity,0);
  assert.equal(created[0].options.element.type,'button');
  assert.match(created[0].options.element.attrs['aria-label'],/Portugal.*Lisbon/);
  let stopped=false;
  const click=new Event('click',{bubbles:true});
  click.stopPropagation=()=>{stopped=true;};
  created[1].options.element.dispatchEvent(click);
  assert.deepEqual(selected,['two']);assert.equal(stopped,true);
  pins.highlight('two');
  assert.equal(created[1].options.element.attrs['aria-pressed'],'true');
  assert.equal(created[0].options.element.attrs['aria-pressed'],'false');
  assert.equal(created[1].options.element.children[1].hidden,false);
  assert.equal(created[0].options.element.children[1].hidden,true);
  pins.remove();assert.ok(created.every(marker=>marker.removed));
  created[1].options.element.dispatchEvent(new Event('click'));
  assert.deepEqual(selected,['two']);
});

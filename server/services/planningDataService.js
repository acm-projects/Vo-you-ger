const destinations = require('../data/destinations.json');
const routes = require('../data/planningCatalog.json');
const registry = require('../data/countries.json');
const { normalizeTag } = require('../config/interestTags');
const { TRIP_POLICY } = require('../config/tripPolicy');
const { createHash } = require('node:crypto');

function realDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}

function httpsUrl(value) {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function buildPlanningData(records, routeData, countryRecords = registry.countries) {
  if (new Set(countryRecords.map(country=>country.countryCode)).size!==countryRecords.length || countryRecords.some(country=>!/^[A-Z]{2}$/.test(country.countryCode))) throw new Error('Country registry requires unique alpha-2 codes');
  const countries = new Map(countryRecords.map(country => [country.countryCode, { ...country, id:country.id || `country-${country.countryCode.toLowerCase()}`, pin: null, supportedBaseCount: 0, planningAvailable: false }]));
  const destinationById = new Map();
  const geonamesByCountry = new Map();
  const enabledGeography = new Set();
  for (const destination of records) {
    if (typeof destination.id !== 'string' || !destination.id.trim() || typeof destination.name !== 'string' || !destination.name.trim()) throw new Error('Destinations require stable IDs and names');
    if (destinationById.has(destination.id)) throw new Error(`Duplicate destination ID: ${destination.id}`);
    if (!countries.has(destination.countryCode)) throw new Error(`Unknown registry country: ${destination.countryCode}`);
    if (!['city', 'town', 'place', 'country'].includes(destination.type)) throw new Error(`Invalid destination type: ${destination.id}`);
    for (const tag of destination.tags || []) normalizeTag(tag);
    const geography = destination.provenance?.geography;
    if (geography?.status === 'verified_gazetteer') {
      const point = destination.coordinates;
      if (!point || !Number.isFinite(point.lat) || Math.abs(point.lat)>90 || !Number.isFinite(point.lng) || Math.abs(point.lng)>180 || !Number.isInteger(geography.geonameId) || geography.geonameId<1 || !httpsUrl(geography.sourceUrl)) throw new Error(`Invalid geographic provenance: ${destination.id}`);
      if (!geonamesByCountry.has(destination.countryCode)) geonamesByCountry.set(destination.countryCode, new Set());
      if (['city','town'].includes(destination.type)) geonamesByCountry.get(destination.countryCode).add(geography.geonameId);
    }
    destinationById.set(destination.id, destination);
  }
  for(const country of countries.values()) {
    const sourceCount=geonamesByCountry.get(country.countryCode)?.size||0;
    country.verifiedSettlementCount=['MC','VA','SG'].includes(country.countryCode)?Math.min(1,sourceCount):country.countryCode==='AQ'?0:sourceCount;
    const inherentException = ['MC','VA','SG','AQ'].includes(country.countryCode);
    country.geographicCoverage = country.verifiedSettlementCount >= TRIP_POLICY.minimumCatalogCitiesPerCountry ? 'minimum_met' : inherentException ? 'exception' : 'source_gap';
    if (country.geographicCoverage === 'minimum_met') country.coverageException = null;
    else country.coverageException ||= {code:'insufficient_qualifying_source_records',reason:'The loaded catalog has fewer than five verified distinct settlements; travel readiness is evaluated separately.'};
  }
  const bases = records.flatMap(destination => {
    const p = destination.planning;
    if (p?.enabled !== true) return [];
    if (!['city','town'].includes(destination.type) || !Number.isFinite(p.lat) || Math.abs(p.lat)>90 || !Number.isFinite(p.lng) || Math.abs(p.lng)>180 || !Number.isInteger(p.minNights) || p.minNights<TRIP_POLICY.minNightsPerBase || !Number.isFinite(p.radiusKm) || p.radiusKm<=0 || p.radiusKm>50 || typeof p.region!=='string' || !p.region.trim()) throw new Error(`Invalid enabled planning destination: ${destination.id}`);
    // Geographic-only imports never become operational merely by existing.
    if (destination.provenance?.geography?.status !== 'verified_gazetteer' || !['reviewed','legacy_editorial'].includes(p.reviewStatus)) throw new Error(`Enabled base needs geography/travel review: ${destination.id}`);
    if (Math.abs(p.lat-destination.coordinates.lat)>0.05 || Math.abs(p.lng-destination.coordinates.lng)>0.05) throw new Error(`Enabled planning anchor disagrees with verified geography: ${destination.id}`);
    const geographicId=destination.provenance.geography.geonameId;
    if(enabledGeography.has(geographicId)) throw new Error(`A settlement cannot be enabled twice: ${destination.id}`);
    enabledGeography.add(geographicId);
    return [{ ...p, destinationId: destination.id }];
  });
  const baseById = new Map(bases.map(base=>[base.destinationId,base]));
  const basesByCountry = new Map();
  for (const base of bases) {
    const d=destinationById.get(base.destinationId), country=countries.get(d.countryCode);
    if (!basesByCountry.has(d.countryCode)) basesByCountry.set(d.countryCode,[]);
    basesByCountry.get(d.countryCode).push(base);
    country.supportedBaseCount++; country.planningAvailable=true;
    country.pin ||= { lat:base.lat,lng:base.lng };
  }
  for(const override of routeData.countryOverrides||[]) {
    const country=countries.get(override.countryCode);
    if(country && override.pin) country.pin=override.pin;
  }
  const adjacency = new Map();
  for(const edge of routeData.connections||[]) {
    const from=destinationById.get(edge.from),to=destinationById.get(edge.to);
    if(!baseById.has(edge.from)||!baseById.has(edge.to)||from.countryCode!==to.countryCode||edge.domesticOnly!==true||!['train','car','bus','plane','ferry'].includes(edge.mode)||!Number.isInteger(edge.planningMinutes)||edge.planningMinutes<=0||!/^https:\/\//.test(edge.sourceUrl||'')) throw new Error(`Invalid domestic planning connection: ${edge.from} → ${edge.to}`);
    if (edge.from===edge.to || typeof edge.bidirectional!=='boolean' || !['reviewed','unreviewed','unavailable'].includes(edge.status) || !realDate(edge.reviewedOn)) throw new Error(`Connection needs a validity status, directionality and real review date: ${edge.from} → ${edge.to}`);
    for(const [origin,target] of [[edge.from,edge.to],...(edge.bidirectional?[[edge.to,edge.from]]:[])]) {
      if(!adjacency.has(origin)) adjacency.set(origin,[]);
      adjacency.get(origin).push({ ...edge, target });
    }
  }
  for (const excursion of routeData.excursions || []) {
    const from=destinationById.get(excursion.fromDestinationId), to=destinationById.get(excursion.destinationId);
    if(!from || !to || !baseById.has(from.id) || from.countryCode!==to.countryCode || from.id===to.id || to.provenance?.geography?.status!=='verified_gazetteer' || excursion.domesticOnly!==true || !['train','bus','car','ferry','plane'].includes(excursion.mode) || !Number.isInteger(excursion.roundTripPlanningMinutes) || excursion.roundTripPlanningMinutes<1 || excursion.roundTripPlanningMinutes>TRIP_POLICY.maxExcursionMinutes || !realDate(excursion.reviewedOn) || !httpsUrl(excursion.sourceUrl) || !Number.isFinite(excursion.lat) || Math.abs(excursion.lat)>90 || !Number.isFinite(excursion.lng) || Math.abs(excursion.lng)>180 || !Number.isFinite(excursion.radiusKm) || excursion.radiusKm<=0 || excursion.radiusKm>50) throw new Error(`Invalid domestic excursion: ${excursion.destinationId}`);
  }
  const fingerprint=createHash('sha256').update(JSON.stringify({records,routeData,countryRecords})).digest('hex').slice(0,12);
  return { ...routeData, version:`${routeData.version}/${registry.version}/${fingerprint}`, countries:[...countries.values()], bases, destinationById, baseById, basesByCountry, adjacency };
}
module.exports=buildPlanningData(destinations,routes);
module.exports.buildPlanningData=buildPlanningData;

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const catalog = require("../services/planningDataService");
const destinations = require("../data/destinations.json");
const { buildOutline, countryCandidates } = require("../services/tripOutlineService");

describe("Destination-driven planning coverage", () => {
  it("derives country availability from located destinations without an allowlist", () => {
    const record = {
      id: "sample-city", name: "Example city", type: "city", country: "Example country", countryCode: "XX",
      coordinates:{lat:10,lng:20},provenance:{geography:{status:'verified_gazetteer',geonameId:1,sourceUrl:'https://example.test/1'}},
      planning: { enabled: true,reviewStatus:'reviewed', lat: 10, lng: 20, region: "City area", minNights: 3, radiusKm: 15 },
    };
    const data = catalog.buildPlanningData([record], { connections: [], countryOverrides: [] },[{countryCode:'XX',id:'country-xx',name:'Example country'}]);
    assert.equal(data.countries[0].id, "country-xx");
    assert.deepEqual(data.countries[0].pin, { lat: 10, lng: 20 });
    assert.equal(data.bases[0].destinationId, record.id);
    record.planning.enabled = false;
    assert.equal(catalog.buildPlanningData([record], { connections: [] },[{countryCode:'XX'}]).countries[0].planningAvailable, false);
  });
  it("requires valid location and stay metadata for enabled bases", () => {
    const sample = structuredClone(destinations.find((destination) => destination.planning?.enabled));
    for (const changes of [{ lat: null }, { lng: 181 }, { minNights: 0 }, { radiusKm: 0 }]) {
      const invalid = { ...sample, planning: { ...sample.planning, ...changes } };
      assert.throws(() => catalog.buildPlanningData([invalid], { connections: [] }), /Invalid enabled planning destination/);
    }
    assert.throws(() => catalog.buildPlanningData([{ ...sample, type: "country" }], { connections: [] }));
  });
  it("retains broad country records as descriptive data until they have concrete bases", () => {
    for (const countryCode of ["JO", "MV", "CR", "ZW", "NA", "MU"]) {
      assert.ok(destinations.some((destination) => destination.countryCode === countryCode));
      assert.equal(catalog.countries.find((country) => country.countryCode === countryCode).planningAvailable, false);
    }
    assert.equal(destinations.find(d=>d.id==='swiss-alps-ch').planning?.enabled===true,false);
    assert.equal(catalog.countries.find(country=>country.countryCode==='CH').planningAvailable,true);
  });
  it("makes existing destinations available across continents", () => {
    const countries = new Set(countryCandidates({ budgetLevel: "$$$" }).map((country) => country.countryCode));
    for (const code of ["US", "CA", "MX", "AU", "NZ", "KR", "TH", "IN", "ZA", "MA", "CL", "BR", "SE"]) assert.ok(countries.has(code), code);
  });
  it("adds only supported domestic multi-city routes and honors their modes", () => {
    for (const [countryId, mode] of [["country-us", "train"], ["country-ca", "train"], ["country-nz", "car"], ["country-pl", "train"], ["country-cl", "bus"]]) {
      const outline = buildOutline({ countryId, numberOfNights: 7, quiz: { seeAllOrDeeply: "seeAll", intercityTransportModes: [mode] } });
      assert.equal(outline.stops.length, 2, countryId);
      assert.equal(outline.transfers[0].mode, mode);
      const blocked = buildOutline({ countryId, numberOfNights: 7, quiz: { intercityTransportModes: ["ferry"] } });
      assert.equal(blocked.stops.length, 1);
    }
  });
});

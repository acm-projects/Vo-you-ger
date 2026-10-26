const {it,mock}=require('node:test');
const assert=require('node:assert/strict');
const {assessmentCoverage}=require('../scripts/assessment-coverage');
const {rankCountries}=require('../services/countryScoringService');
const {buildOutline,validateOutline}=require('../services/tripOutlineService');

it('offers three distinct valid routes across the core assessment eligibility matrix',()=>{
  const network=mock.method(global,'fetch',()=>assert.fail('Coverage must not use live providers'));
  try {
    const report=assessmentCoverage();
    assert.equal(report.checkedProfiles,1008);
    assert.equal(report.profilesWithThreeValidRoutes,report.checkedProfiles,JSON.stringify(report.gaps));
    assert.equal(report.profilesWithInsufficientCountries,0);
  } finally {network.mock.restore();}
});

it('has budget multi-base routes even within an explicitly restricted three-country eligible pool',()=>{
  const eligible=new Set(['PL','RO','BG']);
  for(const seeAllOrDeeply of ['See it all','See it deeply'])for(const days of [3,5,7,8,14,21]) {
    const quiz={minNights:days-1,maxNights:days-1,budgetLevel:'$',highRiskDestWillingness:false,
      seeAllOrDeeply,startDate:'2027-06-05',travelAlterEgo:'The Explorer'};
    const selected=rankCountries(quiz,eligible);
    assert.deepEqual(new Set(selected.map(country=>country.countryCode)),eligible);
    for(const country of selected)validateOutline(buildOutline({countryId:country.id,quiz}),quiz);
  }
});

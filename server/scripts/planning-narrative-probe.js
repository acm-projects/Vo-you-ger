// Diagnose the narrative stage of already collected live-test plans. Each case
// runs in a fresh process to separate provider errors from shared cooldown state.
// Reuses the original persisted request budget; never calls Google or a database.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {performance} = require('node:perf_hooks');
require('dotenv').config({path: path.resolve(__dirname, '../.env'), quiet: true});
const {budgetFetch} = require('./verify-planning-integrations');
const {cases} = require('./planning-reliability-check');

async function main() {
  const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (!process.argv.includes('--allow-live')) {
    console.log('Usage: node scripts/planning-narrative-probe.js --allow-live --report-dir=/original/live-report --case=CASE_ID (or --all)');
    return;
  }
  const directory = option('report-dir');
  assert.ok(directory && path.isAbsolute(directory), 'Use the original absolute report directory');
  const filename = name => path.join(directory, `${name}.json`);
  const read = name => JSON.parse(fs.readFileSync(filename(name), 'utf8'));
  const write = (name, data) => fs.writeFileSync(filename(name), JSON.stringify(data, null, 2) + '\n', {mode: 0o600});
  const report = read('report');
  if (process.argv.includes('--all')) {
    const {spawn} = require('node:child_process');
    for (const item of cases) {
      if (!fs.existsSync(filename(item.id)) || fs.existsSync(filename(`narrative-${item.id}`))) continue;
      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [__filename, '--allow-live', `--report-dir=${directory}`, `--case=${item.id}`], {stdio: 'inherit'});
        child.on('error', reject);
        child.on('close', code => code === 0 ? resolve() : reject(new Error('Probe process failed')));
      });
    }
    return;
  }
  const id = option('case');
  assert.ok(cases.some(item => item.id === id), 'Choose an existing live-test case');
  if (fs.existsSync(filename(`narrative-${id}`))) return;
  const counts = read('budget'), limits = report.limits;
  if (counts.gemini >= limits.gemini) throw new Error('Approved Gemini allowance exhausted');
  const {itinerary, quiz} = read(id);
  const slots = ['morning','afternoon','evening'];
  const originalIdentity=JSON.stringify(itinerary.days.map(day=>({day:day.day,stopId:day.stopId,slots:slots.map(slot=>day[slot].map(p=>p.placeId))})));
  const {writeNarrative,clearNarrativeCache}=require('../services/itineraryNarrativeService');
  clearNarrativeCache();
  const discovered=itinerary.days.map(day=>({candidatePlaces:slots.flatMap(slot=>day[slot]).map(activity=>({placeId:activity.placeId,name:activity.placeName,category:activity.category,types:[]}))}));
  const probe = {id, scope: 'Fresh-process narrative-only probe using the previously collected live plan; Google types are absent from saved activity metadata', startedAt: new Date().toISOString(), diagnostics: [], network: []};
  const original = global.fetch, originalWarn = console.warn;
  // Google and visa have zero allowance in this probe, regardless of their
  // remaining shared budget. Only approved Gemini requests may leave this process.
  global.fetch = budgetFetch(original, counts, state => write('budget', state), {google: counts.google, visa: 0, gemini: limits.gemini}, event => {
    probe.network.push(event);
    console.log(JSON.stringify({probe: id, ...event}));
  });
  console.warn = (value, ...args) => {
    if (typeof value === 'string' && /^(Gemini model |Gemini rejected a request)/.test(value)) probe.diagnostics.push(value);
    originalWarn(value, ...args);
  };
  const before = counts.gemini, start = performance.now();
  console.log(`START narrative-only ${id}`);
  try {
    const {model}=await writeNarrative({itinerary,discovered,quiz});
    assert.equal(itinerary.narrativeSource,'gemini','Only partial or fallback descriptions were returned');
    assert.equal(JSON.stringify(itinerary.days.map(day=>({day:day.day,stopId:day.stopId,slots:slots.map(slot=>day[slot].map(p=>p.placeId))}))),originalIdentity);
    probe.status = 'passed';
    probe.model = model;
    probe.structuredResponseAndFixedPlanVerified = true;
    probe.narrativeDiagnostics=itinerary.narrativeDiagnostics;
    probe.response={tripTitle:itinerary.tripTitle,summary:itinerary.summary,
      dayThemes:itinerary.days.map(day=>({day:day.day,theme:day.theme})),
      activityDescriptions:itinerary.days.flatMap(day=>slots.flatMap(slot=>day[slot].map(p=>({placeId:p.placeId,description:p.activityDescription})))),
    };
  } catch (error) {
    probe.status = counts.gemini >= limits.gemini ? 'inconclusive_budget' : 'failed';
    probe.code = error.code || error.statusCode || 'INVALID_STRUCTURED_OUTPUT';
    probe.fallbackReason = error.fallbackReason || null;
    if (error.code === 'ERR_ASSERTION') probe.validationMessage = error.message.split('\n')[0];
  } finally {
    global.fetch = original;
    console.warn = originalWarn;
    probe.elapsedMs = Number((performance.now() - start).toFixed(1));
    probe.geminiRequests = counts.gemini - before;
    write(`narrative-${id}`, probe);
    console.log(`DONE narrative-only ${id}: ${probe.status} (${probe.elapsedMs}ms)`);
  }
}
if (require.main === module) main().catch(() => {console.error('Narrative probe could not continue; check the persisted budget and report. No provider messages or keys printed.'); process.exitCode = 1;});

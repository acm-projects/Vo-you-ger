const { AsyncLocalStorage } = require('node:async_hooks');
const { performance } = require('node:perf_hooks');
const context = new AsyncLocalStorage();

function record(stage, started) {
  const metrics = context.getStore();
  if (metrics) metrics.timingsMs[stage] = Number(((metrics.timingsMs[stage] || 0) + performance.now() - started).toFixed(3));
}
function measuredSync(stage, work) {
  const started = performance.now();
  try { return work(); } finally { record(stage, started); }
}
async function measured(stage, work) {
  const started = performance.now();
  try { return await work(); } finally { record(stage, started); }
}
function count(name, amount = 1) {
  const metrics = context.getStore();
  if (metrics) metrics.counts[name] = (metrics.counts[name] || 0) + amount;
}
async function instrument(operation, work) {
  if (context.getStore()) return measured(operation, work);
  const metrics = { operation, timingsMs: {}, counts: {} };
  return context.run(metrics, async () => {
    try { return await measured('overall', work); }
    finally { if (process.env.PLANNING_METRICS === '1') console.info(JSON.stringify({ planningMetrics: metrics })); }
  });
}
async function mapLimit(items, limit, worker) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Concurrency must be a positive integer');
  const output = new Array(items.length);
  let next = 0, error;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (!error) {
      const index = next++;
      if (index >= items.length) return;
      try { output[index] = await worker(items[index], index); }
      catch (failure) { error = failure; }
    }
  }));
  if (error) throw error;
  return output;
}
module.exports = { measured, measuredSync, count, instrument, mapLimit };

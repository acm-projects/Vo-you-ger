const {describe, it, afterEach, mock} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createPhotoCatalogReader} = require('../services/countryPhotoCatalogService');
const controller = require('../controllers/countryInfoController');
const directories = [];
afterEach(() => {
  mock.restoreAll();
  for (const directory of directories.splice(0)) fs.rmSync(directory, {recursive: true, force: true});
});

describe('Country photo freshness', () => {
  it('reloads atomic catalog replacements without restarting, including same-size files', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'voyouger-photo-freshness-'));
    directories.push(directory);
    const filename = path.join(directory, 'photos.json');
    const initial = {countries: {CZ: {id: 'old'}}};
    fs.writeFileSync(filename, JSON.stringify(initial));
    const read = createPhotoCatalogReader(filename, initial);
    assert.equal(read('CZ').id, 'old');
    const replacement = path.join(directory, 'replacement.json');
    fs.writeFileSync(replacement, JSON.stringify({countries: {CZ: {id: 'new'}}}));
    fs.renameSync(replacement, filename);
    assert.equal(read('CZ').id, 'new');
    assert.equal(read('NP'), null);
  });
  it('keeps the last valid selection if an update is malformed or temporarily unavailable', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'voyouger-photo-recovery-'));
    directories.push(directory);
    const filename = path.join(directory, 'photos.json');
    const initial = {countries: {CZ: {id: 'existing'}}};
    fs.writeFileSync(filename, JSON.stringify(initial));
    const read = createPhotoCatalogReader(filename, initial);
    const warnings = mock.method(console, 'warn', () => {});
    fs.writeFileSync(filename, '{');
    assert.equal(read('CZ').id, 'existing');
    assert.equal(read('CZ').id, 'existing');
    assert.equal(warnings.mock.callCount(), 1);
    fs.unlinkSync(filename);
    assert.equal(read('CZ').id, 'existing');
    fs.writeFileSync(filename, JSON.stringify({countries: {CZ: {id: 'recovered'}}}));
    assert.equal(read('CZ').id, 'recovered');
  });
  it('requires country detail responses to revalidate instead of staying fresh for ten minutes', () => {
    const headers = {};
    let body;
    const response = {set(name, value) {headers[name] = value; return this;}, json(value) {body = value; return this;}};
    controller.details({params: {countryCode: 'CZ'}}, response);
    assert.equal(headers['Cache-Control'], 'no-cache');
    assert.equal(body.countryCode, 'CZ');
    assert.ok(body.photo.url);
  });
});

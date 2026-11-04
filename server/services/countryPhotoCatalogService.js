const fs = require('node:fs');

function createPhotoCatalogReader(filename, initialData) {
  const signature = () => {
    const stat = fs.statSync(filename);
    return `${stat.ino}:${stat.mtimeMs}:${stat.size}`;
  };
  let data = initialData;
  let version = signature();
  let failedVersion;

  return function readPhoto(code) {
    let currentVersion;
    try {
      currentVersion = signature();
      if (currentVersion !== version) {
        const next = JSON.parse(fs.readFileSync(filename, 'utf8'));
        if (!next.countries || typeof next.countries !== 'object' || Array.isArray(next.countries)) {
          throw new Error('Invalid photo catalog');
        }
        data = next;
        version = currentVersion;
        failedVersion = undefined;
      }
    } catch {
      if (failedVersion !== (currentVersion || 'unavailable')) {
        console.warn('Country photo catalog could not be refreshed; retaining the previous selections.');
        failedVersion = currentVersion || 'unavailable';
      }
    }
    return data.countries[code] || null;
  };
}

module.exports = {createPhotoCatalogReader};

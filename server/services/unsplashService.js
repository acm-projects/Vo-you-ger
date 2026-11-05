const API_ORIGIN = 'https://api.unsplash.com';
let requestLimit = Infinity;
let requestsMade = 0;
let providerRemaining = null;

function configureRequestBudget(limit) {
  if (!(limit === Infinity || (Number.isInteger(limit) && limit > 0))) throw new Error('Use a positive request budget.');
  requestLimit = limit;
  requestsMade = 0;
  providerRemaining = null;
}

function requestUsage() {
  return {requestsMade, providerRemaining, remaining: Math.min(requestLimit - requestsMade, providerRemaining ?? Infinity)};
}

function budgetError(message) {
  return Object.assign(new Error(message), {code: 'UNSPLASH_LIMIT'});
}

async function request(path, params = {}) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) throw new Error('Set UNSPLASH_ACCESS_KEY in server/.env first.');
  if (requestUsage().remaining <= 0) throw budgetError('Unsplash request allowance reached. Progress is saved; resume after the hourly reset.');

  const url = new URL(path, API_ORIGIN);
  if (url.origin !== API_ORIGIN) throw new Error('Invalid Unsplash API address.');
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);

  let response;
  try {
    requestsMade += 1;
    response = await fetch(url, {
      headers: {Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1'},
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
  } catch (error) {
    throw new Error(error.name === 'TimeoutError' || error.name === 'AbortError'
      ? 'Unsplash timed out. No photo was saved; try again later.'
      : 'Could not reach Unsplash. No photo was saved.');
  }

  const remaining = response.headers.get('x-ratelimit-remaining');
  if (remaining !== null && /^\d+$/.test(remaining)) providerRemaining = Number(remaining);

  if (!response.ok) {
    if (response.status === 401) throw new Error('Unsplash rejected the Access Key.');
    if (response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) {
      throw budgetError('Unsplash API allowance exhausted. Wait for the hourly limit to reset.');
    }
    throw Object.assign(new Error(`Unsplash returned HTTP ${response.status}. No photo was saved.`), {status: response.status});
  }
  try {
    return await response.json();
  } catch {
    throw new Error('Unsplash returned an unreadable response. No photo was saved.');
  }
}

function photoId(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error('Invalid Unsplash photo ID.');
  return encodeURIComponent(id);
}

function referralLink(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'unsplash.com') throw new Error('Invalid Unsplash attribution link.');
  url.searchParams.set('utm_source', 'voyouger');
  url.searchParams.set('utm_medium', 'referral');
  return url.href;
}

function formatPhoto(photo, country, {allowPortrait = false} = {}) {
  photoId(photo.id);
  if (!Number.isFinite(photo.width) || !Number.isFinite(photo.height) || photo.width < 1200 || photo.height < 600 || (!allowPortrait && photo.width <= photo.height)) {
    throw new Error(allowPortrait ? 'Choose a photo at least 1200 pixels wide and 600 pixels tall.' : 'Choose a landscape photo at least 1200 pixels wide.');
  }
  if (!photo.user?.name || !photo.user?.links?.html || !photo.links?.html || !photo.urls?.raw) {
    throw new Error('This photo is missing its image or photographer credit.');
  }
  const image = new URL(photo.urls.raw);
  if (image.protocol !== 'https:' || image.hostname !== 'images.unsplash.com') throw new Error('Invalid Unsplash image address.');
  // Preserve the API image URL and its ixid while requesting display-sized versions.
  function imageAt(width) {
    const url = new URL(image);
    url.searchParams.set('auto', 'format');
    url.searchParams.set('fit', 'max');
    url.searchParams.set('q', '85');
    url.searchParams.set('w', width);
    return url.href;
  }
  return {
    provider: 'unsplash', id: photo.id,
    url: imageAt(1200),
    srcSet: [640, 1200, 1800].filter(width => width <= photo.width).map(width => `${imageAt(width)} ${width}w`).join(', '),
    width: photo.width, height: photo.height,
    sourceUrl: referralLink(photo.links.html),
    credit: photo.user.name, photographerUrl: referralLink(photo.user.links.html),
    providerUrl: referralLink('https://unsplash.com'),
    license: 'Unsplash License', licenseUrl: referralLink('https://unsplash.com/license'),
    alt: photo.alt_description || photo.description || `A view of ${country.name}`,
  };
}

async function searchPhotos(query) {
  if (typeof query !== 'string' || !query.trim() || query.length > 160) throw new Error('Use a search query between 1 and 160 characters.');
  const result = await request('/search/photos', {query, orientation: 'landscape', per_page: 6, content_filter: 'high'});
  if (!Array.isArray(result.results)) throw new Error('Unsplash returned an invalid search response.');
  return result.results;
}

async function getPhoto(id) {
  const safeId = photoId(id);
  const photo = await request(`/photos/${safeId}`);
  if (photo.id !== id) throw new Error('Unsplash returned a different photo.');
  return photo;
}

async function trackPhoto(photo) {
  const safeId = photoId(photo.id);
  const tracking = new URL(photo.links.download_location);
  if (tracking.origin !== API_ORIGIN || tracking.pathname !== `/photos/${safeId}/download`) {
    throw new Error('Invalid Unsplash selection tracking address.');
  }
  // Selecting an image for a country header requires a download-tracking event.
  await request(tracking.href);
}

async function selectPhoto(id, country) {
  const photo = await getPhoto(id);
  const formatted = formatPhoto(photo, country);
  await trackPhoto(photo);
  return {...formatted, reviewedForCountry: country.countryCode};
}

module.exports = {searchPhotos, selectPhoto, formatPhoto, getPhoto, trackPhoto, configureRequestBudget, requestUsage};

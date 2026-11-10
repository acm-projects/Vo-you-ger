import { getTrip, getTripDayPlaces, saveTrip } from "../src/services/api.js";
import { journalTrip, journalDay, dayNotes, detailText, venueRefreshIssue } from "../src/services/journalItinerary.js";
import { paths } from "../src/services/navigation.js";

let itinerary = [];
let trip = null;
let journal = null;
const tripId = new URLSearchParams(window.location.search).get("tripId");
const refreshedDays = new Set();
const loadingDays = new Map();
const refreshIssues = new Map();

/* =========================================
   HTML ELEMENT REFERENCES
========================================= */

const journalCover = document.getElementById("journalCover");
const journalOpen = document.getElementById("journalOpen");
const journalStatus = document.getElementById("journalStatus");
const journalLoading = document.getElementById("journalLoading");
const tripDetailsButton = document.getElementById("tripDetails");
const saveTripButton = document.getElementById("saveTrip");
const journalSaveStatus = document.getElementById("journalSaveStatus");

const leftPageContent = document.getElementById("leftPageContent");
const rightPageContent = document.getElementById("rightPageContent");

const leftPageNumber = document.getElementById("leftPageNumber");
const rightPageNumber = document.getElementById("rightPageNumber");

const dayTabs = document.getElementById("dayTabs");

const turningSheet = document.getElementById("turningSheet");
const turningFront = document.getElementById("turningFront");
const turningBack = document.getElementById("turningBack");

const previousDayButton = document.getElementById("previousDay");
const nextDayButton = document.getElementById("nextDay");

const spreadDayLabel = document.getElementById("spreadDayLabel");
const spreadDateLabel = document.getElementById("spreadDateLabel");

const detailsModal = document.getElementById("detailsModal");
const detailsTitle = document.getElementById("detailsTitle");
const detailsDescription = document.getElementById("detailsDescription");
const detailsMeta = document.getElementById("detailsMeta");

const closeDetails = document.getElementById("closeDetails");
const detailsDone = document.getElementById("detailsDone");


/* =========================================
   STATE
========================================= */

let activeDayIndex = 0;
let isFlipping = false;
let lastFocusedElement = null;
let savingTrip = false;


/* =========================================
   HELPERS
========================================= */

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function webURL(value) {
  try {
    const url = new URL(typeof value === 'string' && value.startsWith('//') ? `https:${value}` : value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function photoCredit(card, place) {
  let credit = card.querySelector('.photo-credit');
  if (!credit) { credit = document.createElement('div'); credit.className = 'photo-credit'; card.querySelector('.scrap-photo').after(credit); }
  credit.replaceChildren();
  function link(label, url) {
    const anchor = document.createElement('a');
    anchor.textContent = label; anchor.href = webURL(url);
    anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
    return anchor;
  }
  if (place.placeId) {
    const source = link('Google Maps', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.placeName)}&query_place_id=${encodeURIComponent(place.placeId)}`);
    source.className = 'google-maps-attribution'; source.setAttribute('translate','no');
    credit.append(source);
  }
  if (!place.image) return;
  if (place.photo?.provider === 'google_places') {
    for (const author of place.photo.authorAttributions || []) {
      if (!author.displayName) continue;
      credit.append(document.createElement('br'), document.createTextNode('Photo by '),
        webURL(author.uri) ? link(author.displayName, author.uri) : document.createTextNode(author.displayName));
    }
    return;
  }
  if (place.photo?.provider !== 'unsplash') return;
  if (credit.childNodes.length) credit.append(document.createElement('br'));
  const caption = document.createElement('span');
  caption.className = 'photo-illustration'; caption.textContent = 'Illustrative photo';
  credit.append(caption, document.createElement('br'), document.createTextNode('Photo by '),
    link(place.photo.credit, place.photo.photographerUrl), document.createTextNode(' on '),
    link('Unsplash', place.photo.providerUrl));
}

function showCardPhoto(card, place) {
  const url = webURL(place.image || place.photo?.url);
  if (!url) return;
  place.image = url;
  const frame = card.querySelector('.scrap-photo');
  const image = document.createElement('img');
  image.alt = place.photo?.alt || place.placeName;
  image.loading = 'lazy'; image.decoding = 'async';
  if (place.photo?.srcSet) { image.srcset = place.photo.srcSet; image.sizes = '(max-width: 600px) 40vw, 22vw'; }
  image.addEventListener('error', () => photoFailed(card, place), {once:true});
  frame.querySelector('img')?.remove();
  frame.querySelector('.photo-placeholder')?.remove();
  frame.prepend(image);
  photoCredit(card, place);
  image.src = url;
}

function photoFailed(card, place) {
  if (place.photo?.provider === 'google_places' && webURL(place.fallbackPhoto?.url)) {
    place.photo = place.fallbackPhoto;
    place.image = place.photo.url;
    showCardPhoto(card, place);
    return;
  }
  place.image = '';
  const frame = card.querySelector('.scrap-photo');
  frame.querySelector('img')?.remove();
  frame.querySelector('.photo-placeholder')?.remove();
  const placeholder = document.createElement('span');
  placeholder.className = 'photo-placeholder';
  placeholder.textContent = 'Photo unavailable';
  if (place.photo?.url) {
    const retry = document.createElement('button');
    retry.type = 'button'; retry.textContent = 'Retry photo';
    retry.addEventListener('click', () => { retry.disabled = true; showCardPhoto(card, place); });
    placeholder.appendChild(retry);
  }
  frame.prepend(placeholder);
  photoCredit(card, place);
}

function renderSaveButton() {
  const saved = trip?.isSaved === true;
  saveTripButton.disabled = !trip?.itinerary || savingTrip || saved;
  saveTripButton.textContent = savingTrip ? 'Saving…' : saved ? 'Saved to globe' : 'Save trip';
  saveTripButton.setAttribute('aria-busy', String(savingTrip));
}

function saveNotice(message, {error = false, link, label} = {}) {
  journalSaveStatus.textContent = message;
  journalSaveStatus.dataset.error = String(error);
  if (link) {
    const anchor = document.createElement('a');
    anchor.href = link; anchor.textContent = label;
    journalSaveStatus.appendChild(anchor);
  }
}

async function saveCurrentTrip() {
  if (!trip?.itinerary || !tripId || savingTrip || trip.isSaved === true) return;
  savingTrip = true; renderSaveButton(); saveNotice('');
  try {
    const {data} = await saveTrip(tripId);
    if (data.trip?.tripId !== tripId || data.trip.isSaved !== true) throw new Error('Save was not confirmed');
    // Keep the currently displayed itinerary and refreshed venue facts intact.
    trip.isSaved = true; trip.savedAt = data.trip.savedAt;
    saveNotice('Saved to your account.', {link: paths.globe, label: 'View my globe'});
  } catch (error) {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      saveNotice('Sign in again to save this trip.', {error: true, link: paths.login, label: 'Sign in'});
    } else {
      saveNotice(status === 404 ? 'This trip was not found in your account.' : "Couldn't save this trip. Please try again.", {error: true});
    }
  } finally { savingTrip = false; renderSaveButton(); }
}

function showStatus(message, retry) {
  journalLoading.textContent = '';
  journalLoading.classList.remove('is-loading');
  journalStatus.replaceChildren();
  journalStatus.hidden = !message;
  if (!message) return;
  const text = document.createElement('p');
  text.textContent = message;
  journalStatus.appendChild(text);
  if (retry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Try again';
    button.addEventListener('click', retry);
    journalStatus.appendChild(button);
  }
}

async function loadJournal() {
  try {
    if (!tripId) throw new Error('Choose a trip from your globe or generate an itinerary first.');
    const {data} = await getTrip(tripId);
    journal = journalTrip(data.trip);
    trip = data.trip;
    itinerary = journal.days;
    document.title = journal.title;
    document.querySelector('.cover-destination').textContent = journal.country || journal.title;
    document.querySelector('.cover-country').textContent = journal.bases.join(' → ');
    document.querySelector('.cover-details').textContent =
      [...new Set(journal.dates)].join(' – ') +
      `\n${journal.numberOfDays} days · ${journal.numberOfNights} nights`;
    document.getElementById('coverPrompt').textContent = 'Open my journal';
    journalCover.disabled = false;
    tripDetailsButton.disabled = false;
    renderSaveButton();
    if (trip.isSaved === true) saveNotice('Saved to your account.', {link: paths.globe, label: 'View my globe'});
    showStatus('');
  } catch (error) {
    journalCover.classList.add('hidden');
    const unauthorized = [401,403].includes(error.response?.status);
    const message = unauthorized ? 'Sign in to view this trip.'
      : error.response?.status === 404 ? 'This trip was not found in your account.'
        : error.response ? "Couldn't load this itinerary. Please try again."
          : error.message || "Couldn't load this itinerary. Please try again.";
    showStatus(message, tripId ? () => window.location.reload() : null);
    if (unauthorized) {
      const link = document.createElement('a');
      link.href = '/signUpAndLogin/login.html';
      link.textContent = 'Sign in';
      journalStatus.appendChild(link);
    }
  }
}

async function refreshDay(index) {
  const rawDay = trip.itinerary.days[index];
  if (trip.itinerary.placesStoredAs !== 'ids_only' || refreshedDays.has(rawDay.day)) return;
  if (!itinerary[index].places.length) { refreshedDays.add(rawDay.day); return; }
  if (activeDayIndex === index) {
    showStatus('');
    journalLoading.textContent = 'Loading venue details…';
    journalLoading.classList.add('is-loading');
  }
  if (loadingDays.has(rawDay.day)) return;
  const request = getTripDayPlaces(tripId, rawDay.day);
  loadingDays.set(rawDay.day, request);
  try {
    const {data} = await request;
    itinerary[index] = journalDay(rawDay, index, data.places || []);
    refreshedDays.add(rawDay.day);
    if (activeDayIndex === index) {
      showStatus('');
      if (!isFlipping) renderDay(index);
    }
  } catch (error) {
    // Retain the saved schedule and descriptions without fabricating venue facts.
    itinerary[index] = journalDay(rawDay, index);
    const issue=venueRefreshIssue(error);
    issue.retryAt=Date.now()+(issue.retrySeconds||0)*1000;
    refreshIssues.set(rawDay.day,issue);
    if (activeDayIndex === index) {
      if (!isFlipping) renderDay(index);
      else showVenueRefreshIssue(index);
    }
  } finally {
    loadingDays.delete(rawDay.day);
  }
}

function showVenueRefreshIssue(index) {
  const day=itinerary[index],issue=refreshIssues.get(day.day);
  showStatus(issue.message,issue.retryable?()=>{
    refreshIssues.delete(day.day);
    refreshDay(index);
  }:null);
  const button=journalStatus.querySelector('button');
  const remaining=issue.retryAt-Date.now();
  if(button&&remaining>0) {
    button.disabled=true;
    setTimeout(()=>{button.disabled=false;},remaining);
  }
}


/* =========================================
   CREATE DESTINATION CARDS
========================================= */

function createDestinationCard(place) {
  const card = document.createElement("article");
  card.className = "scrap-card";

  card.innerHTML = `
    <div class="scrap-photo">
      <span class="photo-placeholder">${place.category === 'food' ? 'Meal suggestion' : 'Explore'}</span>

      <span class="scrap-time">
        ${escapeHTML(place.time)}
      </span>
    </div>

    <h3>${escapeHTML(place.placeName)}</h3>

    <p class="card-cost">
      ${escapeHTML(place.estimatedCost || 'Cost not available')}
      ${place.rating ? ` · ★ ${escapeHTML(place.rating)}` : ""}
    </p>

    <button class="read-more" type="button">
      Read more ✿
    </button>
  `;

  photoCredit(card, place);
  if (place.image) showCardPhoto(card, place);

  card.querySelector(".read-more").addEventListener("click", () => {
    openDetails(place);
  });

  return card;
}


/* =========================================
   CREATE A PAGE
========================================= */

// dayIndex is zero-based and identifies the day
// being displayed, including during page animations.

function createPageHTML(day, places, side, dayIndex) {
  const wrapper = document.createElement("div");
  wrapper.className = "page-content";

  const heading = document.createElement("div");
  heading.className = "day-heading";

  const dayNumber = dayIndex + 1;

  heading.innerHTML = `
    <p class="eyebrow">${escapeHTML([day.city, journal.country].filter(Boolean).join(', '))}</p>

    <h2>Day ${dayNumber} · ${escapeHTML(day.city || journal.country || 'Your trip')}</h2>

    <p class="heading-subtext">
      ${escapeHTML(day.theme)}
    </p>
  `;

  wrapper.appendChild(heading);

  if (side === 'left') {
    for (const note of dayNotes(day, trip.itinerary)) {
      const paragraph = document.createElement('p');
      paragraph.className = 'day-logistics';
      paragraph.textContent = note;
      wrapper.appendChild(paragraph);
    }
    const stay = trip.itinerary.stays?.find(stay => stay.stopId === day.stopId);
    if (stay?.recommendedStayArea) {
      const paragraph = document.createElement('p');
      paragraph.className = 'day-logistics';
      paragraph.textContent = `Where to stay: ${stay.recommendedStayArea}. ${stay.stayAreaRationale || ''}`;
      wrapper.appendChild(paragraph);
    }
  }

  const grid = document.createElement("div");
  grid.className = `page-destinations cards-${places.length}`;

  places.forEach(place => {
    grid.appendChild(createDestinationCard(place));
  });

  wrapper.appendChild(grid);

  if (!places.length) {
    const paragraph = document.createElement('p');
    paragraph.className = 'day-logistics';
    paragraph.textContent = side === 'right' ? 'No additional activities scheduled.' : 'No activities scheduled during this part of the day.';
    wrapper.appendChild(paragraph);
  }

  return wrapper;
}


/* =========================================
   RENDER A DAY
========================================= */

function renderDay(index) {
  const day = itinerary[index];

  if (!day) return;

  const places = day.places || [];

  // Split destinations between the two pages.
  const splitIndex = Math.ceil(places.length / 2);

  const leftPlaces = places.slice(0, splitIndex);
  const rightPlaces = places.slice(splitIndex);

  // Replace page content without replacing page containers.
  leftPageContent.innerHTML = "";
  rightPageContent.innerHTML = "";

  leftPageContent.appendChild(
    createPageHTML(day, leftPlaces, "left", index)
  );

  rightPageContent.appendChild(
    createPageHTML(day, rightPlaces, "right", index)
  );

  // Page numbering.
  leftPageNumber.textContent =
    String(index * 2 + 1).padStart(2, "0");

  rightPageNumber.textContent =
    String(index * 2 + 2).padStart(2, "0");

  // Simple day label below the journal.
  spreadDayLabel.textContent = `DAY ${index + 1}`;

  spreadDateLabel.textContent = day.date;

  previousDayButton.disabled = index === 0;
  nextDayButton.disabled = index === itinerary.length - 1;

  renderDayTabs();
  if (refreshIssues.has(day.day)) showVenueRefreshIssue(index);
  else { showStatus(''); refreshDay(index); }
}


/* =========================================
   DYNAMIC DAY TABS
========================================= */

function renderDayTabs() {
  dayTabs.innerHTML = "";

  dayTabs.style.setProperty("--day-count", itinerary.length);
  dayTabs.dataset.manyDays = String(itinerary.length > 7);

  itinerary.forEach((day, index) => {
    const tab = document.createElement("button");

    tab.type = "button";

    tab.className =
      `day-tab ${index === activeDayIndex ? "active" : ""}`;

    tab.textContent = `DAY ${index + 1}`;

    tab.setAttribute(
      "aria-label",
      `Day ${index + 1}: ${day.theme}`
    );

    tab.setAttribute(
      "aria-pressed",
      String(index === activeDayIndex)
    );

    tab.addEventListener("click", () => {
      if (index === activeDayIndex || isFlipping) return;

      flipToDay(index);
    });

    dayTabs.appendChild(tab);
  });
}


/* =========================================
   PAGE FLIP
========================================= */

function flipToDay(targetIndex) {
  if (
    isFlipping ||
    targetIndex < 0 ||
    targetIndex >= itinerary.length ||
    targetIndex === activeDayIndex
  ) {
    return;
  }

  const direction =
    targetIndex > activeDayIndex ? "forward" : "backward";

  const oldDay = itinerary[activeDayIndex];
  const newDay = itinerary[targetIndex];

  const oldSplit = Math.ceil(oldDay.places.length / 2);
  const newSplit = Math.ceil(newDay.places.length / 2);

  // Forward: right page turns over to reveal the next day's left page.
  // Backward: left page turns over to reveal the previous day's right page.
  const oldPlaces = direction === "forward"
    ? oldDay.places.slice(oldSplit)
    : oldDay.places.slice(0, oldSplit);

  const newPlaces = direction === "forward"
    ? newDay.places.slice(0, newSplit)
    : newDay.places.slice(newSplit);

  const oldSide = direction === "forward" ? "right" : "left";
  const newSide = direction === "forward" ? "left" : "right";

  // Prepare the two sides of the turning paper.
  turningFront.innerHTML = "";
  turningBack.innerHTML = "";

  turningFront.appendChild(
    createPageHTML(oldDay, oldPlaces, oldSide, activeDayIndex)
  );

  turningBack.appendChild(
    createPageHTML(newDay, newPlaces, newSide, targetIndex)
  );

  // Reset previous animation and direction.
  turningSheet.classList.remove(
    "hidden",
    "flipping",
    "flip-forward",
    "flip-backward"
  );

  turningSheet.classList.add(
    direction === "forward" ? "flip-forward" : "flip-backward"
  );

  // Force the browser to restart the animation.
  void turningSheet.offsetWidth;

  isFlipping = true;

  turningSheet.classList.add("flipping");

  const finishFlip = (event) => {
    if (event && event.target !== turningSheet) return;
    clearTimeout(flipTimer);
    turningSheet.removeEventListener("animationend", finishFlip);
    turningSheet.classList.remove("flipping", "flip-forward", "flip-backward");
    turningSheet.classList.add("hidden");

    activeDayIndex = targetIndex;

    renderDay(activeDayIndex);

    isFlipping = false;
  };

  turningSheet.addEventListener(
    "animationend",
    finishFlip
  );
  const flipTimer = setTimeout(finishFlip, 1200);
}


/* =========================================
   DETAILS POPUP
========================================= */

function addMetaItem(label, value) {
  const item = document.createElement("div");
  item.className = "meta-item";

  const metaLabel = document.createElement("span");
  metaLabel.className = "meta-label";
  metaLabel.textContent = label;

  const metaValue = document.createElement("div");
  metaValue.className = "meta-value";
  metaValue.textContent = value || "Not provided";

  item.append(metaLabel, metaValue);

  detailsMeta.appendChild(item);
}

function openDetails(place) {
  lastFocusedElement = document.activeElement;

  detailsTitle.textContent = place.placeName;

  detailsDescription.textContent =
    place.activityDescription || "";

  detailsMeta.innerHTML = "";

  addMetaItem("Suggested time", place.time);
  addMetaItem("Estimated cost", place.estimatedCost);
  addMetaItem("Opening hours", place.openingHours);

  addMetaItem(
    "Rating",
    place.rating ? `★ ${place.rating} / 5` : ""
  );

  addMetaItem("Location", place.address);
  addMetaItem("Travel tip", place.travelTip);

  if (place.placeId) {
    const link = document.createElement('a');
    link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.placeName)}&query_place_id=${encodeURIComponent(place.placeId)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'View on Google Maps';
    detailsMeta.appendChild(link);
  }
  for (const attribution of place.attributions || []) {
    addMetaItem('Attribution', attribution.provider || attribution.displayName || attribution);
  }

  detailsModal.classList.remove("hidden");

  document.body.style.overflow = "hidden";

  closeDetails.focus();
}

function openTripDetails() {
  if (!trip) return;
  lastFocusedElement = document.activeElement;
  detailsTitle.textContent = journal.title;
  detailsDescription.textContent = journal.summary;
  detailsMeta.replaceChildren();
  const plan = trip.itinerary, info = plan.practicalInfo || {};
  addMetaItem('Places to visit', journal.bases.join(' → '));
  addMetaItem('Trip length', `${journal.numberOfDays} days · ${journal.numberOfNights} nights`);
  addMetaItem('Currency', typeof info.currency === 'string' ? info.currency
    : [info.currency?.name, info.currency?.code, info.currency?.symbol].filter(Boolean).join(' · '));
  addMetaItem('Languages', detailText(info.languages));
  function addPayments(payments) {
    if (!payments) return;
    addMetaItem('Accepted cards (general guidance)', detailText(payments.cardsAccepted));
    if (payments.cardsLimited?.length) addMetaItem('Cards with limited acceptance', detailText(payments.cardsLimited));
    if (payments.popularEWallets?.length) addMetaItem('E-wallets', detailText(payments.popularEWallets));
    if (payments.cashAdvice) addMetaItem('Cash guidance', payments.cashAdvice);
    if (payments.acceptanceNote) addMetaItem('Payment guidance', payments.acceptanceNote);
  }
  addPayments(info.paymentMethods);
  if (info.culturalTips?.length) addMetaItem('Travel tips', detailText(info.culturalTips));
  for (const stop of info.byStop || []) {
    addMetaItem('Local guidance', stop.name);
    addPayments(stop.paymentMethods);
    if (stop.culturalTips?.length) addMetaItem('Local travel tips', detailText(stop.culturalTips));
  }
  for (const stay of plan.stays || []) {
    addMetaItem(`Where to stay · ${stay.name || 'Overnight base'}`,
      [stay.recommendedStayArea, stay.stayAreaRationale].filter(Boolean).join('\n'));
  }
  if (plan.planningNotes?.length) addMetaItem('Planning notes', detailText(plan.planningNotes));
  if (info.notes?.length) addMetaItem('About this guidance', detailText(info.notes));
  detailsModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  closeDetails.focus();
}

function closeModal() {
  detailsModal.classList.add("hidden");

  document.body.style.overflow = "";

  if (lastFocusedElement) {
    lastFocusedElement.focus();
  }
}


/* =========================================
   OPEN JOURNAL
========================================= */

function openJournal() {
  journalCover.classList.add("hidden");
  journalOpen.classList.remove("hidden");

  activeDayIndex = 0;

  renderDay(activeDayIndex);
}


/* =========================================
   EVENT LISTENERS
========================================= */

journalCover.addEventListener("click", openJournal);
tripDetailsButton.addEventListener('click', openTripDetails);
saveTripButton.addEventListener('click', saveCurrentTrip);

previousDayButton.addEventListener("click", () => {
  flipToDay(activeDayIndex - 1);
});

loadJournal();

nextDayButton.addEventListener("click", () => {
  flipToDay(activeDayIndex + 1);
});

closeDetails.addEventListener("click", closeModal);

detailsDone.addEventListener("click", closeModal);

detailsModal.addEventListener("click", event => {
  if (event.target.matches("[data-close-modal]")) {
    closeModal();
  }
});

document.addEventListener("keydown", event => {
  if (
    event.key === "Escape" &&
    !detailsModal.classList.contains("hidden")
  ) {
    closeModal();
  }

  if (
    detailsModal.classList.contains("hidden") &&
    journalOpen.classList.contains("hidden") === false &&
    !isFlipping
  ) {
    if (event.key === "ArrowRight") {
      flipToDay(activeDayIndex + 1);
    }

    if (event.key === "ArrowLeft") {
      flipToDay(activeDayIndex - 1);
    }
  }
});

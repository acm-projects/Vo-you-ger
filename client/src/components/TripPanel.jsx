import { useEffect, useState } from "react";
import API from "../services/api";
import { itineraryUrl } from "../services/navigation";

function displayDate(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return null;
  return new Intl.DateTimeFormat("en", {month: "short", day: "numeric", year: "numeric", timeZone: "UTC"})
    .format(new Date(`${date}T12:00:00Z`));
}

export default function TripPanel({ trip, onClose }) {
  const [details, setDetails] = useState(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  useEffect(() => {
    if (!trip.countryCode) return;
    const controller = new AbortController();
    API.get(`/countries/${trip.countryCode}`, {signal: controller.signal})
      .then(({data}) => { if (!controller.signal.aborted) setDetails(data); })
      .catch(() => {}); // A country image is optional; the saved trip still opens.
    return () => controller.abort();
  }, [trip.countryCode]);

  const photo = photoFailed ? details?.fallbackPhoto : details?.photo;
  const start = displayDate(trip.startDate);
  const end = displayDate(trip.endDate);
  const year = start ? trip.startDate.slice(0, 4) : null;
  const bases = trip.baseNames?.length ? trip.baseNames : trip.startCity ? [trip.startCity] : [];

  return (
    <article className="country-panel saved-trip-panel">
      <div className="country-panel__heading">
        <h2>{details?.flag && <span aria-hidden="true">{details.flag} </span>}{trip.country || "Saved trip"}{year && ` — ${year}`}</h2>
        <button type="button" className="country-panel__close" onClick={onClose} aria-label="Close trip preview">×</button>
      </div>

      {photo?.url && !fallbackFailed && (
        <figure className="country-panel__photo">
          <img src={photo.url} srcSet={photo.srcSet || undefined} sizes="(max-width: 850px) 90vw, 420px"
            alt={photo.alt || `A view of ${trip.country}`} decoding="async"
            onError={() => photoFailed || !details?.fallbackPhoto?.url ? setFallbackFailed(true) : setPhotoFailed(true)} />
          <figcaption>
            Photo: <a href={photo.photographerUrl || photo.sourceUrl} target="_blank" rel="noopener noreferrer">{photo.credit || "Source"}</a>
            {photo.provider === "unsplash" && <> on <a href={photo.providerUrl} target="_blank" rel="noopener noreferrer">Unsplash</a></>}
            {photo.license && <> · <a href={photo.licenseUrl || photo.sourceUrl} target="_blank" rel="noopener noreferrer">{photo.license}</a></>}
          </figcaption>
        </figure>
      )}

      {bases.length > 0 && <p className="saved-trip-panel__route">{bases.join(" → ")}</p>}
      {start && <p className="saved-trip-panel__dates">{start}{end && end !== start ? ` – ${end}` : ""}</p>}
      <p className="saved-trip-panel__dates">
        {trip.numberOfDays != null && `${trip.numberOfDays} ${trip.numberOfDays === 1 ? "day" : "days"}`}
        {trip.numberOfDays != null && trip.numberOfNights != null && " · "}
        {trip.numberOfNights != null && `${trip.numberOfNights} ${trip.numberOfNights === 1 ? "night" : "nights"}`}
      </p>
      <p>{trip.description || trip.title || "Open your saved itinerary to see the full plan."}</p>
      {trip.pinSource === "country" && <p className="country-panel__footnote">This older trip is shown at the country location because its starting-city coordinates are unavailable.</p>}
      <a className="saved-trip-panel__open" href={itineraryUrl(trip.tripId)}>View itinerary</a>
    </article>
  );
}

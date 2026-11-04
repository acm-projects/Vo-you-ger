import { useEffect, useState } from "react";
import API from "../services/api";

function displayName(code, type) {
  try {
    return new Intl.DisplayNames(["en"], { type }).of(code) || code;
  } catch {
    return code;
  }
}

export default function CountryPanel({ country, onClose }) {
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  const countryCode = country.countryCode;

  useEffect(() => {
    if (!countryCode) return;

    const controller = new AbortController();

    API.get(`/countries/${countryCode}`, {
      signal: controller.signal,
      headers: { "Cache-Control": "no-cache" },
    })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setError("");
          setPhotoFailed(false);
          setFallbackFailed(false);
          setDetails(data);
        }
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;

        setError(
          requestError.response?.status === 404
            ? "Details aren't available for this location yet."
            : "Couldn't load country details. Please try again."
        );
      });

    return () => controller.abort();
  }, [countryCode, country, attempt]);

  function retry() {
    setDetails(null);
    setError("");
    setPhotoFailed(false);
    setFallbackFailed(false);
    setAttempt((previous) => previous + 1);
  }

  const message = !countryCode
    ? "Details aren't available for this location yet."
    : error;

  const loading = Boolean(countryCode && !details && !error);
  const facts = details?.facts || {};
  const photo = photoFailed ? details?.fallbackPhoto : details?.photo;

  const languages = (facts.languages || [])
    .map((code) => displayName(code, "language"))
    .join(", ");

  const currency = facts.currencyCode
    ? displayName(facts.currencyCode, "currency")
    : "";

  const currencyText = facts.currencyCode
    ? currency === facts.currencyCode
      ? currency
      : `${currency} (${facts.currencyCode})`
    : "Not available";

  return (
    <article className="country-panel" aria-busy={loading}>
      <div className="country-panel__heading">
        <h2>
          {details?.flag && (
            <span aria-hidden="true">{details.flag} </span>
          )}
          {details?.name || country.name}
        </h2>

        <button
          type="button"
          className="country-panel__close"
          onClick={onClose}
          aria-label="Close country details"
        >
          ×
        </button>
      </div>

      {loading && <p role="status">Loading country details…</p>}

      {message && (
        <div className="country-panel__error" role="alert">
          <p>{message}</p>

          {countryCode && (
            <button
              type="button"
              className="country-panel__retry"
              onClick={retry}
            >
              Try again
            </button>
          )}
        </div>
      )}

      {details && (
        <>
          {photo?.url && !fallbackFailed ? (
            <figure className="country-panel__photo">
              <img
                key={photo.url}
                src={photo.url}
                srcSet={photo.srcSet || undefined}
                sizes="(max-width: 850px) 90vw, 420px"
                alt={photo.alt || `A view of ${details.name}`}
                decoding="async"
                onError={() => {
                  if (!photoFailed && details.fallbackPhoto?.url && details.fallbackPhoto.url !== photo.url) {
                    setPhotoFailed(true);
                  } else {
                    setFallbackFailed(true);
                  }
                }}
              />

              <figcaption>
                {photo.provider === "unsplash" && "Photo by "}
                <a
                  href={photo.photographerUrl || photo.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {photo.credit || "Photo source"}
                </a>

                {photo.provider === "unsplash" && (
                  <>
                    {" on "}
                    <a href={photo.providerUrl} target="_blank" rel="noopener noreferrer">
                      Unsplash
                    </a>
                  </>
                )}

                {photo.license && (
                  <>
                    {" · "}
                    <a
                      href={photo.licenseUrl || photo.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {photo.license}
                    </a>
                  </>
                )}
              </figcaption>
            </figure>
          ) : (
            <div className="country-panel__photo-placeholder">
              Photo unavailable
            </div>
          )}

          <p className="country-panel__description">
            {details.description}
          </p>

          <dl className="country-panel__facts">
            <div>
              <dt>Capital</dt>
              <dd>{facts.capital || "Not available"}</dd>
            </div>

            <div>
              <dt>Continent</dt>
              <dd>{facts.continent || "Not available"}</dd>
            </div>

            <div>
              <dt>Currency</dt>
              <dd>{currencyText}</dd>
            </div>

            <div>
              <dt>Population</dt>
              <dd>
                {Number.isFinite(facts.population)
                  ? new Intl.NumberFormat("en").format(facts.population)
                  : "Not available"}
              </dd>
            </div>

            <div>
              <dt>Languages</dt>
              <dd>{languages || "Not available"}</dd>
            </div>
          </dl>

          {details.source?.populationNote && (
            <p className="country-panel__footnote">
              {details.source.populationNote}
            </p>
          )}

          {details.source?.url && (
            <p className="country-panel__attribution">
              Facts:{" "}
              <a
                href={details.source.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {details.source.name}
              </a>
              {details.source.license &&
                ` · ${details.source.license}`}
            </p>
          )}
        </>
      )}
    </article>
  );
}

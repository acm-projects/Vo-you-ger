import { useEffect, useState } from "react";
import { getCountryInfo } from "../services/api";

export default function RecommendationPhoto({ destination }) {
  const [details, setDetails] = useState(null);
  const [failedUrls, setFailedUrls] = useState([]);
  const countryCode = destination.countryCode;

  useEffect(() => {
    if (!/^[A-Z]{2}$/i.test(countryCode || "")) return;
    const controller = new AbortController();
    getCountryInfo(countryCode, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setDetails(data);
      })
      .catch(() => { /* Keep the recommendation's supplied photo if details are unavailable. */ });
    return () => controller.abort();
  }, [countryCode]);

  // Refresh just the media for older session-cached recommendations. This public
  // endpoint reads the local photo catalog; it does not search Unsplash again.
  const primary = details?.photo || destination.photo || {
    url: destination.imageUrl || destination.image,
  };
  const fallback = details?.fallbackPhoto || destination.fallbackPhoto;
  const photo = [primary, fallback].find(item => item?.url && !failedUrls.includes(item.url));

  if (!photo) return <span className="travel-postcard__photo-unavailable">Photo unavailable</span>;

  return (
    <>
      <img
        key={photo.url}
        src={photo.url}
        srcSet={photo.srcSet || undefined}
        sizes="(max-width: 850px) 90vw, 50vw"
        alt={photo.alt || destination.name || destination.country || "Destination"}
        decoding="async"
        loading="lazy"
        onError={() => setFailedUrls(previous => [...previous, photo.url])}
      />
      {photo.credit && (
        <span className="travel-postcard__credit">
          {photo.provider === "unsplash" && "Photo by "}
          <a href={photo.photographerUrl || photo.sourceUrl} target="_blank" rel="noopener noreferrer">
            {photo.credit}
          </a>
          {photo.provider === "unsplash" ? (
            <> on <a href={photo.providerUrl} target="_blank" rel="noopener noreferrer">Unsplash</a></>
          ) : photo.license && (
            <> · <a href={photo.licenseUrl || photo.sourceUrl} target="_blank" rel="noopener noreferrer">{photo.license}</a></>
          )}
        </span>
      )}
    </>
  );
}

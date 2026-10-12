function RecommendationCard({ destination, onSelect }) {
  return (
    <article className="recommendation-card">
      <button
        className="recommendation-card__image-button"
        onClick={() => onSelect(destination)}
        aria-label={`View details for ${destination.name}`}
      >
        <img
          className="recommendation-card__image"
          src={destination.image}
          alt={destination.name}
        />
      </button>

      <div className="recommendation-card__content">
        <p className="recommendation-card__eyebrow">
          {destination.region}
        </p>

        <h2>{destination.name}</h2>

        <p className="recommendation-card__description">
          {destination.description}
        </p>

        <div className="recommendation-card__tags">
          {destination.tags.map((tag) => (
            <span className="recommendation-card__tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>

        <button
          className="recommendation-card__link"
          onClick={() => onSelect(destination)}
        >
          Explore destination <span aria-hidden="true">↗</span>
        </button>
      </div>
    </article>
  );
}

export default RecommendationCard;

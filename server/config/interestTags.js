const TAGS = Object.freeze("adventure ancient architecture art beach bucket-list budget-friendly city clean climate coastal coffee craft-beer culture cycling desert design diving family famous festivals food gastronomy hidden-gem hiking history innovation luxury mountains museums music nature nightlife parks photography relaxation road-trip romance safari scenic seafood shopping spa sunshine walkable water-sports wildlife wine".split(" "));
const ALIASES = Object.freeze({ gastronomy: "food", ancient: "history", "hidden gem": "hidden-gem", "budget friendly": "budget-friendly", museum: "museums", wellness: "spa" });
const PERSONAS = Object.freeze({
  foodie: ["food", "coffee", "seafood", "wine", "craft-beer"],
  historian: ["history", "architecture", "museums", "culture"],
  explorer: ["nature", "hiking", "mountains", "adventure", "wildlife", "safari", "desert"],
  "spa lover": ["relaxation", "spa", "beach"],
});
function normalizeTag(tag) {
  const value = String(tag).trim().toLowerCase();
  const canonical = ALIASES[value] || value;
  if (!TAGS.includes(canonical)) throw new Error(`Unknown interest tag: ${value}`);
  return canonical;
}
function personaTags(value) { return PERSONAS[String(value || "").toLowerCase().replace(/^the\s+/, "")] || []; }
module.exports = { TAGS, ALIASES, PERSONAS, normalizeTag, personaTags };

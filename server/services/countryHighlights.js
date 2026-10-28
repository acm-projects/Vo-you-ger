/**
 * server/services/countryHighlights.js
 *
 * Curated culinary and cultural highlights for countries.
 * Used for rich, dish-specific explanations and seamless fallbacks.
 */

const COUNTRY_HIGHLIGHTS = {
  PH: {
    dishes: "savory chicken adobo, crispy lechon, and sizzling sisig",
    unique: "world-renowned island hopping, the historic walled enclave of Intramuros, and emerald tropical scenery"
  },
  ZA: {
    dishes: "flame-grilled braai barbecue, Cape Malay curries, and savory biltong",
    unique: "dramatic heights of Table Mountain, scenic Cape Peninsula coastal drives, and legendary wildlife sanctuaries"
  },
  PA: {
    dishes: "fresh sea bass ceviche, sancocho chicken stew, and world-class Geisha specialty coffee",
    unique: "engineering wonder of the Panama Canal, vibrant colonial streets of Casco Viejo, and lush tropical rainforests"
  },
  MY: {
    dishes: "delicious Hainanese chicken rice, fragrant nasi lemak, and spicy laksa",
    unique: "vibrant night hawker streets, rich colonial history, and breathtaking skyline and rainforest sceneries"
  },
  IT: {
    dishes: "handmade pasta al dente, wood-fired Neapolitan pizza, and creamy gelato",
    unique: "timeless Renaissance art, ancient Roman landmarks, and dramatic cliffside coastal views"
  },
  JP: {
    dishes: "rich tonkotsu ramen, handcrafted sushi, and delicate matcha treats",
    unique: "the mesmerizing contrast between futuristic neon skylines and serene thousand-year-old Shinto shrines"
  },
  FR: {
    dishes: "flaky buttery croissants, boeuf bourguignon, and artisanal regional cheeses",
    unique: "world-class art museums, storied Gothic cathedrals, and picturesque riverfront boulevards"
  },
  ES: {
    dishes: "saffron-infused paella, sizzling garlic gambas, and crisp churros con chocolate",
    unique: "lively tapas culture, sun-drenched historic plazas, and awe-inspiring architectural marvels"
  },
  PT: {
    dishes: "warm pastéis de nata egg tarts, grilled sardines, and savory bacalhau dishes",
    unique: "sun-drenched historic tramways, decorative azulejo tilework, and sweeping Atlantic coastal cliffs"
  },
  TH: {
    dishes: "fragrant pad thai, spicy tom yum goong, and sweet mango sticky rice",
    unique: "ornate golden temples, buzzing night street markets, and tranquil tropical island shores"
  },
  MX: {
    dishes: "fresh tacos al pastor, rich mole poblano, and crispy churros",
    unique: "ancient Mesoamerican ruins, colorful colonial towns, and vibrant artistic traditions"
  },
  GR: {
    dishes: "flaky spanakopita, grilled souvlaki, and creamy baked moussaka",
    unique: "iconic whitewashed cliffside villages, ancient marble temples, and sparkling Aegean waters"
  },
  VN: {
    dishes: "aromatic pho noodle soup, crispy banh mi baguettes, and fresh spring rolls",
    unique: "bustling street food alleys, majestic emerald limestone karsts, and verdant river deltas"
  },
  KR: {
    dishes: "sizzling Korean barbecue, spicy tteokbokki, and crispy kimchi pancakes",
    unique: "dynamic pop-culture energy, ancient royal palaces, and round-the-clock bustling night markets"
  },
  ID: {
    dishes: "fragrant nasi goreng, tender beef rendang, and chicken satay with peanut sauce",
    unique: "lush terraced rice paddies, volcanic mountain backdrops, and spiritually rich temple ceremonies"
  },
  PE: {
    dishes: "zesty citrus ceviche, savory lomo saltado, and causa rellena",
    unique: "the awe-inspiring wonder of Machu Picchu, Sacred Valley landscapes, and deep Incan heritage"
  },
  MA: {
    dishes: "slow-cooked aromatic tagine, fluffy steamed couscous, and fresh mint tea",
    unique: "bustling labyrinthine medinas, intricate mosaic tilework, and sweeping Saharan landscapes"
  },
  TR: {
    dishes: "flame-roasted kebabs, flaky pistachio baklava, and warm Turkish tea",
    unique: "the meeting point of East and West across the Bosphorus, Byzantine domes, and fairy-chimney valleys"
  },
  DE: {
    dishes: "crispy schnitzel, savory grilled bratwurst, and fresh soft pretzels",
    unique: "storybook hilltop castles, lush forested valleys, and vibrant cultural beer gardens"
  },
  AT: {
    dishes: "golden Wiener schnitzel, warm Apfelstrudel, and rich Sachertorte",
    unique: "classical imperial palaces, dramatic Alpine vistas, and storied musical heritage"
  },
  CH: {
    dishes: "warm melted cheese fondue, crisp rösti, and rich Swiss chocolate",
    unique: "dramatic snow-capped Alpine peaks, pristine turquoise lakes, and scenic mountain railways"
  },
  GB: {
    dishes: "golden fish and chips, traditional Sunday roasts, and warm afternoon scones",
    unique: "historic royal landmarks, sweeping countryside moors, and iconic cultural institutions"
  },
  IE: {
    dishes: "hearty Irish beef stew, warm soda bread, and creamy colcannon",
    unique: "cozy live-music pubs, the dramatic Cliffs of Moher, and emerald rolling hills"
  },
  NL: {
    dishes: "sweet caramel stroopwafels, warm poffertjes, and fresh herring",
    unique: "picturesque canal-ringed avenues, historic windmills, and vibrant bicycle culture"
  },
  BE: {
    dishes: "crispy Belgian frites, decadent chocolate pralines, and warm Liège waffles",
    unique: "grand medieval guildhalls, storybook canals, and world-renowned brewing heritage"
  },
  CO: {
    dishes: "hearty bandeja paisa, warm cheesy arepas, and fresh brewed Andean coffee",
    unique: "vibrant street art, the lush green coffee triangle, and colonial Caribbean charm"
  },
  AR: {
    dishes: "flame-grilled asado steaks, flaky chimichurri empanadas, and sweet dulce de leche",
    unique: "passionate tango rhythms, elegant European-style boulevards, and dramatic Patagonian glaciers"
  },
  BR: {
    dishes: "slow-simmered feijoada black bean stew, warm pão de queijo, and fresh açaí bowls",
    unique: "samba rhythms, iconic golden coastlines, and sweeping panoramic views from Corcovado"
  }
};

function getCountryFallbackReason(country, days, bases) {
  const code = (country.countryCode || "").toUpperCase();
  const info = COUNTRY_HIGHLIGHTS[code];
  const basesText = bases && bases.length ? bases.join(" and ") : country.name;

  if (info) {
    return `A foodie's paradise, ${country.name} offers a unique, tasty blend of cuisines highlighted by ${info.dishes}. And while you're not savoring local specialties in ${basesText}, feel free to enjoy the ${info.unique} that make this ${days}-day trip unforgettable.`;
  }

  return `A paradise for curious travelers, ${country.name} offers a flavorful blend of regional cuisines and authentic local specialties. And while you're not exploring the culinary highlights of ${basesText}, enjoy the distinctive cultural traditions, storied heritage, and striking landscapes that make this ${days}-day trip unforgettable.`;
}

module.exports = {
  COUNTRY_HIGHLIGHTS,
  getCountryFallbackReason
};

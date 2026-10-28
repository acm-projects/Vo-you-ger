/**
 * server/services/countryHighlights.js
 *
 * Bespoke culinary and cultural highlights for countries.
 * Ensures every recommendation has a completely unique, non-formulaic narrative
 * featuring authentic local dishes and what the country is famous and unique for.
 */

const COUNTRY_NARRATIVES = {
  PH: (country, days, basesText) =>
    `Steaming street-side woks and the savory aroma of chicken adobo welcome food lovers across the Philippine archipelago. Beyond sizzling sisig and fresh mangoes, island-hopping around dramatic limestone lagoons and wandering ${basesText}'s historic Intramuros offer an unforgettable tropical adventure.`,

  ZA: (country, days, basesText) =>
    `Framed by the dramatic silhouette of Table Mountain, South Africa pairs world-class coastal scenery with a deep-rooted culinary heritage. Savoring flame-grilled braai and aromatic Cape Malay curries provides the perfect fuel between scenic Cape Peninsula drives in ${basesText} and legendary wildlife sanctuaries.`,

  PA: (country, days, basesText) =>
    `A sun-soaked bridge between two oceans, Panama captivates with zesty sea bass ceviche, hearty sancocho, and rare Geisha highland coffee. Cobblestone colonial lanes in ${basesText}'s Casco Viejo give way to the engineering marvel of the Panama Canal and lush tropical rainforests just minutes from the city.`,

  MY: (country, days, basesText) =>
    `A vibrant crossroads of Asian cultures, Malaysia delights the palate with fragrant bowls of curry laksa, authentic Hainanese chicken rice, and sizzling night-market satay. Between hawker feasts in ${basesText}, explore ornate heritage architecture, tranquil tea plantations, and ancient rainforest canopies.`,

  IT: (country, days, basesText) =>
    `Every corner of Italy tells a story of passion and flavor, from handmade al dente pasta and creamy gelato to wood-fired Neapolitan pizza. When stepping away from cozy trattorias in ${basesText}, lose yourself in timeless Renaissance galleries, ancient Roman ruins, and postcard-perfect Mediterranean cliffside vistas.`,

  JP: (country, days, basesText) =>
    `Precision craftsmanship defines Japanese cuisine, inviting travelers to savor steaming tonkotsu ramen, melt-in-your-mouth sushi, and delicate matcha treats. In ${basesText}, effortless bullet trains connect futuristic neon skylines with tranquil mountain onsens and thousand-year-old Shinto shrines tucked into bamboo groves.`,

  FR: (country, days, basesText) =>
    `From flaky morning croissants at sidewalk cafés to slow-simmered boeuf bourguignon paired with artisanal cheeses, France turns dining into an art form. In ${basesText}, golden afternoon light washes over iconic Gothic cathedrals, world-class art collections, and charming cobblestone avenues steeped in history.`,

  ES: (country, days, basesText) =>
    `Lively evening energy pulses through Spain, where hopping between tapas bars for sizzling garlic gambas and saffron-scented paella is a way of life. In ${basesText}, marvel at whimsical architecture and sun-drenched plazas that seamlessly blend medieval grandeur with modern coastal charm.`,

  PT: (country, days, basesText) =>
    `Golden afternoon sunshine illuminates Lisbon's vintage yellow trams and the irresistible aroma of freshly baked pastéis de nata sprinkled with cinnamon. Coastal taverns in ${basesText} serve tender grilled sardines and savory bacalhau, while dramatic Atlantic ocean cliffs and intricate azulejo tilework frame every step.`,

  TH: (country, days, basesText) =>
    `Sizzling woks, zesty lemongrass, and aromatic street stalls make Thailand an electrifying culinary playground, famed for spicy tom yum and sweet mango sticky rice. In ${basesText}, serene golden temples and emerald waters offer a calming retreat after diving into buzzing night markets and floating bazaars.`,

  MX: (country, days, basesText) =>
    `Bursting with vibrant color and ancient tradition, Mexico welcomes travelers with freshly pressed corn tortillas, savory tacos al pastor, and rich, complex mole poblano. Wander through sunlit plazas in ${basesText}, discover towering Mesoamerican pyramids, and soak in the warm, artistic spirit found in every neighborhood.`,

  GR: (country, days, basesText) =>
    `Crisp sea breezes and sun-bleached marble set the stage for Greece's unforgettable Mediterranean cuisine, featuring flaky spanakopita, grilled souvlaki, and chilled wine beside the water. In ${basesText}, whitewashed cliffside chapels overlooking turquoise Aegean bays make every sunset feel like a celebration.`,

  VN: (country, days, basesText) =>
    `Steaming bowls of aromatic pho, crisp banh mi baguettes, and fresh herb-packed spring rolls showcase the clean, vibrant balance of Vietnamese street cooking. In ${basesText}, glide past towering limestone karsts in emerald waters before exploring lantern-lit historic alleys and lively riverfront markets.`,

  KR: (country, days, basesText) =>
    `Round-the-clock neon and sizzling tabletop barbecues fuel South Korea's irresistible modern rhythm, complemented by spicy tteokbokki and crispy savory pancakes. In ${basesText}, tranquil Joseon-era royal palaces and forested mountain temples provide peaceful sanctuaries right beside cutting-edge design and pop-culture hubs.`,

  ID: (country, days, basesText) =>
    `Lush terraced rice paddies and volcanic peaks form the backdrop for Indonesia's rich spice traditions, celebrated through fragrant beef rendang and chicken satay. In ${basesText}, spiritual temple ceremonies, warm island hospitality, and pristine tropical beaches create an immersive, deeply restorative escape.`,

  PE: (country, days, basesText) =>
    `Peruvian gastronomy shines through zesty citrus ceviche and savory wok-tossed lomo saltado, celebrated as one of South America's most dynamic culinary capitals. In ${basesText}, ancient Incan heritage and dramatic Andean mountain landscapes offer awe-inspiring archaeological wonder.`,

  MA: (country, days, basesText) =>
    `Sensory magic fills Morocco's labyrinthine medinas, where fragrant slow-cooked tagines, fluffy steamed couscous, and fresh mint tea accompany lively artisan souks. In ${basesText}, intricate mosaic palaces give way to sweeping mountain vistas and the vast, star-filled dunes of the Sahara.`,

  TR: (country, days, basesText) =>
    `At the historic meeting point of East and West, Turkey dazzles with flame-roasted kebabs, flaky pistachio baklava, and spiced Turkish tea. In ${basesText}, marvel at the soaring domes of the Hagia Sophia, drift over fairy-chimney valleys, and cruise along the sparkling Bosphorus strait.`,

  DE: (country, days, basesText) =>
    `Storybook castles and historic beer gardens welcome visitors to Germany, where crisp schnitzel, savory grilled bratwurst, and fresh warm pretzels anchor hearty meals. In ${basesText}, wander through fairytale timbered villages and lush forested valleys, or explore world-class museums in dynamic contemporary cities.`,

  AT: (country, days, basesText) =>
    `Imperial elegance and soaring Alpine panoramas define Austria, where golden Wiener schnitzel, warm Apfelstrudel, and rich Sachertorte accompany classical music traditions. In ${basesText}, Baroque palaces and crystal-clear mountain lakes invite peaceful exploration across every season.`,

  CH: (country, days, basesText) =>
    `Snow-draped Alpine peaks, turquoise glacial lakes, and world-class scenic railways make Switzerland a picture of pristine natural perfection. In ${basesText}, savor warm melted cheese fondue and decadent Swiss chocolate after days spent hiking mountain passes and breathing fresh Alpine air.`,

  GB: (country, days, basesText) =>
    `Historic royal castles, cozy countryside pubs, and afternoon tea with warm scones and clotted cream capture the timeless charm of the United Kingdom. In ${basesText}, traditional golden fish and chips and iconic cultural institutions make history come alive around every bend.`,

  IE: (country, days, basesText) =>
    `Warm fireside fiddles, creamy pints, and hearty Irish beef stew embody the legendary welcoming spirit of Ireland. In ${basesText}, dramatic ocean winds sweep over dramatic cliffside coasts and emerald rolling hills, connecting historic stone castles and colorful seaside villages.`,

  NL: (country, days, basesText) =>
    `Picturesque canals, storybook windmills, and lively bicycle paths give the Netherlands its effortless charm, accompanied by sweet warm stroopwafels and artisanal gouda cheeses. In ${basesText}, world-class art museums sit just steps from tranquil waterways and bustling open-air markets.`,

  BE: (country, days, basesText) =>
    `Medieval guildhalls, romantic cobblestone canals, and golden crispy frites make Belgium an enchanting European escape. In ${basesText}, indulge in warm Liège waffles and handcrafted chocolate pralines while admiring grand Gothic town squares and rich brewing traditions.`,

  CO: (country, days, basesText) =>
    `Verdant Andean mountains and colorful colonial balconies frame Colombia's spirited culture, accompanied by hearty bandeja paisa and world-famous specialty coffee. In ${basesText}, explore vibrant street art in bustling urban plazas before unwinding along Caribbean beaches.`,

  AR: (country, days, basesText) =>
    `Passionate tango rhythms and grand European-style boulevards set the tempo in Argentina, where flame-grilled asado steaks and flaky chimichurri empanadas anchor late-night dining. In ${basesText}, vibrant cultural quarters and dramatic landscapes promise an unforgettable South American journey.`,

  BR: (country, days, basesText) =>
    `Irresistible samba energy and golden tropical shores define Brazil, where slow-simmered feijoada stews, warm pão de queijo, and fresh açaí fuel sun-filled days. In ${basesText}, ascend for panoramic ocean vistas before exploring lush rainforests and vibrant neighborhood street festivals.`
};

// Distinct rotational templates for unlisted countries so they never sound repetitive
const ROTATIONAL_TEMPLATES = [
  (country, days, basesText) =>
    `A rich tapestry of flavors and landscapes, ${country.name} welcomes travelers with authentic regional specialties centered around ${basesText}. Between sampling local street fare and traditional dining spots, explore distinctive cultural landmarks and striking scenery that make this ${days}-day trip unforgettable.`,

  (country, days, basesText) =>
    `Framed by scenic regional vistas and warm hospitality, ${country.name} pairs memorable local dining with storied historical sights in ${basesText}. Travelers can savor unique local dishes while discovering the vibrant traditions and striking architecture of the region.`,

  (country, days, basesText) =>
    `From bustling central markets to tranquil scenic viewpoints, ${country.name} delivers an inspiring blend of authentic culinary traditions and iconic sights in ${basesText}. Unhurried exploration provides the perfect opportunity to taste regional specialties while soaking in the unique local atmosphere.`
];

function getCountryFallbackReason(country, days, bases) {
  const code = (country.countryCode || "").toUpperCase();
  const basesText = bases && bases.length ? bases.join(" and ") : country.name;

  if (COUNTRY_NARRATIVES[code]) {
    return COUNTRY_NARRATIVES[code](country, days, basesText);
  }

  // Rotate template based on country code char sum to ensure diverse sentence structures
  const hash = [...code].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const template = ROTATIONAL_TEMPLATES[hash % ROTATIONAL_TEMPLATES.length];
  return template(country, days, basesText);
}

module.exports = {
  COUNTRY_NARRATIVES,
  getCountryFallbackReason
};

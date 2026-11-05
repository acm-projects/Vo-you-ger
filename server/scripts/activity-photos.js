// One-time shared illustration import. Browsing trips never calls Unsplash.
require('dotenv').config({path:require('node:path').join(__dirname,'../.env'),quiet:true});
const fs=require('node:fs');
const path=require('node:path');
const unsplash=require('../services/unsplashService');
const filename=path.join(__dirname,'../data/activityPhotos.json');
const queries={restaurant:'restaurant dining food',cafe:'coffee cafe',park:'city park',
  museum:'museum interior',landmark:'historic architecture',nature:'hiking landscape',
  beach:'beach coast',city:'city street travel'};

async function main() {
  if(process.argv[2]!=='populate') throw new Error('Usage: node server/scripts/activity-photos.js populate');
  unsplash.configureRequestBudget(24);
  const catalog=JSON.parse(fs.readFileSync(filename,'utf8'));
  const used=new Set(Object.values(catalog.categories).flat().map(photo=>photo.id));
  try {
    for(const [category,query] of Object.entries(queries)) {
      if(catalog.categories[category]?.length>=2) continue;
      const candidates=await unsplash.searchPhotos(query);
      const selected=[...(catalog.categories[category]||[])];
      for(const raw of candidates) {
        if(selected.length>=2) break;
        if(used.has(raw.id)) continue;
        let photo;
        try {photo=unsplash.formatPhoto(raw,{name:category});} catch {continue;}
        await unsplash.trackPhoto(raw);
        selected.push(photo); used.add(photo.id);
      }
      if(!selected.length) throw new Error(`No suitable ${category} illustration was returned.`);
      catalog.categories[category]=selected;
      console.log(`${category}: ${selected.length} illustrations selected`);
    }
  } finally {
    // Keep completed categories if the provider quota is exhausted midway.
    const temporary=filename+'.tmp';
    fs.writeFileSync(temporary,JSON.stringify(catalog,null,2)+'\n');
    fs.renameSync(temporary,filename);
    console.log(`Unsplash API requests: ${unsplash.requestUsage().requestsMade} (cap: 24)`);
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});

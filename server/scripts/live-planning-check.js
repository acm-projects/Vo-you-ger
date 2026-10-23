// Opt-in provider smoke checks; default execution is offline and read-only.
require('dotenv').config();
const { performance } = require('node:perf_hooks');
const provider=process.argv.find(arg=>arg.startsWith('--provider='))?.split('=')[1];
const valid=['google','gemini','visa','dynamodb'];
async function main() {
  if(!valid.includes(provider)||!process.argv.includes('--allow-live')) {
    console.log(JSON.stringify({liveServices:'NOT VERIFIED',usage:'node scripts/live-planning-check.js --provider=google|gemini|visa|dynamodb --allow-live',note:'Explicit opt-in may incur provider charges. DynamoDB check describes the table only; never writes. No credentials are printed.'},null,2));
    return;
  }
  const started=performance.now();
  if(provider==='google') {
    const places=await require('../services/googlePlacesService').searchPlaces('museums in Lisbon Portugal',{pageSize:1});
    if(!places.length)throw new Error('No Google results returned');
  } else if(provider==='gemini') {
    const {z}=require('zod'),schema=z.object({ok:z.boolean()});const jsonSchema=z.toJSONSchema(schema);delete jsonSchema.$schema;
    const result=await require('../services/llmclient').generateStructured({prompt:'Return {"ok":true}.',zodSchema:schema,jsonSchema});
    if(!result.data.ok)throw new Error('Unexpected structured output');
  } else if(provider==='visa') {
    const passport=process.argv.find(arg=>arg.startsWith('--passport='))?.split('=')[1];
    if(!passport||!/^[A-Z]{2}$/.test(passport))throw new Error('Provide --passport=XX with a real citizenship code');
    const eligible=await require('../services/visaService').getVisaFreeCountries([passport]);
    if(!(eligible instanceof Set))throw new Error('Unexpected eligibility response');
  } else {
    const {DescribeTableCommand}=require('@aws-sdk/client-dynamodb');
    const {client,TABLE_NAME}=require('../db/dynamo');
    await client.send(new DescribeTableCommand({TableName:TABLE_NAME}));
  }
  console.log(JSON.stringify({provider,status:'verified_smoke_only',elapsedMs:Number((performance.now()-started).toFixed(1)),databaseWrites:0}));
}
main().catch(()=>{console.error(JSON.stringify({provider,status:'failed',message:'Check credentials, configured model/table, and provider access. Sensitive upstream details omitted.'}));process.exitCode=1;});

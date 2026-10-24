const {describe,it,afterEach,mock}=require('node:test');
const assert=require('node:assert/strict');
const {z}=require('zod');
const key=process.env.GEMINI_API_KEY,models=process.env.LLM_MODELS;
const modulePath=require.resolve('../services/llmclient');
function fresh(modelNames='gemini-3.8-flash') {
 process.env.GEMINI_API_KEY='mock-only';process.env.LLM_MODELS=modelNames;
 delete require.cache[modulePath];return require(modulePath);
}
afterEach(()=>{
 mock.restoreAll();delete require.cache[modulePath];
 if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;
 if(models===undefined)delete process.env.LLM_MODELS;else process.env.LLM_MODELS=models;
});
function result(text='{"ok":true}') {
 return new Response(JSON.stringify({candidates:[{content:{role:'model',parts:[{text}]},finishReason:'STOP'}]}),{status:200,headers:{'Content-Type':'application/json'}});
}

describe('Gemini SDK request controls',()=>{
 it('reserves fallback time and switches models after an abort without SDK retries',async()=>{
  const llm=fresh('gemini-3.5-flash-lite,gemini-3.8-flash'),timeouts=[],urls=[];
  const originalTimeout=AbortSignal.timeout.bind(AbortSignal);
  mock.method(AbortSignal,'timeout',ms=>{timeouts.push(ms);return originalTimeout(ms);});
  mock.method(console,'warn',()=>{});
  mock.method(global,'fetch',async url=>{
   urls.push(String(url));
   if(urls.length===1)throw new DOMException('Private aborted request','AbortError');
   return result();
  });
  const response=await llm.generateWithFallback('Test',{}, {maxAttempts:2,timeoutMs:30000});
  assert.equal(response.model,'gemini-3.8-flash');assert.equal(urls.length,2);
  assert.ok(urls[0].includes('gemini-3.5-flash-lite'));assert.ok(urls[1].includes('gemini-3.8-flash'));
  assert.ok(timeouts[0]<=15000);assert.ok(timeouts[1]>timeouts[0],'The second attempt has its own reserved time');
  assert.equal(response.diagnostics[0].reason,'request_timeout');
 });
 it('gives the fallback unused time after the observed fast 503 within the same 90-second deadline',async()=>{
  const llm=fresh('gemini-3.5-flash-lite,gemini-3.8-flash'),budgets=[],messages=[];
  let now=1000000,calls=0;
  mock.method(Date,'now',()=>now);
  mock.method(console,'warn',message=>messages.push(message));
  const originalTimeout=AbortSignal.timeout.bind(AbortSignal);
  mock.method(AbortSignal,'timeout',ms=>{budgets.push(ms);return originalTimeout(ms);});
  mock.method(global,'fetch',async(_url,init)=>{
   calls++;
   if(calls===1){
    now+=2353;
    return new Response(JSON.stringify({error:{code:503,message:'Private provider detail'}}),{status:503});
   }
   assert.ok(Number(new Headers(init.headers).get('x-server-timeout'))>=87);
   // A response taking 50 seconds would miss the old 45-second cutoff.
   assert.ok(budgets[1]>50000);
   now+=50000;
   return result();
  });
  const response=await llm.generateWithFallback('Private traveler prompt',{}, {timeoutMs:90000});
  assert.equal(response.model,'gemini-3.8-flash');assert.equal(calls,2);
  assert.deepEqual(budgets,[45000,87647]);
  assert.equal(response.diagnostics[0].attemptTimeoutMs,45000);
  assert.equal(response.diagnostics[0].elapsedMs,2353);
  assert.equal(now,1052353);
  assert.ok(!messages.join(' ').includes('Private'));
 });
 it('keeps the total deadline and two-attempt limit when both model attempts time out',async()=>{
  const llm=fresh('gemini-3.5-flash-lite,gemini-3.8-flash'),budgets=[],messages=[];
  let now=1000000,calls=0;
  mock.method(Date,'now',()=>now);
  mock.method(console,'warn',message=>messages.push(message));
  const originalTimeout=AbortSignal.timeout.bind(AbortSignal);
  mock.method(AbortSignal,'timeout',ms=>{budgets.push(ms);return originalTimeout(ms);});
  mock.method(global,'fetch',async()=>{
   calls++;now+=45000;
   if(calls===1)throw new DOMException('Private aborted request','AbortError');
   return new Response(JSON.stringify({error:{code:504,message:'Private deadline exceeded'}}),{status:504});
  });
  await assert.rejects(llm.generateWithFallback('Private prompt',{}, {timeoutMs:90000}),error=>{
   assert.equal(error.fallbackReason,'request_timeout');
   assert.deepEqual(error.diagnostics.map(item=>item.timeoutOrigin),['client','provider']);
   assert.deepEqual(error.diagnostics.map(item=>item.attemptTimeoutMs),[45000,45000]);
   return true;
  });
  assert.equal(calls,2);assert.deepEqual(budgets,[45000,45000]);assert.equal(now,1090000);
  assert.match(messages[0],/budget 45000ms, timeout client/);
  assert.match(messages[1],/budget 45000ms, timeout provider/);
  assert.ok(!messages.join(' ').includes('Private'));
 });
 for(const mode of ['abort','504'])it(`does not let a short ${mode} timeout suppress the next longer request`,async()=>{
  const llm=fresh('gemini-3.5-flash-lite');let calls=0;
  mock.method(console,'warn',()=>{});
  mock.method(global,'fetch',async()=>{
   calls++;
   if(calls>1)return result();
   if(mode==='abort')throw new DOMException('Aborted','AbortError');
   return new Response(JSON.stringify({error:{code:504,message:'Private deadline exceeded'}}),{status:504});
  });
  await assert.rejects(llm.generateWithFallback('Test',{}, {maxAttempts:1,timeoutMs:8000}),error=>error.code==='GEMINI_TIMEOUT'&&error.fallbackReason==='request_timeout');
  const response=await llm.generateWithFallback('Longer request',{}, {maxAttempts:1,timeoutMs:60000});
  assert.equal(response.model,'gemini-3.5-flash-lite');assert.equal(calls,2);
 });
 it('distinguishes a quota failure from a later cooldown skip without exposing provider details',async()=>{
  const llm=fresh();let calls=0;const messages=[];
  mock.method(console,'warn',message=>messages.push(message));
  mock.method(global,'fetch',async()=>{calls++;return new Response(JSON.stringify({error:{code:429,message:'Private key and traveler data'}}),{status:429});});
  await assert.rejects(llm.generateWithFallback('Private prompt'),error=>error.statusCode===429&&error.fallbackReason==='rate_limited');
  await assert.rejects(llm.generateWithFallback('Private prompt'),error=>error.code==='GEMINI_COOLDOWN'&&error.fallbackReason==='cooldown_skipped'&&error.diagnostics[0].previousReason==='rate_limited');
  assert.equal(calls,1);assert.ok(!messages.join(' ').includes('Private'));
 });
 it('tries a different model immediately after overload within the two-attempt cap',async()=>{
  const llm=fresh('gemini-3.5-flash-lite,gemini-3.8-flash'),urls=[];
  mock.method(console,'warn',()=>{});
  mock.method(global,'fetch',async url=>{urls.push(String(url));return urls.length===1?new Response(JSON.stringify({error:{code:503,message:'Unavailable'}}),{status:503}):result();});
  const response=await llm.generateWithFallback('Test');
  assert.equal(response.model,'gemini-3.8-flash');assert.equal(urls.length,2);
  assert.ok(urls[0].includes('gemini-3.5-flash-lite'));assert.ok(urls[1].includes('gemini-3.8-flash'));
 });
 it('uses supported low thinking and bounded output with the real SDK serializer',async()=>{
  const llm=fresh();let calls=0;
  mock.method(global,'fetch',async(_url,init)=>{
   calls++;const body=JSON.parse(init.body);
   assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'LOW');
   assert.equal(body.generationConfig.maxOutputTokens,1400);
   assert.ok(init.signal);return result();
  });
  const schema=z.object({ok:z.boolean()}),jsonSchema=z.toJSONSchema(schema);delete jsonSchema.$schema;
  const output=await llm.generateStructured({prompt:'Return ok.',jsonSchema,zodSchema:schema,maxOutputTokens:1400,maxAttempts:1,timeoutMs:1000});
  assert.equal(output.data.ok,true);assert.equal(calls,1);
 });
 it('sends a compact provider grammar while retaining strict local validation',async()=>{
  const llm=fresh();
  const schema=z.object({days:z.array(z.object({day:z.number().int().min(1).max(21),theme:z.string().min(1).max(10)})).min(1).max(21)});
  const jsonSchema=z.toJSONSchema(schema),original=JSON.stringify(jsonSchema);
  let calls=0;
  mock.method(global,'fetch',async(_url,init)=>{
   calls++;
   const sent=JSON.parse(init.body).generationConfig.responseJsonSchema;
   assert.equal(sent.properties.days.type,'array');
   assert.equal(sent.properties.days.items.properties.day.type,'integer');
   assert.deepEqual(sent.required,['days']);
   assert.ok(!/"(?:minItems|maxItems|minLength|maxLength|minimum|maximum|\$schema)":/.test(JSON.stringify(sent)));
   return result(JSON.stringify({days:[{day:22,theme:'Too long for the local bound'}]}));
  });
  await assert.rejects(llm.generateStructured({prompt:'Test',jsonSchema,zodSchema:schema,maxAttempts:1}),error=>error.statusCode===502&&/did not match the schema/.test(error.message));
  assert.equal(calls,1);assert.equal(JSON.stringify(jsonSchema),original);
 });
 it('keeps an eight-second client cutoff without sending an invalid server deadline',async()=>{
  const llm=fresh('gemini-3.5-flash-lite');let calls=0;
  mock.method(global,'fetch',async(_url,init)=>{
   calls++;
   const deadline=Number(new Headers(init.headers).get('x-server-timeout'));
   // Reproduce the real provider rejection rather than masking it in the mock.
   if(deadline<10)return new Response(JSON.stringify({error:{code:400,message:`Manually set deadline ${deadline}s is too short. Minimum allowed deadline is 10s.`,status:'INVALID_ARGUMENT'}}),{status:400,headers:{'Content-Type':'application/json'}});
   assert.equal(deadline,10);assert.ok(init.signal);
   return result();
  });
  const output=await llm.generateWithFallback('Test',{}, {maxAttempts:1,timeoutMs:8000});
  assert.equal(output.model,'gemini-3.5-flash-lite');assert.equal(calls,1);
 });
 it('disables SDK hidden retries so a one-attempt request really sends once',async()=>{
  const llm=fresh();let calls=0;
  mock.method(console,'warn',()=>{});
  mock.method(global,'fetch',async()=>{calls++;return new Response(JSON.stringify({error:{code:503,message:'Temporarily overloaded',status:'UNAVAILABLE'}}),{status:503});});
  await assert.rejects(llm.generateWithFallback('Test',{}, {maxAttempts:1,timeoutMs:1000}),error=>error.code==='GEMINI_UNAVAILABLE');
  assert.equal(calls,1);
 });
 it('falls back from an unavailable configured model within the total attempt budget',async()=>{
  const llm=fresh('missing-model,gemini-3.8-flash');let calls=0;
  mock.method(console,'warn',()=>{});
  mock.method(global,'fetch',async()=>{calls++;return calls===1?new Response(JSON.stringify({error:{code:404,message:'Missing',status:'NOT_FOUND'}}),{status:404}):result();});
  const output=await llm.generateWithFallback('Test',{}, {maxAttempts:2,timeoutMs:1000});
  assert.equal(output.model,'gemini-3.8-flash');assert.equal(calls,2);
 });
 it('does not issue requests without a Gemini key and still imports successfully',async()=>{
  const llm=fresh();delete process.env.GEMINI_API_KEY;
  mock.method(global,'fetch',()=>assert.fail('Missing key cannot invoke Gemini'));
  await assert.rejects(llm.generateWithFallback('Test'),error=>error.code==='GEMINI_NOT_CONFIGURED');
 });
 it('sanitizes provider authentication failures',async()=>{
  const llm=fresh();
  mock.method(global,'fetch',async()=>new Response(JSON.stringify({error:{code:403,message:'private upstream detail',status:'PERMISSION_DENIED'}}),{status:403}));
  await assert.rejects(llm.generateWithFallback('Test',{}, {maxAttempts:1}),error=>error.code==='GEMINI_CONFIGURATION'&&!error.message.includes('private'));
 });
 it('categorizes rejected structured requests without logging provider details',async()=>{
  const llm=fresh();const messages=[];
  mock.method(console,'warn',message=>messages.push(message));
  mock.method(global,'fetch',async()=>new Response(JSON.stringify({error:{code:400,message:'Invalid response schema, private@example.test',status:'INVALID_ARGUMENT'}}),{status:400}));
  await assert.rejects(llm.generateWithFallback('Test',{}, {maxAttempts:1}),error=>error.code==='GEMINI_CONFIGURATION'&&error.providerStatus===400&&error.providerCategory==='SCHEMA_CONFIG');
  assert.match(messages.join(' '),/SCHEMA_CONFIG/);assert.ok(!messages.join(' ').includes('private@example.test'));
 });
 for (const fixture of [
  {status:400,reason:'API_KEY_INVALID',message:'Invalid request',category:'AUTHENTICATION'},
  {status:400,reason:undefined,message:'API key expired. Please renew the API key.',expectedReason:'API_KEY_EXPIRED',category:'AUTHENTICATION'},
  {status:403,reason:'SERVICE_DISABLED',message:'Service is disabled',category:'SERVICE_ACCESS'},
  {status:400,reason:'private-reason@example.test',message:'Invalid argument',expectedReason:'UNSPECIFIED',category:'REQUEST_CONFIG'},
  {status:400,reason:undefined,message:'Manually set deadline 8s is too short. Minimum allowed deadline is 10s.',expectedReason:'DEADLINE_TOO_SHORT',category:'TIMEOUT_CONFIG'},
 ]) it(`safely diagnoses ${fixture.expectedReason||fixture.reason} from an SDK error`,async()=>{
  const llm=fresh('gemini-3.8-flash,gemini-3.5-flash-lite');const messages=[];let calls=0;
  mock.method(console,'warn',message=>messages.push(message));
  mock.method(global,'fetch',async()=>{
   calls++;
   return new Response(JSON.stringify({error:{code:fixture.status,status:'INVALID_ARGUMENT',message:fixture.message,
    details:[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason:fixture.reason,metadata:{api_key:'private-key',consumer:'private-project'}}],
   }}),{status:fixture.status,headers:{'Content-Type':'application/json'}});
  });
  await assert.rejects(llm.generateWithFallback('Private traveler prompt'),error=>{
   assert.equal(error.code,'GEMINI_CONFIGURATION');
   assert.equal(error.providerStatus,fixture.status);
   assert.equal(error.providerCategory,fixture.category);
   assert.equal(error.providerReason,fixture.expectedReason||fixture.reason);
   assert.ok(!error.message.includes(fixture.message));
   return true;
  });
  assert.equal(calls,1,'Rejected credentials/settings must not spend fallback attempts');
  assert.ok(!/private-|@example|Private traveler/.test(messages.join(' ')));
  assert.match(messages.join(' '),new RegExp(fixture.expectedReason||fixture.reason));
 });
 it('aborts a stalled request at the configured deadline',async()=>{
  const llm=fresh();let calls=0;const keepAlive=setTimeout(()=>{},1000);
  mock.method(console,'warn',()=>{});
  mock.method(global,'fetch',async(_url,init)=>{calls++;return new Promise((_,reject)=>{
   if(init.signal.aborted)reject(new DOMException('Aborted','AbortError'));
   else init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
  });});
  try{await assert.rejects(llm.generateWithFallback('Test',{}, {maxAttempts:1,timeoutMs:20}),error=>error.code==='GEMINI_TIMEOUT'&&error.fallbackReason==='request_timeout');assert.equal(calls,1);}
  finally{clearTimeout(keepAlive);}
 });
});

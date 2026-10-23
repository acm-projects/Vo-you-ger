const buckets=new Map();
function generationLimiter(req,res,next) {
  const key=req.user.userId, now=Date.now(), windowMs=60000;
  const limit=Number(process.env.GENERATION_REQUESTS_PER_MINUTE)||12;
  let bucket=buckets.get(key);
  if(!bucket||bucket.until<=now) {bucket={count:0,until:now+windowMs};buckets.set(key,bucket);}
  if(buckets.size>5000) for(const [id,item] of buckets) if(item.until<=now) buckets.delete(id);
  if(buckets.size>10000) buckets.delete(buckets.keys().next().value);
  if(++bucket.count>limit) {res.setHeader('Retry-After',String(Math.ceil((bucket.until-now)/1000)));return res.status(429).json({error:'Too Many Requests',code:'GENERATION_RATE_LIMIT',message:'Please wait before requesting more generated plans'});}
  next();
}
module.exports={generationLimiter};

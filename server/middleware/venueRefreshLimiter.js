const buckets=new Map();

function venueRefreshLimiter(req,res,next) {
  const now=Date.now(),key=req.user.userId;
  const configured=Number(process.env.VENUE_REFRESH_REQUESTS_PER_MINUTE);
  const limit=Number.isInteger(configured)&&configured>0&&configured<=120?configured:30;
  let bucket=buckets.get(key);
  if(!bucket||bucket.until<=now) {bucket={count:0,until:now+60000};buckets.set(key,bucket);}
  if(buckets.size>5000) for(const [id,item] of buckets) if(item.until<=now) buckets.delete(id);
  if(buckets.size>10000) buckets.delete(buckets.keys().next().value);
  if(++bucket.count>limit) {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Retry-After',String(Math.ceil((bucket.until-now)/1000)));
    return res.status(429).json({code:'VENUE_REFRESH_RATE_LIMIT',message:'Please wait before refreshing more trip days'});
  }
  next();
}
module.exports={venueRefreshLimiter};

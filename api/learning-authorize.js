const SECTIONS = new Set(['creatives','infrastructure','keitaro','launch']);
function respond(res,status,body) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(status).json(body);
}
export default async function handler(req,res) {
  if(req.method!=='POST'){res.setHeader('Allow','POST');return respond(res,405,{ok:false,error:'method_not_allowed'});}
  const section=req.body?.section;
  if(section!=='all'&&!SECTIONS.has(section))return respond(res,400,{ok:false,error:'invalid_section'});
  // Sales and access checks are disabled. Never expose paid content anonymously.
  return respond(res,403,{ok:false,error:'purchase_required'});
}

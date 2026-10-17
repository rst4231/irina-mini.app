import { extractLearningCookieHeader } from './learning-cookie.js';
const SECTIONS=new Set(['theory','creatives','infrastructure','keitaro','launch']);
const CLOUD='https://irina-learning-api.cpateammail.workers.dev';
function respond(res,status,data){
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(status).json(data);
}
export default async function handler(req,res){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return respond(res,405,{ok:false,error:'method_not_allowed'});}
  if(Number(req.headers['content-length']||0)>6000)return respond(res,413,{ok:false,error:'too_large'});
  try{if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host)return respond(res,403,{ok:false,error:'invalid_origin'});}
  catch{return respond(res,403,{ok:false,error:'invalid_origin'});}
  const {mode,section,id,initData}=req.body||{};
  if(!['catalog','list','lesson'].includes(mode))return respond(res,400,{ok:false,error:'invalid_mode'});
  if(mode!=='catalog'&&!SECTIONS.has(section))return respond(res,400,{ok:false,error:'invalid_section'});
  if(mode==='lesson'&&!/^[a-f0-9-]{36}$/.test(String(id||'')))return respond(res,400,{ok:false,error:'invalid_id'});
  const sessionCookie = extractLearningCookieHeader(req.headers.cookie);
  if(mode==='lesson'&&section!=='theory'&&(!initData||typeof initData!=='string'||initData.length>3500)&&!sessionCookie)
    return respond(res,403,{ok:false,error:'purchase_required'});
  const url = new URL(mode,CLOUD+'/');
  if(mode==='list')url.searchParams.set('section',section);
  try{
    const method=mode==='lesson'?'POST':'GET';
    const response=await fetch(url.toString(),{
      method,headers:{Accept:'application/json',...(method==='POST'?{'Content-Type':'application/json'}:{})},
      ...(method==='POST'?{body:JSON.stringify({id,section,initData:typeof initData==='string'?initData:'',session:sessionCookie})}:{}),
      signal:AbortSignal.timeout(11000),cache:'no-store',
    });
    const payload=await response.json().catch(()=>({ok:false,error:'invalid_provider_response'}));
    if(!response.ok){
      if(response.status===403)return respond(res,403,{ok:false,error:'purchase_required'});
      if(response.status===400||response.status===404)return respond(res,response.status,payload);
      return respond(res,503,{ok:false,error:'learning_unavailable'});
    }
    return respond(res,200,payload);
  }catch(e){
    console.error('learning_proxy_error',e?.message||e);
    return respond(res,503,{ok:false,error:'learning_unavailable'});
  }
}
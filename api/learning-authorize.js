import { validateInitData } from './profile.js';
import { verifyLearningCookie } from './learning-cookie.js';

const BOT_ID = '6671465ac84ab24b4702fa25';
export const SECTION_TAGS = Object.freeze({
  creatives:'Практика: Креативы',
  infrastructure:'Практика: Инфраструктура',
  keitaro:'Практика: Keitaro',
  launch:'Практика: Запуск',
});
export function grantsLearningAccess(tags, section) {
  const canonical = String(section||'').toLowerCase();
  if (!Object.hasOwn(SECTION_TAGS, canonical)) return false;
  const lower = new Set((Array.isArray(tags)?tags:[...tags||[]]).map(value=>
    String(typeof value === 'string'?value:(value?.name||value?.title||value?.tag||'')).trim().replace(/\s+/g,' ').toLowerCase()
  ).filter(Boolean));
  return lower.has('практика: все') || lower.has('практика: полный комплект') || lower.has(SECTION_TAGS[canonical].toLowerCase());
}
function respond(res, status, body) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(status).json(body);
}
export default async function handler(req,res) {
  if(req.method!=='POST') {res.setHeader('Allow','POST');return respond(res,405,{ok:false,error:'method_not_allowed'});}
  if(Number(req.headers['content-length']||0)>5000)return respond(res,413,{ok:false,error:'too_large'});
  try{if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host)return respond(res,403,{ok:false,error:'invalid_origin'});}
  catch{return respond(res,403,{ok:false,error:'invalid_origin'});}
  const {section,initData}=req.body||{};
  if(!Object.hasOwn(SECTION_TAGS,String(section||'')))return respond(res,400,{ok:false,error:'invalid_section'});
  if(!process.env.TELEGRAM_BOT_TOKEN||!process.env.SENDPULSE_API_KEY)
    return respond(res,503,{ok:false,error:'auth_not_configured'});
  const user = typeof initData==='string' && initData.length>=20 && initData.length<=3500
    ? validateInitData(initData,process.env.TELEGRAM_BOT_TOKEN) : null;
  const verified = user?.id ? {id:String(user.id)} : verifyLearningCookie(req.headers.cookie,process.env.TELEGRAM_BOT_TOKEN);
  if(!verified?.id)return respond(res,403,{ok:false,error:'purchase_required'});
  try{
    const url=new URL('https://api.sendpulse.com/telegram/contacts/getByTelegramId');
    url.searchParams.set('bot_id',BOT_ID);
    url.searchParams.set('telegram_id',verified.id);
    const response=await fetch(url.toString(),{
      headers:{Authorization:'Bearer '+process.env.SENDPULSE_API_KEY,Accept:'application/json'},
      cache:'no-store',signal:AbortSignal.timeout(7500),
    });
    if(response.status===404)return respond(res,403,{ok:false,error:'purchase_required'});
    if(!response.ok)throw new Error('sendpulse_error_'+response.status);
    const payload=await response.json();
    const contact=payload?.data||payload;
    const allowed=grantsLearningAccess(contact?.tags||[],section);
    if(!allowed)return respond(res,403,{ok:false,error:'purchase_required'});
    return respond(res,200,{ok:true,authorized:true,section});
  }catch(error){console.error('learning_auth_unavailable',error?.message||error);return respond(res,503,{ok:false,error:'auth_unavailable'});}
}

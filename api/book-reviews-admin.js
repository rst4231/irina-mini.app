import { validateInitData } from './profile.js';
import { reviewStore } from '../lib/book-review-store.js';

const ADMIN_TELEGRAM_ID = '160628165';
function send(res, status, data) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  return res.status(status).json(data);
}
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow','POST');
    return send(res,405,{ok:false,error:'method_not_allowed'});
  }
  if (req.headers.origin && req.headers.origin !== 'https://irina-miniapp.vercel.app')
    return send(res,403,{ok:false,error:'invalid_origin'});
  const initData=String(req.body?.initData||'');
  const user=validateInitData(initData,process.env.TELEGRAM_BOT_TOKEN);
  if (!user || String(user.id)!==ADMIN_TELEGRAM_ID)
    return send(res,403,{ok:false,error:'admin_required'});
  const action=String(req.body?.action||'');
  try {
    if (action==='list') {
      const result=await reviewStore('/pending');
      return send(res,200,{ok:true,reviews:result.reviews||[]});
    }
    if (action==='approve'||action==='reject') {
      const id=String(req.body?.id||'');
      if (!/^[a-f0-9-]{36}$/i.test(id))
        return send(res,400,{ok:false,error:'invalid_id'});
      const result=await reviewStore('/moderate',{action,id});
      return send(res,200,{ok:true,updated:result.updated});
    }
    return send(res,400,{ok:false,error:'invalid_action'});
  } catch {
    return send(res,503,{ok:false,error:'moderation_unavailable'});
  }
}

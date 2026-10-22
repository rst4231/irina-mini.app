import {db} from '../lib/store/db.js';
import {guardMethod,json} from '../lib/store/core.js';
import {telegramUserFromInitData} from '../lib/store/telegram.js';

const SECTIONS = new Set(['recruitment','about','theory','practice','book','store','mentor']);
export default async function handler(req,res){
  if(!guardMethod(req,res,['POST']))return;
  if(req.headers.origin){
    try{if(new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'Invalid origin'});}
    catch{return json(res,403,{error:'Invalid origin'});}
  }
  const {initData,action='list',section}=req.body||{};
  const user=telegramUserFromInitData(initData);
  if(!user)return json(res,401,{error:'Telegram authorization required'});
  if(!['list','mark'].includes(action)||(action==='mark'&&!SECTIONS.has(section)))return json(res,400,{error:'Invalid section action'});
  try{
    const records=await db('rpc/store_home_sections',{method:'POST',body:{telegram_id:user.telegram_id,action,...(action==='mark'?{section}:{})}});
    return json(res,200,{seen:Array.isArray(records?.[0]?.seen)?records[0].seen:[]});
  }catch(e){
    console.error('Home section Cloudflare D1 error',String(e.message).slice(0,100));
    return json(res,503,{error:'Home section state temporarily unavailable'});
  }
}

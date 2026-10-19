import {createHmac,timingSafeEqual} from 'node:crypto';

// Verify Telegram Mini App initData against the same bot that opened the app.
// Never trust initDataUnsafe, URL user IDs, cookies or browser-supplied IDs.
export function telegramUserFromInitData(raw,{botToken=process.env.TELEGRAM_BOT_TOKEN,now=Date.now()}={}){
  if(typeof raw!=='string'||raw.length<30||raw.length>8192||!botToken)return null;
  const params=new URLSearchParams(raw);
  const entries=[...params.entries()];
  if(entries.length<3||entries.length!==new Set(entries.map(([k])=>k)).size)return null;
  const hash=params.get('hash'),date=Number(params.get('auth_date'));
  if(!hash||!/^[a-f0-9]{64}$/i.test(hash)||!Number.isSafeInteger(date))return null;
  const age=Math.floor(now/1000)-date;
  if(age< -60||age>86400)return null;
  const check=entries.filter(([k])=>k!=='hash').sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
  const key=createHmac('sha256','WebAppData').update(botToken).digest();
  const expected=createHmac('sha256',key).update(check).digest();
  const actual=Buffer.from(hash,'hex');
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
  let user;
  try{user=JSON.parse(params.get('user')||'null');}catch{return null;}
  if(!user||typeof user!=='object'||!Number.isSafeInteger(user.id)||user.id<=0)return null;
  return {
    telegram_id:String(user.id),
    first_name:typeof user.first_name==='string'?user.first_name.slice(0,100):'',
    username:typeof user.username==='string'?user.username.replace(/^@/,'').slice(0,64):''
  };
}

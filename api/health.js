function json(res,status,body) {
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(body));
}
export default async function handler(req,res) {
  if(req.method!=='GET'){res.setHeader('Allow','GET');return json(res,405,{ok:false,error:'method_not_allowed'});}
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token)return json(res,503,{ok:false,telegram:false});
  try{
    const response=await fetch(`https://api.telegram.org/bot${token}/getMe`,{cache:'no-store',signal:AbortSignal.timeout(5000)});
    const data=await response.json();
    const telegram=Boolean(response.ok&&data?.ok&&data?.result);
    return json(res,telegram?200:503,{ok:telegram,telegram,...(telegram?{botUsername:String(data.result.username||'')}:{})});
  }catch{return json(res,503,{ok:false,telegram:false});}
}

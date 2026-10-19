// Private Cloudflare D1 backend for the ADSPLY section of Irina.
// Requires a secret STORE_D1_TOKEN and a D1 binding STORE_DB.
// It deliberately exposes no raw SQL endpoint and no browser CORS permission.
const TABLES = Object.freeze({
  store_settings: ['key','value','updated_at'],
  store_products: ['id','provider','provider_listing_id','slug','title','title_ru','title_en','category','category_ru','category_en','translation_attempts','description','supplier_price_cents','stock','published','last_synced_at'],
  store_orders: ['id','lookup_hash','customer_email','product_id','product_title','quantity','unit_price_cents','supplier_unit_price_cents','total_cents','pay_network','pay_wallet','payment_tx_hash','ip_hash','status','supplier_order_id','delivery_ciphertext','error_message','pay_amount_micro','purchase_started_at','telegram_user_id','created_at','updated_at']
});
const TEXT_LIMIT=256 * 1024;
const STATUSES = new Set(['awaiting_payment','fulfilling','fulfilled','needs_review','cancelled']);
const META_ACCOUNT_CATEGORY=/(?:\bfacebook\b|\binstagram\b|\bmeta\b|\bthreads\b|\bwhatsapp\b|\bbusiness manager\b|\bfb accounts?\b)/i;
const NON_ACCOUNT_CATEGORY=/(?:\b(?:likes?|followers?|views?|comments?|boosts?|reactions?|engagement|services?)\b)/i;
function allowedCategory(value){return typeof value==='string'&&META_ACCOUNT_CATEGORY.test(value)&&!NON_ACCOUNT_CATEGORY.test(value)}
function reply(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
function problem(status,message){return reply({error:message},status)}
function authorized(req,secret){
  const supplied=req.headers.get('Authorization')?.replace(/^Bearer /i,'')||'';
  if(typeof secret!=='string'||secret.length<32||supplied.length!==secret.length)return false;
  let diff=0;for(let i=0;i<secret.length;i++)diff|=secret.charCodeAt(i)^supplied.charCodeAt(i);
  return diff===0;
}
function safeSelect(table, value){
  if(value==='*'||!value)return '*';
  const allowed=new Set(TABLES[table]);
  const cols=value.split(',');
  if(!cols.length||cols.some(c=>!allowed.has(c)))throw Error('Invalid selection');
  return cols.join(',');
}
function rows(result,table){
  return result.results.map(record=>{
    if(table==='store_settings'&&Object.hasOwn(record,'value'))record.value=JSON.parse(record.value);
    if(table==='store_products'&&Object.hasOwn(record,'published'))record.published=record.published===1;
    return record;
  });
}
function filters(table, params){
  const where=[];const values=[];
  const permitted=table==='store_orders'?new Set(['id','ip_hash','created_at','status','telegram_user_id']):table==='store_products'?new Set(['id','published']):new Set();
  for(const [name,filter] of params){
    if(['select','order','limit','offset','on_conflict'].includes(name))continue;
    if(!permitted.has(name))throw Error('Invalid filter');
    const at=filter.indexOf('.');const mode=filter.slice(0,at);let val=filter.slice(at+1);
    if(at<1||!['eq','gte'].includes(mode)||(mode==='gte'&&name!=='created_at'))throw Error('Invalid filter');
    if(name==='published')val=val==='true'?1:val==='false'?0:NaN;
    if(name==='id'&&table==='store_products')val=Number(val);
    if(typeof val==='number'&&!Number.isSafeInteger(val))throw Error('Invalid filter');
    where.push(`${name} ${mode==='eq'?'=':'>='} ?`);values.push(val);
  }
  return {sql:where.length?' WHERE '+where.join(' AND '):'',values};
}
async function selectRows(db,table,queryString){
  const params=new URLSearchParams(queryString);
  const cols=safeSelect(table,params.get('select'));
  const {sql,values}=filters(table,params);
  const order=params.get('order');let orderSql='';
  if(order){
    const [column,direction,...rest]=order.split('.');
    if(rest.length||!TABLES[table].includes(column)||!['asc','desc'].includes(direction))throw Error('Invalid sort');
    orderSql=` ORDER BY ${column} ${direction.toUpperCase()}`;
  }
  const count=params.get('limit')===null?400:Number(params.get('limit'));
  const offset=params.get('offset')===null?0:Number(params.get('offset'));
  if(!Number.isSafeInteger(count)||count<1||count>500||!Number.isSafeInteger(offset)||offset<0||offset>100000)throw Error('Invalid limit');
  return rows(await db.prepare(`SELECT ${cols} FROM ${table}${sql}${orderSql} LIMIT ? OFFSET ?`).bind(...values,count,offset).all(),table);
}
async function adminOrders(db,query){
  if(query)throw Error('Invalid admin order query');
  // Fixed projection: never expose receipt tokens or encrypted credentials.
  const result=await db.prepare(`SELECT o.id,o.product_title,o.customer_email,o.quantity,o.total_cents,o.pay_amount_micro,o.status,o.created_at,o.purchase_started_at,o.supplier_order_id,o.error_message,o.payment_tx_hash,o.telegram_user_id,u.first_name AS telegram_first_name,u.username AS telegram_username
    FROM store_orders o LEFT JOIN store_users u ON u.telegram_id=o.telegram_user_id ORDER BY o.created_at DESC,o.id DESC LIMIT 100`).bind().all();
  return result.results;
}
async function saveSetting(db,body){
  if(!body||!['markup_pct','checkout_enabled','supplier_resale_approved','usdt_trc20_wallet','sync_cursor','auto_fulfillment_enabled'].includes(body.key))throw Error('Invalid setting');
  await db.prepare("INSERT INTO store_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
    .bind(body.key,JSON.stringify(body.value),new Date().toISOString()).run();
  return [];
}
async function changeProduct(db,params,body){
  const id=params.get('id');
  if(!/^eq\.\d+$/.test(id||'')||typeof body?.published!=='boolean')throw Error('Invalid publish');
  if(body.published){const item=await db.prepare('SELECT category FROM store_products WHERE id=?').bind(Number(id.slice(3))).all();if(!item.results.length||!allowedCategory(item.results[0].category))throw Error('Invalid category');}
  await db.prepare('UPDATE store_products SET published=? WHERE id=?').bind(Number(body.published),Number(id.slice(3))).run();
  return [];
}
async function addOrder(db,body){
  const keys=['id','lookup_hash','customer_email','product_id','product_title','quantity','unit_price_cents','supplier_unit_price_cents','total_cents','pay_network','pay_wallet','status','ip_hash','pay_amount_micro'];
  if(!body||!keys.every(k=>Object.hasOwn(body,k))||body.status!=='awaiting_payment'||!Number.isSafeInteger(body.product_id)||!Number.isSafeInteger(body.quantity)||body.quantity<1||body.quantity>20||!['TRC20'].includes(body.pay_network)||!Number.isSafeInteger(body.pay_amount_micro)||body.pay_amount_micro!==body.total_cents*10000+body.pay_amount_micro%10000||body.pay_amount_micro%10000===0)throw Error('Invalid order');
  if(body.telegram_user_id!==undefined){if(!goodTelegramId(body.telegram_user_id))throw Error('Invalid Telegram user ID');keys.push('telegram_user_id');}
  await db.prepare(`INSERT INTO store_orders(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).bind(...keys.map(k=>body[k])).run();
  return [];
}
async function transitionOrder(db,params,body){
  const id=params.get('id'),from=params.get('status');
  if(!/^eq\.[0-9a-f-]{36}$/i.test(id||'')||!/^eq\.[a-z_]+$/.test(from||'')||!STATUSES.has(body?.status))throw Error('Invalid order transition');
  const before=from.slice(3),to=body.status;
  const allowed={awaiting_payment:['fulfilling','cancelled'],needs_review:['fulfilling'],fulfilling:['fulfilled','needs_review']};
  if(!allowed[before]?.includes(to))throw Error('Invalid status change');
  const extra=Object.entries(body).filter(([k])=>k!=='status');
  const permitted={
    'awaiting_payment:fulfilling':['payment_tx_hash'],
    'awaiting_payment:cancelled':[],
    'needs_review:fulfilling':[],
    'fulfilling:fulfilled':['supplier_order_id','delivery_ciphertext','error_message'],
    'fulfilling:needs_review':['error_message']
  }[`${before}:${to}`];
  if(extra.some(([k])=>!permitted.includes(k)))throw Error('Invalid status data');
  if(before==='awaiting_payment'&&to==='fulfilling'&&!/^[a-f0-9]{64}$/.test(body.payment_tx_hash||''))throw Error('Invalid transaction hash');
  if(to==='fulfilled'&&(!body.delivery_ciphertext||!body.supplier_order_id))throw Error('Missing delivery');
  const columns=['status','updated_at',...extra.map(([k])=>k)];
  const values=[to,new Date().toISOString(),...extra.map(([,v])=>v)];
  const stmt=`UPDATE store_orders SET ${columns.map(k=>`${k}=?`).join(',')} WHERE id=? AND status=? RETURNING *`;
  return rows(await db.prepare(stmt).bind(...values,id.slice(3),before).all(),'store_orders');
}
async function beginPurchase(db,id){
  if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))throw Error('Invalid order ID');
  const result=await db.prepare("UPDATE store_orders SET purchase_started_at=?,updated_at=? WHERE id=? AND status='fulfilling' AND purchase_started_at IS NULL RETURNING id")
    .bind(new Date().toISOString(),new Date().toISOString(),id).all();
  return [{claimed:result.results.length===1}];
}

function goodTelegramId(value){return typeof value==='string'&&/^\d{1,20}$/.test(value)&&BigInt(value)>0n;}
async function upsertStoreUser(db,body){
  if(!body||!goodTelegramId(body.telegram_id)||typeof body.first_name!=='string'||body.first_name.length>100||typeof body.username!=='string'||body.username.length>64)throw Error('Invalid Telegram account');
  await db.prepare("INSERT INTO store_users(telegram_id,first_name,username) VALUES(?,?,?) ON CONFLICT(telegram_id) DO UPDATE SET first_name=excluded.first_name,username=excluded.username,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')")
    .bind(body.telegram_id,body.first_name,body.username).run();
  return [{telegram_id:body.telegram_id}];
}
async function claimStoreOrder(db,body){
  if(!body||!goodTelegramId(body.telegram_id)||!(/^[0-9a-f-]{36}$/i.test(body.id||'')))throw Error('Invalid legacy order claim');
  const found=await db.prepare('UPDATE store_orders SET telegram_user_id=? WHERE id=? AND (telegram_user_id IS NULL OR telegram_user_id=?) RETURNING id')
   .bind(body.telegram_id,body.id,body.telegram_id).all();
  return [{claimed:found.results.length===1}];
}

async function syncProducts(db,payload){
  if(!Array.isArray(payload)||payload.length>200)throw Error('Invalid inventory batch');
  if(!payload.length)return [];
  const fields=['provider','provider_listing_id','slug','title','category','description','supplier_price_cents','stock'];
  const prepared=payload.map(p=>{
    if(p.provider!=='adsplus'||!allowedCategory(p.category)||!Number.isSafeInteger(p.provider_listing_id)||p.provider_listing_id<1||!Number.isSafeInteger(p.supplier_price_cents)||p.supplier_price_cents<0||!Number.isSafeInteger(p.stock)||p.stock<0||typeof p.slug!=='string'||p.slug.length>250||!p.slug||!p.title||p.title.length>150)throw Error('Invalid supplier item');
    const sql=`INSERT INTO store_products(${fields.join(',')},last_synced_at) VALUES(${fields.map(()=>'?').join(',')},?) ON CONFLICT(provider,provider_listing_id) DO UPDATE SET slug=excluded.slug,title=excluded.title,category=excluded.category,description=excluded.description,supplier_price_cents=excluded.supplier_price_cents,stock=excluded.stock,last_synced_at=excluded.last_synced_at,title_ru=CASE WHEN store_products.title=excluded.title AND store_products.category=excluded.category THEN store_products.title_ru ELSE NULL END,title_en=CASE WHEN store_products.title=excluded.title AND store_products.category=excluded.category THEN store_products.title_en ELSE NULL END,category_ru=CASE WHEN store_products.category=excluded.category THEN store_products.category_ru ELSE NULL END,category_en=CASE WHEN store_products.category=excluded.category THEN store_products.category_en ELSE NULL END,translation_attempts=CASE WHEN store_products.title=excluded.title AND store_products.category=excluded.category THEN store_products.translation_attempts ELSE 0 END`;
    return db.prepare(sql).bind(...fields.map(k=>p[k]),new Date().toISOString());
  });
  await db.batch(prepared);
  return [];
}

// Translate only new/changed ADSPLUS listings. Source text stays unchanged.
// The localizations are cached in D1; unlocalized products stay unpublished.
const THAI=/[\u0E00-\u0E7F]/;
const CATEGORY_TRANSLATIONS={
  'Facebook Clone (ใหม่/เก่า)':{ru:'Facebook — клоны (новые/старые)',en:'Facebook clone accounts (new/aged)'},
  'Facebook UID 1000x (เก่า)':{ru:'Facebook — старые аккаунты UID 1000x',en:'Facebook aged UID 1000x accounts'},
  'Facebook Clone ชื่อไทย':{ru:'Facebook — клоны с тайским именем',en:'Facebook clone accounts with Thai names'}
};
export function normalizedTranslation(original,translated){
  if(typeof translated!=='string'||!translated.trim()||THAI.test(translated))return null;
  let text=translated.replace(/\s*;\s*/g,' | ').replace(/Фейсбук/gi,'Facebook').replace(/\s+/g,' ').trim();
  for(const match of original.match(/\b(?:UID\s*\d+|FVIAINBOXES\.COM|HOTMAIL|2FA)\b/gi)||[]){
    if(!text.toLowerCase().includes(match.toLowerCase()))text+=' | '+match;
  }
  return text.length>350?text.slice(0,350):text;
}
async function translateValue(env,original,target,kind){
  if(kind==='category'&&CATEGORY_TRANSLATIONS[original]?.[target])return CATEGORY_TRANSLATIONS[original][target];
  const source=THAI.test(original)?'th':/[А-Яа-яЁё]/.test(original)?'ru':'en';
  if(source===target||!/[\p{L}]/u.test(original))return original;
  const response=await env.AI.run('@cf/meta/m2m100-1.2b',{
    text:original.replace(/\s*\|\s*/g,'; '),source_lang:source,target_lang:target
  });
  return normalizedTranslation(original,response?.translated_text);
}
async function translatePending(env,limit=8){
  if(!env.STORE_DB||!env.AI)return 0;
  const record=await env.STORE_DB.prepare(
    'SELECT id,title,category,title_ru,title_en,category_ru,category_en FROM store_products WHERE translation_attempts<3 AND (title_ru IS NULL OR title_en IS NULL OR category_ru IS NULL OR category_en IS NULL) ORDER BY id LIMIT ?'
  ).bind(limit).all();
  let completed=0;
  for(const p of record.results){
    try{
      const [ru,en,catRu,catEn]=await Promise.all([
        p.title_ru||translateValue(env,p.title,'ru','title'),
        p.title_en||translateValue(env,p.title,'en','title'),
        p.category_ru||translateValue(env,p.category,'ru','category'),
        p.category_en||translateValue(env,p.category,'en','category')
      ]);
      if(!ru||!en||!catRu||!catEn)throw Error('Translation incomplete');
      const updated=await env.STORE_DB.prepare(
        'UPDATE store_products SET title_ru=?,title_en=?,category_ru=?,category_en=?,translation_attempts=0 WHERE id=? AND title=? AND category=?'
      ).bind(ru,en,catRu,catEn,p.id,p.title,p.category).run();
      if(updated.meta?.changes)completed++;
    }catch(error){
      await env.STORE_DB.prepare('UPDATE store_products SET translation_attempts=translation_attempts+1 WHERE id=? AND title=? AND category=?')
        .bind(p.id,p.title,p.category).run();
      console.error('store_translation_failed',p.id,String(error.message||error).slice(0,100));
    }
  }
  return completed;
}

export async function handleRequest(request,env,ctx){
  if(new URL(request.url).pathname!=='/internal'||request.method!=='POST')return problem(404,'Not found');
  if(!authorized(request,env.STORE_D1_TOKEN))return problem(401,'Unauthorized');
  if(!env.STORE_DB)return problem(503,'Database unavailable');
  if(Number(request.headers.get('content-length')||0)>TEXT_LIMIT)return problem(413,'Request too large');
  let input;
  try{const txt=await request.text();if(txt.length>TEXT_LIMIT)return problem(413,'Request too large');input=JSON.parse(txt);}catch{return problem(400,'Invalid JSON');}
  const {table,method='GET',query='',body}=input||{};
  if(!TABLES[table]&&!['rpc/store_sync_products','rpc/store_begin_purchase','rpc/store_upsert_user','rpc/store_claim_order','rpc/store_admin_orders'].includes(table))return problem(400,'Invalid resource');
  if(typeof query!=='string'||query.length>2000)return problem(400,'Invalid query');
  try{
    const params=new URLSearchParams(query);let result;
    if(method==='GET'&&TABLES[table])result=await selectRows(env.STORE_DB,table,query);
    else if(method==='GET'&&table==='rpc/store_admin_orders')result=await adminOrders(env.STORE_DB,query);
    else if(method==='POST'&&table==='store_settings')result=await saveSetting(env.STORE_DB,body);
    else if(method==='PATCH'&&table==='store_products')result=await changeProduct(env.STORE_DB,params,body);
    else if(method==='POST'&&table==='store_orders')result=await addOrder(env.STORE_DB,body);
    else if(method==='PATCH'&&table==='store_orders')result=await transitionOrder(env.STORE_DB,params,body);
    else if(method==='POST'&&table==='rpc/store_sync_products'){result=await syncProducts(env.STORE_DB,body?.payload);if(ctx?.waitUntil)ctx.waitUntil(translatePending(env,3).catch(e=>console.error('store_translation_background_error',String(e.message).slice(0,80))));}
    else if(method==='POST'&&table==='rpc/store_begin_purchase')result=await beginPurchase(env.STORE_DB,body?.id);
    else if(method==='POST'&&table==='rpc/store_upsert_user')result=await upsertStoreUser(env.STORE_DB,body);
    else if(method==='POST'&&table==='rpc/store_claim_order')result=await claimStoreOrder(env.STORE_DB,body);
    else return problem(405,'Operation not allowed');
    return reply(result);
  }catch(e){
    if(/^(Invalid|Missing)/.test(String(e.message)))return problem(400,'Invalid input');
    if(/UNIQUE constraint failed/.test(String(e.message)))return problem(409,'Duplicate record');
    console.error('store_d1_failed',String(e.message||e).slice(0,180));
    return problem(503,'Database operation failed');
  }
}
export default {fetch:handleRequest,async scheduled(_event,env,ctx){ctx.waitUntil(translatePending(env,12).catch(e=>console.error('store_translation_cron_error',String(e.message).slice(0,80))));}};

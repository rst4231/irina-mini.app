// Dedicated book-reviews API: only Vercel backend knows the shared secret.
const id=/^[a-f0-9-]{36}$/i;
const books=new Set(['profit','beginner']);
const ok=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
function secureEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string')return false;
 let diff=a.length^b.length;
 for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
 return diff===0;
}
export default {
 async fetch(request,env) {
  if(request.method!=='POST')return ok({ok:false,error:'method_not_allowed'},405);
  if(!env.INTERNAL_TOKEN||!secureEqual(request.headers.get('X-Internal-Token'),env.INTERNAL_TOKEN))
   return ok({ok:false,error:'unauthorized'},401);
  if(Number(request.headers.get('Content-Length')||0)>8192)return ok({ok:false,error:'too_large'},413);
  let body;
  try{body=await request.json()}catch{return ok({ok:false,error:'invalid_json'},400)}
  const db=env.BOOK_ORDERS;
  const path=new URL(request.url).pathname;
  try{
   if(path==='/list'){
    const offset=Math.max(0,Math.min(10000,Number(body.offset)||0));
    const [records,aggregates]=await Promise.all([
     db.prepare("SELECT id, book_key, rating, review_text, author_name, avatar_url, created_at FROM book_reviews WHERE status='published' ORDER BY created_at DESC, rowid DESC LIMIT 51 OFFSET ?").bind(offset).all(),
     db.prepare("SELECT book_key, COUNT(rating) AS count, ROUND(AVG(rating),1) AS average FROM book_reviews WHERE status IN ('published','pending') AND rating IS NOT NULL GROUP BY book_key").all(),
    ]);
    const found=records.results||[];
    return ok({ok:true,reviews:found.slice(0,50),stats:aggregates.results||[],nextOffset:found.length>50?offset+50:null});
   }
   if(path==='/create'){
    const b=body.review||{};
    if(!id.test(String(b.id||''))||!books.has(b.book_key)||!Number.isInteger(b.rating)||b.rating<1||b.rating>5||
      typeof b.review_text!=='string'||b.review_text.length<10||b.review_text.length>3000||
      typeof b.author_name!=='string'||b.author_name.length<2||b.author_name.length>80||
      !/^[a-f0-9]{64}$/.test(String(b.submitter_key||''))||
      !['pending','published'].includes(b.status) ||
      (b.avatar_url!=null && (typeof b.avatar_url!=='string'||b.avatar_url.length>900)) ||
      (b.telegram_user_id!=null && !/^[0-9]{1,20}$/.test(String(b.telegram_user_id))))
      return ok({ok:false,error:'invalid_review'},400);
    const result=await db.prepare("INSERT INTO book_reviews (id,book_key,rating,review_text,author_name,avatar_url,telegram_user_id,submitter_key,status,moderation_reason) SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM book_reviews WHERE submitter_key=? AND created_at>=datetime('now','-24 hours')) < 3")
      .bind(b.id,b.book_key,b.rating,b.review_text,b.author_name,b.avatar_url||null,b.telegram_user_id||null,b.submitter_key,b.status,String(b.moderation_reason||'').slice(0,80),b.submitter_key).run();
    if(!result.meta?.changes)return ok({ok:false,error:'rate_limited'},429);
    return ok({ok:true,status:b.status});
   }
   if(path==='/pending'){
    const rows=await db.prepare("SELECT id,book_key,rating,review_text,author_name,avatar_url,created_at FROM book_reviews WHERE status='pending' ORDER BY created_at ASC LIMIT 200").all();
    return ok({ok:true,reviews:rows.results||[]});
   }
   if(path==='/moderate'){
    if(!id.test(String(body.id||''))||!['approve','delete'].includes(body.action))
      return ok({ok:false,error:'invalid_action'},400);
    const done=body.action==='delete'
      ? await db.prepare("DELETE FROM book_reviews WHERE id=? AND status='pending'").bind(body.id).run()
      : await db.prepare("UPDATE book_reviews SET status='published',moderated_at=datetime('now') WHERE id=? AND status='pending'").bind(body.id).run();
    return ok({ok:true,updated:!!done.meta?.changes});
   }
   return ok({ok:false,error:'not_found'},404);
  }catch(e){console.error('books_reviews_d1_error',e?.message||'unknown');return ok({ok:false,error:'database_error'},503)}
 }
};

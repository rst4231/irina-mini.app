const SECTIONS = new Set(['theory','creatives','infrastructure','keitaro','launch']);
const AUTH_URL = 'https://irina-miniapp.vercel.app/api/learning-authorize';
export default {
  async fetch(req, env) {
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': 'https://irina-miniapp.vercel.app',
    };
    const reply = (status, data) => new Response(JSON.stringify(data), {status, headers});
    const url = new URL(req.url);
    try {
      if (url.pathname === '/catalog' && req.method === 'GET') {
        const lessons = await env.LEARNING_DB.prepare('SELECT id,section,title,sort_order FROM learning_lessons_v2 WHERE published=1 ORDER BY section,sort_order').all();
        const values = await env.LEARNING_DB.prepare('SELECT key,value FROM learning_settings').all();
        return reply(200, {ok:true,lessons:lessons.results||[],settings:Object.fromEntries((values.results||[]).map(x=>[x.key,x.value]))});
      }
      if (url.pathname === '/list' && req.method === 'GET') {
        const section=url.searchParams.get('section')||'';
        if (!SECTIONS.has(section)) return reply(400,{ok:false,error:'invalid_section'});
        const lessons=await env.LEARNING_DB.prepare('SELECT id,section,title,sort_order FROM learning_lessons_v2 WHERE section=? AND published=1 ORDER BY sort_order').bind(section).all();
        return reply(200,{ok:true,lessons:lessons.results||[]});
      }
      if(url.pathname==='/lesson' && req.method==='POST') {
        if(Number(req.headers.get('Content-Length')||0)>5000)return reply(413,{ok:false,error:'too_large'});
        const data=await req.json().catch(()=>null);
        const section=String(data?.section||''),id=String(data?.id||''),initData=String(data?.initData||''),session=String(data?.session||'');
        if (!SECTIONS.has(section)||!/^[a-f0-9-]{36}$/.test(id))return reply(400,{ok:false,error:'invalid_lesson'});
        if(section!=='theory'){
          if((!initData&&!session)||initData.length>3500||session.length>800)return reply(403,{ok:false,error:'purchase_required'});
          // Validate Telegram session and confirmed purchase on the existing Vercel backend.
          const check=await fetch(AUTH_URL,{method:'POST',headers:{'Content-Type':'application/json',...(session?{Cookie:session}:{})},body:JSON.stringify({initData,section}),redirect:'manual',signal:AbortSignal.timeout(8000)});
          if(!check.ok)return reply(check.status===403||check.status===401?403:503,{ok:false,error:check.status===403||check.status===401?'purchase_required':'auth_unavailable'});
          const grant=await check.json().catch(()=>null);
          if(grant?.ok!==true||grant?.authorized!==true||grant?.section!==section)return reply(403,{ok:false,error:'purchase_required'});
        }
        const lesson=await env.LEARNING_DB.prepare('SELECT id,section,title,body,sort_order FROM learning_lessons_v2 WHERE id=? AND section=? AND published=1').bind(id,section).first();
        if(!lesson)return reply(404,{ok:false,error:'not_found'});
        return reply(200,{ok:true,lesson});
      }
      return reply(404,{ok:false,error:'not_found'});
    } catch(e) {
      console.error('learning_worker_error',e?.message||e);
      return reply(503,{ok:false,error:'learning_unavailable'});
    }
  }
};

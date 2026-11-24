import handler0 from './_lava/checkout.js';
import handler1 from './_lava/session.js';
import handler2 from './_lava/status.js';
import handler3 from './_lava/webhook.js';
const handlers = Object.freeze({"checkout":handler0,"session":handler1,"status":handler2,"webhook":handler3});
export default async function route(req,res){
  const path = String(req.url || '').split('?')[0].replace(/\/$/,'');
  const prefix = '/api/lava/';
  const action = path.startsWith(prefix) ? path.slice(prefix.length) : req.query?.__irina_action;
  if(typeof action!=='string'||!Object.hasOwn(handlers,action)){
    res.setHeader('Cache-Control','no-store');
    return res.status(404).json({ok:false,error:'not_found'});
  }
  return handlers[action](req,res);
}

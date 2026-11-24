import handler0 from './_store/account.js';
import handler1 from './_store/admin.js';
import handler2 from './_store/catalog.js';
import handler3 from './_store/order.js';
import handler4 from './_store/orders.js';
import handler5 from './_store/verify-payment.js';
const handlers = Object.freeze({"account":handler0,"admin":handler1,"catalog":handler2,"order":handler3,"orders":handler4,"verify-payment":handler5});
export default async function route(req,res){
  const path = String(req.url || '').split('?')[0].replace(/\/$/,'');
  const prefix = '/api/store/';
  const action = path.startsWith(prefix) ? path.slice(prefix.length) : req.query?.__irina_action;
  if(typeof action!=='string'||!Object.hasOwn(handlers,action)){
    res.setHeader('Cache-Control','no-store');
    return res.status(404).json({ok:false,error:'not_found'});
  }
  return handlers[action](req,res);
}

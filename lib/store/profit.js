import {db} from './db.js';
import {thbUsdRate} from './fx.js';

export function validProfitMonth(month){return month==='all'||(typeof month==='string'&&/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month));}
export function currentProfitMonth(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit'}).format(new Date());}

// Historical FX and actual purchase debits are not recorded. This is explicitly
// an estimate using the order's saved THB quote and the current THB/USD rate.
export async function profitReport(month){
  if(!validProfitMonth(month))throw Error('Invalid profit month');
  let start=null,end=null;
  if(month!=='all'){
    start=new Date(`${month}-01T00:00:00+03:00`);
    const [year,number]=month.split('-').map(Number);
    end=new Date(Date.UTC(year,number,1)-3*60*60*1000);
  }
  let orderCount=0,revenueMicro=0,costThbCents=0;
  const pageSize=500;
  for(let offset=0;;offset+=pageSize){
    const orders=await db('store_orders',{query:'select=id,quantity,total_cents,pay_amount_micro,supplier_unit_price_cents,created_at&status=eq.fulfilled&order=created_at.desc'+(start?`&created_at=gte.${encodeURIComponent(start.toISOString())}`:'')+`&limit=${pageSize}&offset=${offset}`});
    for(const order of orders){
      const date=Date.parse(order.created_at);
      if(!Number.isFinite(date))throw Error('Invalid sale date');
      if(start&&(date<start.getTime()||date>=end.getTime()))continue;
      // total_cents is the USD sale price. The USDT invoice suffix is only
      // a payment identifier and is not part of dollar sales revenue.
      const revenue=order.total_cents*10000;
      const cost=order.supplier_unit_price_cents*order.quantity;
      if(!Number.isSafeInteger(revenue)||revenue<0||!Number.isSafeInteger(cost)||cost<0)throw Error('Invalid sale amounts');
      orderCount++;revenueMicro+=revenue;costThbCents+=cost;
      if(!Number.isSafeInteger(revenueMicro)||!Number.isSafeInteger(costThbCents))throw Error('Profit totals too large');
    }
    if(orders.length<pageSize)break;
    // The private D1 adapter limits offsets. Never show a truncated total.
    if(offset>=100000)throw Error('Profit history exceeds query limit');
  }
  let rate=null;
  if(orderCount){try{rate=await thbUsdRate();}catch{ /* Revenue remains usable when FX is unavailable. */ }}
  const costMicro=orderCount===0?0:rate===null?null:Math.round(costThbCents*rate*10000);
  if(costMicro!==null&&!Number.isSafeInteger(costMicro))throw Error('Profit totals too large');
  return {month,currency:'USD',timeZone:'Europe/Moscow',orderCount,revenueMicro,costThbCents,costMicro,profitMicro:costMicro===null?null:revenueMicro-costMicro,rate,estimated:true};
}

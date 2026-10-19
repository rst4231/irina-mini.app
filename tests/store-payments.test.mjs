import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteUsdCents,invoiceUnits,formatUsdt,thbUsdRate} from '../lib/store/fx.js';
import {validateTronTransfer,USDT_TRC20} from '../lib/store/tron.js';
import verifyHandler from '../api/store/verify-payment.js';
const wallet='TLEYJyCMjPjNXy3jFiyAfwTwXvgRuQY4VW',hash='a'.repeat(64),now=Date.parse('2026-10-19T12:00:00Z');
const createdAt='2026-10-19T11:55:00Z';
const transaction={hash,confirmed:true,revert:false,confirmations:20,contractRet:'SUCCESS',timestamp:now,trc20TransferInfo:[{contract_address:USDT_TRC20,to_address:wallet,type:'Transfer',decimals:6,status:0,amount_str:'17512345'}]};
const opts={txid:hash,wallet,units:17512345,createdAt,now};
test('THB/USD conversion rounds up, invoices have 6 exact decimals',()=>{
  assert.equal(quoteUsdCents(3500,45,0.031),163);
  assert.equal(invoiceUnits(1751,2345),17512345);
  assert.equal(formatUsdt(17512345),'17.512345');
  assert.throws(()=>invoiceUnits(1751,10000));
});
test('Frankfurter response validates freshness and base currencies',async()=>{
  const response=await thbUsdRate({force:true,now,fetchImpl:async()=>({ok:true,json:async()=>({base:'THB',quote:'USD',rate:0.031,date:'2026-10-19'})})});
  assert.equal(response,0.031);
  await assert.rejects(thbUsdRate({force:true,now,fetchImpl:async()=>({ok:true,json:async()=>({base:'USD',quote:'THB',rate:31,date:'2026-10-19'})})}));
});
test('TRON verification rejects wrong token, wrong wallet, amount, unconfirmed and old payments',()=>{
  // TRONSCAN transfer schema omits tokenType on real USDT transfers.
  assert.equal(validateTronTransfer(transaction,opts),true);
  assert.equal(validateTronTransfer({...transaction,trc20TransferInfo:[{...transaction.trc20TransferInfo[0],decimals:18}]},opts),false);
  assert.equal(validateTronTransfer({...transaction,confirmed:false},opts),false);
  assert.equal(validateTronTransfer({...transaction,confirmations:19},opts),false);
  assert.equal(validateTronTransfer({...transaction,contractRet:'REVERT'},opts),false);
  assert.equal(validateTronTransfer({...transaction,timestamp:Date.parse('2026-10-19T11:40:00Z')},opts),false);
  assert.equal(validateTronTransfer(transaction,{...opts,units:17512344}),false);
  assert.equal(validateTronTransfer(transaction,{...opts,wallet:'TN1LKZJUJaWmi9sPVhGgPoyUDj7qnTGvAc'}),false);
  assert.equal(validateTronTransfer({...transaction,trc20TransferInfo:[{...transaction.trc20TransferInfo[0],contract_address:'FAKE'}]},opts),false);
});
test('payment API rejects malformed txid and arbitrary receipt identifiers',async()=>{
  const req={method:'POST',body:{id:'bad',token:'short',txHash:'123'}};
  const res={code:200,setHeader(){},status(c){this.code=c;return this},json(o){this.body=o;return this}};
  await verifyHandler(req,res);assert.equal(res.code,400);
});

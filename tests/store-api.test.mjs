import test from 'node:test';import assert from 'node:assert/strict';
import catalog from '../api/store/catalog.js';import orders from '../api/store/orders.js';import admin from '../api/store/admin.js';import receipt from '../api/store/order.js';
function req(method,body={},headers={}){return {method,body,headers}};
function res(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(s){this.code=s;return this},json(d){this.data=d;return this}}}
test('demo catalog is safe and disables checkout',async()=>{const r=res();await catalog(req('GET'),r);assert.equal(r.code,200);assert.equal(r.data.checkout,false);assert.equal(r.data.demo,true);assert.ok(r.data.products.length>0)});
test('admin rejects unknown token',async()=>{const r=res();await admin(req('GET',{}, {authorization:'Bearer bad'}),r);assert.equal(r.code,401)});
test('checkout validates email, quantity before supplier',async()=>{const r=res();await orders(req('POST',{productId:3,quantity:21,email:'no'}),r);assert.equal(r.code,400)});
test('checkout refuses when database or supplier is not configured',async()=>{const r=res();await orders(req('POST',{productId:1,quantity:1,email:'a@b.co'}),r);assert.equal(r.code,503)});
test('receipt rejects invalid token',async()=>{const r=res();await receipt(req('POST',{id:'123',token:'abc'}),r);assert.equal(r.code,400)});

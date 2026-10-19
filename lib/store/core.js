import {createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual} from 'node:crypto';

export const currency = n => Number((n/100).toFixed(2));
export function moneyToCents(input) {
  const str = String(input);
  if(!/^\d+(?:\.\d{1,2})?$/.test(str)) throw new Error('Invalid money amount');
  const [whole, fraction=''] = str.split('.');
  const result = Number(whole)*100 + Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(result) || result > 10000000000) throw new Error('Money amount out of range');
  return result;
}
export function sellPrice(costCents, markupPercent) {
  if(!Number.isInteger(costCents) || costCents<0 || !Number.isFinite(markupPercent) || markupPercent<0 || markupPercent>500) throw new Error('Invalid pricing input');
  return Math.ceil(costCents * (100 + markupPercent)/100);
}
export function sha256(text) {return createHash('sha256').update(text).digest('hex');}
export function equalsSecret(a,b) {
  if(typeof a!=='string'||typeof b!=='string'||!b) return false;
  const x=createHash('sha256').update(a).digest();
  const y=createHash('sha256').update(b).digest();
  return timingSafeEqual(x,y);
}
export function getEncryptionKey() {
  const str=process.env.STORE_DELIVERY_ENCRYPTION_KEY || '';
  if(!/^[0-9a-fA-F]{64}$/.test(str)) throw new Error('STORE_DELIVERY_ENCRYPTION_KEY must be 32-byte hex');
  return Buffer.from(str,'hex');
}
export function encryptDelivery(value) {
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',getEncryptionKey(),iv);
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');
}
export function decryptDelivery(value) {
  const [iv,tag,body]=String(value).split('.');
  if(!iv||!tag||!body) throw new Error('Invalid payload');
  const decipher=createDecipheriv('aes-256-gcm',getEncryptionKey(),Buffer.from(iv,'base64url'));
  decipher.setAuthTag(Buffer.from(tag,'base64url'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(body,'base64url')),decipher.final()]).toString('utf8'));
}
export const newLookupToken=()=>randomBytes(32).toString('base64url');
// TRON uses Base58Check: validate both address bytes and checksum.
export function validWallet(value){
  if(typeof value!=='string'||!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value))return false;
  const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let number=0n;
  for(const character of value){const digit=alphabet.indexOf(character);if(digit<0)return false;number=number*58n+BigInt(digit);}
  const bytes=Buffer.alloc(25);
  for(let i=24;i>=0;i--){bytes[i]=Number(number&255n);number>>=8n;}
  if(number!==0n||bytes[0]!==0x41)return false;
  const twice=createHash('sha256').update(createHash('sha256').update(bytes.subarray(0,21)).digest()).digest();
  return bytes.subarray(21).equals(twice.subarray(0,4));
}
export const validEmail = value => typeof value==='string' && value.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const cleanTitle = value => String(value || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,150).trim();
export const stripHtml = value => String(value || '').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').slice(0,600).trim();
export function basicAuth(req){const provided=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');return equalsSecret(provided,process.env.STORE_ADMIN_TOKEN||'');}
export function json(res,status,data){res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store, max-age=0');return res.status(status).json(data);}
export function guardMethod(req,res,methods){if(methods.includes(req.method))return true;res.setHeader('Allow',methods.join(', '));json(res,405,{error:'Method not allowed'});return false;}
export const statusLabel = s => ({awaiting_payment:'Ожидает оплаты',fulfilling:'В обработке',fulfilled:'Выдан',needs_review:'Требует проверки',cancelled:'Отменён'})[s]||s;

// Payment activation is intentionally gated until all operational checks are met.
export function storeCanCheckout(config,supplierConnected){
  return Boolean(config?.checkout_enabled===true && config?.supplier_resale_approved===true &&
    validWallet(config?.usdt_trc20_wallet) && supplierConnected &&
    process.env.STORE_PAYMENT_CONFIRMATION_MODE==='tronscan' &&
    !!process.env.STORE_TRONSCAN_API_KEY &&
    (process.env.STORE_ADMIN_TOKEN||'').length>=32 &&
    /^[a-fA-F0-9]{64}$/.test(process.env.STORE_DELIVERY_ENCRYPTION_KEY||''));
}

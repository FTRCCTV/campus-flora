import test from 'node:test';
import assert from 'node:assert/strict';
import {clientIp, sameOrigin} from '../server/auth.mjs';
import {publicAuth} from '../server/auth.mjs';

function bucket(){
  const map=new Map();let rev=0;
  return {
    map,
    get:async key=>{
      const entry=map.get(key);
      return entry?{httpEtag:entry.httpEtag,json:async()=>JSON.parse(entry.value)}:null;
    },
    put:async(key,value,options={})=>{
      const old=map.get(key),condition=options&&options.onlyIf;
      if(condition&&condition.has('If-None-Match')&&old)return null;
      if(condition&&condition.has('If-Match')&&old?.httpEtag!==condition.get('If-Match'))return null;
      const entry={httpEtag:'"'+(++rev)+'"',value};
      map.set(key,entry);
      return entry;
    },
    delete:async key=>{map.delete(key)}
  };
}
const digest=async(password,salt,iterations)=>{
  const encoder=new TextEncoder();
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations},key,256);
  return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('');
};
const auth=(path,body,{origin='https://test',headers={}}={})=>new Request('https://test/api/auth/'+path,{
  method:'POST',
  headers:{'content-type':'application/json',Origin:origin,...headers},
  body:JSON.stringify(body)
});
const cookie=response=>response.headers.get('set-cookie')||'';

test('register creates a hardened session cookie and stores the KDF rounds',async()=>{
  const env={BUCKET:bucket()};
  const response=await publicAuth(auth('register',{name:'小明',password:'correct-horse'}),env,'register');
  assert.equal(response.status,200);
  const header=cookie(response);
  assert.match(header,/^__Host-flora_session=[a-f0-9]{64};/);
  assert.match(header,/HttpOnly/);
  assert.match(header,/Secure/);
  assert.match(header,/SameSite=Lax/);
  const keys=[...env.BUCKET.map.keys()];
  const recordKey=keys.find(key=>key.startsWith('auth/names/'));
  const record=JSON.parse(env.BUCKET.map.get(recordKey).value);
  assert.equal(record.rounds,100000);
  assert.equal(record.digest.length,64);
});

test('login rejects a wrong password and locks the account after repeated failures',async()=>{
  const env={BUCKET:bucket()};
  await publicAuth(auth('register',{name:'locket',password:'correct-horse'}),env,'register');
  for(let attempt=0;attempt<8;attempt++){
    const response=await publicAuth(auth('login',{name:'locket',password:'wrong-password'}),env,'login');
    assert.equal(response.status,401);
  }
  const locked=await publicAuth(auth('login',{name:'locket',password:'correct-horse'}),env,'login');
  assert.equal(locked.status,429);
  assert.equal(cookie(locked),'');
});

test('login accepts a legacy record without rounds and upgrades it',async()=>{
  const bucketStore=bucket();
  const env={BUCKET:bucketStore,PASSWORD_ROUNDS:'200000'};
  await publicAuth(auth('register',{name:'legacy',password:'correct-horse'}),env,'register');
  const recordKey=[...bucketStore.map.keys()].find(key=>key.startsWith('auth/names/'));
  // Rewrite the record the way the previous release stored it: no rounds field, 100k iterations.
  const stored=JSON.parse(bucketStore.map.get(recordKey).value);
  const salt='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  await bucketStore.put(recordKey,JSON.stringify({user:stored.user,salt,digest:await digest('correct-horse',salt,100000)}),{});
  const response=await publicAuth(auth('login',{name:'legacy',password:'correct-horse'}),env,'login');
  assert.equal(response.status,200);
  const upgraded=JSON.parse(bucketStore.map.get(recordKey).value);
  assert.equal(upgraded.rounds,200000);
  assert.notEqual(upgraded.digest,await digest('correct-horse',salt,100000));
  // The upgraded account keeps working.
  assert.equal((await publicAuth(auth('login',{name:'legacy',password:'correct-horse'}),env,'login')).status,200);
});

test('registration honours the site-wide daily ceiling',async()=>{
  const env={BUCKET:bucket(),REGISTER_DAILY_LIMIT:'1'};
  assert.equal((await publicAuth(auth('register',{name:'first',password:'correct-horse'}),env,'register')).status,200);
  const second=await publicAuth(auth('register',{name:'second',password:'correct-horse'}),env,'register');
  assert.equal(second.status,429);
});

test('sameOrigin accepts the request origin and PUBLIC_ORIGIN but nothing else',async()=>{
  const request=(url,origin)=>new Request(url,{headers:origin?{Origin:origin}:{}});
  assert.equal(sameOrigin(request('https://flora.test/api/auth/login','https://flora.test'),{},),true);
  assert.equal(sameOrigin(request('https://flora.test/api/auth/login','https://evil.test'),{}),false);
  assert.equal(sameOrigin(request('https://flora.test/api/auth/login','https://flora.example.edu'),{PUBLIC_ORIGIN:'https://flora.example.edu'}),true);
  assert.equal(sameOrigin(request('https://flora.test/api/auth/login','https://evil.example.edu'),{PUBLIC_ORIGIN:'https://flora.example.edu, https://b.test'}),false);
  assert.equal(sameOrigin(request('https://flora.test/api/auth/login',null),{}),false);
  const proxied=new Request('http://10.0.0.5/api/auth/login',{headers:{Origin:'https://flora.example.edu'}});
  assert.equal(sameOrigin(proxied,{PUBLIC_ORIGIN:'https://flora.example.edu'}),true);
});

test('a foreign origin is rejected before any password work happens',async()=>{
  const env={BUCKET:bucket()};
  const response=await publicAuth(auth('login',{name:'anyone',password:'correct-horse'},{origin:'https://evil.test'}),env,'login');
  assert.equal(response.status,403);
  assert.equal([...env.BUCKET.map.keys()].length,0);
});

test('clientIp only trusts values that parse as addresses',async()=>{
  const request=headers=>new Request('https://test/',{headers});
  assert.equal(clientIp(request({'cf-connecting-ip':'198.51.100.4'})),'198.51.100.4');
  assert.equal(clientIp(request({'x-forwarded-for':'203.0.113.9, 10.0.0.1'})),'203.0.113.9');
  assert.equal(clientIp(request({'cf-connecting-ip':'not-an-ip'})),'unknown');
  assert.equal(clientIp(request({})),'unknown');
});

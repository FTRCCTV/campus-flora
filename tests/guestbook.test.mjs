import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/profile.js';
import '../dist/layout.js';
import {friendsApi} from '../server/friends.mjs';
import {giftsApi} from '../server/gifts.mjs';

// Same conditional-write bucket as tests/quota.test.mjs: puts only succeed while
// the etag the caller read is still current.
function bucket(){
  const map=new Map();let rev=0;
  return {
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
const hash=async text=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).toString('hex');
const tokens={alice:'a'.repeat(64),bob:'b'.repeat(64)};
const edgeId='11111111-1111-4111-8111-111111111111';
const edge={id:edgeId,sender:'flora-alice',recipient:'flora-bob',sender_name:'alice',recipient_name:'bob',accepted:1};
const friendDb=()=>({prepare:()=>({bind:()=>({first:async()=>edge})})});
const strangerDb=()=>({prepare:()=>({bind:()=>({first:async()=>undefined})})});

async function environment(db){
  const bucketStore=bucket();
  for(const name of ['alice','bob']){
    const account={user:{id:'flora-'+name,name},revision:1};
    await bucketStore.put('auth/names/'+await hash(name),JSON.stringify(account));
    await bucketStore.put('auth/sessions/'+await hash(tokens[name]),JSON.stringify({...account,until:Date.now()+60000}));
  }
  return {BUCKET:bucketStore,DB:db()};
}
function call(api,env,who,path,body){
  const request=new Request('https://test/api/'+path,{
    method:body?'POST':'GET',
    headers:{Origin:'https://test',Cookie:'__Host-flora_session='+tokens[who],...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  return api(request,env);
}
const comment=(env,who,text)=>call(friendsApi,env,who,'friends',{action:'comment',id:edgeId,text});
const guestbook=env=>call(friendsApi,env,'alice','friends?comments='+edgeId);

test('guestbook turns away anyone who is not a friend of the edge',async()=>{
  const env=await environment(strangerDb);
  assert.equal((await guestbook(env)).status,403);
  assert.equal((await comment(env,'alice','偷偷留一句')).status,403);
  assert.equal((await call(friendsApi,env,'alice','friends?comments=')).status,400);
});

test('friends read the guestbook newest first and own marks their own words',async()=>{
  const env=await environment(friendDb);
  assert.equal((await comment(env,'alice','第一句留言')).status,200);
  assert.equal((await comment(env,'bob','第二句留言')).status,200);
  const {comments}=await (await guestbook(env)).json();
  assert.equal(comments.length,2);
  assert.deepEqual(comments.map(c=>c.text),['第二句留言','第一句留言']);
  assert.equal(comments[0].fromName,'bob');
  assert.equal(comments[0].own,false);
  assert.equal(comments[1].own,true);
  assert.equal(typeof comments[0].id,'string');
  assert.ok(!Number.isNaN(Date.parse(comments[0].date)));
});

test('comment text is trimmed and must stay within 1–200 characters',async()=>{
  const env=await environment(friendDb);
  assert.equal((await comment(env,'alice','   ')).status,400);
  assert.equal((await comment(env,'alice','x'.repeat(201))).status,400);
  assert.equal((await comment(env,'alice','  留一句  ')).status,200);
  const {comments}=await (await guestbook(env)).json();
  assert.equal(comments.length,1);
  assert.equal(comments[0].text,'留一句');
});

test('guestbook quota stops at twenty comments per ten minutes',async()=>{
  const env=await environment(friendDb);
  for(let i=0;i<20;i++)assert.equal((await comment(env,'alice','第'+i+'句')).status,200);
  assert.equal((await comment(env,'alice','第二十一句')).status,429);
  assert.equal((await guestbook(env)).status,200);
});

test('guestbook keeps the latest hundred comments and pages fifty',async()=>{
  const env=await environment(friendDb);
  const key='social/comments/v1/'+encodeURIComponent(edgeId)+'.json';
  const seed=Array.from({length:100},(_,i)=>({id:'old-'+i,fromId:'flora-bob',fromName:'bob',text:'旧留言'+i,date:new Date(Date.now()-i*1000).toISOString()}));
  await env.BUCKET.put(key,JSON.stringify(seed));
  await env.BUCKET.put('social/comments/quota/flora-alice',JSON.stringify({until:Date.now()+60000,n:19}));
  assert.equal((await comment(env,'alice','新的留言')).status,200);
  const stored=await (await env.BUCKET.get(key)).json();
  assert.equal(stored.length,100);
  assert.equal(stored[0].text,'新的留言');
  assert.equal(stored[99].text,'旧留言98');
  const {comments}=await (await guestbook(env)).json();
  assert.equal(comments.length,50);
  assert.equal(comments[0].text,'新的留言');
  assert.equal(comments[0].own,true);
});

test('wantsReturn travels with a gift until the friend accepts it',async()=>{
  const env=await environment(friendDb);
  await env.BUCKET.put('gardens/v1/flora-alice.json',JSON.stringify([{uid:'plant-1',name:'鸡爪槭',latin:'Acer palmatum',form:'tree',size:'medium',zone:'sill',growth:2,generation:1}]));
  assert.equal((await call(giftsApi,env,'alice','gifts',{action:'send',id:edgeId,uid:'plant-1',wantsReturn:true})).status,200);
  const inbox=await (await call(giftsApi,env,'bob','gifts')).json();
  assert.equal(inbox.gifts.length,1);
  assert.equal(inbox.gifts[0].wantsReturn,true);
  assert.equal(inbox.gifts[0].from,'alice');
  const accepted=await call(giftsApi,env,'bob','gifts',{action:'accept',id:inbox.gifts[0].id,zone:'sill',cover:'data:image/jpeg;base64,/9j/4AAQSkZJRg=='});
  assert.equal(accepted.status,200);
  assert.deepEqual((await (await call(giftsApi,env,'bob','gifts')).json()).gifts,[]);
  assert.equal((await call(giftsApi,env,'alice','gifts',{action:'send',id:edgeId,uid:'plant-1'})).status,200);
  const plain=await (await call(giftsApi,env,'bob','gifts')).json();
  assert.equal(plain.gifts.length,1);
  assert.equal('wantsReturn' in plain.gifts[0],false);
});

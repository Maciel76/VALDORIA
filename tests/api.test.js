import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { createApi } from '../server/api.js';
import { makeKingdom } from '../src/world/demo.js';
import { validatedKingdom } from '../src/core/kingdom.js';
import { onAtlasLand } from '../src/world/atlas-geography.js';

async function isolated(env, callback) {
  const api=createApi(env), server=createServer(api.handle);
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port+'/api';
  const request=async (path,method='GET',token,input,headers={})=>{
    const response=await fetch(base+path,{
      method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...headers},
      ...(input?{body:JSON.stringify(input)}:{})
    });
    const cookie=response.headers.get('set-cookie');
    return {status:response.status,...await response.json(),...(cookie?{cookie}:{})};
  };
  try{await callback(request);}
  finally{await new Promise(resolve=>server.close(resolve));await api.close();}
}

test('servidor sem MongoDB informa o modo local ao navegador',async()=>{
  await isolated({MONGODB_URI:'disabled'},async send=>{
    assert.deepEqual(await send('/health'),{status:200,online:false,storage:'indexeddb'});
    assert.equal((await send('/world')).status,503);
    const npc=await send('/world/npc-grifo');
    assert.equal(npc.kingdom.kind,'npc');
    assert.ok(validatedKingdom(npc.state));
  });
});

const uri=process.env.VALDORIA_TEST_MONGO;
test('jogadores independentes, publicação, visitas, presença, operações idempotentes e conflito',{skip:!uri},async()=>{
  const database='reino_valdoria_test_'+randomBytes(6).toString('hex');
  const mongo = new MongoClient(uri);
  try {
    await isolated({MONGODB_URI:uri,MONGODB_DATABASE:database},async send=>{
      const a=randomBytes(24).toString('hex'),b=randomBytes(24).toString('hex');
      assert.equal((await send('/health')).online,true);
      const first=await send('/profile','POST',a,{alias:'Arven'});
      const second=await send('/profile','POST',b,{alias:'Vidral'});
      assert.notEqual(first.id,second.id);
      const state=makeKingdom('starter');
      const input={state,revision:0,operation:'operation-001'};
      const [save,duplicate]=await Promise.all([send('/kingdom','PUT',a,input),send('/kingdom','PUT',a,input)]);
      assert.equal(save.revision,1);
      assert.equal(duplicate.revision,1);
      assert.ok(save.duplicate||duplicate.duplicate);
      assert.equal((await send('/kingdom','PUT',a,{...input,operation:'operation-002'})).status,409);
      assert.equal((await send('/kingdom','PUT',b,{...input,state:{...state,objects:[{id:'oops',type:'wrong',x:0,z:0,rotation:0}]}})).status,400);
      assert.equal((await send('/kingdom','PUT',b,{...input,state:{...state,name:'Castelo de Vidral'}})).status,200);
      assert.equal((await send('/world','POST',a,{revision:1})).status,200);
      assert.equal((await send('/world','POST',b,{revision:1})).status,200);
      const list=await send('/world');
      const players=list.kingdoms.filter(row=>row.kind==='player');
      assert.equal(players.length,2);
      assert.ok(list.kingdoms.every(row=>row.castles===1 && onAtlasLand(row.x,row.y)));
      assert.ok(players.every(row=>row.preview==='stockade'));
      assert.equal((await send('/world/'+first.id)).state.name,state.name);
      assert.equal((await send('/kingdom','GET',b)).state.name,'Castelo de Vidral');
      const position={x:0,y:0,z:0,angle:0};
      assert.deepEqual((await send('/world/'+first.id+'/presence','POST',a,position)).players,[]);
      assert.equal((await send('/world/'+first.id+'/presence','POST',b,position)).players[0].id,first.id);
      assert.equal((await send('/world','DELETE',a)).status,200);
      assert.equal((await send('/world/'+first.id)).status,404);
      assert.equal((await send('/world')).kingdoms.filter(row=>row.kind==='player').length,1);
    });
  } finally {
    await mongo.db(database).dropDatabase();
    await mongo.close();
  }
});

test('conta com senha, sessões, isolamento, mapa automático e migração de código',{skip:!uri},async()=>{
  const database='reino_valdoria_test_'+randomBytes(6).toString('hex');
  const mongo=new MongoClient(uri);
  try {
    await isolated({MONGODB_URI:uri,MONGODB_DATABASE:database},async send=>{
      const input={alias:'Alina do Vale',username:'ALINA',password:'minha-senha-longa'};
      const registered=await send('/auth/register','POST',null,input);
      assert.equal(registered.status,201);
      assert.equal(registered.account.username,'alina');
      assert.match(registered.cookie,/HttpOnly; SameSite=Lax/);
      const session=cookie=>({Cookie:cookie.split(';')[0]});
      const headers=session(registered.cookie);
      assert.equal((await send('/auth/session','GET',null,null,headers)).account.id,registered.account.id);
      assert.equal((await send('/auth/register','POST',null,input)).status,409);
      assert.equal((await send('/auth/login','POST',null,{...input,password:'senha-errada'})).status,401);
      const state={...makeKingdom(),name:'Castelo de Alina'};
      const save={state,revision:0,operation:'account-save-001'};
      assert.equal((await send('/progress','GET')).status,401);
      assert.equal((await send('/progress','POST',null,{id:'fundacao'},headers)).status,409);
      assert.equal((await send('/kingdom','PUT',null,save,{...headers,'X-Valdoria-Account':'outra-conta'})).status,401);
      assert.equal((await send('/kingdom','PUT',null,save,headers)).status,200);
      const rewards=await Promise.all([1,2].map(()=>send('/progress','POST',null,{id:'fundacao'},headers)));
      assert.ok(rewards.every(reward=>reward.progress.xp===100&&reward.progress.level===2));
      assert.equal(rewards.filter(reward=>reward.duplicate).length,1);
      assert.equal((await send('/progress','POST',null,{id:'legado'},headers)).status,409);
      const id=registered.account.id;
      const listed=(await send('/world')).kingdoms;
      assert.equal(listed.find(site=>site.id===id)?.preview,'stockade');
      assert.equal(listed.filter(site=>site.kind==='npc').length,5);
      assert.deepEqual((await send('/world/'+id)).state,state);
      const changed={state:{...state,name:'Forte da Alina'},revision:1,operation:'account-save-002'};
      assert.equal((await send('/kingdom','PUT',null,changed,headers)).status,200);
      assert.equal((await send('/world/'+id)).kingdom.name,changed.state.name);
      assert.equal((await send('/world','DELETE',null,null,headers)).status,200);
      assert.equal((await send('/kingdom','PUT',null,{...changed,revision:2,operation:'account-save-003'},headers)).status,200);
      assert.equal((await send('/world/'+id)).status,404);
      assert.equal((await send('/world','POST',null,{revision:3},headers)).status,200);
      assert.equal((await send('/auth/logout','POST',null,null,headers)).status,200);
      assert.equal((await send('/auth/session','GET',null,null,headers)).account,null);
      const login=await send('/auth/login','POST',null,input);
      assert.equal(login.status,200);
      assert.equal(login.account.progress.xp,100);
      assert.equal((await send('/kingdom','GET',null,null,session(login.cookie))).state.name,changed.state.name);
      const doc=await mongo.db(database).collection('kingdoms').findOne({_id:id});
      assert.notEqual(doc.password.hash,input.password);
      assert.notEqual(doc.sessions[0].key,session(login.cookie).Cookie.split('=')[1]);
      const code=randomBytes(24).toString('hex');
      const legacy=await send('/profile','POST',code,{alias:'Artur do Vau'});
      await send('/kingdom','PUT',code,save);
      const upgraded=await send('/auth/register','POST',null,{...input,username:'artur',alias:legacy.alias,legacyCode:code});
      assert.equal(upgraded.account.id,legacy.id);
      assert.equal((await send('/kingdom','GET',code)).status,401);
      assert.equal((await send('/kingdom','GET',null,null,session(upgraded.cookie))).state.name,state.name);
    });
  } finally {
    await mongo.db(database).dropDatabase();
    await mongo.close();
  }
});


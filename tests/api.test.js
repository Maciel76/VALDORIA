import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { createApi } from '../server/api.js';
import { makeKingdom } from '../src/world/demo.js';

async function isolated(env, callback) {
  const api=createApi(env), server=createServer(api.handle);
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port+'/api';
  const request=async (path,method='GET',token,input)=>{
    const response=await fetch(base+path,{
      method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
      ...(input?{body:JSON.stringify(input)}:{})
    });
    return {status:response.status,...await response.json()};
  };
  try{await callback(request);}
  finally{await new Promise(resolve=>server.close(resolve));await api.close();}
}

test('servidor sem MongoDB informa o modo local ao navegador',async()=>{
  await isolated({MONGODB_URI:'disabled'},async send=>{
    assert.deepEqual(await send('/health'),{status:200,online:false,storage:'indexeddb'});
    assert.equal((await send('/world')).status,503);
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
      assert.equal(list.kingdoms.length,2);
      assert.ok(list.kingdoms.every(row=>row.castles===1 && row.x>0 && row.x<1));
      assert.equal((await send('/world/'+first.id)).state.name,state.name);
      assert.equal((await send('/kingdom','GET',b)).state.name,'Castelo de Vidral');
      const position={x:0,y:0,z:0,angle:0};
      assert.deepEqual((await send('/world/'+first.id+'/presence','POST',a,position)).players,[]);
      assert.equal((await send('/world/'+first.id+'/presence','POST',b,position)).players[0].id,first.id);
      assert.equal((await send('/world','DELETE',a)).status,200);
      assert.equal((await send('/world/'+first.id)).status,404);
      assert.equal((await send('/world')).kingdoms.length,1);
    });
  } finally {
    await mongo.db(database).dropDatabase();
    await mongo.close();
  }
});


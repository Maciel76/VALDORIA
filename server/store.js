import { MongoClient } from 'mongodb';
import { createHash, randomUUID } from 'node:crypto';

export const digest = token => createHash('sha256').update(token).digest('hex');

export function worldSummary({ _id, alias, published }) {
  const seed = Number.parseInt(digest(_id).slice(0,12),16);
  // Each account occupies a stable inland point on one of the atlas islands.
  const a = (seed % 1024)/1024*Math.PI*2;
  const r = Math.sqrt((Math.floor(seed/1024)%4096)/4096);
  const island = Math.floor(seed/4194304)%3;
  const [cx,cy,rx,ry] = [[.44,.49,.255,.285],[.775,.59,.074,.16],[.22,.30,.069,.075]][island];
  return { id: _id, alias, name: published.name, x:cx+Math.cos(a)*r*rx,y:cy+Math.sin(a)*r*ry,
    castles:published.castles, buildings:published.buildings, updatedAt:published.at };
}

export function createStore(env) {
  const disabled = env.MONGODB_URI === 'disabled';
  const client = !disabled && new MongoClient(env.MONGODB_URI || 'mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 1500 });
  let pending, collection, retryAt = 0;
  async function getCollection() {
    if (disabled || Date.now()<retryAt) return null;
    if (collection) return collection;
    pending ||= client.connect().then(async () => {
      const result = client.db(env.MONGODB_DATABASE || 'reino_valdoria').collection('kingdoms');
      await result.createIndex({ key:1 },{ unique:true });
      return collection = result;
    }).catch(()=>{
      retryAt = Date.now()+4000;
      return null;
    }).finally(()=>{pending=undefined;});
    return pending;
  }
  return {
    getCollection,
    async close() { if (client) await client.close(); },
    async profile(db,token) { return db.findOne({key:digest(token)}); },
    async register(db,token,alias) {
      return db.findOneAndUpdate({key:digest(token)},{$setOnInsert:{
        _id:randomUUID(),key:digest(token),alias,revision:0,operations:[]
      }},{upsert:true,returnDocument:'after'});
    },
    async save(db,profile,state,revision,operation) {
      const previous = profile.operations.find(record=>record.id===operation);
      if (previous) return {revision:previous.revision, duplicate:true};
      if (revision!==profile.revision) return {conflict:profile.revision};
      const next = revision+1;
      const update = await db.findOneAndUpdate({_id:profile._id,revision},{
        $set:{state,revision:next,updatedAt:Date.now()},
        $push:{operations:{$each:[{id:operation,revision:next}],$slice:-32}}
      },{returnDocument:'after',projection:{revision:1}});
      if (update) return {revision:update.revision};
      const latest = await db.findOne({_id:profile._id},{projection:{revision:1,operations:1}});
      const committed = latest.operations.find(record=>record.id===operation);
      return committed ? {revision:committed.revision,duplicate:true} : {conflict:latest.revision};
    }
  };
}


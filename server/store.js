import { MongoClient } from 'mongodb';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { catalogue } from '../src/core/catalog.js';
import { castleTypes } from '../src/core/geometry.js';
import { isPerimeterPiece } from '../src/world/perimeter.js';
import { onAtlasLand } from '../src/world/atlas-geography.js';

export const digest = token => createHash('sha256').update(token).digest('hex');
const towers = ['squareTower','roundTower'];
const previewPriority = ['keep','stockade',...towers];
const findPreview = types => previewPriority.find(type=>types.includes(type)) || 'flag';

export function worldSummary({ _id, alias, published }) {
  let x, y, attempt = 0;
  do {
    const hash = digest(_id+':'+attempt++);
    x = .14 + Number.parseInt(hash.slice(0,6),16)/0xffffff*.73;
    y = .19 + Number.parseInt(hash.slice(6,12),16)/0xffffff*.60;
  } while (!onAtlasLand(x,y));
  const preview = published.preview ?? findPreview(published.state?.objects.map(object=>object.type) || []);
  return {id:_id,alias,name:published.name,x,y,kind:'player',preview,
    castles:published.castles,buildings:published.buildings,updatedAt:published.at};
}

export function kingdomSnapshot(state) {
  const castles = state.objects.filter(object=>!isPerimeterPiece(object) &&
    (castleTypes.has(object.type) || towers.includes(object.type)));
  const preview = findPreview(castles.map(object=>object.type));
  const buildings = state.objects.filter(({type})=>['housing','trade','civic','castle'].includes(catalogue[type].category)).length;
  return {name:state.name,castles:castles.length,buildings,preview,at:Date.now(),state};
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
      await result.createIndexes([
        {key:{key:1},name:'key_1',unique:true},
        {key:{username:1},name:'username_unique',unique:true,partialFilterExpression:{username:{$exists:true}}},
        {key:{'sessions.key':1},name:'session_key'},
        {key:{'published.at':-1,_id:1},name:'atlas_recent'}
      ]);
      return collection = result;
    }).catch(()=>{
      retryAt = Date.now()+4000;
      return null;
    }).finally(()=>{pending=undefined;});
    return pending;
  }
  return {
    getCollection,
    async world(db) {
      const legacyPreview = {$switch:{
        branches:previewPriority.map(type=>({
          case:{$in:[type,{$ifNull:['$published.state.objects.type',[]]}]},then:type
        })),
        default:'flag'
      }};
      return db.aggregate([
        {$match:{published:{$exists:true}}},
        {$sort:{'published.at':-1,_id:1}},
        {$limit:300},
        {$project:{alias:1,published:{name:'$published.name',castles:'$published.castles',buildings:'$published.buildings',
          at:'$published.at',preview:{$ifNull:['$published.preview',legacyPreview]}}}}
      ]).toArray();
    },
    economyCollection:()=>client?client.db(env.MONGODB_DATABASE||'reino_valdoria').collection('game_settings'):null,
    async close() { if (client) await client.close(); },
    async profile(db,token) { return db.findOne({key:digest(token),username:{$exists:false}}); },
    async sessionProfile(db,key) {
      return db.findOne({sessions:{$elemMatch:{key,expiresAt:{$gt:Date.now()}}}});
    },
    async revokeSession(db,key) { await db.updateOne({'sessions.key':key},{$pull:{sessions:{key}}}); },
    async startSession(db,id,session) {
      return db.findOneAndUpdate({_id:id},{$push:{sessions:{$each:[session],$slice:-12}}},{returnDocument:'after'});
    },
    async createAccount(db,{username,alias,password,session,legacyCode}) {
      const account = {username,alias,password,sessions:[session],key:digest(randomBytes(24).toString('hex'))};
      if (legacyCode) {
        return db.findOneAndUpdate({key:digest(legacyCode),username:{$exists:false}},[
          {$set:{...Object.fromEntries(Object.entries(account).map(([key,value])=>[key,{$literal:value}])),
            discoverable:{$ifNull:['$discoverable',{$ne:[{$type:'$published'},'missing']}]}}}
        ],{returnDocument:'after'});
      }
      const profile = {...account,_id:randomUUID(),revision:0,operations:[],discoverable:true};
      await db.insertOne(profile);
      return profile;
    },
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
      const update = await db.findOneAndUpdate({_id:profile._id,revision},[
        {$set:{state:{$literal:state},revision:next,updatedAt:Date.now(),
          operations:{$slice:[{$concatArrays:[{$ifNull:['$operations',[]]},[{id:operation,revision:next}]]},-32]},
          published:{$cond:[{$eq:['$discoverable',true]},{$literal:kingdomSnapshot(state)},'$published']}}}
      ],{returnDocument:'after',projection:{revision:1}});
      if (update) return {revision:update.revision};
      const latest = await db.findOne({_id:profile._id},{projection:{revision:1,operations:1}});
      const committed = latest.operations.find(record=>record.id===operation);
      return committed ? {revision:committed.revision,duplicate:true} : {conflict:latest.revision};
    }
  };
}


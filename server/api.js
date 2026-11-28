import { createEconomyStore } from './economy.js';
import { createStore, worldSummary } from './store.js';
import { validatedKingdom } from '../src/core/kingdom.js';
import { catalogue } from '../src/core/catalog.js';
import { castleTypes } from '../src/core/geometry.js';
import { isPerimeterPiece } from '../src/world/perimeter.js';

const tokenPattern = /^[a-f0-9]{48}$/;
const kingdomId = /^[a-f0-9-]{36}$/;
const MAX_BODY = 720_000;
const MAX_LIVE_ROOMS = 1500;

async function body(request) {
  let length = 0;
  const chunks = [];
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_BODY) throw Object.assign(new Error('Salvamento excede o limite.'),{status:413});
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Dados inválidos.'),{status:400}); }
}

function send(response,status,data) {
  response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  response.end(JSON.stringify(data));
}

export function createApi(env=process.env) {
  const store = createStore(env);
  const economy = createEconomyStore(env,store.economyCollection());
  const rooms = new Map();
  const prune = setInterval(()=>{
    const now=Date.now();
    for (const [id,room] of rooms) {
      for (const [player,presence] of room) if (now-presence.at>13000) room.delete(player);
      if (!room.size) rooms.delete(id);
    }
  },6000);
  prune.unref();
  const known = /^(?:\/health|\/profile|\/kingdom|\/world(?:\/[a-f0-9-]{36}(?:\/presence)?)?)$/;

  async function handle(request,response) {
    const path = new URL(request.url,'http://localhost').pathname.replace(/^\/api(?=\/)/,'');
    const method = request.method, token = request.headers.authorization?.replace(/^Bearer /,'') || '';
    if(path==='/economy'||path==='/admin/valdoria/economy'){
      try{
        const admin=path.startsWith('/admin/');
        if(admin&&!economy.configured)return send(response,503,{error:'Configure VALDORIA_ADMIN_TOKEN no servidor.'});
        if(admin&&!economy.authorized(token))return send(response,401,{error:'Token administrativo inválido.'});
        if(method==='GET')return send(response,200,await economy.read());
        if(admin&&method==='PUT'){
          const saved=await economy.save(await body(request));
          if(saved.invalid)return send(response,400,{error:'Revise os valores das regras da economia.'});
          if(saved.conflict)return send(response,409,{error:'As regras mudaram em outra sessão. Recarregue antes de salvar.'});
          return send(response,200,saved);
        }
        return send(response,405,{error:'Operação indisponível.'});
      }catch(error){
        if(error.name==='MongoServerSelectionError')return send(response,503,{error:'O MongoDB local está indisponível.'});
        return send(response,error.status||500,{error:error.status?error.message:'Falha ao acessar as regras da economia.'});
      }
    }
    if (!known.test(path)) return send(response,404,{error:'Rota indisponível.'});
    try {
      let db = await store.getCollection();
      if (path==='/health' && method==='GET') {
        if (db) {
          try { await db.findOne({}, {projection:{_id:1},maxTimeMS:1000}); }
          catch { db=null; }
        }
        return send(response,200,{online:Boolean(db),storage:db?'mongodb':'indexeddb'});
      }
      if (!db) return send(response,503,{error:'O mapa online está indisponível. Você pode continuar jogando neste navegador.'});
      if (path==='/world' && method==='GET') {
        const records = await db.find({published:{$exists:true}},{projection:{alias:1,'published.name':1,'published.castles':1,'published.buildings':1,'published.at':1}})
          .sort({'published.at':-1,_id:1}).limit(300).toArray();
        return send(response,200,{kingdoms:records.map(worldSummary)});
      }
      const [ , , id, presence ] = path.split('/');
      if (id && kingdomId.test(id) && !presence && method==='GET') {
        const found = await db.findOne({_id:id,published:{$exists:true}},{projection:{alias:1,published:1}});
        return found ? send(response,200,{kingdom:worldSummary(found),state:found.published.state}) :
          send(response,404,{error:'Este reino ainda não está publicado.'});
      }
      if (!tokenPattern.test(token)) return send(response,401,{error:'Entre com seu perfil.'});
      if (path==='/profile' && method==='POST') {
        const {alias} = await body(request) || {};
        if (typeof alias!=='string' || !/^[\p{L}\p{N}][\p{L}\p{N} .’-]{1,25}$/u.test(alias.trim())) {
          return send(response,400,{error:'Use de 2 a 26 caracteres no nome do jogador.'});
        }
        const profile = await store.register(db,token,alias.trim());
        return send(response,200,{id:profile._id,alias:profile.alias,revision:profile.revision,hasKingdom:Boolean(profile.state),published:Boolean(profile.published)});
      }
      const profile = await store.profile(db,token);
      if (!profile) return send(response,401,{error:'Perfil online indisponível.'});
      if (path==='/kingdom' && method==='GET') {
        return send(response,200,{state:profile.state || null,revision:profile.revision,id:profile._id,alias:profile.alias,published:Boolean(profile.published)});
      }
      if (path==='/kingdom' && method==='PUT') {
        const {state,revision,operation} = await body(request) || {};
        const valid = validatedKingdom(state);
        if (!valid || !Number.isSafeInteger(revision) || revision<0 ||
            typeof operation!=='string' || !/^[a-z0-9-]{12,48}$/.test(operation)) {
          return send(response,400,{error:'Salvamento inválido.'});
        }
        const result = await store.save(db,profile,valid,revision,operation);
        return send(response,Object.hasOwn(result,'conflict')?409:200,result);
      }
      if (path==='/world' && method==='POST') {
        const input = await body(request) || {};
        if (!profile.state) return send(response,409,{error:'Salve seu reino no servidor antes de publicar.'});
        if (input.revision!==profile.revision) return send(response,409,{error:'O reino mudou. Sincronize antes de publicar.'});
        const {name, objects} = profile.state;
        const castles = objects.filter(object=>!isPerimeterPiece(object) &&
          (castleTypes.has(object.type) || ['squareTower','roundTower'].includes(object.type))).length;
        const buildings = objects.filter(({type})=>['housing','trade','civic','castle'].includes(catalogue[type].category)).length;
        const published = {name,castles,buildings,at:Date.now(),state:profile.state};
        const saved = await db.findOneAndUpdate({_id:profile._id,revision:profile.revision},{$set:{published}},{returnDocument:'after'});
        return saved ? send(response,200,{kingdom:worldSummary(saved)}) : send(response,409,{error:'Sincronize o reino novamente.'});
      }
      if (path==='/world' && method==='DELETE') {
        await db.updateOne({_id:profile._id},{$unset:{published:1}});
        rooms.delete(profile._id);
        return send(response,200,{removed:true});
      }
      if (id && presence==='presence' && method==='POST') {
        const input = await body(request) ?? {};
        const {x,y,z,angle} = input;
        if (![x,y,z,angle].every(Number.isFinite) || Math.abs(x)>370 || Math.abs(z)>370 || y<-4 || y>200 || Math.abs(angle)>100) {
          return send(response,400,{error:'Posição inválida.'});
        }
        let room = rooms.get(id);
        if (!room) {
          if (!await db.findOne({_id:id,published:{$exists:true}},{projection:{_id:1}})) {
            return send(response,404,{error:'Este reino ainda não está publicado.'});
          }
          if (rooms.size>=MAX_LIVE_ROOMS) return send(response,503,{error:'Salas de visita lotadas.'});
          rooms.set(id,room=new Map());
        }
        if (room.size<80 || room.has(profile._id)) room.set(profile._id,{id:profile._id,alias:profile.alias,x,y,z,angle,at:Date.now()});
        return send(response,200,{players:[...room.values()].filter(({id,at})=>id!==profile._id && Date.now()-at<10000)});
      }
      return send(response,405,{error:'Operação indisponível.'});
    } catch (error) {
      if (response.headersSent) return response.end();
      const status = error.status || (String(error.name).startsWith('Mongo') ? 503 : 500);
      if (status===500) console.error(error);
      return send(response,status,{error:error.status?error.message:'Serviço de Valdória temporariamente indisponível.'});
    }
  }
  return {handle,close:async()=>{clearInterval(prune);await store.close();}};
}


import { createEconomyStore } from './economy.js';
import { createStore, kingdomSnapshot, worldSummary } from './store.js';
import { aliasPattern, credentials, matchesPassword, newSession, passwordRecord,
  publicAccount, readSession, sessionCookie, tokenPattern } from './accounts.js';
import { validatedKingdom } from '../src/core/kingdom.js';
import { findMission, missionProgress, missionStats, missionStatus } from '../src/core/missions.js';
import { npcSite, npcSites } from '../src/world/npc-sites.js';
import { npcKingdom } from '../src/world/npc-kingdom.js';

const kingdomId = /^(?:[a-f0-9-]{36}|npc-[a-z]+)$/;
const MAX_BODY = 720_000;
const MAX_LIVE_ROOMS = 1500;

async function body(request,limit=MAX_BODY) {
  let length = 0;
  const chunks = [];
  for await (const chunk of request) {
    length += chunk.length;
    if (length > limit) throw Object.assign(new Error('Os dados enviados excedem o limite.'),{status:413});
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
  const credentialAttempts = new Map();
  let hashJobs = 0;
  const prune = setInterval(()=>{
    const now=Date.now();
    for (const [address,attempt] of credentialAttempts) if (now>=attempt.until) credentialAttempts.delete(address);
    for (const [id,room] of rooms) {
      for (const [player,presence] of room) if (now-presence.at>13000) room.delete(player);
      if (!room.size) rooms.delete(id);
    }
  },6000);
  prune.unref();
  const known = /^(?:\/health|\/profile|\/auth\/(?:register|login|logout|session)|\/kingdom|\/progress|\/world(?:\/(?:[a-f0-9-]{36}|npc-[a-z]+)(?:\/presence)?)?)$/;

  async function authenticate(request,response,db,path) {
    const address = request.socket.remoteAddress;
    const now = Date.now();
    let attempt = credentialAttempts.get(address);
    if (!attempt || now>=attempt.until) credentialAttempts.set(address,attempt={until:now+60000,count:0});
    if (attempt.count>=12 || hashJobs>=3) return send(response,429,{error:'Muitas tentativas. Tente novamente em instantes.'});
    if (!/^application\/json\b/i.test(request.headers['content-type'] || '')) return send(response,415,{error:'Envie os dados de acesso como JSON.'});
    const input = await body(request,4096) || {};
    const {username,password} = credentials(input);
    if (attempt.count>=12 || hashJobs>=3) return send(response,429,{error:'Muitas tentativas. Tente novamente em instantes.'});
    attempt.count++;
    hashJobs++;
    try {
      const session = newSession();
      let profile;
      if (path==='/auth/register') {
        const legacyCode = input.legacyCode;
        const alias = typeof input.alias==='string' ? input.alias.trim() : '';
        if (!aliasPattern.test(alias)) return send(response,400,{error:'Use de 2 a 26 caracteres no nome do jogador.'});
        if (legacyCode && (typeof legacyCode!=='string' || !tokenPattern.test(legacyCode))) {
          return send(response,400,{error:'Use um código de acesso válido.'});
        }
        profile = await store.createAccount(db,{username,alias,password:await passwordRecord(password),session:session.record,legacyCode});
        if (!profile) return send(response,401,{error:'Código de acesso inválido ou já convertido em conta.'});
      } else {
        const account = await db.findOne({username},{projection:{password:1}});
        if (!await matchesPassword(password,account?.password)) return send(response,401,{error:'Usuário ou senha incorretos.'});
        profile = await store.startSession(db,account._id,session.record);
      }
      response.setHeader('Set-Cookie',sessionCookie(request,env,session.token));
      return send(response,path==='/auth/register'?201:200,{account:publicAccount(profile)});
    } catch(error) {
      if (error.code===11000) return send(response,409,{error:'Esse usuário já está em uso.'});
      throw error;
    } finally {
      hashJobs--;
    }
  }

  async function handle(request,response) {
    const path = new URL(request.url,'http://localhost').pathname.replace(/^\/api(?=\/)/,'');
    const method = request.method, token = request.headers.authorization?.replace(/^Bearer /,'') || '';
    const fetchSite = request.headers['sec-fetch-site'];
    if (method!=='GET' && fetchSite && !['same-origin','none'].includes(fetchSite)) {
      return send(response,403,{error:'Abra o jogo para realizar esta operação.'});
    }
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
      const [ , , id, presence ] = path.split('/');
      if (id?.startsWith('npc-') && !presence && method==='GET') {
        const found = npcKingdom(id);
        return found ? send(response,200,found) : send(response,404,{error:'Castelo de NPC não encontrado.'});
      }
      let db = await store.getCollection();
      if (path==='/health' && method==='GET') {
        if (db) {
          try { await db.findOne({}, {projection:{_id:1},maxTimeMS:1000}); }
          catch { db=null; }
        }
        return send(response,200,{online:Boolean(db),storage:db?'mongodb':'indexeddb'});
      }
      if (!db) return send(response,503,{error:'O mapa online está indisponível. Você pode continuar jogando neste navegador.'});
      if (method==='POST' && ['/auth/register','/auth/login'].includes(path)) return await authenticate(request,response,db,path);
      const sessionKey = readSession(request);
      if (path==='/auth/logout' && method==='POST') {
        if (sessionKey) await store.revokeSession(db,sessionKey);
        response.setHeader('Set-Cookie',sessionCookie(request,env));
        return send(response,200,{account:null});
      }
      if (path==='/world' && method==='GET') {
        const records = await store.world(db);
        return send(response,200,{kingdoms:[...records.map(worldSummary),...npcSites]});
      }
      if (id && kingdomId.test(id) && !presence && method==='GET') {
        const found = await db.findOne({_id:id,published:{$exists:true}},{projection:{alias:1,published:1}});
        return found ? send(response,200,{kingdom:worldSummary(found),state:found.published.state}) :
          send(response,404,{error:'Este reino ainda não está publicado.'});
      }
      if (path==='/profile' && method==='POST') {
        if (!tokenPattern.test(token)) return send(response,401,{error:'Entre com seu perfil.'});
        const {alias} = await body(request) || {};
        if (typeof alias!=='string' || !aliasPattern.test(alias.trim())) {
          return send(response,400,{error:'Use de 2 a 26 caracteres no nome do jogador.'});
        }
        const profile = await store.register(db,token,alias.trim());
        return send(response,200,publicAccount(profile));
      }
      const profile = (sessionKey && await store.sessionProfile(db,sessionKey)) ||
        (tokenPattern.test(token) ? await store.profile(db,token) : null);
      if (path==='/auth/session' && method==='GET') return send(response,200,{account:profile ? publicAccount(profile) : null});
      if (!profile) return send(response,401,{error:'Entre com seu perfil.'});
      const expectedAccount = request.headers['x-valdoria-account'];
      if (expectedAccount && expectedAccount!==profile._id) return send(response,401,{error:'A conta mudou em outra aba. Reabra o jogo.'});
      if(path==='/progress' && method==='GET')return send(response,200,{progress:missionProgress(profile.missions)});
      if(path==='/progress' && method==='POST'){
        const {id:missionId}=await body(request,4096) || {};
        const mission=findMission(missionId);
        if(!mission)return send(response,404,{error:'Missão indisponível.'});
        const progress=missionProgress(profile.missions);
        const {rules}=await economy.read();
        const status=missionStatus(mission,progress.completed,missionStats(profile.state,rules));
        if(status==='complete')return send(response,200,{progress,duplicate:true});
        if(status!=='ready')return send(response,409,{error:'Conclua os objetivos e as missões anteriores no Reino principal.'});
        const updated=await db.findOneAndUpdate({_id:profile._id,revision:profile.revision,missions:{$ne:mission.id}},
          {$addToSet:{missions:mission.id}},{returnDocument:'after',projection:{missions:1}});
        if(updated)return send(response,200,{progress:missionProgress(updated.missions)});
        const latest=await db.findOne({_id:profile._id},{projection:{missions:1}});
        const current=missionProgress(latest?.missions);
        if(current.completed.includes(mission.id))return send(response,200,{progress:current,duplicate:true});
        return send(response,409,{error:'O reino mudou durante o resgate. Sincronize e tente novamente.'});
      }
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
        const published = kingdomSnapshot(profile.state);
        const saved = await db.findOneAndUpdate({_id:profile._id,revision:profile.revision},{$set:{published,discoverable:true}},{returnDocument:'after'});
        return saved ? send(response,200,{kingdom:worldSummary(saved)}) : send(response,409,{error:'Sincronize o reino novamente.'});
      }
      if (path==='/world' && method==='DELETE') {
        await db.updateOne({_id:profile._id},{$unset:{published:1},$set:{discoverable:false}});
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
          if (!npcSite(id) && !await db.findOne({_id:id,published:{$exists:true}},{projection:{_id:1}})) {
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


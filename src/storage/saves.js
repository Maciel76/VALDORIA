import { createId, validatedKingdom } from '../core/kingdom.js';
import { makeKingdom } from '../world/demo.js';

const prefix = 'reino-valdoria';
const profileKey = prefix+'-profile';
let dbPromise;
const local = () => dbPromise ||= new Promise((resolve,reject)=>{
  const request = indexedDB.open(prefix+'-saves',1);
  request.onupgradeneeded = () => request.result.createObjectStore('kingdoms');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
async function access(mode, fn) {
  const db = await local();
  return new Promise((resolve,reject)=>{
    const transaction = db.transaction('kingdoms',mode);
    const request = fn(transaction.objectStore('kingdoms'));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}
export function profile() {
  try { return JSON.parse(localStorage.getItem(profileKey)); } catch { return null; }
}
export function setProfile(value) { localStorage.setItem(profileKey, JSON.stringify(value)); }
export async function request(path, {method='GET',payload,token=profile()?.token}={}) {
  const result = await fetch('/api'+path,{method,signal:AbortSignal.timeout(6000),headers:{
    ...(payload!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})
  },...(payload!==undefined?{body:JSON.stringify(payload)}:{})});
  const data = await result.json();
  if (!result.ok) throw Object.assign(new Error(data.error || 'Falha ao sincronizar.'),{status:result.status,data});
  return data;
}

export class SaveManager {
  slot = 'own';
  revision = 0;
  online = false;
  conflicted = false;
  current = null;
  queued = null;
  saving = null;
  sequence = 0;
  remoteProfile = null;

  constructor(status) { this.status = status; }

  async load(slot, kind='starter') {
    await this.saving;
    this.slot = slot;
    this.revision = 0;
    this.remoteProfile = null;
    this.conflicted = false;
    let saved;
    try { saved = await access('readonly',store=>store.get(slot)); }
    catch { this.status('Falha ao abrir IndexedDB.'); }
    this.current = validatedKingdom(saved?.state) ? saved : null;
    const account=profile();
    if (account && this.current?.profileId===account.id) {
      this.revision = this.current.revision || 0;
      this.remoteProfile = this.current.profileId;
    }
    return this.current?.state || makeKingdom(kind);
  }

  async connect() {
    try {
      this.online = (await request('/health')).online;
      if (!this.online) this.status('Salvo neste navegador');
    } catch { this.online=false;this.status('Salvo neste navegador'); }
    return this.online;
  }

  async prepareSync() {
    if (this.slot!=='own' || !profile()?.id) return null;
    await this.saving;
    const remote = await request('/kingdom');
    const hasSameIdentity = this.current?.profileId===profile().id;
    if (remote.state && (!hasSameIdentity || remote.revision!==this.revision)) {
      if (hasSameIdentity && this.current?.pending) {
        // Reuse the operation ID when the response to a previous write was lost.
        try {
          const result = await request('/kingdom',{method:'PUT',payload:{
            state:this.current.state,revision:this.revision,operation:this.current.pending
          }});
          if (result.duplicate && result.revision===remote.revision) {
            this.revision=result.revision;
            this.current={...this.current,revision:this.revision,pending:null};
            await this.write(this.current);
            this.status('Sincronizado');
            return null;
          }
        } catch { /* Preserve the two versions for the owner to choose. */ }
      }
      if (!this.current) { await this.useRemote(remote); return remote.state; }
      this.conflicted = true;
      this.status('Conflito de versões');
      return remote;
    }
    this.remoteProfile = remote.id;
    this.revision = remote.revision;
    return null;
  }

  async write(record,slot=this.slot) {
    try { await access('readwrite',store=>store.put(record,slot)); }
    catch (error) { throw Object.assign(error,{storageFailure:true}); }
  }

  async useRemote(remote) {
    if (this.current) await this.write(this.current,'backup');
    const valid = validatedKingdom(remote.state);
    if (!valid) throw new Error('A versão online é inválida.');
    this.revision = remote.revision;
    this.remoteProfile = remote.id;
    this.conflicted = false;
    this.current = {state:valid,revision:this.revision,profileId:remote.id,pending:null};
    await this.write(this.current);
    this.status('Sincronizado');
    return valid;
  }

  async useLocal(remote, state) {
    this.revision = remote.revision;
    this.remoteProfile = remote.id;
    this.conflicted = false;
    await this.save(state,{strict:true});
  }

  save(state,{strict=false}={}) {
    const version = ++this.sequence;
    this.queued = {state:structuredClone(state),version,slot:this.slot};
    this.saving ||= this.flush().finally(()=>{this.saving=null;});
    return this.saving.then(result=>{
      if (strict && (!result || this.conflicted || result.version<version)) throw new Error(this.conflicted?
        'Resolva o conflito de salvamento primeiro.':'Não foi possível salvar online.');
      return result;
    });
  }

  async flush() {
    let synced;
    while (this.queued) {
      const {state,version,slot} = this.queued;
      this.queued = null;
      const account=profile();
      const online = slot==='own' && this.online && account?.id && this.remoteProfile===account.id && !this.conflicted;
      const operation = createId();
      const sameState = this.current?.pending && JSON.stringify(this.current.state)===JSON.stringify(state);
      let record = {state,revision:this.revision,profileId:this.remoteProfile,pending:sameState?this.current.pending:operation};
      this.current = record;
      let stored = false;
      try {
        await this.write(record,slot);
        stored = true;
        this.status(this.conflicted?'Conflito de versões':online?'Salvando…':'Salvo neste navegador');
      } catch { this.status('O navegador não salvou o progresso.'); }
      if (!online) continue;
      try {
        const response = await request('/kingdom',{method:'PUT',payload:{state,revision:this.revision,operation:record.pending}});
        this.revision = response.revision;
        record = {...record,revision:this.revision,pending:null};
        this.current = record;
        this.status('Sincronizado');
        synced = {revision:this.revision,version};
        try { await this.write(record,slot); } catch { /* Cloud write has already succeeded. */ }
      } catch(error) {
        this.conflicted = error.status===409;
        this.status(this.conflicted?'Conflito de versões':stored?'Salvo neste navegador':'Não foi possível salvar.');
      }
    }
    return synced;
  }
}

export async function register(alias, existingToken) {
  const token = existingToken || createId()+createId();
  const result = await request('/profile',{method:'POST',payload:{alias},token});
  const account = {id:result.id,alias:result.alias,token};
  setProfile(account);
  return account;
}

export async function recoverProfile(code) {
  const token=code.toLowerCase().replace(/[\s-]/g,'');
  if(!/^[a-f0-9]{48}$/.test(token))throw new Error('O código de acesso tem 48 caracteres.');
  const result=await request('/kingdom',{token});
  const account={id:result.id,alias:result.alias,token};
  setProfile(account);
  return account;
}


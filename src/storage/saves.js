import { createId, validatedKingdom } from '../core/kingdom.js';
import { makeKingdom } from '../world/demo.js';
import { importKey, request } from './account.js';

const prefix = 'reino-valdoria';
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
const localKey = (slot,accountId) => accountId ? accountId+':'+slot : slot;

async function readSlot(slot, accountId) {
  let record;
  const importLocal = accountId && slot==='own' && sessionStorage.getItem(importKey)===accountId;
  await access('readwrite',store=>{
    const lookup = store.get(localKey(slot,accountId));
    lookup.onsuccess = () => {
      record = lookup.result;
      if (!accountId && record?.profileId) {
        const legacy = record;
        record = null;
        const destination = localKey(slot,legacy.profileId);
        const existing = store.get(destination);
        existing.onsuccess = () => {
          if (!existing.result) store.put(legacy,destination);
          store.delete(slot);
        };
      } else if (accountId && !record) {
        const lookupLegacy = store.get(slot);
        lookupLegacy.onsuccess = () => {
          const legacy = lookupLegacy.result;
          if (legacy && (legacy.profileId===accountId || (importLocal && !legacy.profileId))) {
            record = legacy;
            store.put(legacy,localKey(slot,accountId));
            store.delete(slot);
          }
        };
      }
    };
    return lookup;
  });
  if (importLocal) sessionStorage.removeItem(importKey);
  return record;
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
  account = null;

  constructor(status) { this.status = status; }

  async load(slot, kind='starter') {
    await this.saving;
    this.slot = slot;
    this.revision = 0;
    this.remoteProfile = null;
    this.conflicted = false;
    let saved;
    try { saved = await readSlot(slot,this.account?.id); }
    catch { this.status('Falha ao abrir IndexedDB.'); }
    const valid=validatedKingdom(saved?.state);
    this.current = valid ? {...saved,state:valid} : null;
    const account=this.account;
    if (account && this.current?.profileId===account.id) {
      this.revision = this.current.revision || 0;
      this.remoteProfile = this.current.profileId;
    }
    return this.current ? structuredClone(this.current.state) : makeKingdom(kind);
  }

  async connect() {
    try {
      this.online = (await request('/health')).online;
      if (!this.online) this.status('Salvo neste navegador');
    } catch { this.online=false;this.status('Salvo neste navegador'); }
    return this.online;
  }

  async prepareSync() {
    if (this.slot!=='own' || !this.account?.id) return null;
    await this.saving;
    const sequence = this.sequence;
    const remote = await request('/kingdom',{account:this.account});
    if (this.slot!=='own' || this.sequence!==sequence) return null;
    const hasSameIdentity = this.current?.profileId===this.account.id;
    if (remote.state && (!hasSameIdentity || remote.revision!==this.revision)) {
      if (hasSameIdentity && this.current?.pending) {
        // Reuse the operation ID when the response to a previous write was lost.
        try {
          const result = await request('/kingdom',{account:this.account,method:'PUT',payload:{
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
      if (!this.current || (hasSameIdentity && !this.current.pending)) return this.useRemote(remote,{backup:false});
      this.conflicted = true;
      this.status('Conflito de versões');
      return remote;
    }
    this.remoteProfile = remote.id;
    this.revision = remote.revision;
    return null;
  }

  async write(record,slot=this.slot) {
    try { await access('readwrite',store=>store.put(record,localKey(slot,this.account?.id))); }
    catch (error) { throw Object.assign(error,{storageFailure:true}); }
  }

  async useRemote(remote,{backup=true}={}) {
    const valid = validatedKingdom(remote.state);
    if (!valid) throw new Error('A versão online é inválida.');
    if (backup && this.current) await this.write(this.current,'backup');
    this.revision = remote.revision;
    this.remoteProfile = remote.id;
    this.conflicted = false;
    this.current = {state:valid,revision:this.revision,profileId:remote.id,pending:null};
    try {
      await this.write(this.current);
      this.status('Sincronizado');
    } catch { this.status('Não foi possível salvar a cópia neste navegador.'); }
    return structuredClone(valid);
  }

  async useLocal(remote, state) {
    this.revision = remote.revision;
    this.remoteProfile = remote.id;
    this.conflicted = false;
    if (this.current) this.current.pending = createId();
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
      const account=this.account;
      const online = slot==='own' && this.online && account?.id && this.remoteProfile===account.id && !this.conflicted;
      const operation = createId();
      const sameState = this.current && JSON.stringify(this.current.state)===JSON.stringify(state);
      if (sameState && !this.current.pending && (!online || this.current.profileId===account.id)) {
        if (online) {
          synced = {revision:this.revision,version};
          this.status('Sincronizado');
        }
        continue;
      }
      let record = {state,revision:this.revision,profileId:account?.id,
        pending:sameState && this.current.pending ? this.current.pending : operation};
      this.current = record;
      let stored = false;
      try {
        await this.write(record,slot);
        stored = true;
        this.status(this.conflicted?'Conflito de versões':online?'Salvando…':'Salvo neste navegador');
      } catch { this.status('O navegador não salvou o progresso.'); }
      if (!online) continue;
      try {
        const response = await request('/kingdom',{account,method:'PUT',payload:{state,revision:this.revision,operation:record.pending}});
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


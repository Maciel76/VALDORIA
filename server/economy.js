import { mkdir,readFile,rename,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { createHash,randomUUID,timingSafeEqual } from 'node:crypto';
import { defaultEconomyRules,validatedEconomyRules } from '../src/core/economy-rules.js';

const digest=value=>createHash('sha256').update(value).digest();

export function createEconomyStore(env,collection){
  const path=env.VALDORIA_ECONOMY_FILE?resolve(env.VALDORIA_ECONOMY_FILE):null;
  const id='valdoria-economy';
  const secret=env.VALDORIA_ADMIN_TOKEN;
  const expected=typeof secret==='string'&&secret.length>=24?digest(secret):null;
  const normalize=saved=>{
    if(!saved)return {revision:0,rules:defaultEconomyRules()};
    const rules=validatedEconomyRules(saved.rules);
    if(!rules||!Number.isSafeInteger(saved.revision)||saved.revision<1)throw new Error('Economia inválida.');
    return {revision:saved.revision,rules};
  };
  const read=async()=>{
    if(!path)return normalize(collection?await collection.findOne({_id:id}):null);
    try{
      return normalize(JSON.parse(await readFile(path,'utf8')));
    }catch(error){
      if(error.code!=='ENOENT')throw error;
      return normalize(null);
    }
  };
  let pending=Promise.resolve();
  return {
    configured:Boolean(expected),
    authorized:token=>Boolean(expected&&token&&timingSafeEqual(digest(token),expected)),
    read,
    save(payload){
      const rules=validatedEconomyRules(payload?.rules);
      if(!rules||!Number.isSafeInteger(payload?.revision)||payload.revision<0)return {invalid:true};
      const next={revision:payload.revision+1,rules};
      if(!path)return saveMongo(collection,id,payload.revision,next);
      const operation=pending.then(async()=>{
        const current=await read();
        if(payload.revision!==current.revision)return {conflict:true};
        await mkdir(dirname(path),{recursive:true});
        const temporary=path+'.'+randomUUID()+'.tmp';
        await writeFile(temporary,JSON.stringify(next,null,2)+'\n',{flag:'wx',mode:0o600});
        await rename(temporary,path);
        return next;
      });
      pending=operation.catch(()=>{});
      return operation;
    }
  };
}

async function saveMongo(collection,id,revision,next){
  if(!collection)throw Object.assign(new Error('O MongoDB está desativado.'),{status:503});
  if(revision===0){
    try{await collection.insertOne({_id:id,...next});}
    catch(error){if(error.code===11000)return {conflict:true};throw error;}
    return next;
  }
  const saved=await collection.updateOne({_id:id,revision},{$set:next});
  return saved.matchedCount?next:{conflict:true};
}

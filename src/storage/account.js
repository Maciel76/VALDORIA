const profileKey = 'reino-valdoria-profile';
export const importKey = 'reino-valdoria-import-account';

export function profile() {
  try { return JSON.parse(localStorage.getItem(profileKey)); } catch { return null; }
}

export function setProfile(value) {
  if (value) localStorage.setItem(profileKey,JSON.stringify(value));
  else localStorage.removeItem(profileKey);
}

export async function request(path,{method='GET',payload,account=profile()}={}) {
  const result = await fetch('/api'+path,{method,signal:AbortSignal.timeout(6000),headers:{
    ...(payload!==undefined?{'Content-Type':'application/json'}:{}),
    ...(account?.token?{Authorization:'Bearer '+account.token}:{}),
    ...(account?.id?{'X-Valdoria-Account':account.id}:{})
  },...(payload!==undefined?{body:JSON.stringify(payload)}:{})});
  const data = await result.json();
  if (!result.ok) throw Object.assign(new Error(data.error || 'Falha ao sincronizar.'),{status:result.status,data});
  return data;
}

export async function refreshAccount() {
  const cached = profile();
  const {account} = await request('/auth/session',{account:cached});
  if (account?.id===cached?.id && !account?.username && cached?.token) account.token=cached.token;
  setProfile(account);
  return account;
}

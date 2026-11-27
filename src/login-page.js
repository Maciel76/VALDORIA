import './ui/portals.css';
import { drawAtlas } from './ui/atlas-art.js';
import { importKey, profile, refreshAccount, request, setProfile } from './storage/account.js';

const form = document.querySelector('#auth-form');
const tabs = document.querySelector('#auth-tabs');
const session = document.querySelector('#session-panel');
const title = document.querySelector('#login-title');
const intro = document.querySelector('#login-intro');
const note = document.querySelector('#auth-message');
const guest = document.querySelector('#guest-link');
const logout = document.querySelector('#logout');
const backToMap = new URLSearchParams(location.search).get('voltar')==='mapa';
let mode = 'login', busy = false;

function message(text='') {
  note.textContent=text;
  note.hidden=!text;
}

function showMode(next) {
  mode=next;
  const register=mode==='register';
  form.hidden=tabs.hidden=guest.hidden=false;
  session.hidden=true;
  document.querySelector('#alias-field').hidden=document.querySelector('#register-options').hidden=!register;
  form.elements.alias.disabled=!register;
  form.elements.alias.required=register;
  form.elements.password.autocomplete=register?'new-password':'current-password';
  form.querySelector('[type="submit"]').textContent=register?'Criar minha conta':'Entrar';
  tabs.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===mode)));
  title.textContent=register?'Crie sua conta':'Conta do jogador';
  intro.textContent=register?'Seu Reino principal será salvo e aparecerá no mapa-múndi.':'Entre para continuar seu reino em qualquer navegador.';
  message();
}

function showSession(account) {
  form.hidden=tabs.hidden=guest.hidden=true;
  session.hidden=false;
  title.textContent=account.alias;
  intro.textContent='Você está conectado a Valdória.';
  const {level=1,xp=0}=account.progress ?? {};
  document.querySelector('#account-progress').textContent=`Nível ${level} · ${xp.toLocaleString('pt-BR')} XP`;
  const link=document.querySelector('#continue-link');
  link.href=backToMap?'/mapa.html':'/';
  link.textContent=backToMap?'Voltar ao mapa-múndi':'Continuar no meu reino';
  message();
}

function showLegacy(account) {
  showMode('register');
  form.elements.alias.value=account.alias;
  form.elements.legacyCode.value=account.token;
  form.elements.legacyCode.closest('details').open=true;
  form.elements.importRealm.checked=false;
  message('Crie um usuário e uma senha para continuar com seu perfil antigo.');
}

tabs.addEventListener('click',event=>{
  const button=event.target.closest('[data-mode]');
  if(button && !busy)showMode(button.dataset.mode);
});

form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(busy)return;
  busy=true;
  const submit=form.querySelector('[type="submit"]');
  submit.disabled=true;
  message();
  const fields=new FormData(form);
  const register=mode==='register';
  const payload={username:fields.get('username'),password:fields.get('password')};
  if(register){
    payload.alias=fields.get('alias');
    payload.legacyCode=fields.get('legacyCode').toLowerCase().replace(/[\s-]/g,'');
  }
  try {
    const {account}=await request('/auth/'+mode,{method:'POST',payload,account:null});
    setProfile(account);
    localStorage.setItem('reino-valdoria-slot','own');
    if(register && fields.has('importRealm'))sessionStorage.setItem(importKey,account.id);
    location.assign(backToMap && !register && account.hasKingdom ? '/mapa.html' : '/');
  } catch(error) {
    message(error.status ? error.message : 'Não foi possível acessar o servidor. Tente novamente.');
    submit.disabled=false;
    busy=false;
  }
});

logout.addEventListener('click',async ()=>{
  if(busy)return;
  busy=true;
  logout.disabled=true;
  try {
    await request('/auth/logout',{method:'POST'});
    setProfile(null);
    form.reset();
    showMode('login');
    message('Você saiu da conta.');
  } catch(error) {
    message(error.status ? error.message : 'Não foi possível sair da conta. Tente novamente.');
  } finally {
    logout.disabled=false;
    busy=false;
  }
});

async function initialize() {
  try {
    const account=await refreshAccount();
    if (busy) return;
    if(account?.token)showLegacy(account);
    else if(account)showSession(account);
  } catch {
    if (busy) return;
    const cached=profile();
    if(cached && !cached.token)showSession(cached);
    message('O servidor está indisponível. Você pode continuar jogando neste navegador.');
  }
}

drawAtlas(document.querySelector('#login-map'));
window.addEventListener('pagehide',()=>{form.elements.password.value='';});
window.addEventListener('pageshow',event=>{
  if(event.persisted){
    busy=false;
    form.querySelector('[type="submit"]').disabled=false;
    showMode('login');
    initialize();
  }
});
initialize();

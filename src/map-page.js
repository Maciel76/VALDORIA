import './ui/portals.css';
import { Atlas } from './ui/atlas.js';
import { profile, refreshAccount, request } from './storage/account.js';
import { npcSites } from './world/npc-sites.js';

const root=document.querySelector('#atlas');
const atlas=new Atlas(root);
const accountLink=document.querySelector('#map-account');
const refreshButton=document.querySelector('#refresh-map');
const note=document.querySelector('#atlas-message');
let account, refreshing=false, saving=false;

function message(text='') {
  note.textContent=text;
  note.hidden=!text;
}

async function refresh() {
  if(refreshing)return;
  refreshing=true;
  refreshButton.disabled=true;
  try {
    const [world,session]=await Promise.allSettled([request('/world',{account:null}),refreshAccount()]);
    const online=world.status==='fulfilled';
    account=session.status==='fulfilled'?session.value:profile();
    accountLink.textContent=account?.username?'Minha conta':account?.token?'Atualizar minha conta':'Entrar';
    atlas.update(online?world.value.kingdoms:npcSites,online,account,session.status==='fulfilled'&&online);
  } finally {
    refreshing=false;
    refreshButton.disabled=false;
  }
}

refreshButton.addEventListener('click',()=>{message();refresh();});
root.addEventListener('click',async event=>{
  const button=event.target.closest('button[data-visibility]');
  if(!button || !account || refreshing || saving)return;
  saving=true;
  button.disabled=true;
  message();
  const visible=button.dataset.visibility==='show';
  try {
    const current=await refreshAccount();
    if(current?.id!==account.id)throw new Error('A conta mudou. Atualize o mapa.');
    await request('/world',{account:current,method:visible?'POST':'DELETE',
      payload:visible?{revision:current.revision}:undefined});
    await refresh();
    message(visible?'Seu reino está visível no mapa.':'Seu reino foi ocultado do mapa.');
  } catch(error) {
    message(error.status || error.message==='A conta mudou. Atualize o mapa.' ? error.message : 'Não foi possível atualizar seu reino. Tente novamente.');
  } finally {
    button.disabled=false;
    saving=false;
  }
});

atlas.update(npcSites,null,profile(),false);
refresh();
setInterval(()=>{if(!document.hidden&&!saving)refresh();},20000);
window.addEventListener('pageshow',event=>{if(event.persisted)refresh();});

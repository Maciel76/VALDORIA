import { drawAtlas } from './atlas-art.js';
import { icon,refreshIcons } from './icons.js';
import { escapeHTML } from './hud.js';

const label = value => escapeHTML(value);
export class Atlas {
  constructor(dialog) {
    this.dialog=dialog;this.entries=[];this.selected=null;
    dialog.innerHTML=`<header class="atlas-heading">
      <div class="atlas-identity"><div class="heading-medallion">${icon('compass')}</div><div><p>Atlas de Valdória</p><h2 id="atlas-title">Mapa-múndi</h2></div></div>
      <button type="button" class="tool" data-action="close-atlas" aria-label="Fechar mapa-múndi" title="Fechar mapa-múndi">${icon('x')}</button>
      </header>
      <div class="atlas-content">
        <div class="atlas-map-wrap"><div class="atlas-map"><canvas aria-label="Mapa ilustrado do mundo de Valdória"></canvas><div class="map-markers" aria-label="Castelos no mapa"></div></div>
          <div class="map-key"><span>${icon('castle')} Castelo publicado</span><span><i class="key-dot"></i> Seu reino</span></div>
        </div>
        <aside class="atlas-directory"><div class="atlas-directory-heading"><h3>Reinos publicados</h3><span class="world-status"></span></div>
          <label class="search">${icon('search')}<input type="search" id="atlas-search" placeholder="Buscar reino ou jogador" aria-label="Buscar reino ou jogador"></label>
          <div class="atlas-list"></div>
          <div class="world-actions"></div>
        </aside>
      </div>`;
    this.directory=dialog.querySelector('.atlas-list');
    this.markers=dialog.querySelector('.map-markers');
    this.actions=dialog.querySelector('.world-actions');
    this.search=dialog.querySelector('input');
    this.canvas=dialog.querySelector('canvas');
    drawAtlas(this.canvas);
    this.search.addEventListener('input',()=>this.renderList());
  }
  open() {
    this.search.value='';
    this.selected=null;
    if(!this.dialog.open)this.dialog.showModal();
    refreshIcons();
  }
  update(entries,online,account,slot) {
    this.codeOpen=false;
    this.entries=entries||[];
    this.account=account;this.online=online;this.slot=slot;
    this.dialog.querySelector('.world-status').textContent=online?'Online':online===null?'Conectando…':'Local';
    this.dialog.querySelector('.world-status').dataset.online=String(online);
    this.renderList();
    this.actions.innerHTML=online?(account?
      `<div class="account-line">${icon('users-round')}<span>${label(account.alias)}</span></div>
      <button type="button" class="primary" data-action="publish" ${slot!=='own'?'disabled title="Abra o Reino principal para publicar"':''}>${icon('flag')}${this.entries.some(e=>e.id===account.id)?'Atualizar meu reino':'Publicar meu reino'}</button>
      <button type="button" class="link-button" data-action="access-code">Código de acesso</button>
      ${this.entries.some(e=>e.id===account.id)?`<button type="button" class="link-button" data-action="unpublish">Retirar do mapa</button>`:''}`:
      `<p>Crie seu perfil para publicar seu reino e encontrar outros jogadores durante as visitas.</p>
      <form id="profile-form"><label for="alias">Nome do jogador</label><div><input id="alias" name="alias" maxlength="26" minlength="2" required placeholder="Seu nome"><button class="primary" type="submit">Entrar</button></div></form>
      <button type="button" class="link-button" data-action="recover-code">Usar código de acesso</button>`):
      online===null?'':`<p>O servidor multiplayer está indisponível. Seu reino continua salvo neste navegador.</p>
      <button class="outlined" type="button" data-action="refresh-map">${icon('rotate-cw')} Tentar novamente</button>`;
    refreshIcons();
  }
  accessCode(token) {
    if(token){
      this.actions.innerHTML=`<p>Guarde este código para recuperar seu perfil em outro navegador.</p><input type="text" value="${label(token)}" readonly aria-label="Seu código de acesso"><button type="button" class="link-button" data-action="access-back">Voltar</button>`;
      this.actions.querySelector('input').select();
    }else{
      this.actions.innerHTML=`<form id="recover-form"><label for="recover">Código de acesso</label><div><input id="recover" name="code" type="password" maxlength="64" required autocomplete="off"><button class="primary" type="submit">Entrar</button></div></form><button type="button" class="link-button" data-action="access-back">Voltar</button>`;
      this.actions.querySelector('input').focus();
    }
    this.codeOpen=true;
  }
  focus(id) {
    this.selected=id;
    this.renderList(true);
    this.directory.querySelector('.realm-card.active')?.scrollIntoView({block:'nearest'});
  }
  renderList() {
    const query=this.search.value.trim().toLocaleLowerCase('pt-BR');
    const entries=this.entries.filter(e=>!query||[e.name,e.alias].some(v=>v.toLocaleLowerCase('pt-BR').includes(query)));
    if(!entries.length){
      this.directory.innerHTML=`<div class="atlas-empty">${icon('castle')}<p>${query?'Nenhum reino encontrado.':this.online===null?'Consultando o mapa…':
        this.online?'Nenhum reino foi publicado ainda.':'Conecte-se ao servidor para ver os castelos dos jogadores.'}</p></div>`;
    } else this.directory.innerHTML=entries.map(entry=>`<article class="realm-card ${entry.id===this.selected?'active':''}">
      <div class="realm-symbol">${icon(entry.castles?'castle':'flag')}</div>
      <div><strong>${label(entry.name)}</strong><small>${entry.id===this.account?.id?'Seu reino':label(entry.alias)} · ${entry.castles} ${entry.castles===1?'castelo':'castelos'}</small></div>
      <button class="tool" type="button" data-action="visit" data-value="${entry.id}" aria-label="Visitar ${label(entry.name)}" title="Visitar ${label(entry.name)}">${icon('external-link')}</button>
      </article>`).join('');
    this.markers.innerHTML=entries.map((entry,i)=>{
      const spatial=[...entries.slice(0,i)].filter(e=>Math.hypot(e.x-entry.x,e.y-entry.y)<.033).length;
      const ox=Math.min(5,spatial)*.011,oy=(spatial%3)*.008;
      return `<button type="button" data-action="focus-marker" data-value="${entry.id}" class="map-pin ${entry.id===this.account?.id?'mine':''} ${entry.id===this.selected?'active':''}" style="left:${(entry.x+ox)*100}%;top:${(entry.y+oy)*100}%"
        aria-label="${label(entry.name)}" title="${label(entry.name)}">${icon(entry.castles?'castle':'flag')}</button>`;
    }).join('');
    refreshIcons();
  }
}


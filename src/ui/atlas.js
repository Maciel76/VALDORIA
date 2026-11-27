import { drawAtlas } from './atlas-art.js';
import { escapeHTML } from './html.js';
import { icon, refreshIcons } from './icons.js';

const castleTypes = new Set(['stockade','keep','squareTower','roundTower']);
const searchText = text => text.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu,'');
const preview = type => castleTypes.has(type) ? `<img src="/castelos/${type}.webp" alt="" decoding="async">` : icon('flag');
const matches = (entry,query) => [entry.name,entry.alias].some(value=>searchText(value).includes(query));

export class Atlas {
  entries = [];
  filter = 'all';
  selected = new URLSearchParams(location.search).get('reino');
  account = null;

  constructor(root) {
    this.root=root;
    this.markers=root.querySelector('.map-markers');
    this.list=root.querySelector('.atlas-list');
    this.search=root.querySelector('#atlas-search');
    this.actions=root.querySelector('.world-actions');
    this.status=root.querySelector('#world-status');

    drawAtlas(root.querySelector('canvas'));
    root.querySelector('#refresh-map').innerHTML=icon('rotate-cw');
    this.search.addEventListener('input',()=>this.renderList());
    root.addEventListener('click',event=>{
      const filter=event.target.closest('button[data-kind]');
      const button=event.target.closest('button[data-focus]');
      if(filter){
        this.filter=filter.dataset.kind;
        root.querySelectorAll('button[data-kind]').forEach(button=>button.setAttribute('aria-pressed',String(button===filter)));
        this.renderList();
      } else if(button) {
        this.focus(button.dataset.focus,button.classList.contains('map-pin'));
      }
    });
  }

  update(entries,online,account,canManage) {
    const previous = this.account;
    const signature = JSON.stringify(entries.map(({updatedAt,...entry})=>entry));
    this.account=account;
    if (signature!==this.signature || online!==this.online || previous?.id!==account?.id) {
      this.entries=entries;
      this.signature=signature;
      this.online=online;
      this.status.dataset.online=online===null?'loading':String(online);
      this.status.textContent=online===null?'Carregando mapa':online?'Mapa online':'Mapa local';
      this.renderList();
    }
    const actionSignature=JSON.stringify([account?.id,account?.hasKingdom,account?.published,online,canManage]);
    if(actionSignature!==this.actionSignature){
      this.actionSignature=actionSignature;
      this.actions.innerHTML=!online && online!==null?'<p>O servidor está indisponível. Os castelos de NPC continuam abertos para visitas.</p>':
        canManage&&account?.hasKingdom ? `<button class="portal-button" type="button" data-visibility="${account.published?'hide':'show'}">${account.published?'Ocultar meu reino':'Mostrar meu reino'}</button>`:
        account ? '<a class="portal-button" href="/">Abrir meu reino</a>' :
        canManage ? '<a class="portal-button" href="/login.html?voltar=mapa">Entrar para colocar meu reino no mapa</a>' : '';
    }
    refreshIcons();
  }

  focus(id, scroll=false) {
    this.selected=id;
    this.root.querySelectorAll('[data-focus]').forEach(button=>{
      button.setAttribute('aria-pressed',String(button.dataset.focus===id));
    });
    this.list.querySelectorAll('.realm-card').forEach(card=>card.classList.toggle('active',card.dataset.realm===id));
    if(scroll)this.list.querySelector('.realm-card.active')?.scrollIntoView({block:'nearest'});
  }

  renderList() {
    const query=searchText(this.search.value.trim());
    const rows=this.entries.filter(entry=>(this.filter==='all'||entry.kind===this.filter)&&matches(entry,query));
    const activeButton=document.activeElement;
    const retained=activeButton?.dataset.focus;
    const fromMap=activeButton?.classList.contains('map-pin');
    this.list.innerHTML=rows.length ? rows.map(entry=>{
      const id=escapeHTML(entry.id);
      const name=escapeHTML(entry.name);
      const owner=entry.id===this.account?.id?'Meu reino':entry.kind==='npc'?'NPC · '+escapeHTML(entry.alias):escapeHTML(entry.alias);
      return `<article class="realm-card" data-realm="${id}">
        <button class="realm-select" type="button" data-focus="${id}">
          <span class="realm-thumb ${entry.kind==='npc'?'npc':''}">${preview(entry.preview)}</span>
          <span><strong>${name}</strong><small>${owner}</small></span>
        </button>
        <a class="portal-button visit-link" href="/?visita=${encodeURIComponent(entry.id)}" aria-label="Visitar ${name}" title="Visitar ${name}">${icon('external-link')}</a>
      </article>`;
    }).join('') : `<p class="atlas-empty">${query?'Nenhum reino encontrado.':this.filter==='player'?
      (this.online?'Nenhum jogador no mapa.':'Os reinos dos jogadores precisam do servidor online.'):'Nenhum reino encontrado.'}</p>`;

    this.markers.innerHTML=rows.map(entry=>{
      const type=entry.id===this.account?.id?'mine':entry.kind==='npc'?'npc':'player';
      const name=escapeHTML(entry.name);
      return `<button type="button" data-focus="${escapeHTML(entry.id)}" class="map-pin ${type}"
        style="left:${entry.x*100}%;top:${entry.y*100}%" aria-label="${name}" title="${name}">
        ${preview(entry.preview)}<span class="pin-name" aria-hidden="true">${name}</span>
      </button>`;
    }).join('');
    this.focus(this.selected);
    if(retained) {
      const container=fromMap?this.markers:this.list;
      [...container.querySelectorAll('[data-focus]')].find(button=>button.dataset.focus===retained)?.focus({preventScroll:true});
    }
    refreshIcons();
  }
}

import { catalogue,categories } from '../core/catalog.js';
import { economy, expansionCost, HARVEST_MS, times } from '../core/kingdom.js';
import { gates } from '../core/geometry.js';
import { bounds, directions, LIMIT } from '../world/terrain-data.js';
import { icon,refreshIcons } from './icons.js';
import { drawMinimap } from './atlas-art.js';
import { fillThumbnails } from './previews.js';

const fmt = new Intl.NumberFormat('pt-BR');
const timeOptions = [['morning','Manhã','cloud-sun'],['noon','Meio-dia','sun'],['sunset','Entardecer','sunset'],['night','Noite','moon']];
const names={north:'Norte',east:'Leste',south:'Sul',west:'Oeste'};
const button = (action, name, symbol, options='')=>`<button type="button" data-action="${action}" ${options}>${icon(symbol)}<span>${name}</span></button>`;
const tool = (action,name,symbol)=>button(action,name,symbol,`class="tool" aria-label="${name}" title="${name}"`);
const stat = (symbol,id,label)=>`<div class="stat">${icon(symbol)}<div><strong id="${id}">—</strong><small>${label}</small></div></div>`;
export const escapeHTML = value => String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);

export class HUD {
  constructor(root) {
    this.root=root;
    this.category='housing';
    this.item=null;
    this.saveStatus='Abrindo reino…';
    root.innerHTML=`
      <main id="game" aria-label="Reino de Valdória">
        <div id="world" class="world"></div>
        <div class="world-vignette"></div>
        <div class="stats dark" aria-label="Economia do reino">
          ${stat('coins','gold','Ouro')}${stat('users-round','people','Moradores')}${stat('hammer','jobs','Empregos')}
          <div class="stat tax">${icon('coins')}<div><strong id="income">—</strong><small id="tax-time">Arrecadação</small><div class="tax-track"><i id="tax-progress"></i></div></div></div>
        </div>
        <div class="game-tools" aria-label="Ajustes do jogo">
          ${tool('time','Alterar horário','cloud-sun')}
          <button type="button" class="tool save-state" data-action="settings" aria-label="Configurações" title="Configurações">${icon('settings-2')}<i class="status-dot" aria-hidden="true"></i></button>
        </div>
        <dialog class="paper catalogue" id="catalogue" aria-labelledby="catalogue-title">
          <div class="pane-heading"><div class="heading-medallion">${icon('hammer')}</div><h2 id="catalogue-title">Construir</h2>${tool('catalogue','Fechar catálogo','x')}</div>
          <div class="category-tabs" role="group" aria-label="Categorias">
            ${categories.map(category=>`<button type="button" data-category="${category.id}" title="${category.name}" aria-label="${category.name}" aria-pressed="false">${icon(category.icon)}</button>`).join('')}
          </div>
          <div class="category-heading"><h3 id="category-name"></h3><span id="category-total"></span></div>
          <div id="shop-items" class="shop-items"></div>
          <div id="item-detail" class="item-detail"></div>
        </dialog>
        <aside id="selection" class="paper selection" aria-label="Construção selecionada" hidden></aside>
        <div class="map-inset" aria-label="Navegação do território">
          <div class="compass-rose" aria-hidden="true"><span>N</span><b>✦</b></div>
          <div class="map-mini"><canvas id="minimap" width="192" height="138" aria-label="Minimapa do território"></canvas>
            <button type="button" data-action="map" title="Abrir mapa-múndi">${icon('map')}<span>Mapa-múndi</span>${icon('chevron-right')}</button>
          </div>
        </div>
        <div class="camera-tools" aria-label="Zoom da câmera">
          ${tool('zoom-in','Aproximar','plus')}${tool('zoom-out','Afastar','minus')}${tool('overview','Visão geral','crosshair')}${tool('focus-castle','Enquadrar castelo','castle')}
        </div>
        <div class="crosshair" id="crosshair" hidden></div>
        <div id="touch-walk" class="touch-walk" aria-label="Controle de caminhada" hidden>
          ${button('walk-up','Frente','arrow-up','aria-label="Frente"')}${button('walk-left','Esquerda','arrow-left','aria-label="Esquerda"')}
          ${button('walk-down','Trás','arrow-down','aria-label="Trás"')}${button('walk-right','Direita','arrow-right','aria-label="Direita"')}
        </div>
        <section class="placement dark" id="placement" hidden aria-label="Posicionamento"></section>
        <footer class="dock" aria-label="Ferramentas do reino">
          ${button('catalogue','Construir','hammer','class="dock-button" aria-haspopup="dialog" aria-controls="catalogue" aria-expanded="false"')}
          ${button('map','Mapa-múndi','map','class="dock-button world-button"')}
          ${button('walk','Explorar','person-standing','class="dock-button" aria-pressed="false"')}
          ${button('territory','Território','expand','class="dock-button"')}
          <i class="dock-divider"></i>
          ${button('undo','Desfazer','rotate-ccw','class="dock-button undo-button" disabled')}
        </footer>
        <button type="button" data-action="help" class="help-button" aria-label="Controles do jogo" title="Controles do jogo">${icon('circle-help')}<span>Controles</span></button>
        <div id="visit" class="visit dark" hidden></div>
        <div id="toast" class="toast dark" role="status" aria-live="polite" hidden></div>
        <dialog id="panel" class="paper modal" aria-labelledby="panel-title"></dialog>
        <dialog id="atlas" class="paper atlas" aria-labelledby="atlas-title"></dialog>
      </main>`;
    this.shop=root.querySelector('#shop-items');
    this.catalogue=root.querySelector('#catalogue');
    this.catalogueButton=root.querySelector('.dock [data-action="catalogue"]');
    this.catalogue.addEventListener('close',()=>{
      this.catalogueButton.setAttribute('aria-expanded',String(this.catalogue.open));
    });
    this.items=root.querySelector('#item-detail');
    this.popup=root.querySelector('#panel');
    this.placement=root.querySelector('#placement');
    this.selection=root.querySelector('#selection');
    this.toastView=root.querySelector('#toast');
    this.visit=root.querySelector('#visit');
    this.renderCategory();
    refreshIcons();
  }
  bind(handle) {
    this.root.addEventListener('click',event=>{
      const target=event.target.closest('button[data-action],button[data-category],button[data-item]');
      if(!target || target.disabled)return;
      if(target.dataset.category){this.category=target.dataset.category;this.renderCategory();return;}
      if(target.dataset.item){
        this.item=target.dataset.item;
        this.markItem();
        handle('item',this.item,event);
        return;
      }
      handle(target.dataset.action,target.dataset.value,event);
    });
  }
  renderCategory() {
    const { name }=categories.find(category=>category.id===this.category);
    const matches=Object.values(catalogue).filter(item=>item.category===this.category);
    this.root.querySelector('#category-name').textContent=name;
    this.root.querySelector('#category-total').textContent=`${matches.length} ${matches.length===1?'peça':'peças'}`;
    this.catalogue.querySelectorAll('[data-category]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.category===this.category));
    this.shop.innerHTML=matches.map(item=>`<button class="item-card" type="button" data-item="${item.id}" aria-pressed="false" title="${item.description}">
      <span class="item-figure">${icon(categories.find(c=>c.id===this.category).icon)}<img data-model="${item.id}" alt=""></span>
      <span class="item-copy"><strong>${item.name}</strong><small>${icon('coins')}${fmt.format(item.price)}</small></span>
      </button>`).join('');
    this.shop.scrollTop=0;
    this.markItem();
    fillThumbnails(this.shop);
  }
  markItem() {
    this.shop.querySelectorAll('[data-item]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.item===this.item));
    this.renderDetail();
    refreshIcons();
  }
  renderDetail() {
    const item=catalogue[this.item];
    if(!item || item.category!==this.category){
      this.items.hidden=true;
      return;
    }
    this.items.hidden=false;
    this.items.innerHTML=`<p>${item.description}</p><div><span>${icon('expand')}${fmt.format(item.w)} × ${fmt.format(item.d)} m</span>
      ${item.homes?`<span>${icon('users-round')}${item.homes} moradores</span>`:''}
      ${item.jobs?`<span>${icon('hammer')}${item.jobs} empregos</span>`:''}</div>`;
  }
  toggleCatalogue(open=!this.catalogue.open) {
    if(open===this.catalogue.open)return;
    if(open)this.catalogue.showModal();
    else this.catalogue.close();
    this.catalogueButton.setAttribute('aria-expanded',String(open));
  }
  saved(status) {
    this.saveStatus=status;
    const button=this.root.querySelector('.save-state');
    button.title=`Configurações · ${status}`;
    button.dataset.status=status==='Sincronizado'?'online':status.includes('Conflito')||status.includes('Falha')?'problem':'local';
    const statusLine=this.popup.querySelector('#save-status');
    if(statusLine)statusLine.textContent=status;
  }
  state(state,undo,position,guest) {
    const report=economy(state);
    this.root.querySelector('#gold').textContent=fmt.format(state.gold);
    this.root.querySelector('#people').textContent=fmt.format(report.homes);
    this.root.querySelector('#jobs').textContent=fmt.format(report.jobs);
    this.root.querySelector('#jobs').title=`${report.filled} postos ocupados`;
    this.root.querySelector('#income').textContent='+'+fmt.format(report.income);
    this.root.querySelector('.undo-button').disabled=!undo||Boolean(guest);
    this.root.querySelectorAll('[data-action="catalogue"],[data-action="territory"]').forEach(x=>x.disabled=Boolean(guest));
    this.root.querySelector('#game').classList.toggle('visiting',Boolean(guest));
    const period=timeOptions.find(([id])=>id===state.time);
    const byTime=this.root.querySelector('.game-tools [data-action="time"]');
    if(byTime.dataset.period!==state.time){
      byTime.dataset.period=state.time;
      byTime.innerHTML=icon(period[2])+`<span>${period[1]}</span>`;
      byTime.setAttribute('title',period[1]);
      refreshIcons();
    }
    drawMinimap(this.root.querySelector('#minimap'),state,position);
  }
  tax(state) {
    const seconds=Math.max(0,Math.ceil((state.nextTaxAt-Date.now())/1000));
    this.root.querySelector('#tax-time').textContent=`Arrecadação em ${seconds}s`;
    this.root.querySelector('#tax-progress').style.width=(1-Math.min(1,seconds*1000/HARVEST_MS))*100+'%';
  }
  camera(mode) {
    const walk=mode==='walk';
    this.root.querySelector('.dock [data-action=walk]').setAttribute('aria-pressed',String(walk));
    this.root.querySelector('#crosshair').hidden=!walk;
    this.root.querySelector('#touch-walk').hidden=!walk;
    this.root.querySelector('#game').classList.toggle('walking',walk);
  }
  showPlacement(entry,details) {
    this.placement.hidden=!entry;
    if(!entry)return;
    const item=catalogue[entry.type];
    const hasReason=Boolean(details.reason);
    const instruction=entry.line
      ? (entry.anchor?'Clique ou toque no fim da linha':'Clique ou toque no início da linha')
      : `Clique ou toque no terreno para ${entry.move?'mover':'construir'}`;
    this.placement.innerHTML=`<div class="placement-title">${icon('hammer')}<div><strong>${entry.move?'Mover ':'Construir '}${item.name}</strong>
      <small class="${hasReason?'problem':''}">${details.reason || instruction}</small></div></div>
      <span class="price">${icon('coins')}${fmt.format(entry.move?0:details.cost)}</span>
      <div class="placement-tools">
      ${tool('rotate','Girar prévia','rotate-cw')}
      ${item.line&&!entry.move?button('line','Linha','route',`class="tool" aria-label="Modo linha" aria-pressed="${entry.line}" title="Traçar linha"`):''}
      ${!entry.move?button('repeat','Repetir','layers',`class="tool" aria-label="Repetir construção" aria-pressed="${entry.repeat}" title="Manter peça selecionada"`):''}
      ${tool('cancel','Cancelar colocação','x')}
      </div>`;
    refreshIcons();
  }
  showSelection(object) {
    this.selection.hidden=!object;
    if(!object)return;
    const item=catalogue[object.type];
    this.selection.innerHTML=`<div><small>Selecionado</small><h3>${item.name}</h3></div><div class="selection-tools">
      ${gates.has(object.type)?button('gate',object.open?'Fechar portão':'Abrir portão','door-open','class="gate-button"'):''}
      ${tool('move','Mover construção','move')}${tool('rotate-object','Girar construção','rotate-cw')}
      ${tool('delete','Excluir construção','trash-2')}${tool('clear-selection','Limpar seleção','x')}</div>`;
    refreshIcons();
  }
  notify(message) {
    this.toastView.textContent=message;
    this.toastView.hidden=false;
    clearTimeout(this.toastTimer);
    this.toastTimer=setTimeout(()=>{this.toastView.hidden=true;},3300);
  }
  modal(title,content,dialogClass='') {
    this.popup.className='paper modal '+dialogClass;
    this.popup.innerHTML=`<div class="modal-heading"><h2 id="panel-title">${title}</h2>${tool('close','Fechar painel','x')}</div>${content}`;
    if(!this.popup.open)this.popup.showModal();
    refreshIcons();
  }
  showTime(active) {
    this.modal('Horário do reino',`<div class="option-grid">${timeOptions.filter(([id])=>times.includes(id)).map(([id,name,ico])=>
      button('set-time',name,ico,`data-value="${id}" class="${id===active?'current':''}"`)).join('')}</div>`);
  }
  showTerritory(state) {
    const edge=bounds(state.territory);
    this.modal('Expandir território',`<p class="modal-intro">Seu território mede <strong>${edge.maxX-edge.minX} × ${edge.maxZ-edge.minZ} m</strong>. Cada expansão acrescenta uma faixa de terreno plano de 36 m.</p>
      <div class="option-grid">${directions.map(direction=>{
        const cost=expansionCost(state,direction);
        return `<button type="button" data-action="expand" data-value="${direction}" ${state.territory[direction]>=LIMIT?'disabled':''}>
          ${icon('arrow-'+{north:'up',east:'right',south:'down',west:'left'}[direction])}
          <span>${names[direction]}<small>${state.territory[direction]>=LIMIT?'Limite atingido':fmt.format(cost)+' ouro'}</small></span></button>`;
      }).join('')}</div>`);
  }
  showSettings(state,slot,localProfile,online,conflicted) {
    this.modal('Configurações',`<form id="settings-form" class="settings-form"><label>Nome do reino<input name="realm" required maxlength="38" value="${escapeHTML(state.name)}"></label>
      <label>Qualidade gráfica<select name="quality"><option value="low" ${state.quality==='low'?'selected':''}>Leve</option><option value="standard" ${state.quality==='standard'?'selected':''}>Padrão</option><option value="high" ${state.quality==='high'?'selected':''}>Alta</option></select></label>
      <label class="toggle"><input name="sound" type="checkbox" ${state.sound?'checked':''}> Som ambiente</label>
      <button class="primary" type="submit">Aplicar</button></form>
      <div class="settings-section"><h3>Salvamento</h3><p id="save-status">${escapeHTML(this.saveStatus)}</p><p>${online&&localProfile?'O Reino principal é salvo no servidor quando sincronizado, com uma cópia neste navegador.':'O progresso fica no IndexedDB deste navegador. Crie um perfil no mapa-múndi para sincronizar quando o servidor estiver disponível.'}</p>
      ${conflicted?button('resolve','Resolver conflito','lock-keyhole','class="outlined"'):''}
      ${button('save','Salvar agora','save','class="outlined"')}
      ${button('saves','Trocar reino','layers','class="outlined"')}
      </div>`);
  }
  showSlots(current) {
    this.modal('Seus reinos',`<div class="save-list">${[['own','Reino principal','Seu reino para publicar no mapa-múndi.'],
      ['empty','Terreno vazio','Um salvamento independente para começar com 5.000 moedas.'],
      ['demo','Cidade demonstrativa','Explore o Domínio do Alvorecer em um salvamento separado.'],
      ['backup','Cópia de conflito','Recupere a cópia local de uma versão substituída.']].map(([slot,name,detail])=>
      `<button type="button" data-action="slot" data-value="${slot}" class="${current===slot?'current':''}">${icon(slot==='own'?'castle':slot==='demo'?'landmark':slot==='backup'?'save':'tree-pine')}<span><strong>${name}</strong><small>${detail}</small></span>${icon('chevron-right')}</button>`).join('')}</div>`);
  }
  showHelp() {
    this.modal('Controles do jogo',`<dl class="help-content">
      <dt>Vista aérea</dt><dd>Arraste para girar. Use o botão direito para deslocar e a roda para aproximar.</dd>
      <dt>Exploração</dt><dd>Use WASD ou as setas. Arraste para olhar ou pressione J para capturar o mouse. Use E próximo a um portão.</dd>
      <dt>Construção</dt><dd>Escolha uma peça em Construir e clique ou toque no terreno para colocá-la. R gira, Shift + R gira no sentido contrário, Enter confirma e Esc cancela. Use as setas para ajustar a prévia.</dd>
      <dt>Edição</dt><dd>Selecione uma peça, use Mover e clique ou toque em uma área livre. Delete exclui e Ctrl + Z desfaz. Mover e girar são gratuitos.</dd>
      <dt>Modo linha</dt><dd>Escolha um caminho ou muralha, ative Linha e marque o início e o fim no terreno. A linha inteira é desfeita em uma ação.</dd>
      <dt>Celular</dt><dd>Arraste o cenário com um dedo. Use dois dedos para deslocar ou aproximar.</dd>
      </dl><div class="modal-actions">${button('free','Câmera livre','compass','class="outlined"')}${button('overview','Visão geral','crosshair','class="outlined"')}</div>`);
  }
  showVisit(guest,count=0) {
    this.visit.hidden=!guest;
    if(!guest)return;
    this.visit.innerHTML=`<div><strong>${escapeHTML(guest.name)}</strong><small>Reino de ${escapeHTML(guest.alias)}${count?` · ${count} ${count===1?'visitante':'visitantes'}`:''}</small></div>${button('leave','Voltar ao meu reino','log-out','class="compact"')}`;
    refreshIcons();
  }
}


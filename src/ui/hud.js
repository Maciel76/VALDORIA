import { catalogue,categories } from '../core/catalog.js';
import { economy, expansionCost, HARVEST_MS, times } from '../core/kingdom.js';
import { gates } from '../core/geometry.js';
import {
  fortificationRole,fortificationLevel,fortificationUpgradeCost,
  isFixedFortification,isVillageGate,isVillageWall,villageGateNames
} from '../core/fortifications.js';
import { BAND, bounds, directions, expansionOptions, LIMIT } from '../world/terrain-data.js';
import { LOT_SIZE,usesLots } from '../world/lots.js';
import { icon,refreshIcons } from './icons.js';
import { drawMinimap } from './atlas-art.js';
import { fillThumbnails } from './previews.js';

const fmt = new Intl.NumberFormat('pt-BR');
const clamp = (value,min,max)=>Math.max(min,Math.min(max,value));
const timeOptions = [['morning','Manhã','cloud-sun'],['noon','Meio-dia','sun'],['sunset','Entardecer','sunset'],['night','Noite','moon']];
const names={north:'Norte',east:'Leste',south:'Sul',west:'Oeste'};
const button = (action, name, symbol, options='')=>`<button type="button" data-action="${action}" ${options}>${icon(symbol)}<span>${name}</span></button>`;
const tool = (action,name,symbol,options='')=>button(action,name,symbol,`class="tool" aria-label="${name}" title="${name}" ${options}`);
const stat = (symbol,id,label)=>`<div class="stat">${icon(symbol)}<div><strong id="${id}">—</strong><small>${label}</small></div></div>`;
export const escapeHTML = value => String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);

export class HUD {
  constructor(root) {
    this.root=root;
    this.category='housing';
    this.item=null;
    this.hasVillageWall=false;
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
          <div class="pane-heading"><div class="heading-medallion">${icon('hammer')}</div><h2 id="catalogue-title">Construir</h2>
            ${button('mark-clearing','Limpar área','pickaxe','class="gate-button compact clear-entry"')}${tool('catalogue','Fechar catálogo','x')}</div>
          <div class="category-tabs" role="group" aria-label="Categorias">
            ${categories.map(category=>`<button type="button" data-category="${category.id}" title="${category.name}" aria-label="${category.name}" aria-pressed="false">${icon(category.icon)}</button>`).join('')}
          </div>
          <div class="category-heading"><h3 id="category-name"></h3><span id="category-total"></span></div>
          <div id="shop-items" class="shop-items"></div>
          <div id="item-detail" class="item-detail"></div>
        </dialog>
        <div id="selection" class="selection" role="group" hidden></div>
        <div class="map-inset" aria-label="Navegação do território">
          <div class="compass-rose" aria-hidden="true"><span>N</span><b>✦</b></div>
          <div class="map-mini"><canvas id="minimap" width="192" height="138" aria-label="Minimapa do território"></canvas>
            <button type="button" data-action="map" title="Abrir mapa-múndi">${icon('map')}<span>Mapa-múndi</span>${icon('chevron-right')}</button>
          </div>
        </div>
        <div class="camera-tools" aria-label="Zoom da câmera">
          ${tool('zoom-in','Aproximar','plus')}${tool('zoom-out','Afastar','minus')}${tool('overview','Visão geral','crosshair')}${tool('focus-castle','Enquadrar castelo','castle')}
          ${button('fortifications','Fortificações da vila','brick-wall','class="tool" aria-label="Fortificações da vila" title="Fortificações da vila" hidden')}
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
    this.popup.addEventListener('change',event=>{
      if(event.target.id==='expansion-lot')handle('preview-expansion',event.target.value,event);
    });
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
    const matches=Object.values(catalogue).filter(item=>item.category===this.category&&item.purchasable);
    this.root.querySelector('#category-name').textContent=name;
    this.root.querySelector('#category-total').textContent=`${matches.length} ${matches.length===1?'peça':'peças'}`;
    this.catalogue.querySelectorAll('[data-category]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.category===this.category));
    this.shop.innerHTML=matches.map(item=>{
      const perimeter=item.id==='villageWall';
      const owned=perimeter&&this.hasVillageWall;
      return `<button class="item-card" type="button" data-item="${item.id}" aria-pressed="false" title="${item.description}" ${owned?'disabled':''}>
        <span class="item-figure">${icon(categories.find(c=>c.id===this.category).icon)}<img data-model="${perimeter?'palisade':item.id}" alt=""></span>
        <span class="item-copy"><strong>${item.name}</strong><small>${owned?'Já construída':icon('coins')+fmt.format(item.price)}</small></span>
        </button>`;
    }).join('');
    this.shop.scrollTop=0;
    this.markItem();
    if(this.catalogue.open)fillThumbnails(this.shop);
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
    const size=item.id==='villageWall'?'Todo o território':`${fmt.format(item.w)} × ${fmt.format(item.d)} m`;
    this.items.innerHTML=`<p>${item.description}</p><div><span>${icon('expand')}${size}</span>
      ${item.homes?`<span>${icon('users-round')}${item.homes} moradores</span>`:''}
      ${item.jobs?`<span>${icon('hammer')}${item.jobs} empregos</span>`:''}</div>`;
  }
  toggleCatalogue(open=!this.catalogue.open) {
    if(open===this.catalogue.open)return;
    if(open){
      this.catalogue.showModal();
      fillThumbnails(this.shop);
    }
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
    const hasVillageWall=state.objects.some(isVillageWall);
    this.root.querySelector('[data-action="fortifications"]').hidden=Boolean(guest)||!hasVillageWall;
    if(this.hasVillageWall!==hasVillageWall){
      this.hasVillageWall=hasVillageWall;
      if(this.category==='walls')this.renderCategory();
    }
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
      ${entry.hold&&details.clearPlots.length?button('clear-landscape','Limpar terreno','pickaxe','class="gate-button compact clear-option"'):''}
      ${tool('rotate','Girar prévia','rotate-cw')}
      ${item.line&&!entry.move?button('line','Linha','route',`class="tool" aria-label="Modo linha" aria-pressed="${entry.line}" title="Traçar linha"`):''}
      ${!entry.move?button('repeat','Repetir','layers',`class="tool" aria-label="Repetir construção" aria-pressed="${entry.repeat}" title="Manter peça selecionada"`):''}
      ${tool('cancel','Cancelar colocação','x')}
      </div>`;
    refreshIcons();
  }
  showClearing(entry,count=0) {
    this.placement.hidden=false;
    const instruction=entry.plot?(count===0?'Área já limpa. Marque outro canto.':
      `${fmt.format(count)} ${count===1?'árvore ou rocha será removida':'árvores e rochas serão removidas'}.`):
      `Clique ou toque no ${entry.first?'canto oposto':'primeiro canto'}.`;
    this.placement.innerHTML=`<div class="placement-title">${icon('pickaxe')}<div><strong>Limpar área</strong><small>${instruction}</small></div></div>
      <div class="placement-tools">
        ${entry.plot&&count?button('clear-landscape','Confirmar limpeza','pickaxe','class="gate-button compact clear-option"'):''}
        ${tool('cancel','Cancelar limpeza','x')}
      </div>`;
    refreshIcons();
  }
  showSelection(object,natural=false) {
    if(!object){this.selection.hidden=true;return;}
    const focused=this.selection.contains(document.activeElement)?document.activeElement.dataset.action:null;
    const role=fortificationRole(object);
    this.selection.style.cssText='';
    if(natural){
      this.selection.className='paper obstacle-selection';
      this.selection.hidden=false;
      const rock=object.type==='rock',name=rock?'Pedra':catalogue[object.type].name;
      this.selection.innerHTML=`<div class="obstacle-selection-heading"><h3>${name}</h3>${tool('clear-selection','Fechar ações','x')}</div>
        <div class="obstacle-selection-actions">
          ${button('delete',rock?'Remover pedra':'Remover árvore','trash-2','class="primary compact"')}
          ${button('mark-clearing','Limpar área','pickaxe','class="outlined compact" data-value="obstacle"')}
        </div>`;
      this.selection.setAttribute('aria-label',`Ações para ${name}`);
    }else if(role){
      this.selection.className='paper selection-panel';
      this.selection.hidden=false;
      const item=catalogue[object.type];
      const level=fortificationLevel(object);
      const cost=fortificationUpgradeCost(object);
      const gate=isVillageGate(object);
      const names={castle:`Castelo Nível ${level}`,wall:'Paliçada',tower:'Torre da muralha',
        gate:villageGateNames[object.id]??'Portão da muralha','village-wall':'Muralha da vila'};
      const name=names[role]??item.name;
      const caption=role==='castle'?'Muralhas do castelo':`Nível ${level}`;
      const upgradeAction=gate?'upgrade-gate':'upgrade-walls';
      const upgradeLabel=gate?'Melhorar portão':'Melhorar muralha';
      this.selection.innerHTML=`<div><small>${caption}</small><h3>${name}</h3></div><div class="selection-tools">
        ${cost===null?'':button(upgradeAction,`Melhorar · ${fmt.format(cost)}`,'coins',`class="gate-button" aria-label="${upgradeLabel} para o nível 2 por ${fmt.format(cost)} de ouro" title="${upgradeLabel}"`)}
        ${gates.has(object.type)?button('gate',object.open?'Fechar portão':'Abrir portão',object.open?'door-closed':'door-open','class="gate-button"'):''}
        ${isFixedFortification(object)?'':tool('move','Mover construção','move')+tool('rotate-object','Girar construção','rotate-cw')+tool('delete','Excluir construção','trash-2')}
        ${tool('clear-selection','Limpar seleção','x')}</div>`;
      this.selection.setAttribute('aria-label',`Ações para ${name}`);
    }else{
      this.selection.className='selection';
      this.selection.setAttribute('aria-label',`Ações para ${catalogue[object.type].name}`);
      const actions=[
        ['move','Mover construção','move'],
        ['rotate-object','Girar construção','rotate-cw'],
        ['delete','Excluir construção','trash-2'],
        ['clear-selection','Limpar seleção','x'],
      ];
      if(gates.has(object.type))actions.unshift(['gate',object.open?'Fechar portão':'Abrir portão',object.open?'door-closed':'door-open']);
      this.selection.innerHTML=actions.map(([action,label,symbol],index)=>
        tool(action,label,symbol,`style="--angle:${index*360/actions.length}deg"`)).join('');
    }
    refreshIcons();
    if(focused)this.selection.querySelector(`[data-action="${focused}"]`)?.focus({preventScroll:true});
  }
  positionSelection(projected) {
    const obstacle=this.selection.classList.contains('obstacle-selection');
    if(!obstacle&&!this.selection.classList.contains('selection'))return;
    if(!projected){this.selection.hidden=true;return;}
    const {width,height}=projected;
    if(obstacle){
      this.selection.hidden=false;
      const menuWidth=this.selection.offsetWidth,menuHeight=this.selection.offsetHeight;
      const x=clamp(projected.x-menuWidth/2,10,width-menuWidth-10);
      const above=projected.top-menuHeight-10;
      const y=clamp(above>=70?above:projected.bottom+10,10,Math.max(10,height-menuHeight-72));
      this.selection.style.transform=`translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
      return;
    }
    const padding=28;
    const left=padding,right=width-padding-Math.min(42,width*.1);
    const top=padding+Math.min(58,height*.16),bottom=height-padding-Math.min(82,height*.22);
    const maxRadius=Math.min((right-left)/2,(bottom-top)/2,178);
    const minRadius=Math.min(58,maxRadius);
    const x=clamp(projected.x,left+minRadius,right-minRadius);
    const y=clamp(projected.y,top+minRadius,bottom-minRadius);
    const available=Math.min(maxRadius,x-left,right-x,y-top,bottom-y);
    const radius=clamp(projected.radius+padding,minRadius,available);
    this.selection.style.left=`${Math.round(x)}px`;
    this.selection.style.top=`${Math.round(y)}px`;
    this.selection.style.setProperty('--radius',`${Math.round(radius)}px`);
    this.selection.hidden=false;
  }
  notify(message) {
    this.toastView.textContent=message;
    this.toastView.hidden=false;
    clearTimeout(this.toastTimer);
    this.toastTimer=setTimeout(()=>{this.toastView.hidden=true;},3300);
  }
  modal(title,content,dialogClass='',modal=true) {
    this.popup.className='paper modal '+dialogClass;
    this.popup.innerHTML=`<div class="modal-heading"><h2 id="panel-title">${title}</h2>${tool('close','Fechar painel','x')}</div>${content}`;
    if(!this.popup.open){
      if(modal)this.popup.showModal();
      else this.popup.show();
    }
    refreshIcons();
  }
  showTime(active) {
    this.modal('Horário do reino',`<div class="option-grid">${timeOptions.filter(([id])=>times.includes(id)).map(([id,name,ico])=>
      button('set-time',name,ico,`data-value="${id}" class="${id===active?'current':''}"`)).join('')}</div>`);
  }
  showFortifications(state) {
    const options=state.objects.filter(isFixedFortification).map(object=>{
      const wall=isVillageWall(object);
      const title=wall?'Muralha da vila':villageGateNames[object.id];
      const detail=`Nível ${fortificationLevel(object)}${wall?'':object.open?' · Aberto':' · Fechado'}`;
      return `<button type="button" data-action="focus-fortification" data-value="${object.id}">
        ${icon(wall?'brick-wall':'door-open')}<span>${title}<small>${detail}</small></span></button>`;
    });
    this.modal('Fortificações da vila',`<div class="option-grid">${options.join('')}</div>`);
  }
  showVillageWallPurchase(state) {
    const cost=catalogue.villageWall.price;
    const edge=bounds(state.territory);
    this.modal('Construir muralha da vila',`<p class="modal-intro">A muralha de nível 1 e os três portões serão instalados em volta do seu território de <strong>${edge.maxX-edge.minX} × ${edge.maxZ-edge.minZ} m</strong>. A muralha se ajusta quando você amplia o reino.</p>
      ${state.gold<cost?'<p class="modal-intro">Ouro insuficiente.</p>':''}
      <div class="modal-actions">${button('buy-village-wall',`Construir por ${fmt.format(cost)} de ouro`,'hammer',`class="primary" ${state.gold<cost?'disabled':''}`)}</div>`);
  }
  get territoryOpen() {
    return this.popup.open&&this.popup.classList.contains('territory-panel');
  }
  showTerritory(state,selected) {
    if(usesLots(state.territory)){
      const lots=expansionOptions(state.territory);
      this.modal('Expandir território',`<p class="modal-intro">Escolha no mapa um lote vizinho de ${LOT_SIZE} × ${LOT_SIZE} m. A muralha acompanha o novo limite.</p>
        <label class="lot-picker">Lote <select id="expansion-lot" ${lots.length?'':'disabled'}>
          ${lots.map(id=>`<option value="${id}">Lote (${id.replace(',',', ')})</option>`).join('')}</select></label>
        <div class="modal-actions"><span class="territory-balance" role="status"></span>
          ${button('expand','Comprar lote','coins','class="primary" disabled')}</div>`,'territory-panel',false);
      this.updateTerritory(state,selected);
      return;
    }
    this.modal('Expandir território',`<p class="modal-intro">Escolha onde adicionar uma faixa de terreno plano de ${BAND} m.</p>
      <div class="option-grid" role="group" aria-label="Direção da expansão">${directions.map(direction=>
        `<button type="button" data-action="preview-expansion" data-value="${direction}" aria-pressed="false">
          ${icon('arrow-'+{north:'up',east:'right',south:'down',west:'left'}[direction])}
          <span>${names[direction]}<small></small></span></button>`
      ).join('')}</div>
      <div class="modal-actions"><span class="territory-balance" role="status"></span>
        ${button('expand','Comprar faixa','coins','class="primary" disabled')}</div>`,'territory-panel');
    this.updateTerritory(state,selected);
  }
  updateTerritory(state,selected) {
    const lots=usesLots(state.territory);
    if(lots)this.popup.querySelector('#expansion-lot').value=selected??'';
    for(const option of this.popup.querySelectorAll('[data-action="preview-expansion"]')){
      const {value}=option.dataset;
      option.disabled=state.territory[value]>=LIMIT;
      option.setAttribute('aria-pressed',String(value===selected));
      option.querySelector('small').textContent=option.disabled?'Limite atingido':fmt.format(expansionCost(state,value))+' ouro';
    }
    const purchase=this.popup.querySelector('[data-action="expand"]');
    const cost=selected?expansionCost(state,selected):Infinity;
    purchase.disabled=!selected||state.gold<cost||(!lots&&state.territory[selected]>=LIMIT);
    purchase.dataset.value=selected||'';
    purchase.querySelector('span').textContent=lots?(selected?`Comprar lote · ${fmt.format(cost)} ouro`:'Comprar lote'):
      selected?'Comprar ao '+names[selected].toLowerCase():'Comprar faixa';
    const status=this.popup.querySelector('.territory-balance');
    const balance=fmt.format(state.gold)+' ouro disponível';
    const message=!selected?'Limite de expansão atingido.':
      state.gold<cost?balance+' · Saldo insuficiente':balance;
    if(status.textContent!==message)status.textContent=message;
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
      ['starter','Reino iniciante','Um salvamento separado para começar com o castelo e ampliar por lotes.'],
      ['empty','Terreno vazio','Um salvamento independente para começar com 5.000 moedas.'],
      ['demo','Cidade demonstrativa','Explore o Domínio do Alvorecer em um salvamento separado.'],
      ['backup','Cópia de conflito','Recupere a cópia local de uma versão substituída.']].map(([slot,name,detail])=>
      `<button type="button" data-action="slot" data-value="${slot}" class="${current===slot?'current':''}">${icon(slot==='own'||slot==='starter'?'castle':slot==='demo'?'landmark':slot==='backup'?'save':'tree-pine')}<span><strong>${name}</strong><small>${detail}</small></span>${icon('chevron-right')}</button>`).join('')}</div>`);
  }
  showHelp() {
    this.modal('Controles do jogo',`<dl class="help-content">
      <dt>Vista aérea</dt><dd>Use WASD ou as setas para deslocar a câmera. Arraste para girar e use a roda para aproximar.</dd>
      <dt>Exploração</dt><dd>Use WASD ou as setas. Arraste para olhar ou pressione J para capturar o mouse. Use E próximo a um portão.</dd>
      <dt>Construção</dt><dd>Escolha uma peça em Construir e clique ou toque no terreno para colocá-la. R gira, Shift + R gira no sentido contrário, Enter confirma e Esc cancela. Use as setas para ajustar a prévia.</dd>
      <dt>Edição</dt><dd>Selecione uma peça para ver as ações ao redor dela. Use Mover e clique ou toque em uma área livre. Delete exclui e Ctrl + Z desfaz. Mover e girar são gratuitos.</dd>
      <dt>Limpeza</dt><dd>Clique ou toque numa árvore natural ou pedra para removê-la. Para limpar um trecho, escolha Limpar área nas ações do obstáculo, marque o canto oposto e confirme. Se uma construção estiver bloqueada, use Limpar terreno na prévia.</dd>
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


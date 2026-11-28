import '@fontsource-variable/crimson-pro/wght.css';
import '@fontsource-variable/dm-sans/wght.css';
import './styles.css';
import { catalogue,categories } from '../core/catalog.js';
import { defaultBuildingLevels,economyFields,isDecoration,MAX_PUBLIC_ORDER,maxBuildingLevel,resources } from '../core/economy-rules.js';

const root=document.querySelector('#admin');
const api='/api/admin/valdoria/economy';
const fmt=new Intl.NumberFormat('pt-BR');
const globalGroups=[
  ['Início da partida',[['starterGold','Ouro do reino inicial'],['emptyGold','Ouro do terreno vazio']]],
  ['Arrecadação',[['harvestSeconds','Intervalo em segundos'],['residentGold','Ouro por morador'],['jobGold','Ouro por emprego ocupado']]],
  ['Ordem pública',[['publicOrderBonus','Bônus de arrecadação por 100 pontos (%)']]],
  ['Expansão territorial',[['lotCost','Preço do primeiro lote'],['lotIncrease','Acréscimo por lote'],['stripCost','Preço da primeira faixa'],['stripIncrease','Acréscimo por faixa']]]
];
const columns=[['cost','Ouro para construir ou melhorar',1e6],['homes','Moradores',10000],
  ['jobs','Empregos',10000],['gold','Ouro direto por ciclo',1e6],['quantity','Unidades por ciclo',1e6],
  ['publicOrder','Pontos de ordem pública',MAX_PUBLIC_ORDER]];
let token, data, draft;
let tab='rules', type='hut', group='all';
let filter='', dirty=false, busy=false;

function escape(value){
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

async function request(method='GET',payload){
  const response=await fetch(api,{
    method,headers:{'Authorization':'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})},
    ...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(10000)
  });
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'Economia indisponível.');
  return result;
}

function notice(message,error=false){
  const status=root.querySelector('#status');
  status.textContent=message;
  status.dataset.error=String(error);
}

function homeLink(){return '<a class="game-link" href="/">Abrir jogo ↗</a>';}
function login(){
  root.innerHTML=`<main class="login"><img src="/crest.svg" alt="" width="54" height="54">
    <h1>Administração de Valdória</h1>
    <form id="login"><label for="token">Token administrativo</label>
      <input id="token" type="password" required autocomplete="off">
      <button class="primary">Entrar no painel</button>
    </form><p id="status" role="status" aria-live="polite"></p>${homeLink()}</main>`;
}
function render(){
  root.innerHTML=`<header class="header"><a href="/admin/r/valdoria" class="brand"><img src="/crest.svg" alt="" width="39" height="39"><strong>Valdória</strong></a>
    <div class="header-tools">${homeLink()}<button type="button" data-action="sign-out">Sair</button></div></header>
    <main class="shell"><aside><nav aria-label="Administração">
      <button type="button" data-tab="rules" ${tab==='rules'?'aria-current="page"':''}>Reino e economia</button>
      <button type="button" data-tab="buildings" ${tab==='buildings'?'aria-current="page"':''}>Construções e níveis</button>
    </nav><div class="revision">Revisão <strong id="revision">${fmt.format(data.revision)}</strong></div></aside>
    <section class="workspace"><div class="toolbar"><h1>${tab==='rules'?'Reino e economia':'Construções e níveis'}</h1>
      <div class="actions"><button type="button" data-action="reload">Recarregar</button><button type="submit" class="primary" id="save" form="economy" ${dirty?'':'disabled'}>Publicar no jogo</button></div></div>
      <p id="status" role="status" aria-live="polite">${dirty?'Alterações pendentes.':''}</p>
      <form id="economy">${tab==='rules'?globalView():buildingView()}</form>
    </section></main>`;
}

function globalView(){
  return globalGroups.map(([title,fields],index)=>`<fieldset><legend>${title}</legend><div class="form-grid">
    ${fields.map(([key,label])=>{
      const [,min,max,step=1]=economyFields[key];
      return `<label>${label}<input type="number" name="${key}" data-global min="${min}" max="${max}" step="${step}" value="${draft[key]}" required></label>`;
    }).join('')}
    ${index===0?`<label class="checkbox"><input type="checkbox" name="starterWall" data-global ${draft.starterWall?'checked':''}> Incluir muralha no reino inicial</label>`:''}
    </div>${title==='Ordem pública'?'<p class="hint">Cada grupo completo de 100 pontos soma esse percentual à arrecadação de ouro.</p>':''}</fieldset>`).join('');
}

const rowsFor=()=>draft.buildings[type]??defaultBuildingLevels(type);
function buildingChoices(){
  const search=filter.trim().toLocaleLowerCase('pt-BR');
  return Object.values(catalogue).filter(item=>(group==='all'||item.category===group)&&
    (item.name.toLocaleLowerCase('pt-BR').includes(search)||item.id.toLowerCase().includes(search)));
}
function buildingList(){
  return buildingChoices().map(item=>`<button type="button" data-building="${item.id}" aria-pressed="${item.id===type}">
    <span>${escape(item.name)}</span><small>${(draft.buildings[item.id]??defaultBuildingLevels(item.id)).length} nível(is)</small></button>`).join('')||
    '<p class="empty">Nenhuma construção encontrada.</p>';
}
function buildingView(){
  return `<div class="ledger"><div class="directory">
    <label>Buscar construção<input id="filter" type="search" value="${escape(filter)}"></label>
    <label>Categoria<select id="category"><option value="all">Todas</option>
      ${categories.map(item=>`<option value="${item.id}" ${item.id===group?'selected':''}>${item.name}</option>`).join('')}</select></label>
    <div id="building-list" class="building-list">${buildingList()}</div>
    </div><div id="levels" class="levels">${levelsView()}</div></div>`;
}
function levelsView(){
  const levels=rowsFor();
  const decoration=isDecoration(type);
  const fields=decoration?columns.filter(([key])=>key==='cost'||key==='publicOrder'):columns;
  return `<div class="level-header"><h2>${escape(catalogue[type].name)}</h2>
    <div class="actions"><button type="button" data-action="remove-level" ${levels.length<=defaultBuildingLevels(type).length?'disabled':''}>Remover último nível</button>
    <button type="button" data-action="add-level" ${levels.length>=maxBuildingLevel(type)?'disabled':''}>Adicionar nível</button></div></div>
    <p class="hint">${decoration?'As decorações contribuem apenas com ordem pública.':'O ouro direto e os recursos são arrecadados a cada ciclo.'} O custo do nível 1 é o preço da loja.</p>
    ${levels.map((level,index)=>`<fieldset><legend>Nível ${index+1}</legend><div class="form-grid">
      ${fields.map(([key,label,max])=>`<label>${label}<input type="number" min="0" max="${max}" step="1"
        data-level="${index}" data-field="${key}" value="${level[key]}" ${key==='quantity'&&!level.resource?'disabled':''} required>
        ${index>0&&['homes','jobs','gold','publicOrder'].includes(key)?`<small data-delta="${index}-${key}">${delta(level[key]-levels[index-1][key])}</small>`:''}</label>`).join('')}
      ${decoration?'':`<label>Recurso produzido<select data-level="${index}" data-field="resource"><option value="">Nenhum</option>
      ${Object.entries(resources).map(([id,label])=>`<option value="${id}" ${id===level.resource?'selected':''}>${label}</option>`).join('')}</select></label>`}</div></fieldset>`).join('')}`;
}
function delta(value){
  return `${value>0?'+':''}${fmt.format(value)} em relação ao nível anterior`;
}
function markDirty(){
  dirty=true;
  root.querySelector('#save').disabled=false;
  notice('Alterações pendentes.');
}
function validDraft(){
  const fields=root.querySelectorAll('input[type=number]');
  return [...fields].every(field=>field.validity.valid);
}
function refreshEditor(){
  root.querySelector('#levels').innerHTML=levelsView();
  root.querySelector('#building-list').innerHTML=buildingList();
}
function useSnapshot(snapshot){
  data=snapshot;
  draft=structuredClone(data.rules);
  dirty=false;
}
root.addEventListener('input',event=>{
  const field=event.target;
  if(field.id==='filter'){
    filter=field.value;
    root.querySelector('#building-list').innerHTML=buildingList();
  }
  if(field.hasAttribute('data-global')){
    draft[field.name]=field.type==='checkbox'?field.checked:field.valueAsNumber;
    markDirty();
  }
  if(field.hasAttribute('data-level')){
    const rows=draft.buildings[type]??=defaultBuildingLevels(type);
    const row=rows[Number(field.dataset.level)],key=field.dataset.field;
    row[key]=field.type==='number'?field.valueAsNumber:field.value;
    if(key==='resource'){
      const quantity=root.querySelector(`[data-level="${field.dataset.level}"][data-field="quantity"]`);
      quantity.disabled=!field.value;
      if(!field.value){ row.quantity=0; quantity.value='0'; }
    }
    for(let index=1;index<rows.length;index++){
      const label=root.querySelector(`[data-delta="${index}-${key}"]`);
      if(label)label.textContent=delta(rows[index][key]-rows[index-1][key]);
    }
    markDirty();
  }
});
root.addEventListener('change',event=>{
  if(event.target.id!=='category')return;
  group=event.target.value;
  root.querySelector('#building-list').innerHTML=buildingList();
});
root.addEventListener('click',async event=>{
  const button=event.target.closest('button');
  if(!button||busy||!data)return;
  if(button.dataset.tab&&validDraft()){
    tab=button.dataset.tab;
    render();
  }
  if(button.dataset.building&&validDraft()){
    type=button.dataset.building;
    refreshEditor();
  }
  if(button.dataset.action==='add-level'&&validDraft()){
    const levels=draft.buildings[type]??=defaultBuildingLevels(type);
    if(levels.length>=maxBuildingLevel(type))return;
    levels.push({...levels.at(-1)});
    refreshEditor();
    markDirty();
  }
  if(button.dataset.action==='remove-level'){
    const levels=draft.buildings[type];
    if(!levels||levels.length<=defaultBuildingLevels(type).length)return;
    levels.pop();
    refreshEditor();
    markDirty();
  }
  if(button.dataset.action==='sign-out'){
    if(dirty&&!window.confirm('Sair sem publicar as alterações?'))return;
    token=data=draft=null;
    dirty=false;
    login();
  }
  if(button.dataset.action==='reload'){
    if(dirty&&!window.confirm('Descartar as alterações pendentes e recarregar?'))return;
    busy=true;
    try{useSnapshot(await request());render();notice('Regras recarregadas.');}
    catch(error){notice(error.message,true);}
    finally{busy=false;}
  }
});
root.addEventListener('submit',async event=>{
  event.preventDefault();
  if(busy)return;
  busy=true;
  const form=event.target;
  const button=event.submitter;
  if(button)button.disabled=true;
  try{
    if(form.id==='login'){
      token=form.querySelector('#token').value;
      useSnapshot(await request());
      render();
    }else if(form.id==='economy'&&dirty){
      form.inert=true;
      useSnapshot(await request('PUT',{revision:data.revision,rules:draft}));
      render();
      notice('Regras publicadas no jogo.');
    }
  }catch(error){notice(error.message,true);}
  finally{
    form.inert=false;
    if(button&&button.isConnected)button.disabled=false;
    busy=false;
  }
});
login();

import '@fontsource-variable/crimson-pro/wght.css';
import '@fontsource-variable/dm-sans/wght.css';
import './ui/styles.css';
import { HUD,escapeHTML } from './ui/hud.js';
import { Atlas } from './ui/atlas.js';
import { icon } from './ui/icons.js';
import { drawMinimap } from './ui/atlas-art.js';
import { loadLandmarks } from './models/library.js';
import { WorldView } from './world/view.js';
import { AmbientSound } from './world/audio.js';
import { BAND,expansionBounds,expansionOptions } from './world/terrain-data.js';
import { LOT_SIZE,usesLots } from './world/lots.js';
import { SaveManager,profile,recoverProfile,register,request } from './storage/saves.js';
import { collectTax, expansionCost, upgradeStarter, validatedKingdom } from './core/kingdom.js';
import { castleTypes, gates } from './core/geometry.js';
import { isFixedFortification,isVillageWall,villageWallId } from './core/fortifications.js';
import { Editor } from './core/editor.js';

const root = document.querySelector('#app');
const hud = new HUD(root);
const atlas = new Atlas(root.querySelector('#atlas'));
const world = root.querySelector('#world');
let view;
try { view = new WorldView(world); }
catch { world.innerHTML='<p class="paper no-webgl">O modo 3D precisa de um navegador com WebGL 2 e aceleração gráfica.</p>'; }
const saves = new SaveManager(status=>hud.saved(status));
const audio = new AmbientSound();
const editor = new Editor(view,hud,changed);
const popups = [hud.catalogue,hud.popup,atlas.dialog];
const active = () => guest?.state || state;
const modalsOpen = () => popups.some(dialog=>dialog.open);
const prepareModels = objects => view && loadLandmarks(objects);
const SLOT_KEY='reino-valdoria-slot';
const saveKind=key=>key==='demo'?'demo':key==='own'||key==='starter'?'starter':'empty';
const previousSlot=localStorage.getItem(SLOT_KEY);
let state, slot=['own','starter','empty','demo','backup'].includes(previousSlot)?previousSlot:'own';
let guest=null, locked=false, refreshBusy=false, lastMini=0, lastAim=0;
let territoryDirection=null;

function changed({modified=false,created=[],refreshRoutes=true}={}) {
  if(!active())return;
  view?.setState(active(),{created,refreshRoutes});
  updateHUD();
  if(modified && !guest) saves.save(state);
}

function updateHUD() {
  if(!active())return;
  const camera = view?.navigation;
  hud.state(active(),editor.history.length,camera?.mode==='walk'?camera.position:camera?.orbit.target,guest?.kingdom);
  hud.tax(active());
  if(hud.territoryOpen)hud.updateTerritory(state,territoryDirection);
}

function tell(message) {
  let current = atlas.dialog.open?atlas.dialog.querySelector('.world-actions'):hud.popup.open?hud.popup:null;
  if(current){
    const prev=current.querySelector('.dialog-message');
    prev?.remove();
    const note=document.createElement('p');
    note.className='dialog-message';
    note.setAttribute('role','status');
    note.textContent=message;
    current.append(note);
  }else hud.notify(message);
}

function friendlyError(error) { tell(error?.message || 'O servidor de Valdória está indisponível.'); }

async function connectProfile() {
  const online=await saves.connect();
  if(!online||!profile()||slot!=='own'||guest)return online;
  try {
    const remote=await saves.prepareSync();
    if(!remote)return online;
    if(saves.conflicted)showConflict(remote);
    else {
      const next=upgradeStarter(remote);
      await prepareModels(next.objects);
      state=next;editor.start(state);cameraMode('orbit');view?.navigation.overview(state);changed();
    }
  } catch (error) { if(error.status!==401)friendlyError(error); }
  return online;
}

function showConflict(remote) {
  if(!remote?.state)return;
  const activeLocal=escapeHTML(state.name), activeOnline=escapeHTML(remote.state.name);
  hud.modal('Escolha uma versão',`<p class="modal-intro">O navegador tem “${activeLocal}”. O servidor tem “${activeOnline}” na revisão ${remote.revision}. Escolha qual versão deve ficar no Reino principal.</p>
    <div class="option-grid"><button type="button" data-action="local-version">${icon('save')} Publicar a versão deste navegador</button>
      <button type="button" data-action="remote-version">${icon('globe-2')} Carregar a versão do servidor</button></div>`);
}

async function mapUpdate(open=false) {
  if(open){
    editor.cancel();
    if(document.pointerLockElement)document.exitPointerLock();
    atlas.open();
    if(!atlas.entries.length)atlas.update([],null,profile(),slot);
  }
  if(refreshBusy)return;
  refreshBusy=true;
  try{
    const data=await request('/world');
    saves.online=true;
    atlas.update(data.kingdoms,true,profile(),slot);
  } catch {
    saves.online=false;
    atlas.update([],false,profile(),slot);
  }finally{refreshBusy=false;}
}

async function publish() {
  if(slot!=='own'||guest)return;
  await connectProfile();
  if(saves.conflicted)return;
  const saved=await saves.save(state,{strict:true});
  await request('/world',{method:'POST',payload:{revision:saved.revision}});
  await mapUpdate();
  tell('Seu reino está no mapa-múndi.');
}

async function switchSlot(next) {
  if(slot===next){hud.popup.close();return;}
  if(guest)leaveVisit();
  await saves.save(state);
  const replacement=await saves.load(next,saveKind(next));
  if(next==='backup'&&!saves.current){
    await saves.load(slot);
    tell('Ainda não há uma cópia de conflito.');
    return;
  }
  const nextState=next==='own'?upgradeStarter(replacement):replacement;
  await prepareModels(nextState.objects);
  slot=next;state=nextState;
  localStorage.setItem(SLOT_KEY,slot);
  editor.start(state);cameraMode('orbit');view?.navigation.overview(state);changed();
  hud.popup.close();
  if(slot==='own')await connectProfile();
  await saves.save(state);
}

async function visit(id) {
  const record=await request('/world/'+id);
  const valid=validatedKingdom(record.state);
  if(!valid)throw new Error('O reino publicado tem um salvamento inválido.');
  await prepareModels(valid.objects);
  if(!guest)await saves.save(state);
  editor.cancel();editor.select(null);
  guest={state:valid,kingdom:record.kingdom};
  atlas.dialog.close();hud.toggleCatalogue(false);
  cameraMode('orbit');view?.navigation.overview(valid);
  if(view) {view.navigation.position.set(-.6,0,9);view.navigation.yaw=0;}
  changed();hud.showVisit(guest.kingdom);
}

function leaveVisit() {
  guest=null;
  editor.start(state);
  view?.traffic.showPlayers([]);
  cameraMode('orbit');
  view?.navigation.overview(state);
  changed();hud.showVisit(null);
}

function cameraMode(mode) {
  if(!view)return;
  const navigation=view.navigation;
  if(mode==='walk' && navigation.mode!=='walk'){
    const point=navigation.position;
    if(view.blocked(point.x,point.z,.38)){
      let found=false;
      for(let radius=1;radius<=35&&!found;radius++)for(let i=0;i<12;i++){
        const x=point.x+Math.cos(i*Math.PI/6)*radius,z=point.z+Math.sin(i*Math.PI/6)*radius;
        if(!view.blocked(x,z,.44)){point.x=x;point.z=z;found=true;break;}
      }
      if(!found){hud.notify('A posição está cercada. Abra espaço antes de explorar.');return;}
    }
  }
  view.navigation.setMode(mode,active());
  hud.camera(mode);
  if(mode==='walk')view.navigation.keys.clear();
}

function firstGate() {
  if(!view||guest)return;
  if(editor.selected&&gates.has(editor.selected.type)){editor.toggleGate(editor.selected.id);return;}
  const point=view.navigation.position;
  const gate=active().objects.filter(o=>gates.has(o.type)&&Math.hypot(o.x-point.x,o.z-point.z)<(castleTypes.has(o.type)?21:8))
    .sort((a,b)=>Math.hypot(a.x-point.x,a.z-point.z)-Math.hypot(b.x-point.x,b.z-point.z))[0];
  if(gate)editor.toggleGate(gate.id);
  else hud.notify('Aproxime-se de um portão.');
}

async function action(which,value) {
  if(!state)return;
  switch(which) {
    case 'catalogue':
      if(!guest){
        if(!hud.catalogue.open && document.pointerLockElement)document.exitPointerLock();
        hud.toggleCatalogue();
      }
      break;
    case 'item':
      if(!guest){
        if(value==='villageWall'){
          editor.cancel();
          hud.toggleCatalogue(false);
          hud.showVillageWallPurchase(state);
          break;
        }
        const loading=prepareModels([{type:value}]);
        if(loading)await loading;
        editor.startPlacement(value);
      }
      break;
    case 'buy-village-wall':
      if(!guest){
        const kingdom=state;
        await prepareModels([{id:villageWallId,type:'villageWall',wallLevel:1}]);
        if(state!==kingdom||guest)break;
        hud.popup.close();
        if(editor.apply({kind:'buy-village-wall'})){
          cameraMode('orbit');
          view?.navigation.focusVillageWall(state.territory);
          editor.select(villageWallId);
          hud.notify('Muralha da vila e três portões construídos.');
        }
      }
      break;
    case 'cancel': editor.cancel(); break;
    case 'mark-clearing':
      if(!guest&&view){
        if(view.navigation.mode==='walk')cameraMode('orbit');
        editor.startClearing(value==='obstacle'?editor.selectedObstacle:null);
      }
      break;
    case 'clear-landscape': if(!guest)editor.clearTerrain(); break;
    case 'rotate': if(!guest)editor.rotate(1); break;
    case 'line': editor.setLine(); break;
    case 'repeat': editor.setRepeat(); break;
    case 'undo': if(!guest)editor.undo(); break;
    case 'move': if(!guest)editor.moveSelected(); break;
    case 'rotate-object': if(!guest)editor.rotate(1); break;
    case 'delete': if(!guest)editor.remove(); break;
    case 'upgrade-walls':
    case 'upgrade-gate':
      if(!guest&&editor.selected){
        const selected=editor.selected;
        await prepareModels([{...selected,wallLevel:2}]);
        if(editor.selected===selected)editor.upgradeFortification(which);
      }
      break;
    case 'fortifications':
      if(!guest&&state.objects.some(isVillageWall)){
        editor.cancel();
        if(document.pointerLockElement)document.exitPointerLock();
        hud.showFortifications(state);
      }
      break;
    case 'focus-fortification': {
      if(guest)return;
      const structure=state.objects.find(object=>object.id===value&&isFixedFortification(object));
      if(!structure)return;
      hud.popup.close();
      cameraMode('orbit');
      if(isVillageWall(structure))view?.navigation.focusVillageWall(state.territory);
      else view?.navigation.focusVillageGate(structure);
      editor.select(structure.id);
      break;
    }
    case 'gate': firstGate(); break;
    case 'clear-selection': editor.select(null); break;
    case 'settings': hud.showSettings(active(),slot,profile(),saves.online,saves.conflicted); break;
    case 'help': hud.showHelp(); break;
    case 'time': hud.showTime(active().time); break;
    case 'set-time':
      active().time=value;
      hud.popup.close();
      changed({modified:true,refreshRoutes:false});
      break;
    case 'territory':
      if(!guest){
        if(editor.clearing||editor.placement?.move)editor.cancel();
        if(document.pointerLockElement)document.exitPointerLock();
        view?.navigation.keys.clear();
        const options=expansionOptions(state.territory);
        territoryDirection=options.includes('0,2')?'0,2':options[0]??null;
        hud.showTerritory(state,territoryDirection);
        view?.showTerritory(territoryDirection,hud.popup);
      }
      break;
    case 'preview-expansion':
      if(!guest&&hud.territoryOpen&&value!==territoryDirection&&expansionOptions(state.territory).includes(value)){
        territoryDirection=value;
        hud.updateTerritory(state,value);
        view?.showTerritory(value,hud.popup);
      }
      break;
    case 'expand': {
      if(guest||!hud.territoryOpen||value!==territoryDirection)return;
      const strip=expansionBounds(state.territory,value);
      const cost=expansionCost(state,value);
      if(strip&&editor.apply({kind:'expand',direction:value})){
        hud.popup.close();
        cameraMode('orbit');
        view?.showPurchasedExpansion(strip);
        editor.select(editor.selection?.id);
        editor.updatePreview();
        const area=usesLots(state.territory)?`Lote de ${LOT_SIZE} × ${LOT_SIZE} m liberado`:`Faixa de ${BAND} m liberada`;
        hud.notify(`${area} por ${cost.toLocaleString('pt-BR')} ouro.`);
      }
      break;
    }
    case 'map': await mapUpdate(true); break;
    case 'refresh-map': await mapUpdate(); break;
    case 'access-code': atlas.accessCode(profile()?.token);break;
    case 'recover-code': atlas.accessCode();break;
    case 'access-back': atlas.update(atlas.entries,atlas.online,profile(),slot);break;
    case 'focus-marker': atlas.focus(value); break;
    case 'publish': await publish(); break;
    case 'unpublish':
      await request('/world',{method:'DELETE'});
      await mapUpdate();tell('Seu reino saiu do mapa.');break;
    case 'visit': await visit(value); break;
    case 'leave': leaveVisit(); break;
    case 'saves': hud.showSlots(slot);break;
    case 'slot': await switchSlot(value);break;
    case 'save':
      if(guest){tell('Você está visitando um reino publicado.');break;}
      await saves.save(state);tell('Salvamento atualizado.');break;
    case 'resolve': showConflict(await request('/kingdom'));break;
    case 'remote-version': {
      const remote=await request('/kingdom');
      const next=upgradeStarter(await saves.useRemote(remote));
      await prepareModels(next.objects);
      state=next;
      editor.start(state);hud.popup.close();changed();break;
    }
    case 'local-version':
      await saves.useLocal(await request('/kingdom'),state);
      hud.popup.close();changed();break;
    case 'walk': cameraMode(view?.navigation.mode==='walk'?'orbit':'walk');break;
    case 'free': hud.popup.close();cameraMode('free');break;
    case 'overview': cameraMode('orbit');view?.navigation.overview(active());if(hud.popup.open)hud.popup.close();break;
    case 'focus-castle': {
      const keep=active().objects.find(object=>castleTypes.has(object.type));
      if(!keep){hud.notify('Construa um castelo para enquadrá-lo.');break;}
      cameraMode('orbit');view?.navigation.focusCastle(keep.x,keep.z);
      if(!guest){editor.cancel();editor.select(keep.id);}
      break;
    }
    case 'zoom-in': view?.navigation.zoom(.82);break;
    case 'zoom-out': view?.navigation.zoom(1.22);break;
    case 'close': hud.popup.close();break;
    case 'close-atlas': atlas.dialog.close();break;
  }
}

function run(which,value) {
  if(locked)return;
  const asyncActions=['publish','unpublish','visit','slot','remote-version','local-version','save','item','buy-village-wall','upgrade-walls','upgrade-gate'];
  locked=asyncActions.includes(which);
  action(which,value).catch(friendlyError).finally(()=>{if(asyncActions.includes(which))locked=false;});
}
hud.bind(run);
root.addEventListener('submit',async event=>{
  event.preventDefault();
  if(locked)return;
  if(event.target.id==='settings-form'){
    const form=new FormData(event.target), current=active();
    if(!guest)current.name=(form.get('realm').trim()||current.name).slice(0,38);
    current.quality=form.get('quality');current.sound=form.has('sound');
    audio.set(current.sound).catch(()=>{});
    hud.popup.close();changed({modified:true});
  } else if(['profile-form','recover-form'].includes(event.target.id)){
    const form=new FormData(event.target);
    locked=true;
    try{
      if(event.target.id==='profile-form')await register(form.get('alias').trim(),profile()?.token);
      else await recoverProfile(form.get('code'));
      await connectProfile();
      if(!saves.conflicted&&slot==='own'&&!guest)await saves.save(state);
      await mapUpdate();
    } catch (error) {friendlyError(error);}
    finally {locked=false;}
  }
});
root.addEventListener('pointerdown',()=>{if(active()?.sound)audio.set(true).catch(()=>{});},{capture:true});
hud.popup.addEventListener('close',()=>{
  if(!hud.territoryOpen&&view?.territoryPreview)view.showTerritory(null,null);
});

if(view){
  view.suspended=()=>modalsOpen()&&!hud.territoryOpen;
  let pointerDown=null;
  const canvas=view.canvas;
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  canvas.addEventListener('pointerdown',event=>{
    pointerDown=event.button===0&&event.isPrimary?{x:event.clientX,y:event.clientY,pointer:event.pointerId}:null;
  });
  canvas.addEventListener('pointermove',event=>{
    if(pointerDown?.pointer===event.pointerId&&Math.hypot(pointerDown.x-event.clientX,pointerDown.y-event.clientY)>8)pointerDown=null;
    if((!editor.placement&&!editor.clearing)||event.pointerType==='touch')return;
    const now=performance.now();
    if(now-lastAim<40)return;
    lastAim=now;
    const point=view.placeAt(event);
    if(point)editor.aim(point);
  });
  canvas.addEventListener('pointerup',event=>{
    const from=pointerDown;pointerDown=null;
    if(!from||event.button!==0||from.pointer!==event.pointerId||Math.hypot(from.x-event.clientX,from.y-event.clientY)>8||guest)return;
    if(hud.territoryOpen&&usesLots(state.territory)){
      const lot=view.pickExpansion(event);
      if(lot)action('preview-expansion',lot);
      return;
    }
    if(editor.placement||editor.clearing){
      const point=view.placeAt(event);
      if(point)editor.confirm(point);
      return;
    }
    const id=view.pick(event);
    if(id&&document.pointerLockElement===canvas)document.exitPointerLock();
    editor.select(id);
    if(view.navigation.mode==='walk'&&event.detail>1)firstGate();
  });
  canvas.addEventListener('pointercancel',()=>pointerDown=null);
  const touchKeys={'walk-up':'w','walk-down':'s','walk-left':'a','walk-right':'d'};
  root.querySelectorAll('#touch-walk button').forEach(button=>{
    const key=touchKeys[button.dataset.action];
    button.addEventListener('pointerdown',event=>{
      button.setPointerCapture(event.pointerId);
      view.navigation.keys.add(key);
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>view.navigation.keys.delete(key));
  });
  view.onFrame=t=>{
    if(editor.selection)hud.positionSelection(view.projectSelection());
    if(t-lastMini>.7){
      lastMini=t;
      const camera=view.navigation;
      drawMinimap(root.querySelector('#minimap'),active(),camera.mode==='walk'?camera.position:camera.orbit.target);
    }
    audio.step(t,active(),view.navigation.mode==='walk'?view.navigation.position:view.navigation.orbit.target);
  };
}

document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&hud.territoryOpen&&usesLots(state?.territory)){hud.popup.close();return;}
  if(!state||modalsOpen()||event.target.matches('input,textarea,select')||event.target.isContentEditable)return;
  const key=event.key.toLowerCase();
  if(key==='escape'){editor.cancel();editor.select(null);return;}
  if((event.ctrlKey||event.metaKey)&&key==='z'&&!guest){event.preventDefault();editor.undo();return;}
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  if(key==='j'&&view?.navigation.mode==='walk'){view.navigation.lookMode();return;}
  const arrows={arrowup:[0,-1],arrowdown:[0,1],arrowleft:[-1,0],arrowright:[1,0]};
  if(!guest){
    if(key==='enter'&&(editor.placement||editor.clearing?.plot)&&event.target.tagName!=='BUTTON'){event.preventDefault();editor.confirm();return;}
    if(key==='delete'&&editor.selection){event.preventDefault();editor.remove();return;}
    if(key==='r'&&!event.repeat){event.preventDefault();editor.rotate(event.shiftKey?-1:1);return;}
    if(key==='e'&&!event.repeat&&view?.navigation.mode==='walk'){firstGate();return;}
    if(arrows[key]&&editor.placement){event.preventDefault();editor.nudge(...arrows[key]);return;}
  }
  if(view&&(arrows[key]||['w','a','s','d','shift'].includes(key))){
    if(key!=='shift')event.preventDefault();
    view.navigation.keys.add(key);
  }
});
document.addEventListener('keyup',event=>view?.navigation.keys.delete(event.key.toLowerCase()));
window.addEventListener('online',()=>connectProfile().then(ok=>{if(ok && !saves.conflicted&&!guest)saves.save(state);}));
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){audio.set(false);view?.navigation.keys.clear();}
  else if(active()?.sound)audio.set(true).catch(()=>{});
});

setInterval(()=>{
  if(document.hidden||!state||guest)return;
  if(collectTax(state)){updateHUD();audio.harvest();saves.save(state);}
  else hud.tax(state);
},1000);
setInterval(async ()=>{
  if(document.hidden || !guest || !view || !profile()) return;
  const id=guest.kingdom.id;
  const camera=view.navigation, foot=camera.position;
  try {
    const {players}=await request('/world/'+id+'/presence',{method:'POST',payload:{x:foot.x,y:foot.y,z:foot.z,angle:Math.atan2(Math.sin(camera.yaw+Math.PI),Math.cos(camera.yaw+Math.PI))}});
    if(guest?.kingdom.id!==id)return;
    view.traffic.showPlayers(players);
    if(guest.count!==players.length){guest.count=players.length;hud.showVisit(guest.kingdom,players.length);}
  } catch {view.traffic.showPlayers([]);}
},2200);
setInterval(()=>{
  if(atlas.dialog.open && profile() && !atlas.codeOpen && !document.hidden && !locked && !atlas.dialog.querySelector('.dialog-message'))mapUpdate();
},12000);
setInterval(async ()=>{
  if(document.hidden||guest||!state||!profile()||slot!=='own'||saves.conflicted||locked)return;
  const ok=await connectProfile();
  if(ok&&saves.current?.pending&&!saves.conflicted)await saves.save(state);
},18000);

async function initialize() {
  const loaded=await saves.load(slot,saveKind(slot));
  const initial=slot==='own'?upgradeStarter(loaded):loaded;
  await prepareModels(initial.objects);
  state=initial;
  view?.navigation.overview(state);
  editor.start(state);changed();hud.saved('Salvo neste navegador');
  await connectProfile();
  if(!saves.conflicted)await saves.save(state);
  root.dataset.ready='true';
}
initialize().catch(error=>{hud.notify('O reino não pôde ser carregado.');console.error(error);});


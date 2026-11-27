import '@fontsource-variable/crimson-pro/wght.css';
import '@fontsource-variable/dm-sans/wght.css';
import './ui/styles.css';
import { HUD } from './ui/hud.js';
import { escapeHTML } from './ui/html.js';
import { icon } from './ui/icons.js';
import { drawMinimap } from './ui/atlas-art.js';
import { loadBuildingUpgrade,loadFortificationKit,loadLandmarks } from './models/library.js';
import { WorldView } from './world/view.js';
import { waterGates } from './world/perimeter.js';
import { lakeCenter } from './world/hydrology.js';
import { AmbientSound } from './world/audio.js';
import { BAND,expansionBounds,expansionOptions } from './world/terrain-data.js';
import { LOT_SIZE,usesLots } from './world/lots.js';
import { SaveManager } from './storage/saves.js';
import { profile,refreshAccount,request,setProfile } from './storage/account.js';
import { collectTax, expansionCost, upgradeStarter, validatedKingdom } from './core/kingdom.js';
import { buildingUpgrade } from './core/building-levels.js';
import { findMission, missionProgress, missionStats, missionStatus } from './core/missions.js';
import { castleTypes, gates } from './core/geometry.js';
import { fortificationUpgrade,isFixedFortification,isVillageWall,villageWallId } from './core/fortifications.js';
import { Editor } from './core/editor.js';

const root = document.querySelector('#app');
const hud = new HUD(root);
const world = root.querySelector('#world');
let view;
try { view = new WorldView(world); }
catch { world.innerHTML='<p class="paper no-webgl">O modo 3D precisa de um navegador com WebGL 2 e aceleração gráfica.</p>'; }
const saves = new SaveManager(status=>hud.saved(status));
const audio = new AmbientSound();
const editor = new Editor(view,hud,changed);
const popups = [hud.catalogue,hud.popup];
const active = () => guest?.state || state;
const modalsOpen = () => popups.some(dialog=>dialog.open);
const prepareModels = objects => view && loadLandmarks(objects);
const SLOT_KEY='reino-valdoria-slot';
const GUEST_MISSIONS_KEY='reino-valdoria-guest-missions';
const saveKind=key=>key==='demo'?'demo':key==='own'||key==='starter'?'starter':'empty';
const previousSlot=localStorage.getItem(SLOT_KEY);
let state, slot=['own','starter','empty','demo','backup'].includes(previousSlot)?previousSlot:'own';
let guest=null, locked=false, lastMini=0, lastAim=0;
let territoryDirection=null;
let progress=missionProgress(), selectedMission=null;

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

function missionNotice() {
  if(guest||slot!=='own')return 'Resgate missões no Reino principal.';
  return saves.account&&!saves.online ? 'Conecte-se ao servidor para resgatar XP da conta.' : '';
}

function renderMissions() {
  hud.showMissions(slot==='own'?state:null,progress,selectedMission,missionNotice());
}

function guestMissions() {
  try { return missionProgress(JSON.parse(localStorage.getItem(GUEST_MISSIONS_KEY))); }
  catch { return missionProgress(); }
}

function applyAccountProgress(next) {
  if(next.completed.length<progress.completed.length)return;
  progress=next;
  const cached=profile();
  if(cached?.id===saves.account.id)setProfile({...cached,progress});
}

async function openMissions() {
  editor.cancel();
  if(document.pointerLockElement)document.exitPointerLock();
  selectedMission=null;
  if(!saves.account)progress=guestMissions();
  renderMissions();
  if(!saves.account)return;
  try {
    const data=await request('/progress',{account:saves.account});
    saves.online=true;
    applyAccountProgress(data.progress);
  } catch(error) {
    if(!error.status||error.status>=500)saves.online=false;
    else if(hud.missionsOpen){friendlyError(error);return;}
  }
  if(hud.missionsOpen)renderMissions();
}

async function claimMission(id) {
  if(missionNotice())return;
  if(!saves.account)progress=guestMissions();
  const mission=findMission(id);
  if(!mission||missionStatus(mission,progress.completed,missionStats(state))!=='ready'){
    renderMissions();return;
  }
  if(saves.account){
    await saves.save(state,{strict:true});
    const data=await request('/progress',{account:saves.account,method:'POST',payload:{id}});
    applyAccountProgress(data.progress);
  }else{
    const completed=[...progress.completed,id];
    localStorage.setItem(GUEST_MISSIONS_KEY,JSON.stringify(completed));
    progress=missionProgress(completed);
  }
  selectedMission=null;
  if(hud.missionsOpen){renderMissions();tell(`+${mission.xp} XP · Nível ${progress.level}`);}
}

function tell(message) {
  const current = hud.popup.open ? hud.popup : null;
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

async function connectProfile({render=true,notify=true}={}) {
  const online=await saves.connect();
  if(!online||!saves.account||slot!=='own'||guest)return online;
  try {
    const remote=await saves.prepareSync();
    if(!remote)return online;
    if(saves.conflicted){
      if(notify)showConflict(remote);
    }
    else {
      const next=upgradeStarter(remote);
      if(render)await prepareModels(next.objects);
      state=next;editor.start(state);
      if(render){cameraMode('orbit');view?.navigation.overview(state);changed();}
    }
  } catch (error) { if(error.status!==401)friendlyError(error); }
  return online;
}

function showConflict(remote) {
  if(!remote?.state)return;
  const activeLocal=escapeHTML(state.name), activeOnline=escapeHTML(remote.state.name);
  hud.modal('Escolha uma versão',`<p class="modal-intro">O navegador tem “${activeLocal}”. O servidor tem “${activeOnline}” na revisão ${remote.revision}. Escolha qual versão deve ficar no Reino principal.</p>
    <div class="option-grid"><button type="button" data-action="local-version">${icon('save')} Usar a versão deste navegador</button>
      <button type="button" data-action="remote-version">${icon('globe-2')} Carregar a versão do servidor</button></div>`);
}

async function navigate(path) {
  editor.cancel();
  if(document.pointerLockElement)document.exitPointerLock();
  if(!guest)await saves.save(state);
  location.assign(path);
}

async function switchSlot(next) {
  if(slot===next){hud.popup.close();return;}
  if(guest)await leaveVisit();
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

async function visit(record) {
  const valid=validatedKingdom(record.state);
  if(!valid)throw new Error('O reino publicado tem um salvamento inválido.');
  await prepareModels(valid.objects);
  guest={state:valid,kingdom:record.kingdom};
  editor.start(valid,{readOnly:true});
  hud.toggleCatalogue(false);
  cameraMode('orbit');view?.navigation.overview(valid);
  if(view) {view.navigation.position.set(-.6,0,9);view.navigation.yaw=0;}
  changed();hud.showVisit(guest.kingdom);
}

async function leaveVisit() {
  await prepareModels(state.objects);
  guest=null;
  history.replaceState(null,'','/');
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
  const gate=[...active().objects,...waterGates(active())].filter(o=>gates.has(o.type)&&Math.hypot(o.x-point.x,o.z-point.z)<(castleTypes.has(o.type)?21:8))
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
        const selected=editor.selected,kingdom=state,upgrade=fortificationUpgrade(selected);
        if(!upgrade)break;
        if(state.gold<upgrade.cost){hud.notify('Moedas insuficientes.');break;}
        const ready=!view||await loadFortificationKit(upgrade.level);
        if(!guest&&state===kingdom&&editor.selected===selected){
          if(ready)editor.upgradeFortification(which);
          else hud.notify('O modelo da melhoria não carregou. Tente novamente.');
        }
      }
      break;
    case 'show-building-upgrade':
      if(!guest&&editor.selected){
        if(document.pointerLockElement)document.exitPointerLock();
        hud.showBuildingUpgrade(editor.selected,state.gold);
      }
      break;
    case 'upgrade-building': {
      if(guest||editor.selected?.id!==value)return;
      const selected=editor.selected,kingdom=state,upgrade=buildingUpgrade(selected);
      if(!upgrade)return;
      if(state.gold<upgrade.cost){hud.notify('Moedas insuficientes.');break;}
      const ready=!view||await loadBuildingUpgrade(upgrade.object);
      if(guest||state!==kingdom||editor.selected!==selected)break;
      if(!ready){hud.notify('O modelo da melhoria não carregou. Tente novamente.');break;}
      if(editor.apply({kind:'upgrade-building',id:value})){
        hud.popup.close();
        editor.select(value);
        hud.notify(`Construção melhorada para o nível ${upgrade.level}.`);
      }
      break;
    }
    case 'missions': await openMissions(); break;
    case 'mission-select': selectedMission=value;renderMissions();break;
    case 'mission-claim': await claimMission(value);break;
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
    case 'settings': hud.showSettings(active(),slot,saves.account,saves.online,saves.conflicted); break;
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
    case 'map': await navigate(guest ? '/mapa.html?reino='+encodeURIComponent(guest.kingdom.id) : '/mapa.html'); break;
    case 'account': await navigate('/login.html'); break;
    case 'leave': await leaveVisit(); break;
    case 'saves': hud.showSlots(slot);break;
    case 'slot': await switchSlot(value);break;
    case 'save':
      if(guest){tell('Você está visitando um reino publicado.');break;}
      await saves.save(state);tell('Salvamento atualizado.');break;
    case 'resolve': showConflict(await request('/kingdom',{account:saves.account}));break;
    case 'remote-version': {
      const remote=await request('/kingdom',{account:saves.account});
      const next=upgradeStarter(await saves.useRemote(remote));
      await prepareModels(next.objects);
      state=next;
      editor.start(state);hud.popup.close();changed();break;
    }
    case 'local-version':
      await saves.useLocal(await request('/kingdom',{account:saves.account}),state);
      hud.popup.close();changed();break;
    case 'walk': cameraMode(view?.navigation.mode==='walk'?'orbit':'walk');break;
    case 'free': hud.popup.close();cameraMode('free');break;
    case 'overview': cameraMode('orbit');view?.navigation.overview(active());if(hud.popup.open)hud.popup.close();break;
    case 'focus-lake': {
      if(!view)break;
      cameraMode('free');
      editor.cancel();editor.select(null);
      const {x,z}=lakeCenter;
      const scale=Math.max(1,.94/view.camera.aspect);
      view.navigation.snap([x-15,0,z-6],[x-15+61*scale,99*scale,z-6+102*scale]);
      break;
    }
    case 'focus-castle': {
      const keep=active().objects.find(object=>castleTypes.has(object.type));
      if(!keep){hud.notify('Construa um castelo para enquadrá-lo.');break;}
      cameraMode('orbit');view?.focusCastle(keep);
      editor.cancel();editor.select(keep.id);
      break;
    }
    case 'zoom-in': view?.navigation.zoom(.82);break;
    case 'zoom-out': view?.navigation.zoom(1.22);break;
    case 'close': hud.popup.close();break;
  }
}

function run(which,value) {
  if(locked||root.dataset.ready!=='true')return;
  const asyncActions=['map','account','slot','leave','remote-version','local-version','save','item','buy-village-wall','upgrade-walls','upgrade-gate','upgrade-building','mission-claim'];
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
    if(point)editor.aim(point,false,editor.grading?view.pick(event,point,{foundationsOnly:true}):undefined);
  });
  canvas.addEventListener('pointerup',event=>{
    const from=pointerDown;pointerDown=null;
    if(root.dataset.ready!=='true'||!from||event.button!==0||from.pointer!==event.pointerId||
       Math.hypot(from.x-event.clientX,from.y-event.clientY)>8)return;
    if(hud.territoryOpen&&usesLots(state.territory)){
      const lot=view.pickExpansion(event);
      if(lot)action('preview-expansion',lot);
      return;
    }
    if(editor.placement||editor.clearing){
      const point=view.placeAt(event);
      if(point)editor.confirm(point,editor.grading?view.pick(event,point,{foundationsOnly:true}):undefined);
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
  if(root.dataset.ready!=='true'||modalsOpen()||event.target.matches('input,textarea,select')||event.target.isContentEditable)return;
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
window.addEventListener('online',()=>{if(state)connectProfile().then(ok=>{if(ok && !saves.conflicted&&!guest)saves.save(state);});});
window.addEventListener('pageshow',event=>{
  if(event.persisted)refreshAccount().then(account=>{
    if(account?.id!==saves.account?.id)location.reload();
  }).catch(()=>{});
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){audio.set(false);view?.navigation.keys.clear();}
  else if(active()?.sound)audio.set(true).catch(()=>{});
});

setInterval(()=>{
  if(document.hidden||root.dataset.ready!=='true'||guest)return;
  if(collectTax(state)){updateHUD();audio.harvest();saves.save(state);}
  else hud.tax(state);
},1000);
setInterval(async ()=>{
  if(document.hidden || !guest || !view || !saves.account || !saves.online) return;
  const id=guest.kingdom.id;
  const camera=view.navigation, foot=camera.position;
  try {
    const {players}=await request('/world/'+id+'/presence',{account:saves.account,method:'POST',payload:{x:foot.x,y:foot.y,z:foot.z,angle:Math.atan2(Math.sin(camera.yaw+Math.PI),Math.cos(camera.yaw+Math.PI))}});
    if(guest?.kingdom.id!==id)return;
    view.traffic.showPlayers(players);
    if(guest.count!==players.length){guest.count=players.length;hud.showVisit(guest.kingdom,players.length);}
  } catch {view.traffic.showPlayers([]);}
},2200);
setInterval(async ()=>{
  if(document.hidden||guest||!state||!saves.account||slot!=='own'||saves.conflicted||locked)return;
  const ok=await connectProfile();
  if(ok&&saves.current?.pending&&!saves.conflicted)await saves.save(state);
},18000);

async function initialize() {
  const destination=new URLSearchParams(location.search).get('visita');
  const target=destination && /^(?:[a-f0-9-]{36}|npc-[a-z]+)$/.test(destination) ?
    request('/world/'+destination,{account:null}).then(record=>({record}),error=>({error})) : null;
  try { saves.account=await refreshAccount(); }
  catch { saves.account=profile(); }
  hud.account(saves.account);
  progress=saves.account?missionProgress(saves.account.progress?.completed):guestMissions();
  const loaded=await saves.load(slot,saveKind(slot));
  state=slot==='own'?upgradeStarter(loaded):loaded;
  editor.start(state);hud.saved('Salvo neste navegador');
  await connectProfile({render:false,notify:!target});
  if(!saves.conflicted)await saves.save(state);
  if(target){
    try {
      const {record,error}=await target;
      if(error)throw error;
      await visit(record);
    }
    catch(error) { history.replaceState(null,'','/');friendlyError(error); }
  }
  if(!guest){
    await prepareModels(state.objects);
    view?.navigation.overview(state);
    changed();
  }
  root.dataset.ready='true';
}
initialize().catch(error=>{hud.notify('O reino não pôde ser carregado.');console.error(error);});


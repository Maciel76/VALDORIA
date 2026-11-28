import { catalogue } from './catalog.js';
import { constructionCost } from './economy-rules.js';
import { fixedRotation, snapPlacement, getLineCandidate, linePositions, gates, containsPoint, footprint,
  foundationSlopeError, foundationSlopeTarget, landscapeBlocked, landscapeObstacles } from './geometry.js';
import { edit } from './kingdom.js';
import { fortificationLevel,isFixedFortification,isVillageGate } from './fortifications.js';
import { bounds,insideTerritory } from '../world/terrain-data.js';
import { validWaterGateId,waterGates } from '../world/perimeter.js';

function clearingBounds(first,second){
  return {minX:Math.min(first.x,second.x),maxX:Math.max(first.x,second.x)+1,
    minZ:Math.min(first.z,second.z),maxZ:Math.max(first.z,second.z)+1};
}

export class Editor {
  constructor(view,hud,onChange) { this.view=view;this.hud=hud;this.onChange=onChange;this.history=[]; }
  start(state,{readOnly=false}={}) {
    this.state=state;
    this.readOnly=readOnly;
    this.history=[];
    this.cancel();
    this.select(null);
  }
  get player() {
    return this.view?.navigation.mode==='walk'?this.view.navigation.position:null;
  }
  get grading() { return this.placement?.type==='terrainSlope'; }
  select(id) {
    this.selected=this.state.objects.find(object=>object.id===id) ??
      (validWaterGateId(id)?waterGates(this.state).find(gate=>gate.id===id):null) ?? null;
    this.selectedObstacle=this.selected||this.readOnly?null:this.view?.terrain?.obstacleAt(id)??null;
    this.view?.markObject(this.selection,Boolean(this.selectedObstacle));
    this.hud.showSelection(this.selection,Boolean(this.selectedObstacle),this.readOnly);
    if(this.selection)this.hud.positionSelection(this.view?.projectSelection());
  }
  get selection() { return this.selected??this.selectedObstacle; }
  startClearing(first=null) {
    if(!this.view?.terrain)return;
    this.cancel();
    this.select(null);
    this.clearing={first:null,point:null,plot:null};
    this.hud.toggleCatalogue(false);
    if(first)this.markClearing(first);
    else this.hud.showClearing(this.clearing);
    this.view.canvas.focus({preventScroll:true});
  }
  clearingPoint(point) {
    const edge=bounds(this.state.territory);
    const snap=(value,min,max)=>Math.max(min,Math.min(max-1,Math.floor(value)));
    return {x:snap(point.x,edge.minX,edge.maxX),z:snap(point.z,edge.minZ,edge.maxZ)};
  }
  markClearing(point) {
    if(!insideTerritory(point.x,point.z,bounds(this.state.territory))){
      this.hud.notify('Marque os cantos dentro do seu território.');
      return;
    }
    const entry=this.clearing;
    const next=this.clearingPoint(point);
    if(!entry.first||entry.plot){
      entry.first=entry.point=next;
      entry.plot=null;
      this.view.terrain.showClearing(clearingBounds(next,next),this.state.territory);
    }else{
      const edge=clearingBounds(entry.first,next);
      entry.plot={x:(edge.minX+edge.maxX)/2,z:(edge.minZ+edge.maxZ)/2,w:edge.maxX-edge.minX,d:edge.maxZ-edge.minZ};
      this.view.terrain.showClearing(edge,this.state.territory,true);
    }
    this.updateClearing();
  }
  updateClearing() {
    const entry=this.clearing;
    if(!entry)return;
    const count=entry.plot?[...landscapeObstacles(this.state,entry.plot)].length:0;
    this.hud.showClearing(entry,count);
  }
  clearTerrain() {
    const area=this.clearing?.plot;
    const plots=area?[area]:this.detail?.clearPlots;
    if(!plots?.length)return;
    const ids=new Set();
    for(const plot of plots)for(const point of landscapeObstacles(this.state,plot))ids.add(point.id);
    if(!this.apply({kind:'clear-landscape',ids:[...ids]}))return;
    if(area)this.cancel();
    else this.updatePreview();
    this.view.canvas.focus({preventScroll:true});
    this.hud.notify('Terreno limpo. Você já pode construir no local.');
  }
  startPlacement(type, object=null) {
    if(!this.view||isFixedFortification(object)||type==='villageWall'||(!object&&!catalogue[type]?.purchasable))return;
    if(this.clearing)this.cancel();
    this.select(null);
    const point=object ? {x:object.x,z:object.z} : this.player ?
      {x:this.player.x-Math.sin(this.view.navigation.yaw)*8,z:this.player.z-Math.cos(this.view.navigation.yaw)*8} :
      {x:18,z:18};
    this.placement={type,rotation:object?.rotation??(type==='riverBridge'?1:0),point:null,line:false,repeat:!object,anchor:null,move:object};
    if(this.grading)this.updatePreview();
    else this.aim(point);
    this.hud.toggleCatalogue(false);
    this.view.canvas.focus({preventScroll:true});
  }
  aim(point,refresh=false,hit) {
    if(this.clearing){
      const entry=this.clearing;
      if(!point||!entry.first||entry.plot)return;
      const next=this.clearingPoint(point);
      if(next.x===entry.point.x&&next.z===entry.point.z)return;
      entry.point=next;
      this.view.terrain.showClearing(clearingBounds(entry.first,next),this.state.territory);
      return;
    }
    const entry=this.placement;
    if(!entry||!point||(entry.hold&&!refresh))return;
    if(this.grading){
      const target=foundationSlopeTarget(this.state,point,hit);
      if(refresh||target!==entry.target){entry.target=target;this.updatePreview();}
      return;
    }
    entry.cursor=point;
    const next=snapPlacement(catalogue[entry.type],point,entry.rotation);
    if(!refresh&&next.x===entry.point?.x&&next.z===entry.point?.z)return;
    entry.point=next;
    this.updatePreview();
  }
  nudge(x,z) {
    const entry=this.placement;
    if(!entry?.point)return;
    const step=catalogue[entry.type].grid;
    entry.hold=false;
    this.aim({x:entry.point.x+x*step,z:entry.point.z+z*step});
  }
  rotate(sign) {
    if(this.grading)return;
    if(this.placement){
      this.placement.rotation=fixedRotation(this.placement.rotation+sign);
      this.placement.anchor=null;
      this.aim(this.placement.cursor,true);
    } else if(this.selected) {
      this.moveSelected({rotation:this.selected.rotation+sign});
    }
  }
  setLine() {
    if(!this.placement||!catalogue[this.placement.type].line)return;
    this.placement.line=!this.placement.line;
    this.placement.anchor=null;
    this.updatePreview();
  }
  setRepeat() {
    if(!this.placement||this.placement.move)return;
    this.placement.repeat=!this.placement.repeat;
    this.updatePreview();
  }
  cancel() {
    if(this.clearing)this.view?.terrain?.showClearing(null);
    this.clearing=null;
    this.placement=null;
    this.detail=null;
    this.view?.clearPreview();
    this.hud.showPlacement(null);
    this.hud.item=null;
    this.hud.markItem();
  }
  updatePreview() {
    const entry=this.placement;
    if(this.grading){
      const target=this.state.objects.find(object=>object.id===entry.target?.id);
      const {seed,territory,gold}=this.state;
      const cost=constructionCost('terrainSlope');
      const reason=foundationSlopeError(target,seed,territory)||(gold<cost?'Moedas insuficientes.':'');
      this.detail={cost,reason,clearPlots:[]};
      this.view?.showSlopePreview(target,Boolean(reason));
      this.hud.showPlacement(entry,this.detail);
      return;
    }
    if(!entry?.point)return;
    const item=catalogue[entry.type];
    const points=entry.line && entry.anchor ? linePositions(item,entry.anchor,entry.point,entry.rotation) : [{...entry.point,rotation:entry.rotation}];
    const options={player:this.player,ignore:entry.move?.id,moving:entry.move};
    const result=getLineCandidate(this.state,item,points,options);
    const reason=result.failures.find(Boolean) || (!entry.move&&this.state.gold<result.total?'Moedas insuficientes.':'');
    const clearPlots=result.failures.every(failure=>!failure||failure===landscapeBlocked)
      ? points.filter((_,i)=>result.failures[i]===landscapeBlocked).map(point=>footprint({...entry.move,...point,type:entry.type})) : [];
    this.detail={points,cost:result.total,reason,clearPlots};
    if(entry.move)this.view?.setMovePreview(entry.move,points[0],Boolean(reason));
    else this.view?.setPreview(points,{type:entry.type},result.failures.map(failed=>failed||this.state.gold<result.total));
    this.hud.showPlacement(entry,this.detail);
  }
  confirm(point,hit) {
    if(this.clearing){
      if(point)this.markClearing(point);
      else if(this.clearing.plot)this.clearTerrain();
      return;
    }
    if(point&&this.placement){
      this.placement.hold=false;
      this.aim(point,true,hit);
    }
    const entry=this.placement;
    if(!entry||!this.detail)return;
    if(this.detail.reason){
      if(this.detail.clearPlots.length){
        entry.hold=true;
        this.hud.showPlacement(entry,this.detail);
      }
      this.hud.notify(this.detail.reason);
      return;
    }
    if(this.grading){
      if(!this.apply({kind:'landscape-foundation',id:entry.target.id}))return;
      if(entry.repeat)this.updatePreview();
      else this.cancel();
      this.hud.notify('Talude natural aplicado.');
      return;
    }
    if(entry.line&&!entry.anchor){entry.anchor={...entry.point};this.updatePreview();return;}
    const points=this.detail.points.map(point=>({...point,type:entry.type}));
    const result=this.apply(entry.move ? {kind:'move',id:entry.move.id,...points[0]} : {kind:'place',points});
    if(!result)return;
    if(entry.move) {
      const id=entry.move.id;
      this.cancel();this.select(id);
      this.hud.notify('Construção movida.');
      return;
    }
    if(entry.repeat) {
      entry.anchor=null;entry.hold=false;this.updatePreview();
    } else {
      this.cancel();
    }
    this.hud.notify(points.length===1?'Construção concluída.':`${points.length} peças construídas.`);
  }
  moveSelected({rotation}={}) {
    const object=this.selected;
    if(!object)return;
    if(rotation===undefined){this.startPlacement(object.type,object);return;}
    const item=catalogue[object.type];
    const {x,z}=item.sidewalkOf?snapPlacement(item,object,rotation):object;
    if(this.apply({kind:'move',id:object.id,x,z,rotation})){this.select(object.id);this.hud.notify('Construção girada.');}
  }
  upgradeFortification(kind) {
    if(!this.selected)return;
    const gate=isVillageGate(this.selected);
    if(this.apply({kind,id:this.selected.id})){
      this.select(this.selected.id);
      const level=fortificationLevel(this.selected);
      this.hud.notify(gate?`Portão melhorado para o nível ${level}.`:`Muralha melhorada para o nível ${level}.`);
    }
  }
  remove() {
    const object=this.selection,obstacle=this.selectedObstacle;
    if(!object)return;
    const action=obstacle?{kind:'clear-landscape',ids:[obstacle.id]}:{kind:'remove',id:object.id};
    if(this.apply(action)){
      this.select(null);
      this.hud.notify(obstacle?(obstacle.type==='rock'?'Pedra removida.':'Árvore removida.'):'Construção excluída.');
    }
  }
  toggleGate(id) {
    const object=this.state.objects.find(o=>o.id===id) ??
      (validWaterGateId(id)?waterGates(this.state).find(gate=>gate.id===id):null);
    if(!object || !gates.has(object.type))return;
    if(object.open&&this.player&&containsPoint({...object,open:false},this.player.x,this.player.z,.45)){
      this.hud.notify('Afaste-se da passagem antes de fechar o portão.');
      return;
    }
    if(this.apply({kind:'gate',id})){
      this.select(this.selection?.id);
      const message=object.type==='waterGate'
        ? (object.open?'Comporta fechada.':'Comporta aberta.')
        : (object.open?'Portão fechado.':'Portão aberto.');
      this.hud.notify(message);
    }
  }
  apply(action) {
    const result=edit(this.state,action,this.player);
    if(result.error){this.hud.notify(result.error);return null;}
    this.history.push(result.undo);
    if(this.history.length>100)this.history.shift();
    const reveal=action.kind==='place'||(action.kind==='upgrade-building'&&
      result.objects.some(o=>['market','watermill','windmill','chapel','church','barracks'].includes(o.type)));
    this.onChange({modified:true,created:reveal?result.objects.map(o=>o.id):[]});
    return result;
  }
  undo() {
    if(!this.history.length)return;
    const change=this.history.at(-1);
    if(this.player && change.add?.some(object=>containsPoint(object,this.player.x,this.player.z,.43))){
      this.hud.notify('Afaste-se para restaurar a construção.');
      return;
    }
    const result=edit(this.state,{kind:'undo',change},this.player);
    if(result.error){this.hud.notify(result.error);return;}
    this.history.pop();
    this.onChange({modified:true});
    this.select(this.selection?.id);
    this.updatePreview();
    this.updateClearing();
    this.hud.notify('Última alteração desfeita.');
  }
}


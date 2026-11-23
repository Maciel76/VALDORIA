import { catalogue } from './catalog.js';
import { fixedRotation, gridRound, getLineCandidate, linePositions, gates, containsPoint } from './geometry.js';
import { edit } from './kingdom.js';

export class Editor {
  constructor(view,hud,onChange) { this.view=view;this.hud=hud;this.onChange=onChange;this.history=[]; }
  start(state) {
    this.state=state;
    this.history=[];
    this.cancel();
    this.select(null);
  }
  get player() {
    return this.view?.navigation.mode==='walk'?this.view.navigation.position:null;
  }
  select(id) {
    this.selected=this.state.objects.find(object=>object.id===id) || null;
    this.view?.markObject(this.selected);
    this.hud.showSelection(this.selected);
    if(this.selected)this.hud.positionSelection(this.view?.projectSelection());
  }
  startPlacement(type, object=null) {
    if(!this.view)return;
    this.select(null);
    const point=object ? {x:object.x,z:object.z} : this.player ?
      {x:this.player.x-Math.sin(this.view.navigation.yaw)*8,z:this.player.z-Math.cos(this.view.navigation.yaw)*8} :
      {x:18,z:18};
    this.placement={type,rotation:object?.rotation||0,point:null,line:false,repeat:false,anchor:null,move:object};
    this.aim(point);
    this.hud.toggleCatalogue(false);
    this.view.canvas.focus({preventScroll:true});
  }
  aim(point,refresh=false) {
    const entry=this.placement;
    if(!entry||!point)return;
    const {grid}=catalogue[entry.type];
    const next={x:gridRound(point.x,grid),z:gridRound(point.z,grid)};
    if(!refresh&&next.x===entry.point?.x&&next.z===entry.point?.z)return;
    entry.point=next;
    this.updatePreview();
  }
  nudge(x,z) {
    const entry=this.placement;
    if(!entry)return;
    const step=catalogue[entry.type].grid;
    this.aim({x:entry.point.x+x*step,z:entry.point.z+z*step});
  }
  rotate(sign) {
    if(this.placement){
      this.placement.rotation=fixedRotation(this.placement.rotation+sign);
      this.placement.anchor=null;
      this.updatePreview();
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
    this.placement=null;
    this.detail=null;
    this.view?.clearPreview();
    this.hud.showPlacement(null);
    this.hud.item=null;
    this.hud.markItem();
  }
  updatePreview() {
    const entry=this.placement;
    if(!entry?.point)return;
    const item=catalogue[entry.type];
    const points=entry.line && entry.anchor ? linePositions(item,entry.anchor,entry.point,entry.rotation) : [{...entry.point,rotation:entry.rotation}];
    const options={player:this.player,ignore:entry.move?.id};
    const result=getLineCandidate(this.state,item,points,options);
    const reason=result.failures.find(Boolean) || (!entry.move&&this.state.gold<result.total?'Moedas insuficientes.':'');
    this.detail={points,cost:result.total,reason};
    this.view?.setPreview(points,entry.type,result.failures.map(failed=>failed||(!entry.move&&this.state.gold<result.total)));
    this.hud.showPlacement(entry,this.detail);
  }
  confirm(point) {
    if(point)this.aim(point,true);
    const entry=this.placement;
    if(!entry||!this.detail)return;
    if(this.detail.reason){this.hud.notify(this.detail.reason);return;}
    if(entry.line&&!entry.anchor){entry.anchor={...entry.point};this.updatePreview();return;}
    const points=this.detail.points.map(point=>({...point,type:entry.type}));
    const result=this.apply(entry.move ? {kind:'move',id:entry.move.id,...points[0]} : {kind:'place',points});
    if(!result)return;
    if(entry.move) {
      const id=entry.move.id;
      this.cancel();this.select(id);
      this.hud.notify('Construção movida.');
    } else if(entry.repeat) {
      entry.anchor=null;this.updatePreview();
      this.hud.notify(points.length===1?'Construção concluída.':`${points.length} peças construídas.`);
    } else {
      this.cancel();
      this.hud.notify(points.length===1?'Construção concluída.':`${points.length} peças construídas.`);
    }
  }
  moveSelected({rotation}={}) {
    const object=this.selected;
    if(!object)return;
    if(rotation===undefined){this.startPlacement(object.type,object);return;}
    if(this.apply({kind:'move',id:object.id,x:object.x,z:object.z,rotation})){this.select(object.id);this.hud.notify('Construção girada.');}
  }
  remove() {
    if(!this.selected)return;
    if(this.apply({kind:'remove',id:this.selected.id})){this.select(null);this.hud.notify('Construção excluída.');}
  }
  toggleGate(id) {
    const object=this.state.objects.find(o=>o.id===id);
    if(!object || !gates.has(object.type))return;
    if(object.open&&this.player&&containsPoint({...object,open:false},this.player.x,this.player.z,.45)){
      this.hud.notify('Afaste-se da passagem antes de fechar o portão.');
      return;
    }
    if(this.apply({kind:'gate',id})){this.select(this.selected?.id);this.hud.notify(object.open?'Portão fechado.':'Portão aberto.');}
  }
  apply(action) {
    const result=edit(this.state,action,this.player);
    if(result.error){this.hud.notify(result.error);return null;}
    this.history.push(result.undo);
    if(this.history.length>100)this.history.shift();
    this.onChange({modified:true,created:action.kind==='place'?result.objects.map(o=>o.id):[]});
    return result;
  }
  undo() {
    if(!this.history.length)return;
    const change=this.history.pop();
    if(this.player && change.add.some(object=>containsPoint(object,this.player.x,this.player.z,.43))){
      this.history.push(change);
      this.hud.notify('Afaste-se para restaurar a construção.');
      return;
    }
    edit(this.state,{kind:'undo',change});
    this.select(this.selected?.id);
    this.onChange({modified:true});
    this.updatePreview();
    this.hud.notify('Última alteração desfeita.');
  }
}


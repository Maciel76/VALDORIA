export class AmbientSound {
  next=0;
  node=null;
  async set(active){
    if(!active){this.master?.gain.setTargetAtTime(0,this.context.currentTime,.13);return;}
    if(!window.AudioContext)return;
    if(!this.context){
      this.context=new AudioContext();
      this.master=this.context.createGain();this.master.gain.value=0;
      this.master.connect(this.context.destination);
      const length=this.context.sampleRate*3;
      const noise=this.context.createBuffer(1,length,this.context.sampleRate);
      const data=noise.getChannelData(0);
      let coast=0;
      for(let i=0;i<length;i++){coast=(coast+(Math.random()*2-1)*.025)*.974;data[i]=coast;}
      this.node=this.context.createBufferSource();this.node.buffer=noise;this.node.loop=true;
      this.wind=this.context.createBiquadFilter();this.wind.type='lowpass';this.wind.frequency.value=430;
      this.node.connect(this.wind).connect(this.master);this.node.start();
    }
    await this.context.resume();
    this.master.gain.setTargetAtTime(.19,this.context.currentTime,.22);
  }
  tone(frequency,end,volume,seconds,type='sine',delay=0){
    const start=this.context.currentTime+delay;
    const wave=this.context.createOscillator(), envelope=this.context.createGain();
    wave.type=type;wave.frequency.setValueAtTime(frequency,start);wave.frequency.exponentialRampToValueAtTime(end,start+seconds*.8);
    envelope.gain.setValueAtTime(.0001,start);envelope.gain.exponentialRampToValueAtTime(volume,start+.035);
    envelope.gain.exponentialRampToValueAtTime(.0001,start+seconds);
    wave.connect(envelope).connect(this.master);wave.start(start);wave.stop(start+seconds+.02);
  }
  harvest() {
    if(this.context?.state==='running'&&this.master.gain.value>.02){
      this.tone(523,521,.065,.62);this.tone(784,780,.028,.47,'sine',.075);
    }
  }
  step(clock,state,point) {
    if(!state.sound||this.context?.state!=='running'||clock<this.next)return;
    const close=(type,r)=>state.objects.some(o=>type.includes(o.type)&&Math.hypot(o.x-point.x,o.z-point.z)<r);
    const water=close(['watermill','fountain'],20) || point.x>46&&point.x<78;
    this.wind.frequency.setTargetAtTime(water?960:state.time==='night'?270:480,this.context.currentTime,.7);
    const chance=Math.random();
    if(chance<.38&&close(['smith'],21)){
      for(let i=0;i<3;i++){this.tone(445,226,.057,.11,'triangle',i*.31);this.tone(1090,910,.022,.12,'sine',i*.31);}
    } else if(chance<.59&&close(['stable','cart'],24)){
      for(let i=0;i<4;i++)this.tone(115,66,.063,.075,'triangle',i*.19+i%2*.04);
    } else if(chance<.69&&close(['bonfire','torch','brazier'],18)){
      for(let i=0;i<5;i++)this.tone(240+i*93,110+i*17,.023,.07,'triangle',i*.09);
    } else if(state.time!=='night'){
      for(let i=0;i<3;i++)this.tone(1380+i*190,1770+i*129,.027,.16,'sine',i*.17);
    }
    this.next=clock+4+Math.random()*8;
  }
}


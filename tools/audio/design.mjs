// Original nonvocal Foley and instrument design, rendered once at build time.
// No microphone, vocal samples, third-party recordings or generated speech.
export const RATE=48000;
const TAU=Math.PI*2;
function rng(seed){return()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};}
export function renderCue(key,family,variant=0){
  const seed=[...key].reduce((a,c)=>(a*33+c.charCodeAt(0))>>>0,7919)+variant*7381;
  const random=rng(seed),pitch=1+(variant-1)*.037;
  const duration=family==='ambience'?6:family==='weather'?2.2:['victory','defeat','boss','breach'].includes(key)?2.6:family==='reward'?1.05:family==='creature'?.8:family==='ability'?1.2:['explosion','lob','mortar'].includes(key)?.9:family==='movement'?.36:.48;
  const samples=new Float32Array(Math.ceil(duration*RATE));
  function tone(start,length,freq,amp,{end=freq,attack=.003,decay=5,metal=0,rough=0}={}){
    let phase=0;for(let i=0;i<length*RATE&&Math.floor(start*RATE)+i<samples.length;i++){
      const t=i/RATE,u=t/length,f=(freq+(end-freq)*u)*pitch;phase+=TAU*f/RATE;
      const env=Math.min(1,t/attack)*Math.exp(-u*decay)*Math.min(1,(length-t)/.015);
      samples[Math.floor(start*RATE)+i]+=amp*env*(Math.sin(phase)+metal*Math.sin(phase*2.71)+rough*Math.sin(phase*1.013)*Math.sin(phase*.14));
    }
  }
  function noise(start,length,amp,{low=1800,high=90,attack=.002,decay=5,pulse=0}={}){
    let lp=0,hp=0;const lo=1-Math.exp(-TAU*low/RATE),hi=1-Math.exp(-TAU*high/RATE);
    for(let i=0;i<length*RATE&&Math.floor(start*RATE)+i<samples.length;i++){
      const t=i/RATE,u=t/length,n=random()*2-1;lp+=(n-lp)*lo;hp+=(lp-hp)*hi;
      const env=Math.min(1,t/attack)*Math.exp(-u*decay)*Math.min(1,(length-t)/.025)*(pulse?.55+.45*Math.sin(TAU*pulse*t)**2:1);
      samples[Math.floor(start*RATE)+i]+=amp*env*(lp-hp);
    }
  }
  const chime=(notes,level=.25)=>notes.forEach((f,i)=>{tone(i*.11,.72,f,level,{metal:.18,decay:5});tone(i*.11,.58,f*2,.045,{decay:6});});
  if(family==='ui'){
    if(key==='deny'){tone(0,.16,170,.3,{end:105,metal:.3});noise(0,.08,.25,{low:800});}
    else if(key==='salvage'){for(let j=0;j<5;j++)noise(j*.047,.16,.5,{low:2200,high:600});tone(.12,.3,440,.17,{end:250,metal:.7});}
    else if(key==='equip'){noise(0,.055,.5,{low:4200});tone(.035,.22,540,.2,{metal:.8});noise(.07,.07,.5,{low:1800});}
    else {tone(0,.075,key==='aim'?640:1150,.23,{end:key==='aim'?800:950});noise(0,.028,.2,{low:4200});if(key==='order'||key==='rally')tone(.09,.2,1450,.17);}
  }else if(family==='reward'){
    const notes=({build:[294,440],upgrade:[440,554,659,880],forge:[330,495,660],sell:[784,587,392],talent:[659,880,1109],begin:[294,392,587],waveStart:[294,330,440],reconnect:[392,523,784]})[key]||(key==='defeat'?[294,233,196]:key==='victory'?[392,494,587,784,988]:key==='coin'?[1320,1760]:key==='crystal'?[1175,1568,2350]:key==='deposit'?[784,988,1175,1568]:key==='waveClear'?[523,659,784]:[392,587,784]);
    chime(notes,key==='coin'?.19:.26);
    if(['build','upgrade','forge','sell'].includes(key)){
      noise(0,.25,.65,{low:1400});tone(0,.4,key==='forge'?110:175,.38,{end:70,metal:.75});
      for(let j=0;j<3;j++)tone(j*.09,.28,620+j*157,.08,{metal:.5});
      if(key==='forge'){for(const t of [0,.19,.38]){noise(t,.065,.55,{low:5200,high:700});tone(t,.36,740,.23,{metal:.8,decay:4});}}
      if(key==='build')noise(.17,.24,.6,{low:700,high:40});
    }
  }else if(family==='weapon'){
    if(['swing','spear','twinblade'].includes(key)){
      noise(0,.32,key==='spear'?.7:.85,{low:key==='twinblade'?6500:4200,high:350,attack:.04,decay:3});tone(.015,.21,180,.2,{end:55});if(key==='twinblade')noise(.12,.28,.5,{low:5400,high:600,attack:.02});
    }else if(['rifle','shot','lob','mortar'].includes(key)){
      const profiles={rifle:[10000,330,90,.24,3800,.27],shot:[6400,760,210,.2,2700,.19],lob:[3200,235,95,.42,1700,.4],mortar:[4800,115,32,.78,650,.78]};
      const [crack,body,end,tail,dust,spread]=profiles[key];
      noise(0,.025,.9,{low:crack,high:300});tone(0,tail,body,.65,{end,decay:7,rough:.1});noise(.014,spread,.7,{low:dust,decay:6});
      if(key==='rifle'){noise(.085,.055,.32,{low:5800,high:1700});tone(.09,.12,2100,.08,{metal:.8});}
      if(key==='shot'){tone(.015,.24,2100,.2,{end:420,metal:.2});noise(.04,.15,.2,{low:5500,pulse:60});}
      if(key==='lob'){noise(.025,.23,.5,{low:1200,high:200,attack:.012});tone(.035,.2,520,.12,{end:200});}
      if(key==='mortar'){tone(.065,.72,58,.3,{end:31,decay:4});noise(.17,.5,.28,{low:450,high:25});}
    }else if(key==='fire'){
      noise(0,.47,.95,{low:3100,high:180,attack:.025,decay:1.8,pulse:33});tone(0,.42,120,.26,{end:65,rough:.35});for(let i=0;i<6;i++)noise(random()*.32,.023,.2,{low:7500});
    }else if(key==='cryo'){
      noise(0,.23,.6,{low:8000,high:3000});[930,1480,2370].forEach(f=>tone(0,.4,f,.17,{end:f*.62,metal:.25}));
    }else{
      const zap=key==='zap';for(let i=0;i<(zap?4:2);i++)tone(i*.038,.28,680+i*233,.23,{end:90+i*80,rough:.3,metal:.25});noise(0,.25,.45,{low:5000,high:500,pulse:zap?43:14});
    }
  }else if(family==='impact'){
    const heavy=['explosion','leak','enemyHit'].includes(key);
    noise(0,heavy?.8:.23,.95,{low:heavy?1600:5800,high:60,decay:5});tone(0,heavy?.8:.28,heavy?95:230,.65,{end:heavy?35:75,decay:5});
    if(key==='blocked'||key==='shed')[460,1270,2011,3370].forEach(f=>tone(0,.4,f,.12,{metal:.4}));
    if(key==='kill'){for(let i=0;i<4;i++)noise(i*.047,.1,.4,{low:2100,high:450});tone(.1,.3,420,.14,{end:140});}
    if(key==='meleeHit'){tone(0,.12,910,.22,{end:350,metal:.4});noise(.065,.15,.35,{low:1200});}
  }else if(family==='creature'){
    if(key==='breach'||key==='boss'||key==='portal'){
      tone(0,2,65,.45,{end:key==='portal'?140:30,rough:.4,decay:2});noise(0,2,.65,{low:1500,attack:.07,decay:2,pulse:11});for(let j=0;j<8;j++)tone(j*.09,.5,230+j*23,.07,{end:140,metal:.6});
    }else{
      const wing=key==='flier';for(let j=0;j<(wing?12:6);j++){const start=j*(wing?.05:.09)+random()*.025;noise(start,.1,.6,{low:wing?3500:2200,high:wing?500:90});tone(start,.08,key==='brute'?72:370+random()*300,.22,{end:90,metal:wing?0:.7});}
    }
  }else if(family==='movement'){
    if(['possess','release','mount','dismount','flight'].includes(key)){
      tone(0,.35,key==='release'?800:150,.24,{end:key==='release'?200:700,rough:.2});noise(0,.25,.38,{low:1700,attack:.025});
    }else if(key==='stepWater'){
      noise(0,.32,.8,{low:4600,high:450,attack:.01});for(let i=0;i<4;i++)tone(i*.034,.1,350+random()*900,.08,{end:1400});
    }else{
      const hard=key==='stepHard'||key==='stepIce';tone(0,.16,key==='land'?90:hard?190:110,.45,{end:45,decay:7});noise(.005,.22,.6,{low:hard?3300:1700,high:130,decay:6});if(key==='stepIce')tone(0,.2,1700,.09,{metal:.8});if(key==='jump')noise(.06,.25,.22,{low:4200,attack:.03});
    }
  }else if(family==='ability'){
    const freq={guard:130,haste:620,deadeye:960,barrage:85,renew:523,weaponPower:330,disconnect:220,respawn:440}[key];
    tone(0,.85,freq,.32,{end:key==='disconnect'?110:freq*1.5,rough:.14,attack:.02,decay:2});tone(.04,.95,freq*1.5,.14,{metal:.15,decay:3});noise(0,.6,.4,{low:2400,attack:.04,decay:3});if(key==='renew'||key==='respawn')chime([660,880,1320],.13);
  }else if(family==='weather'){
    if(key==='warning'){[0,.45,.9].forEach(t=>{tone(t,.35,440,.2,{end:520,metal:.1});tone(t,.3,660,.08);});}
    else if(['thunder','radiation','meteor','eruption','quake'].includes(key)){
      noise(0,2.2,1.2,{low:key==='radiation'?4800:1400,high:28,attack:.005,decay:3});tone(.025,2,55,.45,{end:29,rough:.3,decay:2});for(let j=0;j<8;j++)noise(j*.19+random()*.05,.23,.4,{low:key==='quake'?850:3300,high:75});if(key==='radiation')tone(0,.9,980,.22,{end:80,metal:.4});
    }else{noise(0,2.2,1.5,{low:key==='geyser'?4200:2300,high:90,attack:.17,decay:1.6,pulse:key==='hail'?21:3});if(key==='tsunami')noise(.4,1.6,1.4,{low:750,high:30,attack:.2,decay:2});}
  }else if(family==='ambience'){
    // Seamless noise bed. No oscillator pad and no human/animal voice sample.
    noise(0,6,key==='ocean'?2:1.3,{low:{forest:1700,ocean:1900,desert:950,ice:3100,lava:570,cosmic:1300}[key],high:45,attack:.4,decay:0,pulse:key==='ocean'?.19:.08});
    if(key==='forest')for(let j=0;j<13;j++)tone(random()*5,.06,3700+random()*1100,.022,{end:2200});
    if(key==='lava')for(let j=0;j<10;j++)noise(random()*5,.12,.3,{low:1800});
    const overlap=Math.floor(.4*RATE),end=samples.length-overlap;
    for(let i=0;i<overlap;i++)samples[i]=samples[i]*i/overlap+samples[end+i]*(1-i/overlap);
    return finish(samples.slice(0,end),.42);
  }
  // Short diffuse reflections give solid surfaces a body without long tails
  // washing out rapid input. They are baked, not convolution nodes at runtime.
  const dry=samples.slice();for(const [seconds,gain]of [[.021,.13],[.037,.08],[.061,.035]]){
    const offset=Math.floor(seconds*RATE);for(let i=offset;i<samples.length;i++)samples[i]+=dry[i-offset]*gain;
  }
  return finish(samples,.83);
}
function finish(samples,peak){
  let dc=0;for(const x of samples)dc+=x;dc/=samples.length;
  let max=0;for(let i=0;i<samples.length;i++){samples[i]=Math.tanh((samples[i]-dc)*1.2);max=Math.max(max,Math.abs(samples[i]));}
  const scale=Math.min(1.8,peak/Math.max(.001,max));
  for(let i=0;i<samples.length;i++)samples[i]*=scale;
  const edge=Math.min(240,samples.length/2);for(let i=0;i<edge;i++){samples[i]*=i/edge;samples[samples.length-1-i]*=i/edge;}
  return samples;
}

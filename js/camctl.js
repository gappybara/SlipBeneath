/* ═══ SBCam: play SLIP BENEATH with the webcam alone (cam.html; index.html stays mouse + keys). MediaPipe face + hand, the visitor
   standing ≥ 60 cm away. Everything is measured against a pose learned in the first seconds ("ahead"), so height doesn't matter.
     steer     ← turn your head: you turn and swim that way (the further you turn, the faster); nod up / down to rise or sink
     swim      ← you glide slowly on your own; lean in to go faster, step back to stop
     echo      ← open your mouth (the dolphin's call)        · also: dive at the title, knock on the face in the wake, the dolphin
     take      ← make a fist near a lit sound
     listen    ← in THE DEEP, an open palm held still for 1 s near a being (again to let go)
     sleep     ← in THE DEEP, close your eyes for 2 s
     point     ← in the wake's ring of signs, where your head points is the cursor (the real mouse wins while it moves)
   Two modes: DEFAULT — mouth (echo), eyes (sleep), open palm (listen), fist (take); you look and glide with the mouse (scroll).
   FULL (press H) — the head steers and points, leaning swims, as well.
   It starts only when the wake's face opens (SBCam.begin): before that the wake's own face tracking feeds the mouth, so the title
   and the wake run without a second model (the lag). */
/*   The wake runs its own face tracking while the face is on screen; SBCam pauses then and reads the mouth from the wake (feedJaw).
   Mouse and keyboard keep working alongside. V shows / hides the small camera panel; [ ] change the head sensitivity. */
window.SBCam=(()=>{
  const on=window.SB_CAM===true;
  if(!on) return {on:false, ready:false, edge:()=>false, look:()=>null, swim:()=>0, side:()=>0, feedJaw(){}, set paused(v){}, get paused(){ return false; }};
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)), lerp=(a,b,k)=>a+(b-a)*k;
  const T={ dead:.035, full:.2, turn:1.0, look:2.2, sens:1, leanOn:1.02, leanOff:.965, jaw:.34, jawOff:.18, gap:.6, fist:1.25, open:1.7, still:.024, blink:.55 };   // still: a standing hand trembles; this much wrist drift between reads still counts as held
  const S={full:false,found:false,cal:null,calN:0,yaw:0,pitch:0,size:0,sy:0,sp:0,lean:1,jaw:0,blink:0,fist:0,open:0,still:0,lastW:null,hand:false, ly:0,lp:0,eyesT:0,palmT:0};
  const edges={mouth:false,fist:false}; let jawArmed=true, lastMouth=-9, fistWas=0, paused=false, ready=false, face=null, hand=null, lastVT=-1, frameN=0;
  const video=document.createElement('video'); video.playsInline=true; video.muted=true;
  /* the small panel: the mirror, and one line of what it sees */
  const box=document.createElement('div'); box.id='camctl'; box.style.display='none';   // hidden: no face on screen while playing (V shows it)
  box.style.cssText='position:fixed;left:1.4vw;bottom:2vh;z-index:40;display:none;gap:4px;justify-items:start;pointer-events:none;font:300 10px "Josefin Sans",sans-serif;letter-spacing:.2em;color:rgba(238,240,250,.55);text-transform:uppercase';
  video.style.cssText='width:150px;transform:scaleX(-1);opacity:.55;border:1px solid rgba(238,240,250,.15)';
  const line=document.createElement('div'); box.append(video,line);
  addEventListener('DOMContentLoaded',()=>document.body.appendChild(box)); if(document.body) document.body.appendChild(box);
  addEventListener('keydown',e=>{ if(e.target&&e.target.tagName==='INPUT') return; if(e.key==='v'||e.key==='V') box.style.display=box.style.display==='none'?'grid':'none';
    if(e.key==='h'||e.key==='H'){ S.full=!S.full; S.ly=0; S.lp=0; line.textContent=S.full?'full body: head steers, lean swims, hand takes':'mouth only: mouse and keys move'; }
    if(e.key==='['||e.key===']'){ T.sens=clamp(T.sens*(e.key===']'?1.15:1/1.15),.3,3); line.textContent=`sensitivity ${T.sens.toFixed(2)}`; } });
  async function load(){
    const V='0.10.14', base=new URL('../',document.currentScript?document.currentScript.src:location.href).href;
    const srcs=[{mod:new URL('mediapipe/vision_bundle.mjs',location.href).href,wasm:'./mediapipe/wasm'},{mod:`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${V}/vision_bundle.mjs`,wasm:`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${V}/wasm`}];
    let fm='https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
    try{ const r=await fetch('./models/face_landmarker.task',{method:'HEAD'}); if(r.ok) fm='./models/face_landmarker.task'; }catch(e){}
    let hm='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
    try{ const r=await fetch('./models/hand_landmarker.task',{method:'HEAD'}); if(r.ok) hm='./models/hand_landmarker.task'; }catch(e){}
    for(const s of srcs){ try{ const vis=await import(s.mod), files=await vis.FilesetResolver.forVisionTasks(s.wasm);
        face=await vis.FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:fm,delegate:'GPU'},runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true});
        try{ hand=await vis.HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:hm,delegate:'GPU'},runningMode:'VIDEO',numHands:1}); }catch(e){ hand=null; console.warn('SBCam: no hand model',e); }   // (offline without models/hand_landmarker.task: no palm, no fist)
        return true; }catch(e){ console.warn('SBCam: MediaPipe not loaded from',s.mod,e); } }
    return false;
  }
  async function start(){
    try{ const st=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:360},facingMode:'user'},audio:false}); video.srcObject=st; await video.play(); }   // small: the mouth needs no more
    catch(e){ line.textContent='camera unavailable · mouse and keys still work'; return; }
    line.textContent='loading…'; if(await load()){ ready=true; line.textContent='look at the screen'; requestAnimationFrame(loop); }
  }
  function readFace(lm,bs){ const L=i=>lm[i], w=Math.hypot(L(454).x-L(234).x,L(454).y-L(234).y)||.1, h=Math.hypot(L(152).x-L(10).x,L(152).y-L(10).y)||.1;
    S.yaw=-(L(1).x-(L(234).x+L(454).x)/2)/w; S.pitch=-((L(1).y-(L(33).y+L(263).y)/2)/h-.28); S.size=h; S.found=true;
    if(bs){ const g=n=>{ const c=bs.categories.find(c=>c.categoryName===n); return c?c.score:0; }; S.jaw=g('jawOpen'); S.blink=Math.min(g('eyeBlinkLeft'),g('eyeBlinkRight')); } }
  function readHand(lm){ if(!lm){ S.hand=false; S.fist=0; S.open=0; S.still=0; S.lastW=null; return; }
    const d=(a,b)=>Math.hypot(lm[a].x-lm[b].x,lm[a].y-lm[b].y), palm=d(0,9)||.05, tips=(d(8,0)+d(12,0)+d(16,0)+d(20,0))/4/palm;
    S.hand=true; S.fist=clamp((T.open-tips)/(T.open-T.fist*.8)); S.open=clamp((tips-T.fist)/(T.open-T.fist));
    const w=lm[0]; if(S.lastW){ const mv=Math.hypot(w.x-S.lastW.x,w.y-S.lastW.y); S.still=lerp(S.still,mv<T.still?1:0,.25); } S.lastW={x:w.x,y:w.y}; }
  /* a mouth-open counts once, then the mouth has to close again (hysteresis) and a short gap must pass: no double echoes */
  function mouth(j){ const t=performance.now()/1000; if(jawArmed&&j>T.jaw&&t-lastMouth>T.gap){ edges.mouth=true; jawArmed=false; lastMouth=t; flash(); } if(j<T.jawOff) jawArmed=true; }
  let flashT=0; function flash(){ flashT=performance.now(); video.style.borderColor='rgba(238,240,250,.8)'; setTimeout(()=>{ if(performance.now()-flashT>=250) video.style.borderColor='rgba(238,240,250,.15)'; },260); }
  let last=performance.now(), skip=0;
  function loop(now){ const dt=Math.min(.05,(now-last)/1000); last=now;
    if(!paused&&face&&video.readyState>=2&&video.currentTime!==lastVT&&(++skip%2===0||S.calN<75)){ lastVT=video.currentTime; frameN++;   // ~15 reads a second: enough for a mouth, light on the GPU
      const r=face.detectForVideo(video,now), lm=r.faceLandmarks&&r.faceLandmarks[0]; if(lm) readFace(lm,r.faceBlendshapes&&r.faceBlendshapes[0]); else S.found=false;
      if(hand&&frameN%2===0){ const hr=hand.detectForVideo(video,now); readHand(hr.landmarks&&hr.landmarks[0]); }   // the hand: palm and fist, in both modes
      if(S.found&&S.calN<75){ if(!S.cal) S.cal={yaw:0,pitch:0,size:0}; const n=++S.calN; for(const k of ['yaw','pitch','size']) S.cal[k]+=(S[k]-S.cal[k])/n; if(n===75) line.textContent='ready'; } }
    if(S.cal&&S.calN>=75&&S.found){
      S.sy=lerp(S.sy,(S.yaw-S.cal.yaw)*T.sens,dt*4); S.sp=lerp(S.sp,(S.pitch-S.cal.pitch)*T.sens,dt*4); S.lean=lerp(S.lean,S.size/S.cal.size,dt*3);
      mouth(S.jaw);
      if(S.fist>.8&&fistWas<=.8) edges.fist=true; fistWas=S.fist;
      S.eyesT=S.blink>T.blink?S.eyesT+dt:Math.max(0,S.eyesT-dt*3);   // closed eyes put you to sleep in both modes
      S.palmT=(S.hand&&S.open>.7&&S.still>.45)?S.palmT+dt:Math.max(0,S.palmT-dt*1.2);
      if(!paused) line.textContent=!S.full?`mouth ${S.jaw>T.jaw?'open':'closed'}${S.hand?(S.fist>.8?' · fist':S.open>.8?' · palm':''):''}  (H: full body)`:`${Math.abs(S.sy)>T.dead?(S.sy>0?'turning →':'← turning'):'ahead'} · ${S.lean<T.leanOff?'stopped':S.lean>T.leanOn?'faster':'gliding'}${S.hand?(S.fist>.8?' · fist':S.open>.8?' · palm':''):''}`;
    } else if(ready&&!paused&&!S.found) line.textContent='step into the light';
    requestAnimationFrame(loop); }
  let begun=false;
  return {
    begin(){ if(begun) return; begun=true; start(); },   // called by the wake when the face opens
    on:true, T, S, get hasHand(){ return !!hand; },
    get ready(){ return ready&&!!S.cal&&S.calN>=75; },
    get paused(){ return paused; }, set paused(v){ paused=!!v; if(v) line.textContent='the wake is watching'; },
    /* true once for each new mouth-open / fist */
    edge(k){ const v=edges[k]; edges[k]=false; return v; },
    /* the wake feeds the mouth from its own tracking while SBCam is paused */
    feedJaw(j){ mouth(j); },
    /* steer: turn your head and you keep turning that way (rate grows with the turn, eased), so you swim where you look;
       up / down is a held tilt that comes back when you face ahead again */
    turn(){ const a=Math.max(0,Math.abs(S.sy)-T.dead)/(T.full-T.dead); return Math.sign(S.sy)*Math.min(1,a)*Math.min(1,a); },
    look(dt){ if(!this.ready||!S.full) return null; const dz=a=>Math.sign(a)*Math.max(0,Math.abs(a)-T.dead);
      S.ly=lerp(S.ly,-this.turn()*T.turn,dt*3); const nod=Math.max(0,Math.abs(S.sp)-T.dead*.8)/(T.full*.8); S.lp=lerp(S.lp,Math.sign(S.sp)*Math.min(1,nod)*.7,dt*3);
      return {dYaw:S.ly*dt, dPitch:S.lp*dt}; },   // a nod held keeps you rising / sinking, as a turn held keeps you turning
    /* side: -1..1, a sideways push toward where you look (so you move that way at once, before the turn catches up) */
    side(){ if(!this.ready||!S.full) return 0; return this.turn(); },
    /* the head as a pointer, in 0..1 screen coordinates (for the wake's ring of signs) */
    pointer(){ if(!this.ready) return null; return {x:clamp(.5+S.sy*2.4),y:clamp(.5-S.sp*2.6)}; },   // as in a mirror: turn right, it goes right
    /* swim: forward push 0..~3 (glide 1, lean in more, step back 0) */
    swim(){ if(!this.ready||!S.full) return 0; if(S.lean<T.leanOff) return -1; return .55+Math.abs(this.turn())*.6+Math.max(0,S.lean-T.leanOn)*30; },
    back(){ return this.ready&&S.full&&S.lean<T.leanOff?Math.min(1,(T.leanOff-S.lean)*12):0; },   // step back: swim backwards
  };
})();

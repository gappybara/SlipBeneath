/* ═══════════════════════════════════════════════════════════════════
   여기만 고치면 되는 설정 (문구, 시간, 입자 수)
   ═══════════════════════════════════════════════════════════════════ */
const CONFIG = {
  lines: {   // [영어, 한국어, (작은 영어 줄), (작은 한국어 줄)]
    dreaming: ['You have been dreaming.',            '당신은 꿈을 꾸고 있습니다.'],
    human:    ['A dream of being human.',            '인간이라는 꿈을.'],
    calling:  ['Something inside you is calling.',   '당신 안에서 무언가가 부르고 있습니다.'],
    wake:     ['Now, wake up.',                      '이제 깨어나세요.'],
    gather:   ['Gather four sounds. Shape your own dream.', '소리 네 개를 모아 당신만의 꿈을 빚으세요.', 'The deep will remember it.', '깊은 바다가 그 꿈을 기억할 것입니다.'],
    find:     ['Listen, and find them.',             '귀 기울여 찾아보세요.'],
  },
  place: {    // 자막 위치: left = 얼굴 왼쪽 위, right = 얼굴 오른쪽 아래, 나머지는 얼굴 아래 가운데. big = 크게 (타이틀 서체)
    dreaming:'left', human:'right', wake:'big', gather:'mid', find:'mid',
  },
  sounds: {  // 원형으로 펼쳐지는 소리 요소 설명
    heart: {name:'HEARTBEAT', en:'The rhythm that kept you.',          ko:'당신을 살아 있게 한 박동.',        gift:'gives your being a pulse',                  kgift:'존재에 맥박을 남깁니다'},
    voice: {name:'VOICE',     en:'The call you sent into the dark.',   ko:'당신이 어둠 속으로 보낸 부름.',           gift:'gives your being horns that sing',          kgift:'존재에 노래하는 뿔을 남깁니다'},
    bone:  {name:'BONE',      en:'What held your shape.',              ko:'당신의 모습을 지탱하던 것.',        gift:'gives your being a spine',                  kgift:'존재에 척추를 남깁니다'},
    memory:{name:'MEMORY',    en:'What the water kept of you.',        ko:'물이 기억하는 당신.',              gift:'gives your being spirals that turn inward', kgift:'존재에 안으로 감기는 나선을 남깁니다'},
    soul:  {name:'SOUL',      en:'The light behind the eyes.',         ko:'눈 너머에 있던 빛.',               gift:'gives your being a crown of light',         kgift:'존재에 빛의 왕관을 남깁니다'},
    dream: {name:'DREAM',     en:'The sleep you came from.',           ko:'당신이 떠나온 잠.',                gift:'gives your being orbits',                   kgift:'존재에 궤도를 남깁니다'},
    eye:   {name:'? ? ?',     en:'A sound with its eye still closed.', ko:'아직 눈을 감고 있는 소리.',         gift:'opens somewhere below',                     kgift:'저 아래 어딘가에서 열립니다'},
  },
  voice: true,            // narration 폴더에 dreaming.mp3 같은 파일을 넣으면 자막과 함께 재생
  grid: 240,              // 얼굴 입자: 240 × 240. 느리면 180으로
  clicksToOpen: 5,        // 몇 번 클릭해야 얼굴이 열리는지
  clickHintAfter: 8,      // 클릭이 없으면 몇 초 뒤 안내를 밝게 할지
  clickAutoAfter: 20,     // 클릭이 계속 없으면 몇 초마다 저절로 한 번씩 진행할지
  circleIdle: 60,         // 소리 요소 원: 아무 입력이 없을 때만 몇 초 뒤 자동으로 넘어갈지
  bpm: 80,                // 박자 (음악 스템과 같은 80 BPM)
  echoGrid: 0.5,          // 클릭 에코가 맞춰지는 박자 단위: 1 = 4분음표, 0.5 = 8분음표
  grain: 0.09, bloom: 1.0,
  faceLook: 'depth',       // 얼굴 렌더링: 'depth' = 안에서 빛나는 뎁스맵 느낌, 'grain' = 입자 질감 (F 키로 미리보기)
  mediapipeVersion: '0.10.14',
};
/* ═══════════════════════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);
const TAU = Math.PI*2, R = Math.random;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ss=(a,b,x)=>{x=clamp((x-a)/(b-a));return x*x*(3-2*x)};
const lerp=(a,b,k)=>a+(b-a)*k;
const WK=$('wake'), video=$('cam'); video.style.display='none';
const ERR={mp:'',dol:''};

/* ───────── 1. camera ───────── */
let camOK=false, srcAspect=16/9, srcTex=null;
async function startCamera(){
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:'user'},audio:false});
    video.srcObject=stream; await video.play();
    srcAspect=(video.videoWidth||1280)/(video.videoHeight||720);
    srcTex=new THREE.VideoTexture(video); camOK=true;
  }catch(e){ console.warn('camera unavailable, using a silhouette',e); srcTex=new THREE.CanvasTexture(silhouette()); srcAspect=4/3; camOK=false; }
  srcTex.minFilter=THREE.LinearFilter; srcTex.magFilter=THREE.LinearFilter; srcTex.generateMipmaps=false;
  U.uVid.value=srcTex; U.uAspect.value=srcAspect;
}
function silhouette(){
  const c=document.createElement('canvas'); c.width=640; c.height=480; const g=c.getContext('2d');
  g.fillStyle='#000'; g.fillRect(0,0,640,480);
  let gr=g.createRadialGradient(300,190,10,320,210,150); gr.addColorStop(0,'#d8d8d8'); gr.addColorStop(.7,'#7a7a7a'); gr.addColorStop(1,'#000');
  g.fillStyle=gr; g.beginPath(); g.ellipse(320,210,98,128,0,0,TAU); g.fill();
  g.fillStyle='#202020'; for(const x of [282,358]){ g.beginPath(); g.ellipse(x,200,20,8,0,0,TAU); g.fill(); }
  g.fillStyle='#333'; g.beginPath(); g.ellipse(320,290,26,8,0,0,TAU); g.fill();
  gr=g.createLinearGradient(0,340,0,480); gr.addColorStop(0,'#555'); gr.addColorStop(1,'#111');
  g.fillStyle=gr; g.beginPath(); g.ellipse(320,520,230,150,0,0,TAU); g.fill();
  return c;
}

/* ───────── 2. face landmarks (MediaPipe). Local copy first, then the internet. ───────── */
let face=null, faceReady=false;
async function loadFace(){
  const V=CONFIG.mediapipeVersion;
  const sources=[
    {mod:new URL('../mediapipe/vision_bundle.mjs',import.meta.url).href, wasm:'./mediapipe/wasm'},   // module path is relative to this file, wasm path to the page
    {mod:`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${V}/vision_bundle.mjs`, wasm:`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${V}/wasm`},
  ];
  let model='https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  try{ const r=await fetch('./models/face_landmarker.task',{method:'HEAD'}); if(r.ok) model='./models/face_landmarker.task'; }catch(e){}
  for(const s of sources){
    try{
      const vis=await import(s.mod);
      const files=await vis.FilesetResolver.forVisionTasks(s.wasm);
      face=await vis.FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:model,delegate:'GPU'},runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true});
      faceReady=true; ERR.mp=''; return;
    }catch(e){ ERR.mp=String(e&&e.message||e).slice(0,70); console.warn('MediaPipe not loaded from',s.mod,e); }
  }
}
const F={found:false, cx:.5, cy:.45, size:.75, blinkL:0, blinkR:0, eyeL:[.42,.42], eyeR:[.58,.42], third:[.5,.33]};
let lastVT=-1;
function readFace(now){
  if(lmFrozen||!faceReady||!camOK||video.readyState<2||video.currentTime===lastVT) return;   // frozen once the doors start to open
  lastVT=video.currentTime;
  const res=face.detectForVideo(video,now), lm=res.faceLandmarks&&res.faceLandmarks[0];
  if(!lm){ F.found=false; return; }
  F.found=true;
  { const k=hasLM?.55:1; for(let i=0;i<lm.length&&i<478;i++){ LM[i*3]+=(lm[i].x-LM[i*3])*k; LM[i*3+1]+=(lm[i].y-LM[i*3+1])*k; LM[i*3+2]+=(lm[i].z-LM[i*3+2])*k; } hasLM=true; }
  let x0=1,x1=0,y0=1,y1=0; for(const p of lm){ if(p.x<x0)x0=p.x; if(p.x>x1)x1=p.x; if(p.y<y0)y0=p.y; if(p.y>y1)y1=p.y; }
  const k=.25; F.cx+=((x0+x1)/2-F.cx)*k; F.cy+=((y0+y1)/2-.02-F.cy)*k; F.size+=((y1-y0)*1.6-F.size)*k;
  const mid=(a,b)=>[(lm[a].x+lm[b].x)/2,(lm[a].y+lm[b].y)/2];
  F.eyeL=mid(33,133); F.eyeR=mid(362,263); F.third=[lm[9].x,lm[9].y];
  const bs=res.faceBlendshapes&&res.faceBlendshapes[0];
  if(bs) for(const c of bs.categories){ if(c.categoryName==='eyeBlinkLeft')F.blinkL=c.score; if(c.categoryName==='eyeBlinkRight')F.blinkR=c.score; if(c.categoryName==='jawOpen'){ F.jaw=c.score; if(window.SBCam&&SBCam.on) SBCam.feedJaw(c.score); } }
}
function toCrop([ix,iy]){ const ch=F.size, cw=F.size/srcAspect; return [.5-(ix-F.cx)/cw, .5-(iy-F.cy)/ch]; }
const probe=document.createElement('canvas'); probe.width=probe.height=48; const pg=probe.getContext('2d',{willReadFrequently:true});
let lo=.05, hi=.85;
/* for this visit only: the face's brightness on a small grid (no picture is kept, nothing is saved or sent). If the visitor finds
   the EYE, THE DEEP's great eye shows it in its pupil for a moment. Cleared when the next visitor begins. */
const fcv=document.createElement('canvas'); fcv.width=40; fcv.height=52; const fcg=fcv.getContext('2d',{willReadFrequently:true});
function captureFace(){ window.SBFace=null; if(!camOK||video.readyState<2) return;
  const W=video.videoWidth, H=video.videoHeight, sw=F.size/srcAspect*W*.9, sh=F.size*H*.98;
  try{ fcg.save(); fcg.translate(40,0); fcg.scale(-1,1); fcg.drawImage(video,F.cx*W-sw/2,F.cy*H-sh/2,sw,sh,0,0,40,52); fcg.restore(); }catch(e){ return; }
  const d=fcg.getImageData(0,0,40,52).data, L=new Float32Array(40*52);
  for(let i=0;i<L.length;i++){ const v=(d[i*4]*.299+d[i*4+1]*.587+d[i*4+2]*.114)/255; L[i]=Math.max(0,Math.min(1,(v-lo)/Math.max(.05,hi-lo))); }
  fcg.clearRect(0,0,40,52); window.SBFace={w:40,h:52,lum:L}; }
function autoLevels(){
  const img=camOK?video:srcTex.image; if(!img||(camOK&&video.readyState<2)) return;
  const W=camOK?video.videoWidth:img.width, H=camOK?video.videoHeight:img.height, sw=F.size/srcAspect*W*.6, sh=F.size*H*.6;
  try{ pg.drawImage(img,F.cx*W-sw/2,F.cy*H-sh/2,sw,sh,0,0,48,48); }catch(e){ return; }
  const d=pg.getImageData(0,0,48,48).data, L=[]; for(let i=0;i<d.length;i+=4) L.push((d[i]*.299+d[i+1]*.587+d[i+2]*.114)/255);
  L.sort((a,b)=>a-b); lo+=(L[(L.length*.01)|0]*.7-lo)*.2; hi+=(Math.max(lo+.15,L[(L.length*.97)|0])-hi)*.2;   // only the very darkest goes black (a shadow must not punch a hole)
}

/* ───────── 3. scene ───────── */
const renderer=new THREE.WebGLRenderer({canvas:$('wgl'),antialias:true,powerPreference:'high-performance'});
let DPR=window.SB_DPR||Math.min(devicePixelRatio||1,2);   // the shared pixel budget (shared.js)
renderer.setPixelRatio(DPR); renderer.setClearColor(0x04050b,1); renderer.autoClear=false;
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(35,16/9,.1,200); camera.position.set(0,0,12);

const additive=m=>{ m.blending=THREE.CustomBlending; m.blendSrc=THREE.OneFactor; m.blendDst=THREE.OneFactor; m.transparent=true; m.depthWrite=false; return m; };

/* the face (moved over from demo A, 2026-10-21): airbrushed grains of the live camera image, held in water.
   Shared uniforms for the face, the water mandala, the liquid and the skull. */
const G=CONFIG.grid, N=G*G;
const U={ uVid:{value:null}, uAspect:{value:16/9}, uCrop:{value:new THREE.Vector3(.5,.45,.75)}, uLevels:{value:new THREE.Vector2(.05,.85)},
  uTime:{value:0}, uAppear:{value:0}, uPix:{value:1}, uPulseT:{value:-1}, uThird:{value:new THREE.Vector2(.5,.68)}, uEyeClose:{value:0},
  uOpen:{value:0}, uCrumble:{value:0}, uNameT:{value:null}, uNameOK:{value:0}, uDolT:{value:null}, uDolR:{value:null}, uFill:{value:0}, uScatter:{value:0}, uDolC:{value:new THREE.Vector3(0,-.28,-4.3)}, uDolOK:{value:0}, uMorph:{value:0}, uMorphOut:{value:0}, uLight:{value:0}, uTat:{value:0}, uTatShow:{value:0}, uTatTex:{value:null},
  uPulseP:{value:new THREE.Vector2(.5,.68)}, uSrc:{value:Array.from({length:6},()=>new THREE.Vector4(0,0,0,0))}, uLook:{value:CONFIG.faceLook==='grain'?0:1}, uDrift:{value:0}, uGather:{value:1}, uFocus:{value:0},
  uEyeL:{value:new THREE.Vector2(.41,.6)}, uEyeR:{value:new THREE.Vector2(.59,.6)} };
/* the water: every echo drops a wave into it where you clicked, on the beat; each source is mirrored left/right and up/down,
   so the overlapping rings fold into one symmetric interference pattern (the mandala). x = height, yz = slope, w = energy. */
const GL_WAVE=`
  uniform vec4 uSrc[6];
  vec4 waveAt(vec2 p){ vec4 o=vec4(0.);
    for(int i=0;i<6;i++){ vec4 S=uSrc[i]; if(S.w>0.){ float age=uTime-S.z, fr=age*(S.w<.5?.32:.95);   // the first ring barely moves; echoes a little quicker
      for(int m=0;m<4;m++){ float fm=float(m); vec2 s=S.xy*vec2(mod(fm,2.)<.5?1.:-1.,fm<1.5?1.:-1.), d=p-s; float r=length(d)+1e-3;
        float env=S.w*smoothstep(fr,fr-.9,r)*exp(-age*.025)/(1.+r*.3), ph=(r-fr)*15.;
        o.x+=env*cos(ph); o.yz-=env*sin(ph)*15.*d/r; o.w+=env*env; } } }
    return o; }`;
const GL_COMMON=`
  uniform sampler2D uVid,uDolT,uDolR,uNameT; uniform float uNameOK; float nameK=0.; /* nameK: how much a grain is still in the name */ float rimK=0.; /* rimK: drawing the outline */ uniform float uDolOK,uMorph,uMorphOut,uFill,uScatter; uniform vec3 uDolC; uniform float uAspect,uTime,uAppear,uPix,uPulseT,uOpen,uCrumble,uLight,uTat,uTatShow,uLook,uDrift,uGather; uniform vec3 uCrop; uniform vec2 uLevels,uThird,uPulseP,uEyeL,uEyeR;
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  ${GL_WAVE}
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
  float lumAt(vec2 cu){ float ix=uCrop.x-(cu.x-.5)*uCrop.z/uAspect, iy=uCrop.y-(cu.y-.5)*uCrop.z;
    return clamp((dot(texture2D(uVid,vec2(ix,1.-iy)).rgb,vec3(.299,.587,.114))-uLevels.x)/max(.05,uLevels.y-uLevels.x),0.,1.); }
  float jag(float y){ return .04*sin(y*7.1)+.018*sin(y*17.3+1.)+.008*sin(y*31.+2.); }      // the tear is ragged, the same on both halves
  float sideOf(vec2 cu){ return cu.x<uThird.x+jag((cu.y-.5)*6.)/6.?-1.:1.; }
  vec3 door(vec3 p,float side){ float hg=side*3.3, th=side*uOpen*1.15, c=cos(th), s=sin(th), rx=p.x-hg; return vec3(hg+rx*c+p.z*s,p.y,-rx*s+p.z*c); }
  float ring(vec2 cu,float w,float spd,float fall){ float pt=uTime-uPulseT, pd=length(cu-uPulseP); return uPulseT<0.?0.:exp(-pow((pd-pt*spd)*w,2.))*exp(-pt*fall); }   // the echo spreads from where you clicked
  /* where a point on the face ends up: relief from the camera image, the water, the echo, the doors, the halves loosening */
  vec3 place(vec2 cu,float rnd,float lum,out float gone){
    vec2 e=(cu-.5)/vec2(.36,.47); float mask=1.-smoothstep(.7,1.02,length(e));
    vec3 p=vec3((cu.x-.5)*6.,(cu.y-.5)*6.,(lum-.5)*1.3*mask);
    p+=vec3(noise(cu*9.+uTime*.15)-.5,noise(cu*9.-uTime*.13+7.)-.5,0.)*.05;
    p.xy+=vec2(sin(uTime*.45+cu.y*3.5),cos(uTime*.38+cu.x*3.))*.035;                      // held in water: a slow sway
    vec4 wv=waveAt(p.xy); p.z+=wv.x*(.04+.3*uTat*(1.-uOpen)); p.xy+=wv.yz*(.0012+.005*uTat*(1.-uOpen));          // the same water the mandala is drawn in; with each knock it moves the face harder
    float pw=ring(cu,13.,.55,1.1); vec2 dd=cu-uPulseP; p.xy+=dd/(length(dd)+1e-4)*pw*.2; p.z+=pw*.4;
    float g=smoothstep(rnd*.45,rnd*.45+.55,uGather), ga=rnd*43.7+(1.-g)*2.2;               // at the start the grains gather out of the dark, turning in
    if(uNameOK>.5){ vec4 nt=texture2D(uNameT,vec2(fract(rnd*61.73+cu.y*3.1),fract(rnd*23.37+cu.x*5.7))); vec3 nm=nt.xyz;   /* …or, with a name, out of its letters: */
      float st=nt.w*.35+rnd*.15, gg=smoothstep(st,st+.5,uGather), s=gg*gg*(3.-2.*gg);                                      /* each letter in its turn, left to right */
      vec3 mid=nm+vec3((rnd-.5)*1.6,-2.2-rnd*2.4,(fract(rnd*7.3)-.5));                                                    /* it sinks, spreading, like ink let fall in water */
      p=(1.-s)*(1.-s)*nm+2.*(1.-s)*s*mid+s*s*p; g=1.; nameK=1.-gg; }                                                      /* and rises from below into the face */
    p+=vec3(cos(ga),sin(ga)*.8,(fract(rnd*7.1)-.5)*2.)*(1.-g)*(1.-g)*(3.5+fract(rnd*13.3)*6.);
    float side=sideOf(cu); p=door(p,side);
    /* the halves keep their shape to the last moment; then the dolphin wakes inside and a wave runs out from it: the face goes
       as water does, carried off along curved fronts that ripple as they pass, not flung away as flat pieces */
    vec2 c0=vec2(0.,-.3), dv=p.xy-c0; float dist=length(dv)+1e-3; vec2 od=dv/dist, tg=vec2(-od.y,od.x);
    float on=smoothstep(0.,.04,uCrumble), Rw=uCrumble*10.5, band=dist-Rw, front=exp(-band*band*1.4)*on, cr=smoothstep(.6,-1.4,band+rnd*.5)*on;   // nothing until the split starts (at 0 the front sat at the centre and punched a hole)
    p.xy+=od*cr*cr*(5.+rnd*6.)+tg*sin(dist*3.2-uCrumble*18.+rnd*2.)*(front+cr*.6)*.45;
    p.z+=front*1.4+cr*(rnd-.4)*1.5;
    if(uDolOK>.5&&(uMorph>0.||uScatter>0.)){   /* and the wave does not carry them off: each grain is drawn on a curve to a place on the dolphin's skin */
      vec2 tu=vec2(fract(rnd*61.73+cu.y*3.1),fract(rnd*23.37+cu.x*5.7)); float fl=smoothstep(rnd*.35,rnd*.35+.65,uFill);   /* first the outline, then the body fills */
      vec3 tgt=mix(texture2D(uDolR,tu).xyz,texture2D(uDolT,tu).xyz,fl*fl*(3.-2.*fl));
      float sc=uScatter*uScatter*(3.-2.*uScatter); p.xy+=od*sc*(9.+rnd*9.); p.z+=sc*(rnd-.5)*7.;                            /* first they fly apart, out of the frame */
      float r2=fract(rnd*17.31+cu.x*3.7), m=smoothstep(r2*.68,r2*.68+.32,uMorph), e=m*m*(3.-2.*m);                        /* each grain sets off at its own moment: they trickle in, not as one mass */
      vec2 d=tgt.xy-uDolC.xy; float rT=max(length(d),.05), aT=atan(d.y,d.x), r0=9.+fract(rnd*7.7)*15.;                                /* then a golden spiral (r grows by phi each quarter turn) */
      float th0=aT+1.5708*log(r0/rT)/.48121+(fract(rnd*3.3)-.5)*1.4, th=mix(th0,aT,e), rr=rT*exp(.48121*(th-aT)/1.5708);                            /* … from far outside, round and in, to its place */
      vec3 sp=vec3(uDolC.xy+vec2(cos(th),sin(th))*rr,mix(uDolC.z+(rnd-.5)*6.,tgt.z,e));
      p=mix(p,sp,smoothstep(0.,.14,m)); cr=0.; rimK=smoothstep(.8,1.,m)*(1.-fl); }
    gone=cr; return p; }`;

const aUv=new Float32Array(N*2), aRand=new Float32Array(N);
for(let y=0,i=0;y<G;y++) for(let x=0;x<G;x++,i++){ aUv[i*2]=(x+R()*.9)/G; aUv[i*2+1]=(y+R()*.9)/G; aRand[i]=R(); }
const faceGeo=new THREE.BufferGeometry(); faceGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*3),3));
faceGeo.setAttribute('aUv',new THREE.BufferAttribute(aUv,2)); faceGeo.setAttribute('aRand',new THREE.BufferAttribute(aRand,1));
/* the live landmarks (MediaPipe, 478 points, image space, smoothed) — frozen when the doors start to open */
const LM=new Float32Array(478*3); let hasLM=false, lmFrozen=false;
const faceMat=additive(new THREE.ShaderMaterial({uniforms:U,
  vertexShader:`attribute vec2 aUv; attribute float aRand; uniform sampler2D uTatTex; varying float vA; varying vec3 vC; ${GL_COMMON}
    void main(){ vec2 cu=aUv; float lum=lumAt(cu), gone; vec2 e=(cu-.5)/vec2(.36,.47); float mask=1.-smoothstep(.7,1.02,length(e));
      vec3 p=place(cu,aRand,lum,gone);
      /* the crack at the brow: a point of light first (it beats with each echo), then a thin live filament that grows a little with every
         crack and runs the whole seam at the light. Electric: it jitters and throws sparks. */
      float hit=ring(uThird,13.,.55,1.1), open1=1.-uOpen;
      float jit=(noise(vec2(cu.y*90.,floor(uTime*14.)))-.5)*(.002+.006*uLight);
      float sx=abs(cu.x-uThird.x-jag((cu.y-.5)*6.)/6.-jit), dy=abs(cu.y-uThird.y);
      float clen=.012+.07*uTat+uLight*.55, reach=1.-smoothstep(clen*.55,clen,dy*(1.+.4*step(cu.y,uThird.y)));
      float core=exp(-sx*sx/.000012)*reach, glow=exp(-sx*sx/(.00008+.0015*uLight))*reach;
      vec2 bq=(cu-uThird)*vec2(1.,1.3); float bd=dot(bq,bq), bdot=exp(-bd/(.00004+.0001*uTat+.0003*uLight));
      float live=step(.001,uTat+uLight)*(.35+uTat*.6+uLight*1.4+hit*2.2);
      float crack=(core*1.1+glow*.1)*live*open1+bdot*(.2+uTat*.6+hit*2.2+uLight*1.2)*open1;
      float backlit=glow*live*.35*open1;
      float spark=step(.988,hash(vec2(aRand*17.3,floor(uTime*16.))))*smoothstep(.15,.6,glow+bdot)*min(1.,live)*open1;   // sparks off the filament
      p.x+=(cu.x<uThird.x?-1.:1.)*spark*(.04+.22*hash(vec2(aRand,floor(uTime*16.)+3.))); p.z+=spark*.15;
      /* the dolphin's tattoo surfaces in the skin, once, as you wake — on the forehead only, above the brow */
      float above=smoothstep(uThird.y-.03,uThird.y+.07,cu.y);
      float td=length((cu-uThird)*vec2(1.,.82)), tr=uTatShow*.95, tshow=(1.-smoothstep(tr-.08,tr,td))*step(.001,uTatShow)*above;
      float tm=texture2D(uTatTex,vec2(.5+abs(cu.x-.5)/.72,(cu.y-.5)/.94+.5)).r*tshow*mask;
      float tfront=exp(-pow((td-tr)*18.,2.))*step(.001,uTatShow)*(1.-step(.999,uTatShow))*mask*above;
      float n=noise(cu*3.5+vec2(uTime*.03,0.)), n2=noise(cu*7.-uTime*.02);
      vec4 wv2=waveAt((cu-.5)*6.); float pw=ring(cu,13.,.55,1.1), wc=max(wv2.x,0.)*mask*(.5+1.2*uTat*(1.-uOpen));      // wave crests catch light on the skin, more with each knock
      float cau=pow(noise(cu*24.+wv2.yz*.03+uTime*.25),3.)*min(1.,wv2.w*1.5)*mask*uTat*(1.-uOpen);      // where a wave has passed, the light of water (caustics) lingers on the face
      vec3 c; float vis, sz;
      if(uLook<.5){   /* grain: the airbrushed blue-violet stipple */
        c=mix(vec3(.07,.08,.24),vec3(.55,.60,.95),lum); c=mix(c,vec3(.40,.22,.46),smoothstep(.45,.85,n)*.5*(1.-lum));
        c=mix(c,vec3(.36,.44,.88),smoothstep(.55,.9,n2)*.35); c=mix(c,vec3(.94,.95,1.),smoothstep(.82,1.,lum)*.6);
        vis=mask*(.06+lum*.94); sz=2.6+lum*3.4;
      } else {        /* depth: lit from inside like a pale depth map; the eyes burn brightest, a little dust glints on the skin */
        float L=.16+.84*pow(lum,1.1), eyes=   /* a floor: shadows (nostrils, mouth, a hand) stay as dim grains, never a hole */exp(-dot(cu-uEyeL,cu-uEyeL)/.0007)+exp(-dot(cu-uEyeR,cu-uEyeR)/.0007);
        c=mix(vec3(.07,.13,.28),vec3(.78,.86,1.),L); c=mix(c,vec3(.95,.98,1.),smoothstep(.6,1.,L)*.7); c=mix(c,vec3(.32,.50,.82),smoothstep(.55,.9,n2)*.2*(1.-L));   // the key colour
        float rim=smoothstep(.62,.9,length((cu-.5)/vec2(.36,.47)))*mask;              // the outline glows a little, as in the X-ray refs
        vis=mask*(.05+L*.95)*(1.-.35*rim)+rim*.35+eyes*1.1*mask; c+=vec3(.9,.93,1.)*eyes*1.2+vec3(.55,.62,1.)*rim*.4; sz=3.4+L*3.6;
        float glint=step(.993,hash(vec2(aRand*41.,floor(uTime*3.+aRand*7.))))*mask*(.3+L); vis+=glint*1.6; c+=vec3(1.)*glint*1.5;
      }
      c+=vec3(.82,.86,1.)*backlit*.9*mask+vec3(.72,.78,1.)*pw*.7+vec3(.6,.68,1.)*wc*.25+vec3(.75,.85,1.)*cau*1.2+vec3(.82,.9,1.)*rimK*.3;
      c=mix(c,vec3(.70,.77,1.),tm*.5);
      float alive=uAppear*(1.-smoothstep(.55,1.,gone))*(1.-uMorphOut)*mix(1.,step(fract(aRand*91.7),.08)*.8,nameK)*mix(1.,.22,rimK);   /* so many grains crowd onto the outline: each dimmer there */   // so many grains share a letter: only a few show while they are still the name, so it reads as letters of dust; the rest light as they leave   // once settled on the dolphin they give way to its own light   // bright to the edge of the picture
      vis=vis*alive*(1.-.3*tshow*(1.-tm))+tm*.42*alive;
      vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp((sz+crack*1.5+spark*1.5)*(1.+.35*tm)*uPix*(12./-mv.z)*(.7+aRand*.6),1.,22.);
      vC=c+mix(vec3(.95,.97,1.),vec3(1.,.9,.74),core*.55)*crack*2.+vec3(1.,.94,.84)*spark*3.;
      vA=vis*(uLook<.5?.32:.26)+(crack*.9+spark*1.2+pw*mask*.14+wc*.04+cau*.18+rimK*.05)*alive+tfront*.12*uAppear; }`,
  fragmentShader:`varying float vA; varying vec3 vC; void main(){ vec2 q=gl_PointCoord-.5; float d=dot(q,q); if(d>.25) discard; gl_FragColor=vec4(vC*exp(-d*9.)*vA,1.); }`}));
const facePts=new THREE.Points(faceGeo,faceMat); facePts.frustumCulled=false; facePts.renderOrder=2; scene.add(facePts);
/* the dolphin's engraving, as a soft mask for the face's tattoo */
async function loadTattoo(){
  try{ const im=new Image(); im.src='assets/dolphin_engrave.jpg'; await im.decode();
    const cw=312, ch=400, c=document.createElement('canvas'); c.width=cw; c.height=ch; const g=c.getContext('2d',{willReadFrequently:true});
    g.drawImage(im,480,380,780,1000,0,0,cw,ch); const d=g.getImageData(0,0,cw,ch);      // the ornament field of the engraving
    for(let i=0;i<d.data.length;i+=4){ const v=Math.round(ss(.68,.95,d.data[i]/255)*255); d.data[i]=d.data[i+1]=d.data[i+2]=v; d.data[i+3]=255; } g.putImageData(d,0,0);
    const s2=document.createElement('canvas'); s2.width=cw; s2.height=ch; const sg=s2.getContext('2d'); sg.filter='blur(1.2px)'; sg.drawImage(c,0,0);
    const tx=new THREE.CanvasTexture(s2); tx.minFilter=tx.magFilter=THREE.LinearFilter; tx.generateMipmaps=false; U.uTatTex.value=tx;
  }catch(e){ console.warn('tattoo mask missing',e); }
}
loadTattoo();

/* the skull, faint, behind the face while it calls (X-ray: edges read, the cranium more than the jaw, a soft density under it).
   It is never seen when the head splits. */
const SKULL_AT=new THREE.Vector3(0,.1,-1.6), SKS=2.55;
const skullMat=additive(new THREE.ShaderMaterial({
  uniforms:{uTime:U.uTime,uPix:U.uPix,uPulseT:U.uPulseT,uPulseP:U.uPulseP,uSkull:{value:.06},uSoft:{value:0}},
  vertexShader:`attribute vec3 aN0; attribute float aR; uniform float uTime,uPix,uPulseT,uSkull,uSoft; uniform vec2 uPulseP; varying float vA; varying vec3 vC;
    float hs(float x){ return fract(sin(x)*43758.5453); }
    void main(){ vec4 wp=modelMatrix*vec4(position,1.), mv=viewMatrix*wp;
      vec2 cu=wp.xy/6.+.5; float pt=uTime-uPulseT, pd=length(cu-uPulseP);
      float scan=uPulseT<0.?0.:exp(-pow((pd-pt*.55)*4.,2.))*exp(-pt*.8);
      vec3 nv=normalize(normalMatrix*aN0); float rim=1.-abs(dot(nv,normalize(-mv.xyz)));
      float up=.55+1.6*smoothstep(-.15,.85,position.y/2.55);
      float st=step(hs(aR*77.3+floor(uTime*14.)),.7+.3*min(1.,scan*2.));
      vA=uSkull*up*(.18+.82*pow(rim,2.2))*(1.+.35*scan)*mix(st,1.,uSoft)*mix(1.,.07,uSoft);
      vC=mix(vec3(.58,.68,1.),vec3(.92,.95,1.),clamp(scan*1.5,0.,1.));
      gl_Position=projectionMatrix*mv; gl_PointSize=clamp((1.8+scan*1.4)*mix(1.,5.,uSoft)*uPix*(12./-mv.z),1.,40.); }`,
  fragmentShader:`uniform float uSoft; varying float vA; varying vec3 vC; void main(){ vec2 q=gl_PointCoord-.5; float d=dot(q,q); if(d>.25) discard; gl_FragColor=vec4(vC*exp(-d*mix(9.,5.,uSoft))*vA*.95,1.); }`}));
const skull=new THREE.Points(new THREE.BufferGeometry(),skullMat); skull.position.copy(SKULL_AT); skull.frustumCulled=false; skull.renderOrder=1; skull.visible=false; scene.add(skull);
{ const soft=new THREE.Points(skull.geometry,additive(new THREE.ShaderMaterial({uniforms:{...skullMat.uniforms,uSoft:{value:1}},vertexShader:skullMat.vertexShader,fragmentShader:skullMat.fragmentShader})));
  soft.frustumCulled=false; soft.renderOrder=0; skull.add(soft); }
let skullLoaded=false;
async function loadSkull(){
  try{ const r=await fetch('assets/skull_pts.bin'); if(!r.ok) throw new Error('assets/skull_pts.bin '+r.status);
    const buf=await r.arrayBuffer(), dv=new DataView(buf), M=Math.min(26000,buf.byteLength/9|0);
    const P=new Float32Array(M*3), Nn=new Float32Array(M*3), A=new Float32Array(M);
    for(let i=0;i<M;i++){ const o=i*9;   // model: y up, face toward −z → turn it to face the viewer
      P[i*3]=-dv.getInt16(o,true)/16000*SKS; P[i*3+1]=dv.getInt16(o+2,true)/16000*SKS; P[i*3+2]=-dv.getInt16(o+4,true)/16000*SKS;
      Nn[i*3]=-dv.getInt8(o+6)/127; Nn[i*3+1]=dv.getInt8(o+7)/127; Nn[i*3+2]=-dv.getInt8(o+8)/127; A[i]=R(); }
    const g=skull.geometry; g.setAttribute('position',new THREE.BufferAttribute(P,3)); g.setAttribute('aN0',new THREE.BufferAttribute(Nn,3)); g.setAttribute('aR',new THREE.BufferAttribute(A,1));
    skullLoaded=true;
  }catch(e){ console.warn('skull points missing',e); }
}
loadSkull();

/* the split: the tear is lined with a glowing liquid as thick as honey (in the piece's own light). As the halves part it
   stretches into threads that thin in the middle, give, and gather into beads; the drops they shed float out of the picture. */
const doors=[-1,1].map(side=>{ const g=new THREE.Group(); g.position.x=side*3.3; g.userData.side=side; scene.add(g); return g; });
const jagJS=y=>.04*Math.sin(y*7.1)+.018*Math.sin(y*17.3+1)+.008*Math.sin(y*31+2);
const seamXw=y=>(U.uThird.value.x-.5)*6+jagJS(y);   // the tear, in world units (same as the grains' seam)
const edgeZ=y=>.14*Math.pow(Math.sqrt(Math.max(0,1-(y/2.8)**2)),.6);
const hashf=x=>{ const s=Math.sin(x)*43758.5453; return s-Math.floor(s); };
const COAT=2600, FIB=40, FP=150, POOL=3200, LQN=COAT*2+FIB*FP+POOL;
const lqPos=new Float32Array(LQN*3), lqK=new Float32Array(LQN), lqS=new Float32Array(LQN);
const lqGeo=new THREE.BufferGeometry(); lqGeo.setAttribute('position',new THREE.BufferAttribute(lqPos,3));
lqGeo.setAttribute('aK',new THREE.BufferAttribute(lqK,1)); lqGeo.setAttribute('aS',new THREE.BufferAttribute(lqS,1));
const lqMat=additive(new THREE.ShaderMaterial({uniforms:{uPix:U.uPix},
  vertexShader:`attribute float aK,aS; uniform float uPix; varying float vK;
    void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; vK=aK; gl_PointSize=aK>.001?clamp(aS*uPix*(12./-mv.z),1.,24.):0.; }`,
  fragmentShader:`varying float vK; void main(){ vec2 q=gl_PointCoord-.5; float d=dot(q,q); if(d>.25) discard;
    vec3 c=mix(vec3(.40,.48,.95),vec3(.90,.94,1.),clamp(vK*1.1,0.,1.));       // lit from inside: a bright core, a soft wet halo
    gl_FragColor=vec4(c*(exp(-d*16.)*.85+exp(-d*4.)*.3)*vK,1.); }`}));
const lqPts=new THREE.Points(lqGeo,lqMat); lqPts.frustumCulled=false; lqPts.visible=false; lqPts.renderOrder=4; scene.add(lqPts);
/* each thread also has a glowing core line (VisRef/8: a translucent tube lit from inside; the bloom gives it its body) */
const TBN=FIB*FP*2, tbPos=new Float32Array(TBN*3), tbCol=new Float32Array(TBN*3);
const tbGeo=new THREE.BufferGeometry(); tbGeo.setAttribute('position',new THREE.BufferAttribute(tbPos,3)); tbGeo.setAttribute('color',new THREE.BufferAttribute(tbCol,3));
const tubes=new THREE.LineSegments(tbGeo,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
tubes.frustumCulled=false; tubes.renderOrder=5; lqPts.add(tubes);
let coat=[null,null], fibers=[];
/* drops shed by the threads (and the last of the coat): slowed by the thick water, then carried out of the picture */
const plP=new Float32Array(POOL*3), plV=new Float32Array(POOL*3), plB=new Float32Array(POOL), plR=new Float32Array(POOL); let plN=0, coatShed=false;
function shed(x,y,z,vx,vy,vz){ if(plN>=POOL) return; const i=plN++; plP[i*3]=x; plP[i*3+1]=y; plP[i*3+2]=z; plV[i*3]=vx; plV[i*3+1]=vy; plV[i*3+2]=vz; plB[i]=clock; plR[i]=R(); }
function buildCut(){
  plN=0; coatShed=false;
  coat=doors.map(d=>{ const side=d.userData.side, a=new Float32Array(COAT*4);
    for(let i=0;i<COAT;i++){ const y=(R()*2-1)*2.7, e=Math.sqrt(Math.max(0,1-(y/2.85)**2)), g=Math.abs(R()+R()-1);
      a[i*4]=seamXw(y)-side*3.3-side*g*.07; a[i*4+1]=y; a[i*4+2]=edgeZ(y)-R()*.3*e; a[i*4+3]=R(); }
    return a; });
  fibers=Array.from({length:FIB},()=>{ const y=(R()*2-1)*2.3, y2=clamp(y+(R()-.5)*.3,-2.4,2.4);
    return {aL:new THREE.Vector3(seamXw(y)+3.3,y,edgeZ(y)-R()*.28), aR:new THREE.Vector3(seamXw(y2)-3.3,y2,edgeZ(y2)-R()*.28),
      Lb:.35+Math.pow(R(),1.4)*3.2, ub:.35+R()*.3, seed:R()*10, snap:-1, R0:.025+R()*.03, beads:2+(R()*3|0), brk:null, dv:null}; });
}
const tv=new THREE.Vector3(), vA=new THREE.Vector3(), vB=new THREE.Vector3();
function updateLiquid(openSt,dt){
  const BU=ss(3.4,4.3,openSt);                                      // the throw
  let n=0; const put=(x,y,z,k,s)=>{ if(n>=LQN) return;
    if(BU>0){ const hr=hashf(n*1.37), b=ss(hr*.3,hr*.3+.7,BU), l=Math.hypot(x,y)+.2, e=b*b*(7+hr*7); x+=x/l*e; y+=y/l*e; k*=1-ss(.55,1,b); }
    lqPos[n*3]=x; lqPos[n*3+1]=y; lqPos[n*3+2]=z; lqK[n]=k; lqS[n]=s; n++; };
  const all=ss(0,.6,openSt);                                        // arrives with the tear, leaves with the throw
  if(all>0) doors.forEach((d,di)=>{ const a=coat[di]; if(!a) return;
    for(let i=0;i<COAT;i++){ const r=a[i*4+3];
      tv.set(a[i*4]+Math.sin(clock*.9+r*20)*.012, a[i*4+1]+Math.sin(clock*.6+r*13)*.02, a[i*4+2]).applyMatrix4(d.matrixWorld);
      put(tv.x,tv.y,tv.z,(.14+.24*r)*all,2+r*2.2);
      if(!coatShed&&openSt>3.2&&i%3===0) shed(tv.x,tv.y,tv.z,(R()-.5)*.25,(R()-.3)*.2,(R()-.5)*.25); } });
  if(openSt>3.2) coatShed=true;
  let nt=0; const seg=(a,b,k)=>{ if(nt>=TBN-1||k<=.003) return; tbPos.set(a,nt*3); tbPos.set(b,nt*3+3); for(const o of [0,3]){ tbCol[nt*3+o]=k*.95; tbCol[nt*3+o+1]=k; tbCol[nt*3+o+2]=k*1.05; } nt+=2; };
  for(const f of fibers){
    vA.copy(f.aL).applyMatrix4(doors[0].matrixWorld); vB.copy(f.aR).applyMatrix4(doors[1].matrixWorld);
    const len=vA.distanceTo(vB), tau=Math.min(1,len/f.Lb);
    if(f.snap<0&&(len>=f.Lb||openSt>2.7+f.seed*.06)){ f.snap=clock; f.brk=[lerp(vA.x,vB.x,f.ub),lerp(vA.y,vB.y,f.ub)-.06,lerp(vA.z,vB.z,f.ub)];
      f.dv=[(R()-.5)*.12,(R()<.6?-1:1)*(.06+R()*.1),(R()-.5)*.08]; drip();
      for(let k=0;k<30;k++){ const a=R()*TAU, s=.15+R()*.55; shed(f.brk[0]+(R()-.5)*.05,f.brk[1]+(R()-.5)*.05,f.brk[2],f.dv[0]+Math.cos(a)*s,f.dv[1]+Math.sin(a)*s*.7,f.dv[2]+(R()-.5)*s); } }
    if(all<=0||(len<.015&&f.snap<0)) continue;
    const sag=.3*(1-tau)*Math.min(1,len)+.05, ts=f.snap<0?0:clock-f.snap, rr=ss(0,1.5,ts), bead=ss(.1,1,ts), fade=1-ss(1.8,3.6,ts);
    let prev=null, prevLeft=null;
    for(let i=0;i<FP;i+=1){ const h1=hashf(f.seed*91+i*7.13), h2=hashf(f.seed*37+i*3.7), h3=hashf(f.seed*17+i*1.9), u=(i+h3*.9)/FP;
      let px,py,pz,rad,k;
      if(f.snap<0){                                              // stretched: fat at the walls, thinning in the middle as it is pulled
        const s=Math.sin(Math.PI*u), neck=Math.max(.12,1-tau*.88*Math.pow(s,.8));
        rad=f.R0*(neck+1.5*(Math.exp(-u*10)+Math.exp(-(1-u)*10)));
        px=lerp(vA.x,vB.x,u); py=lerp(vA.y,vB.y,u)-sag*s+Math.sin(clock*1.1+f.seed+u*5)*.015; pz=lerp(vA.z,vB.z,u);
        k=(.3+.45*tau)*(1+.7*Math.pow(s,4)*tau*tau);              // the thin middle glows as it is about to give
      } else {                                                   // given: each half creeps back to its wall and gathers into beads
        const left=u<f.ub, w0=left?u/f.ub:(1-u)/(1-f.ub);
        if(w0>.8&&h1<.5){ prev=null; continue; }                   // the tip has become the drops
        const w=w0*(1-rr*.72), nb=f.beads, bc=(Math.floor(w*nb)+.5)/nb, wb=lerp(w,bc,bead*.85), uu=left?wb*f.ub:1-wb*(1-f.ub);
        px=lerp(vA.x,vB.x,uu); py=lerp(vA.y,vB.y,uu)-(.05+.3*rr*wb*wb); pz=lerp(vA.z,vB.z,uu);
        rad=f.R0*(.55+1.3*bead*(1-Math.abs(((w*nb)%1)-.5)*1.8)); k=(.45+.35*(1-w))*fade;
      }
      const ang=h1*TAU, rp=Math.sqrt(h2)*rad;
      put(px,py+Math.cos(ang)*rp,pz+Math.sin(ang)*rp,k*all*.75,2.1+h2*2.2);   // many soft grains overlap into one body of liquid
      { const lf=f.snap<0?null:u<f.ub, cur=[px,py,pz]; if(i%3===0){ if(prev&&prevLeft===lf) seg(prev,cur,k*all*.55*(1-BU)); prev=cur; prevLeft=lf; } }   // the core of the tube
    }
  }
  const drag=Math.exp(-dt*1.3);
  for(let i=0;i<plN;i++){ const r=plR[i], age=clock-plB[i];
    plV[i*3]*=drag; plV[i*3+1]*=drag; plV[i*3+2]*=drag;
    plP[i*3]+=plV[i*3]*dt; plP[i*3+1]+=(plV[i*3+1]+.03+r*.06)*dt; plP[i*3+2]+=plV[i*3+2]*dt;
    const k=lerp(.95,.4+.2*r,ss(0,4.5,age))*(.6+.4*Math.sin(clock*(.5+r)+r*50))*(1-ss(5,9,age));
    if(k>.003) put(plP[i*3]+Math.sin(clock*.13+r*40)*.12,plP[i*3+1],plP[i*3+2]+Math.cos(clock*.11+r*23)*.1,k,lerp(3.8,2.4+r*1.8,ss(0,3,age))); }
  for(let i=n;i<LQN;i++) lqK[i]=0;
  tbGeo.setDrawRange(0,nt); tbGeo.attributes.position.needsUpdate=tbGeo.attributes.color.needsUpdate=true;
  lqGeo.attributes.position.needsUpdate=lqGeo.attributes.aK.needsUpdate=lqGeo.attributes.aS.needsUpdate=true;
}

/* the sea: fine motes drifting slowly, always behind the dolphin */
const MOTES=700, moGeo=new THREE.BufferGeometry(), moP=new Float32Array(MOTES*3), moR=new Float32Array(MOTES);
for(let i=0;i<MOTES;i++){ moP[i*3]=(R()*2-1)*15; moP[i*3+1]=(R()*2-1)*8; moP[i*3+2]=-16+R()*10.5; moR[i]=R(); }
moGeo.setAttribute('position',new THREE.BufferAttribute(moP,3)); moGeo.setAttribute('aR',new THREE.BufferAttribute(moR,1));
const GL_DOF=`uniform float uFocus; varying float vB;
  float dof(float z){ vB=min(abs(z-uFocus)*.3,2.5); return 1.+vB*2.; }`;            // grains off the focal plane: bigger, softer, dimmer
const FR_DOF=`varying float vB; float soft(float d,float k){ return exp(-d*k/(1.+vB*1.6)); }`;
const motes=new THREE.Points(moGeo,additive(new THREE.ShaderMaterial({uniforms:{uTime:U.uTime,uPix:U.uPix,uK:{value:0},uFocus:U.uFocus},
  vertexShader:`attribute float aR; uniform float uTime,uPix,uK; varying float vA; ${GL_DOF}
    void main(){ vec3 p=position; p.y=mod(p.y+uTime*(.04+aR*.07)+8.,16.)-8.; p.x+=sin(uTime*.13+aR*40.)*.35; p.z+=cos(uTime*.11+aR*23.)*.25;
      float b=dof(p.z); vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp((1.6+aR*3.)*b*uPix*(12./-mv.z),1.,16.);
      vA=uK*(.25+.75*aR)*(.55+.45*sin(uTime*(.5+aR)+aR*50.))/(b*(1.+vB*.5)); }`,
  fragmentShader:`varying float vA; ${FR_DOF} void main(){ vec2 q=gl_PointCoord-.5; float d=dot(q,q); if(d>.25) discard; gl_FragColor=vec4(vec3(.6,.68,1.)*soft(d,7.)*vA*.32,1.); }`})));
motes.frustumCulled=false; motes.renderOrder=0; scene.add(motes);


/* the dolphin inside: a black body, its edge catching light, wearing the engraving the face just wore */
const LOOK={value:new THREE.Vector2()}; const look=LOOK.value;
const dolphin=new THREE.Group(); dolphin.visible=false; scene.add(dolphin);
const DS=.62, DOL_HOME=new THREE.Vector3(0,-.28,-4.3), DOL_PITCH=.1;
const HEAD=new THREE.Vector3(0,.55,5.6);          // a point on the brow, in model space (for the ring of signs)
const texL=new THREE.TextureLoader();
const dolMat=new THREE.ShaderMaterial({
  extensions:{derivatives:true},
  uniforms:{ uNormal:{value:texL.load('assets/dolphin_normal.jpg')}, uEngrave:{value:texL.load('assets/dolphin_engrave.jpg')},
    uTime:{value:0}, uReveal:{value:0}, uSwim:{value:.4}, uSweep:{value:-20}, uFade:{value:1}, uHover:{value:0}, uTop:{value:0}, uLook:LOOK },
  vertexShader:`
    uniform float uTime,uSwim; varying vec3 vN; varying vec3 vView; varying vec2 vUv; varying float vZ;
    uniform vec2 uLook;
    /* the head turns toward what it looks at; the body barely follows */
    vec3 turnV(vec3 v,float h){ float a=uLook.x*h, b=uLook.y*h, c=cos(a), s=sin(a);
      v=vec3(c*v.x+s*v.z,v.y,-s*v.x+c*v.z); c=cos(b); s=sin(b); return vec3(v.x,c*v.y+s*v.z,-s*v.y+c*v.z); }
    float headW(vec3 p){ return smoothstep(.5,6.,p.z); }
    vec3 turnP(vec3 p){ vec3 o=vec3(0.,.8,.5); return turnV(p-o,headW(p))+o; }
    void main(){
      vec3 p=turnP(position); float t=smoothstep(2.,-9.2,p.z);
      p.y+=sin(uTime*3.2-p.z*.42)*uSwim*1.1*t*t;
      vZ=p.z; vUv=uv;
      vec4 mv=modelViewMatrix*vec4(p,1.); vView=mv.xyz; vN=normalize(normalMatrix*turnV(normal,headW(position)));
      gl_Position=projectionMatrix*mv; }`,
  fragmentShader:`
    uniform sampler2D uNormal,uEngrave; uniform float uTime,uReveal,uSweep,uFade,uHover,uTop;
    varying vec3 vN; varying vec3 vView; varying vec2 vUv; varying float vZ;
    vec3 perturb(vec3 eye,vec3 n,vec3 m){
      vec3 q0=dFdx(eye), q1=dFdy(eye); vec2 st0=dFdx(vUv), st1=dFdy(vUv);
      vec3 q1p=cross(q1,n), q0p=cross(n,q0);
      vec3 T=q1p*st0.x+q0p*st1.x, B=q1p*st0.y+q0p*st1.y;
      float det=max(dot(T,T),dot(B,B)), s=det==0.?0.:inversesqrt(det);
      return normalize(T*(m.x*s)+B*(m.y*s)+n*m.z); }
    void main(){
      vec3 m=texture2D(uNormal,vUv).xyz*2.-1.; m.xy*=1.6;
      vec3 n=normalize(vN); if(!gl_FrontFacing) n=-n;
      vec3 N=perturb(vView,n,m), V=normalize(-vView);
      float fres=pow(1.-max(dot(N,V),0.),6.);
      vec3 L=normalize(vec3(.3,.9,.5));
      float spec=pow(max(dot(reflect(-L,N),V),0.),36.);
      float eng=smoothstep(.62,.95,texture2D(uEngrave,vUv).r);
      float sweep=exp(-pow((vZ-uSweep)*.45,2.));
      vec3 col=vec3(.004,.007,.011);
      col+=vec3(.55,.66,.98)*fres*(1.3+uHover*.5);
      col+=vec3(.86,.88,1.)*spec*(.3+.5*uTop);
      float up=max(dot(N,normalize((viewMatrix*vec4(0.,1.,.15,0.)).xyz)),0.);                       // light from the surface falls on its back
      col+=vec3(.42,.52,.88)*pow(up,2.5)*.32*uTop*(.85+.15*sin(uTime*.6+vZ*.8));
      col+=vec3(.62,.70,.98)*eng*(.22+sweep*.9)*(.35+fres);   // the tattoo the face just wore
      gl_FragColor=vec4(col*uReveal*uFade,1.);
    }`
});
const eyeMat=new THREE.ShaderMaterial({ uniforms:{uGlow:{value:0},uLook:LOOK},
  vertexShader:`varying vec3 vN; varying vec3 vV; uniform vec2 uLook;     /* the head turns toward what it looks at; the body barely follows */     vec3 turnV(vec3 v,float h){ float a=uLook.x*h, b=uLook.y*h, c=cos(a), s=sin(a);       v=vec3(c*v.x+s*v.z,v.y,-s*v.x+c*v.z); c=cos(b); s=sin(b); return vec3(v.x,c*v.y+s*v.z,-s*v.y+c*v.z); }     float headW(vec3 p){ return smoothstep(.5,6.,p.z); }     vec3 turnP(vec3 p){ vec3 o=vec3(0.,.8,.5); return turnV(p-o,headW(p))+o; }  void main(){ vec4 mv=modelViewMatrix*vec4(turnP(position),1.); vV=-mv.xyz; vN=normalMatrix*turnV(normal,headW(position)); gl_Position=projectionMatrix*mv; }`,
  fragmentShader:`uniform float uGlow; varying vec3 vN; varying vec3 vV; void main(){ float f=max(dot(normalize(vN),normalize(vV)),0.);
    gl_FragColor=vec4(vec3(.84,.87,1.)*(.25+f*1.6)*uGlow,1.); }`});
const dustMat=new THREE.ShaderMaterial({ transparent:true, depthWrite:false,
  uniforms:{uTime:{value:0},uReveal:{value:0},uPix:{value:1}},
  vertexShader:`attribute float aR; uniform float uTime,uReveal,uPix; varying float vA;
    void main(){ float life=fract(uTime*(.08+aR*.12)+aR*7.);
      vec3 p=position+normal*life*(.6+aR*1.4)+vec3(sin(aR*40.+uTime)*.3,life*1.2,-life*2.5);
      vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp((1.2+aR*2.)*uPix*(12./-mv.z),1.,6.); vA=uReveal*(1.-life)*smoothstep(0.,.1,life)*.3; }`,
  fragmentShader:`varying float vA; void main(){ vec2 q=gl_PointCoord-.5; gl_FragColor=vec4(vec3(.70,.76,1.)*exp(-dot(q,q)*16.)*vA,1.); }`});
dustMat.blending=THREE.CustomBlending; dustMat.blendSrc=THREE.OneFactor; dustMat.blendDst=THREE.OneFactor;
let dolLoaded=false; const EYES={};
async function loadDolphin(){
  try{
    const rj=await fetch('assets/dolphin.json'); if(!rj.ok) throw new Error('assets/dolphin.json '+rj.status);
    const rb=await fetch('assets/dolphin.bin'); if(!rb.ok) throw new Error('assets/dolphin.bin '+rb.status);
    const meta=await rj.json(), bin=await rb.arrayBuffer();
    const get=(mesh,kind)=>{ const m=meta.find(x=>x.mesh===mesh&&x.kind===kind); return kind==='idx'?new Uint32Array(bin,m.offset,m.count):new Float32Array(bin,m.offset,m.count); };
    for(const name of ['body','eyeL','eyeR']){
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.BufferAttribute(get(name,'pos'),3));
      g.setAttribute('normal',new THREE.BufferAttribute(get(name,'nrm'),3));
      g.setAttribute('uv',new THREE.BufferAttribute(get(name,'uv'),2));
      g.setIndex(new THREE.BufferAttribute(get(name,'idx'),1));
      const mat=name==='body'?dolMat:eyeMat.clone(); if(name!=='body'){ mat.uniforms.uLook=LOOK; EYES[name]=mat; }
      const mesh=new THREE.Mesh(g,mat); mesh.frustumCulled=false; dolphin.add(mesh);
      if(name==='body'){
        const P=g.attributes.position.array, Nn=g.attributes.normal.array, n=900, dp=new Float32Array(n*3), dn=new Float32Array(n*3), dr=new Float32Array(n);
        for(let i=0;i<n;i++){ const k=(R()*P.length/3|0)*3; dp.set([P[k],P[k+1],P[k+2]],i*3); dn.set([Nn[k],Nn[k+1],Nn[k+2]],i*3); dr[i]=R(); }
        const dg=new THREE.BufferGeometry(); dg.setAttribute('position',new THREE.BufferAttribute(dp,3)); dg.setAttribute('normal',new THREE.BufferAttribute(dn,3)); dg.setAttribute('aR',new THREE.BufferAttribute(dr,1));
        const dust=new THREE.Points(dg,dustMat); dust.frustumCulled=false; dolphin.add(dust);
      }
    }
    dolphin.scale.setScalar(DS); placeDolphin(); dolLoaded=true; ERR.dol='';
  }catch(e){ ERR.dol=String(e&&e.message||e).slice(0,70); console.warn('dolphin model missing',e); }
}
/* points on the dolphin's skin, in world space, for the face's grains to land on */
function buildDolT(){ const body=dolphin.children.find(m=>m.isMesh&&m.material===dolMat); if(!body) return; dolphin.updateMatrixWorld(true);
  const P=body.geometry.attributes.position.array, S=64, d=new Float32Array(S*S*4), v=new THREE.Vector3();
  for(let i=0;i<S*S;i++){ const k=(R()*P.length/3|0)*3; v.set(P[k],P[k+1],P[k+2]).applyMatrix4(body.matrixWorld); d[i*4]=v.x; d[i*4+1]=v.y; d[i*4+2]=v.z; d[i*4+3]=1; }
  const tx=new THREE.DataTexture(d,S,S,THREE.RGBAFormat,THREE.FloatType); tx.minFilter=tx.magFilter=THREE.NearestFilter; tx.needsUpdate=true;
  if(U.uDolT.value) U.uDolT.value.dispose(); U.uDolT.value=tx; U.uDolOK.value=1;
  const Nn=body.geometry.attributes.normal.array, nm=new THREE.Matrix3().getNormalMatrix(body.matrixWorld), n=new THREE.Vector3(), w=new THREE.Vector3(), rim=[];
  for(let k=0;k<P.length;k+=3){ w.set(P[k],P[k+1],P[k+2]).applyMatrix4(body.matrixWorld); n.set(Nn[k],Nn[k+1],Nn[k+2]).applyMatrix3(nm).normalize();
    if(Math.abs(n.dot(v.copy(camera.position).sub(w).normalize()))<.16) rim.push(w.x,w.y,w.z); }
  const dr=new Float32Array(S*S*4); for(let i=0;i<S*S;i++){ if(rim.length){ const k=(R()*rim.length/3|0)*3; dr[i*4]=rim[k]; dr[i*4+1]=rim[k+1]; dr[i*4+2]=rim[k+2]; } else { dr[i*4]=d[i*4]; dr[i*4+1]=d[i*4+1]; dr[i*4+2]=d[i*4+2]; } dr[i*4+3]=1; }
  const tr=new THREE.DataTexture(dr,S,S,THREE.RGBAFormat,THREE.FloatType); tr.minFilter=tr.magFilter=THREE.NearestFilter; tr.needsUpdate=true;
  if(U.uDolR.value) U.uDolR.value.dispose(); U.uDolR.value=tr;
  body.geometry.computeBoundingBox(); body.geometry.boundingBox.getCenter(U.uDolC.value).applyMatrix4(body.matrixWorld); }
function placeDolphin(){ dolphin.position.copy(DOL_HOME); dolphin.rotation.set(DOL_PITCH,0,0); }
loadDolphin();

/* ───────── 4. airbrush finish: bloom, grain, a little colour fringe ───────── */
const rtOpts={minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,
  type:renderer.capabilities.isWebGL2&&renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType};   // half-float where it can: the soft light rays and their bloom band in 8 bits
let rtMain, rtA, rtB, rtBg;
const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2)), qScene=new THREE.Scene(), qCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1); qScene.add(quad);
const VQ=`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
const copyMat=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{t:{value:null}},vertexShader:VQ,
  fragmentShader:`uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor=texture2D(t,vUv); }`});
const brightMat=new THREE.ShaderMaterial({uniforms:{t:{value:null},px:{value:new THREE.Vector2()}},vertexShader:VQ,
  fragmentShader:`uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
    void main(){ vec3 c=(texture2D(t,vUv+px*vec2(-1,-1)).rgb+texture2D(t,vUv+px*vec2(1,-1)).rgb+texture2D(t,vUv+px*vec2(-1,1)).rgb+texture2D(t,vUv+px*vec2(1,1)).rgb)*.25;
      gl_FragColor=vec4(max(c-.08,0.)*1.3,1.); }`});
const blurMat=new THREE.ShaderMaterial({uniforms:{t:{value:null},dir:{value:new THREE.Vector2()}},vertexShader:VQ,
  fragmentShader:`uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
    void main(){ vec3 c=texture2D(t,vUv).rgb*.2;
      for(int i=1;i<7;i++){ float w=exp(-float(i*i)/14.)*.2; c+=(texture2D(t,vUv+dir*float(i)).rgb+texture2D(t,vUv-dir*float(i)).rgb)*w; }
      gl_FragColor=vec4(c,1.); }`});
const compMat=new THREE.ShaderMaterial({uniforms:{t:{value:null},b:{value:null},time:{value:0},grain:{value:CONFIG.grain},bloom:{value:CONFIG.bloom},flash:{value:0},fade:{value:1},rip:{value:1},breath:{value:0},seam:{value:new THREE.Vector3(.5,.5,0)}},vertexShader:VQ,
  fragmentShader:`uniform sampler2D t,b; uniform float time,grain,bloom,flash,fade,rip,breath; uniform vec3 seam; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec2 w=vec2(sin(vUv.y*13.+time*.8)+.45*sin(vUv.y*29.-time*1.25+1.),sin(vUv.x*9.-time*.65)+.45*sin(vUv.x*23.+time*1.05))*.0016*rip;   // looking through water (the wake only)
      vec2 uv=vUv+w, d=(uv-.5)*.004;
      vec3 c=vec3(texture2D(t,uv+d).r,texture2D(t,uv).g,texture2D(t,uv-d).b);
      c*=1.+breath*.12; c+=texture2D(b,uv).rgb*bloom*(1.+flash*2.5+breath*.7);
      /* the light of the crack: only a tall, soft glow (no rays) */
      vec2 q=(vUv-seam.xy)*vec2(16.,1.6);
      c+=vec3(.70,.76,1.)*exp(-dot(q,q)*1.4)*seam.z*.38+vec3(.92,.94,1.)*exp(-dot(q*vec2(1.6,2.2),q*vec2(1.6,2.2))*3.)*seam.z*.22;
      c+=vec3(.78,.82,1.)*flash*.35;
      vec2 v=vUv-.5; c*=1.-dot(v,v)*1.1;
      c+=(h(vUv*vec2(1920.,1080.)+fract(time*13.7)*100.)-.5)*grain;
      c+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)*(1.6/255.);   /* dither: no banding in the dark */
      gl_FragColor=vec4(max(c,0.)*fade,1.); }`});
/* behind the face: the mandala is the water itself. Every echo's rings, folded by their mirror images, interfere into one
   symmetric pattern drawn only in dots; the crests carry the dots outward and the face, mirrored in its own outline and bent by
   the water's slope, decides how bright they are. Drawn at half resolution; it keeps its size on screen while the camera moves in. */
const bgMat=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,
  uniforms:{uVid:U.uVid,uAspect:U.uAspect,uCrop:U.uCrop,uLevels:U.uLevels,uTime:U.uTime,uSrc:U.uSrc,res:{value:new THREE.Vector2(1,1)},viewH:{value:7.57},k:{value:0}},
  vertexShader:VQ,
  fragmentShader:`uniform sampler2D uVid; uniform float uAspect,uTime,viewH,k; uniform vec3 uCrop; uniform vec2 uLevels,res; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    ${GL_WAVE}
    float lumAt(vec2 cu){ float ix=uCrop.x-(cu.x-.5)*uCrop.z/uAspect, iy=uCrop.y-(cu.y-.5)*uCrop.z;
      return clamp((dot(texture2D(uVid,vec2(ix,1.-iy)).rgb,vec3(.299,.587,.114))-uLevels.x)/max(.05,uLevels.y-uLevels.x),0.,1.); }
    void main(){
      vec2 p=(vUv-.5)*vec2(res.x/res.y,1.)*viewH; vec4 wv=waveAt(p); float A=sqrt(wv.w), nF=wv.x/(A*1.41+.04);
      vec2 ee=p/vec2(2.2,2.9); float rr=length(ee), o1=rr-1.;
      vec2 cu=.5+ee/(rr*rr+1e-4)*vec2(.36,.47)*.92+wv.yz*.0018;          // the face mirrored in its own outline, bent by the water
      float L=lumAt(cu)*exp(-max(o1,0.)*.6);
      /* dots carried by the water: two staggered layers drift outward and crossfade, pushed by the slope, each dot its own twinkle,
         so the stipple moves with what it draws instead of sitting on the screen like a mesh */
      float cs=3.; vec2 rd=normalize(gl_FragCoord.xy-res*.5+.001), base=gl_FragCoord.xy+wv.yz*1.2;
      float on=min(1.,A*2.2), crest=smoothstep(.3,1.3,nF)*on, trough=smoothstep(-.6,-1.5,nF)*on;
      float zone=smoothstep(-.03,.2,o1)*(1.-smoothstep(1.8,3.3,o1)), acc=0., tw=0.;
      for(int l=0;l<2;l++){ float fl=fract(uTime*.3+float(l)*.5), wl=1.-abs(fl*2.-1.);
        vec2 q=(base-rd*fl*cs*5.)/cs+float(l)*17.3, cell=floor(q), f=fract(q)-.5, j=vec2(h(cell),h(cell+7.3))-.5;
        float dotS=smoothstep(.42,.06,length(f-j*.6))*(.65+.35*sin(uTime*(1.5+h(cell+2.)*2.)+h(cell+5.)*6.28))*wl;
        acc+=dotS*(crest*(.3+.95*L)+trough*.05+L*.2*step(h(cell+3.1),.4));
        tw+=dotS*step(.975,h(cell+floor(uTime*5.)))*crest; }
      vec3 col=vec3(.008,.010,.022)+mix(vec3(.28,.32,.74),vec3(.84,.88,1.),clamp(crest*.5+L*.8,0.,1.))*(acc*2.8+tw*1.4)*zone;
      gl_FragColor=vec4(col*k,1.); }`});
/* from the 4th crack the mandala lets go, outer rings first: past a ragged front, the live image turns to grains that drift off like silt */
const MGX=440, MGY=248, mUv=new Float32Array(MGX*MGY*2), mR=new Float32Array(MGX*MGY);
for(let y=0,i=0;y<MGY;y++) for(let x=0;x<MGX;x++,i++){ mUv[i*2]=(x+R())/MGX; mUv[i*2+1]=(y+R())/MGY; mR[i]=R(); }
const mGeo=new THREE.BufferGeometry(); mGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(MGX*MGY*3),3));
mGeo.setAttribute('aUv',new THREE.BufferAttribute(mUv,2)); mGeo.setAttribute('aRand',new THREE.BufferAttribute(mR,1));
const mMat=additive(new THREE.ShaderMaterial({depthTest:false,uniforms:{uSnap:{value:null},uDiss:{value:0},uPix:U.uPix,uAsp:{value:16/9},uTime:U.uTime},
  vertexShader:`attribute vec2 aUv; attribute float aRand; uniform sampler2D uSnap; uniform float uDiss,uPix,uAsp,uTime; varying vec3 vC;
    void main(){ vec3 c=texture2D(uSnap,aUv).rgb; float b=max(c.r,max(c.g,c.b));
      vec2 sc=(aUv-.5)*vec2(uAsp,1.)*7.57; float rho=length(sc/vec2(2.2,2.9)), Rd=mix(3.4,.95,min(uDiss,1.));
      float kk=clamp((rho-Rd)*.9+aRand*.25+max(0.,uDiss-1.)*4.,0.,1.);
      vec2 q=(aUv*2.-1.)*vec2(uAsp,1.); float r=length(q)+1e-4; vec2 dir=q/r;
      q+=dir*kk*kk*(.5+aRand*1.2)+vec2(-dir.y,dir.x)*kk*(aRand-.5)*.5+vec2(sin(uTime*.7+aRand*30.)*.03,.12*kk*kk*(aRand-.3));
      float show=step(.001,kk)*(1.-kk);
      vC=c*3.*show*(1.+kk*1.5)*step(.015,b);
      gl_Position=vec4(q/vec2(uAsp,1.),0.,1.); gl_PointSize=(b>.015&&kk>.001)?(2.+kk*1.6)*uPix:0.; }`,
  fragmentShader:`varying vec3 vC; void main(){ vec2 q=gl_PointCoord-.5; float d=dot(q,q); if(d>.25) discard; gl_FragColor=vec4(vC*exp(-d*8.),1.); }`}));
const mPts=new THREE.Points(mGeo,mMat); mPts.frustumCulled=false; const mScene=new THREE.Scene(); mScene.add(mPts);
const bgCompMat=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{t:{value:null},uDiss:mMat.uniforms.uDiss,res:bgMat.uniforms.res,uTime:U.uTime},vertexShader:VQ,
  fragmentShader:`uniform sampler2D t; uniform float uDiss,uTime; uniform vec2 res; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    void main(){ vec2 sc=(vUv-.5)*vec2(res.x/res.y,1.)*7.57; float rho=length(sc/vec2(2.2,2.9)), Rd=mix(3.4,.95,min(uDiss,1.));
      float keep=1.-smoothstep(Rd-.35,Rd,rho+(h(floor(gl_FragCoord.xy*.5)+floor(uTime*9.))-.5)*.25);       // a ragged, living front: outer rings go first
      gl_FragColor=vec4(texture2D(t,vUv).rgb*keep*step(uDiss,1.),1.); }`});
/* light from above (the dolphin's world): soft shafts that sway slowly, brightest at the surface, drawn behind everything */
const rayMat=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{uTime:U.uTime,uK:{value:0},uAsp:{value:16/9}},vertexShader:VQ,
  fragmentShader:`uniform float uTime,uK,uAsp; varying vec2 vUv;
    float b(float x,float p){ return pow(.5+.5*sin(x),p); }
    void main(){ float x=(vUv.x-.5)*uAsp+(1.-vUv.y)*.32+.05*sin(uTime*.21+vUv.y*3.);
      float r=b(x*5.3+uTime*.11,7.)*.55+b(x*9.7-uTime*.08+1.3,10.)*.4+b(x*2.6+uTime*.05+2.,4.)*.45+b(x*17.-uTime*.13+.7,16.)*.25;
      float fall=pow(vUv.y,2.4), glow=pow(vUv.y,6.);
      vec3 c=vec3(.34,.53,.82)*r*fall*(.75+.25*sin(uTime*.37+x*1.7))*.24+vec3(.15,.28,.46)*glow*.18;
      c+=vec3(fract(sin(dot(gl_FragCoord.xy+fract(uTime)*91.,vec2(12.9898,78.233)))*43758.5453)*(1.5/255.))*step(.002,dot(c,vec3(1.)));   // a whisper of noise against banding
      gl_FragColor=vec4(c*uK,1.); }`});
rayMat.blending=THREE.CustomBlending; rayMat.blendSrc=THREE.OneFactor; rayMat.blendDst=THREE.OneFactor; rayMat.transparent=true;

/* where you click, the face surfaces in a glass marble (and its mirror image); the wave rolls it outward and it keeps its shape
   until it meets the edge of the picture, then shatters on the next 16th into a spray of light with a small glass sound. */
const MMAX=24, MARB=[];
const marbleMat=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,
  uniforms:{uVid:U.uVid,uAspect:U.uAspect,uCrop:U.uCrop,uLevels:U.uLevels,uM:{value:Array.from({length:MMAX},()=>new THREE.Vector4())},uAsp:{value:16/9}},vertexShader:VQ,
  fragmentShader:`uniform sampler2D uVid; uniform float uAspect,uAsp; uniform vec3 uCrop; uniform vec2 uLevels; uniform vec4 uM[${MMAX}]; varying vec2 vUv;
    float lumAt(vec2 cu){ float ix=uCrop.x-(cu.x-.5)*uCrop.z/uAspect, iy=uCrop.y-(cu.y-.5)*uCrop.z;
      return clamp((dot(texture2D(uVid,vec2(ix,1.-iy)).rgb,vec3(.299,.587,.114))-uLevels.x)/max(.05,uLevels.y-uLevels.x),0.,1.); }
    void main(){ vec2 p=(vUv-.5)*vec2(uAsp,1.)*7.57; vec3 col=vec3(0.);
      for(int i=0;i<${MMAX};i++){ vec4 M=uM[i]; if(M.z>0.){ vec2 q=(p-M.xy)/M.z; float d2=dot(q,q); if(d2<1.1){
        float d=sqrt(d2), z=sqrt(max(0.,1.-d2)), a=abs(M.w);
        vec2 lq=q/(1.+.55*z)*1.35; lq.x*=sign(M.w);                                // a ball lens: the middle magnified, the rim squeezed
        float L=lumAt(.5+lq*vec2(.36,.47)*1.05), inside=1.-smoothstep(.96,1.01,d);
        vec3 c=mix(vec3(.04,.05,.14),vec3(.86,.9,1.),pow(L,1.2))*(.4+.6*z)*inside;
        float rim=pow(1.-z,3.)*inside, edge=exp(-pow((d-1.)*34.,2.));
        vec2 h1=q-vec2(-.38,.42), h2=q-vec2(.32,-.46);
        float hl=exp(-dot(h1,h1)*60.)+.3*exp(-dot(h2,h2)*26.);
        col+=(c+vec3(.62,.7,1.)*rim*.9+vec3(.55,.62,1.)*edge*.45+vec3(1.,.94,.84)*hl*1.1*inside)*a; } } }
      gl_FragColor=vec4(col,1.); }`});
marbleMat.blending=THREE.CustomBlending; marbleMat.blendSrc=THREE.OneFactor; marbleMat.blendDst=THREE.OneFactor; marbleMat.transparent=true;
const SHN=1600, shP=new Float32Array(SHN*3), shV=new Float32Array(SHN*3), shB=new Float32Array(SHN).fill(-99), shR=new Float32Array(SHN), shK=new Float32Array(SHN), shS=new Float32Array(SHN); let shI=0;
const shGeo=new THREE.BufferGeometry(); shGeo.setAttribute('position',new THREE.BufferAttribute(shP,3)); shGeo.setAttribute('aK',new THREE.BufferAttribute(shK,1)); shGeo.setAttribute('aS',new THREE.BufferAttribute(shS,1));
const shards=new THREE.Points(shGeo,additive(new THREE.ShaderMaterial({uniforms:{uPix:U.uPix},
  vertexShader:`attribute float aK,aS; uniform float uPix; varying float vK; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; vK=aK; gl_PointSize=aK>.001?clamp(aS*uPix*(12./-mv.z),1.,40.):0.; }`,
  fragmentShader:`varying float vK; void main(){ vec2 q=gl_PointCoord-.5; float d=dot(q,q); if(d>.25) discard; gl_FragColor=vec4(mix(vec3(.6,.68,1.),vec3(1.,.93,.82),min(1.,vK*.6))*exp(-d*12.)*vK,1.); }`})));
shards.frustumCulled=false; shards.renderOrder=5; scene.add(shards);
function spawnMarbles(sp){                                 // a main drop off in a random direction, and 2–4 small ones going with it like bells
  const a=R()*TAU, sd=R()<.5?-1:1;
  MARB.push({x:sp[0],y:sp[1],vx:Math.cos(a)*.85,vy:Math.sin(a)*.85,r:0,R:.44+R()*.1,born:clock,side:sd,pending:false,dead:false});
  const n=2+(R()*3|0);
  for(let k=0;k<n;k++){ const b=a+(R()-.5)*.9, sp2=.7+R()*.5, off=.35+R()*.45, oa=a+Math.PI+(R()-.5)*1.6;
    MARB.push({x:sp[0]+Math.cos(oa)*off,y:sp[1]+Math.sin(oa)*off,vx:Math.cos(b)*sp2,vy:Math.sin(b)*sp2,r:0,R:.1+R()*.09,born:clock+.08+k*.07+R()*.1,side:sd,pending:false,dead:false}); }
  while(MARB.length>MMAX) MARB.shift();
}
function shatter(m){
  if(m.dead) return; m.dead=true;
  const hw=VIEWH/2*camera.aspect, hh=VIEWH/2, nx=Math.abs(m.x)+m.r>hw?-Math.sign(m.x):0, ny=Math.abs(m.y)+m.r>hh?-Math.sign(m.y):0;
  const big=m.R>.3, cnt=big?150:34;
  for(let k=0;k<cnt;k++){ const i=shI; shI=(shI+1)%SHN; const core=k<(big?6:2), a=R()*TAU, s=core?.05:.5+Math.pow(R(),2)*3.6, ex=Math.cos(a), ey=Math.sin(a);
    shP[i*3]=m.x+ex*m.r*R(); shP[i*3+1]=m.y+ey*m.r*R(); shP[i*3+2]=.2;
    shV[i*3]=ex*s+nx*.8; shV[i*3+1]=ey*s+ny*.8; shV[i*3+2]=(R()-.5)*s; shB[i]=clock; shR[i]=core?1+R():R(); }   // the first few are the flash itself
  glass(clamp(m.x/hw,-1,1),big?1:.35);
}
function updateMarbles(dt){
  const hw=VIEWH/2*camera.aspect, hh=VIEWH/2, M=marbleMat.uniforms.uM.value;
  for(let i=MARB.length-1;i>=0;i--){ const m=MARB[i], age=clock-m.born;
    if(m.dead){ MARB.splice(i,1); continue; }
    if(age<0) continue;
    m.r=m.R*ss(0,.6,age); m.x+=m.vx*dt; m.y+=m.vy*dt; m.vx*=1+.12*dt; m.vy*=1+.12*dt;      // rolled on by the wave
    if(!m.pending&&(Math.abs(m.x)+m.r>hw||Math.abs(m.y)+m.r>hh)){ m.pending=true; at(nextGrid(.25),()=>shatter(m)); } }
  for(let i=0;i<MMAX;i++){ const m=MARB[i]; if(m&&clock>=m.born) M[i].set(m.x,m.y,m.r,ss(0,.35,clock-m.born)*m.side); else M[i].set(0,0,0,0); }
  const drag=Math.exp(-dt*2.2);
  for(let i=0;i<SHN;i++){ const age=clock-shB[i]; if(age>1.4){ shK[i]=0; continue; }
    shV[i*3]*=drag; shV[i*3+1]*=drag; shV[i*3+2]*=drag; shP[i*3]+=shV[i*3]*dt; shP[i*3+1]+=shV[i*3+1]*dt-.15*dt; shP[i*3+2]+=shV[i*3+2]*dt;
    if(shR[i]>=1){ shK[i]=2.2*(1-ss(0,.35,age)); shS[i]=26*(.5+.5*ss(0,.12,age)); continue; }
    shK[i]=(2.8-age*1.7)*(1-ss(.5,1.4,age))*(.6+.4*Math.sin(clock*30+shR[i]*40)); shS[i]=2.4+shR[i]*4*(1-ss(0,1,age)); }
  shGeo.attributes.position.needsUpdate=shGeo.attributes.aK.needsUpdate=shGeo.attributes.aS.needsUpdate=true;
}

/* when the dolphin arrives: very fine grains rise from below, all through the water (and keep rising, faintly, around it) */
const RISEN=240, riP=new Float32Array(RISEN*3), riR=new Float32Array(RISEN);
for(let i=0;i<RISEN;i++){ riP[i*3]=(R()*2-1)*7.5; riP[i*3+1]=R(); riP[i*3+2]=-7.5+R()*10; riR[i]=R(); }
const riGeo=new THREE.BufferGeometry(); riGeo.setAttribute('position',new THREE.BufferAttribute(riP,3)); riGeo.setAttribute('aR',new THREE.BufferAttribute(riR,1));
const riseMat=additive(new THREE.ShaderMaterial({uniforms:{uTime:U.uTime,uPix:U.uPix,uK:{value:0},uT:{value:0},uFocus:U.uFocus},
  vertexShader:`attribute float aR; uniform float uTime,uPix,uK,uT; varying float vA; ${GL_DOF}
    void main(){ float spd=.6+aR*.9, s=uT-position.y*1.6;                                   // each grain sets off a little later than the last
      vec3 p=position; p.y=-5.+mod(max(s,0.)*spd,11.); p.x+=sin(uTime*(.8+aR)+aR*40.)*.06;
      float b=dof(p.z); vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp((1.3+aR*1.6)*b*uPix*(12./-mv.z),1.2,14.);
      vA=uK*step(0.,s)*smoothstep(-5.,-4.2,p.y)*(1.-smoothstep(4.,6.,p.y))*(.5+.5*smoothstep(-3.,4.,p.y))*(.65+.35*sin(uTime*(1.5+aR*2.)+aR*30.))/(b*(1.+vB*.5)); }`,   // brighter nearer the light above
  fragmentShader:`varying float vA; ${FR_DOF} void main(){ vec2 q=gl_PointCoord-.5; float d=dot(q,q); if(d>.25) discard; gl_FragColor=vec4(vec3(.8,.86,1.)*soft(d,9.)*vA*1.6,1.); }`}));
const rise=new THREE.Points(riGeo,riseMat); rise.frustumCulled=false; rise.renderOrder=0; scene.add(rise);


function pass(mat,target){ quad.material=mat; renderer.setRenderTarget(target); renderer.render(qScene,qCam); }

/* ───────── 5. the seven signs (drawn above, in a ring round the dolphin's head) ───────── */
const fx=$('wfx'), fg=fx.getContext('2d');
const C_CORE='rgba(248,249,255,', C_SIL='rgba(232,234,250,', C_PERI='rgba(111,127,208,', C_LIL='rgba(201,200,232,';
function pearl(g,x,y,r,a=1){const gr=g.createRadialGradient(x-r*.4,y-r*.4,0,x,y,r); gr.addColorStop(0,C_CORE+a+')'); gr.addColorStop(.5,`rgba(214,214,240,${.85*a})`); gr.addColorStop(1,`rgba(111,127,208,${.25*a})`); g.fillStyle=gr; g.beginPath(); g.arc(x,y,r,0,TAU); g.fill();}
function spiral(g,x,y,S,dir,turns,t,r0,a,w){g.strokeStyle=C_SIL+a+')'; g.lineWidth=w; g.beginPath();
  for(let i=0;i<=100;i++){const k=i/100, an=dir+k*turns*TAU+t*.2, r=r0*S*(1-k*.92); const px=x+Math.cos(an)*r, py=y+Math.sin(an)*r; i?g.lineTo(px,py):g.moveTo(px,py);} g.stroke();}
function glyph(g,id,t,S,a){
  const w=Math.max(1,S*.035);
  g.save(); g.globalCompositeOperation='lighter'; g.lineCap='round';
  if(id==='soul'){ g.setLineDash([S*.03,S*.05]);
    for(let i=0;i<11;i++){const an=-Math.PI/2+(i/10-.5)*Math.PI*1.3; g.strokeStyle=C_SIL+(.55*a)+')'; g.lineWidth=w*.7; g.beginPath();
      g.moveTo(Math.cos(an)*S*.2,S*.15+Math.sin(an)*S*.2); g.lineTo(Math.cos(an)*S*(i%2?.55:.75),S*.15+Math.sin(an)*S*(i%2?.55:.75)); g.stroke();}
    g.setLineDash([]); pearl(g,0,S*.15,S*.17,a);
  } else if(id==='dream'){ g.strokeStyle=C_SIL+(.6*a)+')'; g.lineWidth=w; g.beginPath(); g.arc(0,0,S*.62,0,TAU); g.stroke();
    for(let k=1;k<=3;k++){const rx=S*.62*Math.abs(Math.cos(k/4*Math.PI/2+t*.3)); g.strokeStyle=C_SIL+(.35*a)+')'; g.lineWidth=w*.7; g.beginPath(); g.ellipse(0,0,rx,S*.62,0,0,TAU); g.stroke();}
    g.strokeStyle=C_LIL+(.35*a)+')'; g.beginPath(); g.ellipse(0,0,S*.62,S*.1,0,0,TAU); g.stroke();
  } else if(id==='voice'){ for(const sx of [-1,1]){ g.strokeStyle=C_SIL+(.7*a)+')'; g.lineWidth=w; g.beginPath();
      g.moveTo(sx*S*.06,S*.45); g.quadraticCurveTo(sx*S*.75,S*.25,sx*S*.5,-S*.6); g.stroke();
      for(let i=1;i<5;i++){const u=i/5, x=(1-u)*(1-u)*.06+2*(1-u)*u*.62+u*u*.47, y=(1-u)*(1-u)*.45+2*(1-u)*u*.25+u*u*-.6; pearl(g,sx*S*x*.86,S*y,S*.035,a*(.5+.5*Math.sin(t*1.6+i)));}}
  } else if(id==='heart'){ const ph=(t%.75)/.75, beat=Math.exp(-ph*5);
    for(let i=0;i<4;i++){g.strokeStyle=C_SIL+((.65-i*.12)*a)+')'; g.lineWidth=w*.8; g.beginPath(); g.arc(0,0,S*(.12+i*.14)*(1+beat*.04*(4-i)),0,TAU); g.stroke();}
    pearl(g,0,0,S*(.1+beat*.03),a);
  } else if(id==='memory'){ for(const sx of [-1,1]) spiral(g,sx*S*.3,S*.05,S,sx>0?0:Math.PI,1.9,t,.34,.8*a,w);
  } else if(id==='bone'){ for(let i=0;i<6;i++){const yy=S*(-.5+i*.18), ww=S*(.2-i*.02);
      g.strokeStyle=C_SIL+(.7*a)+')'; g.lineWidth=w; g.beginPath(); g.ellipse(0,yy,ww,S*.05,0,0,TAU); g.stroke();
      for(const sx of [-1,1]){g.beginPath(); g.moveTo(0,yy); g.quadraticCurveTo(sx*ww*1.8,yy-S*.03,sx*ww*1.4,yy+S*.09); g.stroke();}}
    g.strokeStyle=C_CORE+(.6*a)+')'; g.beginPath(); g.moveTo(0,-.62*S); g.lineTo(0,.62*S); g.stroke();
  } else if(id==='eye'){   // sealed: a closed lid, lashes hanging down
    g.strokeStyle=C_SIL+(.75*a)+')'; g.lineWidth=w; g.beginPath(); g.moveTo(-S*.6,0); g.quadraticCurveTo(0,S*.32,S*.6,0); g.stroke();
    g.strokeStyle=C_SIL+(.4*a)+')'; g.beginPath(); g.moveTo(-S*.6,0); g.quadraticCurveTo(0,-S*.12,S*.6,0); g.stroke();
    for(let i=-3;i<=3;i++){ const x=i*S*.16, y=S*.16*(1-Math.pow(i/3.6,2)); g.beginPath(); g.moveTo(x,y); g.lineTo(x*1.15,y+S*.16); g.stroke(); }
  }
  g.restore();
}
const SIGNS=['eye','heart','voice','bone','memory','soul','dream'];   // eye sits at the top, sealed
const sign=SIGNS.map((id,i)=>({id,i,hv:0,born:0,x:0,y:0,lastPlay:-9,hit:-9}));
let dreamSaid=true;   // (with a name, the first words wait until the face has gathered)
const ECHO_V=.55;   // how fast an echo's circles spread (screen heights a second)
let ringEchoT=-9, ringC=[0,0], ringR=0, ringK=0, scatter=0, hovered=null, mouse=[-1e4,-1e4], ringAng=0, ringSpin=.02, dolHover=0, answerT=-9;
function drawSigns(t){
  if(ringK<=0&&scatter<=0) return;
  const S=fx.height*.058;
  for(const s of sign){
    const an=-Math.PI/2+s.i/SIGNS.length*TAU+ringAng;
    let x=ringC[0]+Math.cos(an)*ringR*1.3, y=ringC[1]+Math.sin(an)*ringR*.88;
    const er=(clock-ringEchoT)*fx.height*ECHO_V, ed=Math.hypot(x-ringC[0],y-ringC[1]);   // where the echo's circle has got to
    if(ringEchoT>0&&er>=ed&&!s.born){ s.born=1; s.hit=clock; }
    const appear=ringEchoT<0?ss(s.i*.22,s.i*.22+.8,ringK*4):ss(0,fx.height*.09,er-ed);
    const hitK=Math.exp(-(clock-s.hit)*3);
    const bp=bloomOf(s.id);
    let a=Math.min(1,appear*(1-scatter)*(heard.has(s.id)||s.hv>.1?1:.62)+hitK*.6*(1-scatter)), sc=(1+s.hv*.25+hitK*.35)*(1+.04*bp.w*Math.exp(-bp.age*6));
    if(scatter>0){ const k=ss(0,1,scatter); x+=Math.cos(an)*k*fx.height*.06+Math.sin(clock*2+s.i)*k*fx.height*.01; y+=Math.sin(an)*k*fx.height*.05-k*fx.height*.03; sc*=1+k*.15; a*=1-k; }   // they let go: fade, drift a little, waver
    s.x=x; s.y=y;
    if(a<=.01) continue;
    fg.save(); fg.translate(x,y); fg.scale(sc,sc);
    const gr=fg.createRadialGradient(0,0,0,0,0,S*1.6); gr.addColorStop(0,`rgba(150,165,240,${(.12+s.hv*.25)*a})`); gr.addColorStop(1,'rgba(150,165,240,0)');
    fg.fillStyle=gr; fg.beginPath(); fg.arc(0,0,S*1.6,0,TAU); fg.fill();
    fg.shadowColor='rgba(170,180,245,.8)'; fg.shadowBlur=S*.35; glyph(fg,s.id,t,S,a*(s.id==='eye'?.75:1)); fg.shadowBlur=0;
    if(scatter<=0){ const b=bloomOf(s.id); bloom(fg,s.id,S,b.age,b.w,a*(s.id==='eye'?.75:1),t); }
    fg.restore();
  }
}
/* each sign breathes on its own part of the 80 BPM bar (two bars, 16th-note steps): a faint shape opens on the hit and leaves an afterimage */
const BEATS={ heart:[0,4,8,12,16,20,24,28].flatMap(k=>[[k,1],[k+1,.45]]),            // lub-dub on every beat
  voice:[[6,.8],[14,.55],[22,.8],[30,.55]], bone:[[0,1],[8,.5],[16,1],[24,.5]], memory:[[3,.7],[13,.6],[19,.7],[29,.8]],
  soul:[[0,1],[20,.45]], dream:[[10,.8],[26,.8]], eye:[[28,.7]] };
function bloomOf(id){ const s16=BEAT/4, bar=32*s16, pos=((beatNow()-beat0)%bar+bar)%bar; let age=1e9, w=0;
  for(const [k,wk] of BEATS[id]){ let d=pos-k*s16; if(d<0) d+=bar; if(d<age){ age=d; w=wk; } } return {age,w}; }
function bloom(g,id,S,age,w,a,t){
  const env=(Math.exp(-age*4.5)+.22*Math.exp(-age*1.1))*w*a*.5, gr=1-Math.exp(-age*5);
  if(env<.004) return;
  g.save(); g.globalCompositeOperation='lighter'; g.lineCap='round'; g.lineWidth=Math.max(1,S*.02);
  const st=k=>{ g.strokeStyle=C_SIL+(env*k).toFixed(3)+')'; }, dot=(x,y,r,k)=>{ g.fillStyle=C_CORE+(env*k).toFixed(3)+')'; g.beginPath(); g.arc(x,y,r,0,TAU); g.fill(); };
  const d=S*.035;
  if(id==='heart'){ for(const [r,k] of [[.75+.5*gr,1],[.6+.8*gr,.45]]){ st(k); g.beginPath(); g.arc(0,0,S*r,0,TAU); g.stroke(); } }
  else if(id==='voice'){ for(let i=-3;i<=3;i++){ const an=-Math.PI/2+i*.25, r0=S*.75, r1=r0+S*(.12+.38*gr)*(1-Math.abs(i)*.12);
      st(.9); g.beginPath(); g.moveTo(Math.cos(an)*r0,Math.sin(an)*r0); g.lineTo(Math.cos(an)*r1,Math.sin(an)*r1); g.stroke(); dot(Math.cos(an)*r1,Math.sin(an)*r1,d,1); } }
  else if(id==='bone'){ for(let k=0;k<4;k++){ const y=S*(-.36+k*.24); for(const sx of [-1,1]){ st(.9-k*.12); g.beginPath(); g.moveTo(sx*S*.5,y); g.lineTo(sx*S*(.5+.32*gr),y); g.stroke(); dot(sx*S*(.5+.32*gr),y,d*.8,.8); } } }
  else if(id==='memory'){ st(.9); g.beginPath(); for(let i=0;i<=40;i++){ const u=i/40, an=-Math.PI/2+u*gr*TAU*.85, r=S*(.72+.3*u); i?g.lineTo(Math.cos(an)*r,Math.sin(an)*r):g.moveTo(Math.cos(an)*r,Math.sin(an)*r); } g.stroke();
    const an=-Math.PI/2+gr*TAU*.85; dot(Math.cos(an)*S*1.02,Math.sin(an)*S*1.02,d,1); }
  else if(id==='soul'){ for(let i=0;i<9;i++){ const an=-Math.PI*(.85-i*.0875), r=S*(.7+.45*gr); dot(Math.cos(an)*r,Math.sin(an)*r,d*(i%2?.7:1.1),1); } }
  else if(id==='dream'){ st(.8); g.beginPath(); g.ellipse(0,0,S*(.7+.6*gr),S*(.18+.16*gr),t*.3,0,TAU); g.stroke(); const an=t*1.2; dot(Math.cos(an)*S*(.7+.6*gr),Math.sin(an)*S*(.18+.16*gr),d,1); }
  else if(id==='eye'){ const wv=S*(.6+.5*gr), hv=S*.3*gr; st(.9); g.beginPath(); g.moveTo(-wv,0); g.quadraticCurveTo(0,-hv,wv,0); g.quadraticCurveTo(0,hv,-wv,0); g.stroke(); dot(0,0,d*1.4,gr); }
  g.restore();
}

/* ───────── 5c. on the dive, the flipper sweeps past the camera and for 0.3 s you see the hand inside it (X-ray) ───────── */
const tmpS=new THREE.Vector3();
const FIN={rf:new THREE.Vector3(1.5,-.05,3.9), rb:new THREE.Vector3(1.5,-.12,2.5), tip:new THREE.Vector3(2.78,-.82,2.)};   // right flipper, model space
let xrayT=-9, xrayFin=1;
function finScreen(sx){ const out=[];
  for(const k of ['rf','rb','tip']){ tmpS.copy(FIN[k]); tmpS.x*=sx; tmpS.applyMatrix4(dolphin.matrixWorld).project(camera); if(Math.abs(tmpS.z)>1) return null; out.push([(tmpS.x+1)/2*fx.width,(1-tmpS.y)/2*fx.height]); }
  return out; }
function drawXray(){
  if(state!=='swim'||!dolLoaded) return;
  dolphin.updateMatrixWorld();
  if(xrayT<0) for(const sx of [1,-1]){ const f=finScreen(sx); if(!f) continue;
    const cx=(f[0][0]+f[1][0]+f[2][0])/3, cy=(f[0][1]+f[1][1]+f[2][1])/3, L=Math.hypot(f[2][0]-(f[0][0]+f[1][0])/2,f[2][1]-(f[0][1]+f[1][1])/2);
    if(cx>fx.width*.04&&cx<fx.width*.96&&cy>fx.height*.04&&cy<fx.height*.96&&L>fx.height*.2){ xrayT=clock; xrayFin=sx; break; } }
  const age=clock-xrayT; if(xrayT<0||age>.3) return;
  const f=finScreen(xrayFin); if(!f) return;
  const env=ss(0,.04,age)*(1-ss(.2,.3,age)), [RF,RB,TP]=f, Wd=Math.hypot(RF[0]-RB[0],RF[1]-RB[1]);
  const P=(a,b)=>{ const x=lerp(RF[0],RB[0],a), y=lerp(RF[1],RB[1],a); return [lerp(x,TP[0],b),lerp(y,TP[1],b)]; };
  fg.save(); fg.globalCompositeOperation='lighter'; fg.lineCap='round';
  fg.fillStyle=`rgba(120,190,255,${(.05*env).toFixed(3)})`; fg.fillRect(0,0,fx.width,fx.height);
  fg.beginPath(); fg.moveTo(...RF); fg.quadraticCurveTo(...P(-.18,.55),...TP); fg.quadraticCurveTo(...P(1.12,.5),...RB); fg.closePath();
  fg.fillStyle=`rgba(150,205,255,${(.12*env).toFixed(3)})`; fg.fill(); fg.strokeStyle=`rgba(190,225,255,${(.4*env).toFixed(3)})`; fg.lineWidth=1.2*DPR; fg.stroke();
  const bone=(p,q,w)=>{ fg.shadowColor='rgba(140,200,255,.9)'; fg.shadowBlur=10*DPR; fg.strokeStyle=`rgba(215,238,255,${(.5*env).toFixed(3)})`; fg.lineWidth=w;
    fg.beginPath(); fg.moveTo(...p); fg.lineTo(...q); fg.stroke(); fg.shadowBlur=0; fg.strokeStyle=`rgba(255,255,255,${(.45*env).toFixed(3)})`; fg.lineWidth=w*.35; fg.stroke(); };
  bone(P(.5,-.06),P(.5,.18),Wd*.16);                                   // humerus
  bone(P(.36,.22),P(.38,.4),Wd*.08); bone(P(.64,.22),P(.62,.4),Wd*.08);   // radius, ulna
  for(const [a,b] of [[.28,.45],[.42,.45],[.56,.45],[.7,.45],[.34,.5],[.5,.5],[.66,.5]]){ const c=P(a,b); fg.fillStyle=`rgba(225,240,255,${(.5*env).toFixed(3)})`; fg.beginPath(); fg.arc(c[0],c[1],Wd*.035,0,TAU); fg.fill(); }   // wrist
  const A0=[.2,.37,.52,.66,.8], BE=[.66,.92,1,.86,.72], NP=[3,5,6,4,3];   // five fingers, as in a hand
  A0.forEach((a0,i)=>{ const b0=.54, n=NP[i]+1, aa=b=>lerp(a0,.5+(a0-.5)*.3,(b-b0)/(1-b0));
    for(let j=0;j<n;j++){ const b1=lerp(b0,BE[i],j/n)+.008, b2=lerp(b0,BE[i],(j+1)/n)-.008; bone(P(aa(b1),b1),P(aa(b2),b2),Wd*Math.max(.02,.05-.005*j));
      const jt=P(aa(b2+.008),b2+.008); fg.fillStyle=`rgba(255,255,255,${(.6*env).toFixed(3)})`; fg.beginPath(); fg.arc(jt[0],jt[1],Wd*.012,0,TAU); fg.fill(); } });
  fg.restore();
}

/* ───────── 6. sound ───────── */
let AC=null, padG=null; const PH={};
function audio(){
  if(AC) return; const C=window.AudioContext||window.webkitAudioContext; if(!C) return; AC=(window.SBGame&&SBGame.A.ctx)||new C();
  padG=AC.createGain(); padG.gain.value=0; const rev=AC.createConvolver(); const L=AC.sampleRate*5, b=AC.createBuffer(2,L,AC.sampleRate);
  for(let c=0;c<2;c++){const d=b.getChannelData(c); for(let i=0;i<L;i++) d[i]=(R()*2-1)*Math.pow(1-i/L,2.2);} rev.buffer=b;
  const wet=AC.createGain(); wet.gain.value=.7; padG.connect(AC.destination); padG.connect(rev); rev.connect(wet); wet.connect(AC.destination);
  [55,110,164.8,207.7,261.6].forEach((f,i)=>{ const o=AC.createOscillator(), g=AC.createGain(), lf=AC.createOscillator(), lg=AC.createGain();
    o.type=i<2?'triangle':'sine'; o.frequency.value=f; o.detune.value=(R()-.5)*10; g.gain.value=[.05,.045,.028,.02,.012][i];
    lf.frequency.value=.04+i*.027; lg.gain.value=g.gain.value*.7; lf.connect(lg); lg.connect(g.gain); lf.start(); o.connect(g); g.connect(padG); o.start(); });
  padG.gain.linearRampToValueAtTime(.9,AC.currentTime+4);
  AC.rev=rev;
  for(const id of SIGNS) fetch(`audio/p_${id}.mp3`).then(r=>r.ok?r.arrayBuffer():null).then(ab=>ab&&AC.decodeAudioData(ab)).then(bf=>{ if(bf) PH[id]=bf; }).catch(()=>{});
}
function phrase(id){ if(!AC||!PH[id]) return; const s=AC.createBufferSource(), g=AC.createGain(); s.buffer=PH[id]; g.gain.value=.9; s.connect(g); g.connect(AC.destination); g.connect(AC.rev); s.start(nextGrid(.5)); }   // lands on the next 8th, in time with the blooms
/* hovering a sign: its sound plays only while the pointer stays on it — it comes in on the beat, loops while you stay, and lets
   go softly the moment you leave */
function voiceOn(s){ if(!AC||!PH[s.id]||s.voice) return; const src=AC.createBufferSource(), g=AC.createGain(), t=nextGrid(.5);
  src.buffer=PH[s.id]; src.loop=true; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.9,t+.06); src.connect(g); g.connect(AC.destination); g.connect(AC.rev); src.start(t); s.voice={src,g}; }
function voiceOff(s){ if(!s.voice) return; const {src,g}=s.voice, t=AC.currentTime; s.voice=null;
  g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value,t); g.gain.setTargetAtTime(0,t,.12); try{ src.stop(t+.8); }catch(e){} }
let lastSnap=0;
function snapTick(){ if(!AC) return;                     // a fibre gives: a tiny dry pluck, somewhere left or right
  const t=Math.max(AC.currentTime+.005,lastSnap+.028); lastSnap=t;
  const o=AC.createOscillator(), g=AC.createGain(), f=1700+R()*2800; o.type='triangle';
  o.frequency.setValueAtTime(f,t); o.frequency.exponentialRampToValueAtTime(f*.5,t+.09);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.03+R()*.02,t+.002); g.gain.exponentialRampToValueAtTime(.0001,t+.11);
  o.connect(g); let out=g; if(AC.createStereoPanner){ const p=AC.createStereoPanner(); p.pan.value=(R()*2-1)*.75; g.connect(p); out=p; }
  out.connect(AC.destination); out.connect(AC.rev); o.start(t); o.stop(t+.13); }
let lastDrip=0;
function drip(){ if(!onAC()) return;                               // a thread of the liquid gives: a soft, wet 'plip', somewhere left or right
  const t=Math.max(AC.currentTime+.005,lastDrip+.035); lastDrip=t;
  const o=AC.createOscillator(), g=AC.createGain(), lp=AC.createBiquadFilter(), f=380+R()*420; o.type='sine';
  o.frequency.setValueAtTime(f,t); o.frequency.exponentialRampToValueAtTime(f*2.6,t+.07); lp.type='lowpass'; lp.frequency.value=1800;
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.05+R()*.03,t+.006); g.gain.exponentialRampToValueAtTime(.0001,t+.22);
  o.connect(lp); lp.connect(g); let out=g; if(AC.createStereoPanner){ const pn=AC.createStereoPanner(); pn.pan.value=(R()*2-1)*.7; g.connect(pn); out=pn; }
  out.connect(AC.destination); out.connect(AC.rev); o.start(t); o.stop(t+.25); }
function glass(pan,v=1){ if(!onAC()) return;                     // a glass marble breaks: a few high, bright partials and a short splinter (small ones: higher, softer)
  const t=AC.currentTime+.005, out=AC.createGain(); out.gain.value=.55*v; let o2=out;
  if(AC.createStereoPanner){ const pn=AC.createStereoPanner(); pn.pan.value=pan*.8; out.connect(pn); o2=pn; } o2.connect(AC.destination); o2.connect(AC.rev);
  [2637,3951,5274,6645,8372].forEach((f,i)=>{ const o=AC.createOscillator(), g=AC.createGain(); o.frequency.value=f*(v<1?1.5:1)*(1+(R()-.5)*.03);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.05/(1+i*.4),t+.003); g.gain.exponentialRampToValueAtTime(.0001,t+.25+R()*.9); o.connect(g); g.connect(out); o.start(t); o.stop(t+1.3); });
  for(let k=0;k<4;k++){ const s=AC.createBufferSource(); s.buffer=noiseBuf(.04); const hp=AC.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=3000+R()*3000;
    const g=AC.createGain(), tk=t+k*(.012+R()*.03); g.gain.setValueAtTime(.16/(k+1),tk); g.gain.exponentialRampToValueAtTime(.0001,tk+.04); s.connect(hp); hp.connect(g); g.connect(out); s.start(tk); s.stop(tk+.05); } }
function whoosh(){ if(!onAC()) return; const t=AC.currentTime;   // the halves let go: one low breath out
  const n=AC.createBufferSource(); n.buffer=noiseBuf(2); const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(260,t); f.frequency.exponentialRampToValueAtTime(1600,t+.25); f.frequency.exponentialRampToValueAtTime(160,t+1.8);
  const g=AC.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.3,t+.18); g.gain.exponentialRampToValueAtTime(.0001,t+1.9); n.connect(f); f.connect(g); g.connect(AC.destination); g.connect(AC.rev); n.start(t); n.stop(t+2);
  const o=AC.createOscillator(), og=AC.createGain(); o.frequency.setValueAtTime(72,t); o.frequency.exponentialRampToValueAtTime(34,t+1.6);
  og.gain.setValueAtTime(0,t); og.gain.linearRampToValueAtTime(.22,t+.06); og.gain.exponentialRampToValueAtTime(.0001,t+1.7); o.connect(og); og.connect(AC.destination); o.start(t); o.stop(t+1.8); }
function boom(){ if(!onAC()) return; const t=AC.currentTime;   // the face lets go: one deep blow under water
  const o=AC.createOscillator(), g=AC.createGain(); o.frequency.setValueAtTime(58,t); o.frequency.exponentialRampToValueAtTime(28,t+2.2);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.55,t+.03); g.gain.exponentialRampToValueAtTime(.0001,t+2.6); o.connect(g); g.connect(AC.destination); g.connect(AC.rev); o.start(t); o.stop(t+2.7);
  const n=AC.createBufferSource(); n.buffer=noiseBuf(2); const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(900,t); f.frequency.exponentialRampToValueAtTime(120,t+1.4);
  const ng=AC.createGain(); ng.gain.setValueAtTime(.22,t); ng.gain.exponentialRampToValueAtTime(.0001,t+1.6); n.connect(f); f.connect(ng); ng.connect(AC.destination); ng.connect(AC.rev); n.start(t); n.stop(t+1.7); }
function deepSwell(){ if(!onAC()) return; const t=AC.currentTime;   // after the breath out: the water closes over, low and slow, and rises toward the dolphin
  const n=AC.createBufferSource(); n.buffer=noiseBuf(5); const f=AC.createBiquadFilter(); f.type='lowpass'; f.Q.value=3; f.frequency.setValueAtTime(140,t); f.frequency.exponentialRampToValueAtTime(520,t+3.2); f.frequency.exponentialRampToValueAtTime(220,t+4.8);
  const g=AC.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.16,t+1.4); g.gain.linearRampToValueAtTime(.1,t+3.4); g.gain.exponentialRampToValueAtTime(.0001,t+4.9);
  n.connect(f); f.connect(g); g.connect(AC.destination); g.connect(AC.rev); n.start(t); n.stop(t+5);
  const o=AC.createOscillator(), og=AC.createGain(); o.frequency.value=55; og.gain.setValueAtTime(0,t); og.gain.linearRampToValueAtTime(.12,t+2.2); og.gain.exponentialRampToValueAtTime(.0001,t+5.5);
  o.connect(og); og.connect(AC.destination); og.connect(AC.rev); o.start(t); o.stop(t+5.6); }
function firstEcho(){ if(!AC) return; const t=nextGrid(1); clickTrain(.5,3,t); at(t,()=>{ if(state!=='circle') return; ringEchoT=clock; pulses.push(clock); }); at(t+BEAT/2,whistle); }   // its first echo: the same call and circles as its answer later
function firstCall(amp,when){ if(!AC) return; clickTrain(amp,1,when!=null?Math.max(AC.currentTime,when):nextGrid(.5)); }
function bell(f,v,dur=4){ if(!AC) return; const t=AC.currentTime;
  [1,2.76,5.4].forEach((m,i)=>{ const o=AC.createOscillator(), g=AC.createGain(); o.frequency.value=f*m;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v/(i+1),t+.01); g.gain.exponentialRampToValueAtTime(.0001,t+dur/(i+1));
    o.connect(g); g.connect(AC.destination); g.connect(AC.rev); o.start(t); o.stop(t+dur); }); }
function noiseBuf(sec){ const L=AC.sampleRate*sec, b=AC.createBuffer(1,L,AC.sampleRate), d=b.getChannelData(0); for(let i=0;i<L;i++) d[i]=R()*2-1; return b; }
function burst(){ if(!AC) return; const t=AC.currentTime;
  const n=AC.createBufferSource(); n.buffer=noiseBuf(4);
  const f=AC.createBiquadFilter(); f.type='bandpass'; f.Q.value=.7; f.frequency.setValueAtTime(260,t); f.frequency.exponentialRampToValueAtTime(4200,t+3);
  const g=AC.createGain(); g.gain.setValueAtTime(0,t); for(const [tt,v] of [[.3,.06],[.38,.01],[.9,.08],[.98,.015],[1.4,.1],[1.48,.02],[2.9,.2],[3.6,0]]) g.gain.linearRampToValueAtTime(v,t+tt);
  n.connect(f); f.connect(g); g.connect(AC.destination); g.connect(AC.rev); n.start(t); n.stop(t+3.7);
  [880,1108.7,1318.5,1760].forEach((fr,i)=>{ const o=AC.createOscillator(), og=AC.createGain(); o.frequency.value=fr;
    og.gain.setValueAtTime(0,t); og.gain.linearRampToValueAtTime(.028,t+2.8+i*.05); og.gain.exponentialRampToValueAtTime(.0001,t+7);
    o.connect(og); og.connect(AC.rev); o.start(t); o.stop(t+7); }); }
function clickTrain(amp,stage,when){ if(!AC) return; let t=(when==null?AC.currentTime:when)+.01; const t0=t, n=6+stage*2, gap=.032-stage*.003;
  const out=AC.createGain(); out.gain.value=amp; const hp=AC.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=1800;
  out.connect(hp); hp.connect(AC.destination); hp.connect(AC.rev);
  const nb=noiseBuf(.01);
  for(let i=0;i<n;i++){ const s=AC.createBufferSource(); s.buffer=nb; const g=AC.createGain(); const a=.25+.75*Math.sin(i/n*Math.PI);
    g.gain.setValueAtTime(a,t); g.gain.exponentialRampToValueAtTime(.001,t+.006); s.connect(g); g.connect(out); s.start(t); s.stop(t+.01);
    const o=AC.createOscillator(), og=AC.createGain(); o.frequency.value=3800+R()*900; og.gain.setValueAtTime(a*.3,t); og.gain.exponentialRampToValueAtTime(.001,t+.004); o.connect(og); og.connect(out); o.start(t); o.stop(t+.006);
    t+=gap*(.8+R()*.4); }
  const lo=AC.createOscillator(), lg=AC.createGain(); lo.frequency.setValueAtTime(90-stage*6,t0); lo.frequency.exponentialRampToValueAtTime(40,t0+.5);
  lg.gain.setValueAtTime(0,t0); lg.gain.linearRampToValueAtTime(.12+stage*.05,t0+.02); lg.gain.exponentialRampToValueAtTime(.0001,t0+.7);
  lo.connect(lg); lg.connect(AC.destination); lo.start(t0); lo.stop(t0+.75); }
function whistle(){ if(!AC) return; const t=AC.currentTime, o=AC.createOscillator(), g=AC.createGain(), v=AC.createOscillator(), vg=AC.createGain();
  o.type='sine'; o.frequency.setValueAtTime(1900,t); o.frequency.exponentialRampToValueAtTime(3600,t+.35); o.frequency.exponentialRampToValueAtTime(2500,t+.8); o.frequency.exponentialRampToValueAtTime(3100,t+1.2);
  v.frequency.value=11; vg.gain.value=60; v.connect(vg); vg.connect(o.frequency);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.07,t+.05); g.gain.setValueAtTime(.07,t+1.0); g.gain.exponentialRampToValueAtTime(.0001,t+1.5);
  o.connect(g); g.connect(AC.destination); g.connect(AC.rev); o.start(t); v.start(t); o.stop(t+1.6); v.stop(t+1.6); }
function ping(f,v){ if(!AC) return; const t=AC.currentTime, o=AC.createOscillator(), g=AC.createGain(); o.frequency.value=f;
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+.008); g.gain.exponentialRampToValueAtTime(.0001,t+1.2); o.connect(g); g.connect(AC.destination); g.connect(AC.rev); o.start(t); o.stop(t+1.3); }
function passBy(){ if(!AC) return; const t=AC.currentTime;     // the dolphin swims past you
  const n=AC.createBufferSource(); n.buffer=noiseBuf(4); const f=AC.createBiquadFilter(); f.type='lowpass';
  f.frequency.setValueAtTime(200,t); f.frequency.exponentialRampToValueAtTime(2400,t+1.9); f.frequency.exponentialRampToValueAtTime(180,t+3.6);
  const g=AC.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.32,t+1.9); g.gain.linearRampToValueAtTime(0,t+3.8);
  n.connect(f); f.connect(g); g.connect(AC.destination); n.start(t); n.stop(t+4);
  const o=AC.createOscillator(), og=AC.createGain(); o.frequency.setValueAtTime(48,t); o.frequency.exponentialRampToValueAtTime(30,t+4);
  og.gain.setValueAtTime(0,t); og.gain.linearRampToValueAtTime(.35,t+1.8); og.gain.linearRampToValueAtTime(0,t+4.2); o.connect(og); og.connect(AC.destination); o.start(t); o.stop(t+4.3);
  [1318,1046,880,659].forEach((fr,i)=>{ const b=AC.createOscillator(), bg=AC.createGain(), s=t+.4+i*.3; b.frequency.setValueAtTime(fr,s); b.frequency.exponentialRampToValueAtTime(fr*1.5,s+1.4);
    bg.gain.setValueAtTime(0,s); bg.gain.linearRampToValueAtTime(.035,s+.04); bg.gain.exponentialRampToValueAtTime(.0001,s+1.8); b.connect(bg); bg.connect(AC.rev); b.start(s); b.stop(s+1.9); }); }
let voiceEl=null;
const SUB={left:$('subL'), right:$('subR'), bottom:$('sub')};
const subTimers=[];
function letters(el,text,delay){                      // one <i> per character, each sinking in a little after the last
  el.textContent=''; if(!text) return delay;
  [...text].forEach((ch,i)=>{ const c=document.createElement('i'); c.textContent=ch;
    c.style.animationDelay=`${delay+i*.045}s, ${delay+i*.045+1.9}s`;
    c.style.setProperty('--sx',((R()-.5)*.1).toFixed(3)+'em'); c.style.setProperty('--sy',(.04+R()*.08).toFixed(3)+'em');
    el.appendChild(c); requestAnimationFrame(()=>c.classList.add('in')); });
  return delay+text.length*.045;
}
function riseAway(box){                               // the line lets go and floats up
  box.querySelectorAll('i').forEach((c,i)=>{ c.style.animationDelay=`${(i%14)*.03}s`; c.classList.remove('in'); c.classList.add('out'); });
}
function dreamFades(){ for(const box of [SUB.left,SUB.right]){ box.classList.remove('dim'); box.classList.add('fading'); } }   // the dream lets go while you wake
function clearSubs(){ subTimers.splice(0).forEach(clearTimeout); for(const b of Object.values(SUB)){ b.classList.remove('dim','big','fading'); b.querySelectorAll('div').forEach(d=>d.textContent=''); } }
function say(key){
  const box=SUB.bottom; riseAway(box); box.classList.remove('named');
  if(!key) return;
  const L=CONFIG.lines[key], place=CONFIG.place[key]||'bottom', side=place==='left'||place==='right';
  const target=side?SUB[place]:box;
  if(!side){ SUB.left.classList.add('dim'); SUB.right.classList.add('dim'); }
  subTimers.push(setTimeout(()=>{
    target.classList.toggle('big',place==='big'); target.classList.toggle('mid',place==='mid');
    let d=letters(target.querySelector('.en'),L[0],0);
    d=letters(target.querySelector('.ko'),L[1],d*.5+.5);
    if(!side){ d=letters(target.querySelector('.en2'),L[2]||'',d+.2); letters(target.querySelector('.ko2'),L[3]||'',d*.6+.3); }
  },side?0:900));
  if(CONFIG.voice){ try{ voiceEl&&voiceEl.pause(); voiceEl=new Audio(`narration/${key}.mp3`); voiceEl.play().catch(()=>{}); }catch(e){} }
}
/* the small hint at the bottom centre, shown only where its gesture is needed: roll the ball / click / open your mouth */
const TBW=on=>`<svg viewBox="0 0 64 44"><rect x="2" y="4" width="60" height="36" rx="16"/><path d="M14 6V38M50 6V38"/><path ${on==='btn'?'class="on"':''} d="M5 22Q4 10 14 6V38Q4 34 5 22Z"/>`
  +`<circle ${on==='ring'?'class="on"':''} cx="32" cy="22" r="15"/><circle ${on==='ball'?'class="on"':''} cx="32" cy="22" r="10"/></svg>`;
const MOUTHW=`<svg viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="20" ry="26"/><ellipse cx="40" cy="54" rx="6" ry="5" class="on"/></svg>`;
let wtbKey='';
function setTb(k){ if(k===wtbKey) return; wtbKey=k; let el=$('wtb'); if(!el){ el=document.createElement('div'); el.id='wtb'; WK.appendChild(el); }
  if(!k){ el.classList.remove('on'); return; }
  const T={roll:[TBW('ball'),'roll · listen','공을 굴려 기호의 소리를 들어 보세요'], click:[TBW('btn'),'click the dolphin','돌고래를 클릭하세요'], mouth:[MOUTHW,'open your mouth','입을 벌리세요']}[k];
  el.innerHTML=`${T[0]}<div><span class="en">${T[1]}</span><span class="kr">${T[2]}</span></div>`; requestAnimationFrame(()=>el.classList.add('on')); }
function setHelp(en,ko,strong){ const h=$('help'); if(en==null){ h.classList.remove('on'); return; }
  h.querySelector('.h1').textContent=en; h.querySelector('.h2').textContent=ko; h.classList.add('on'); h.classList.toggle('strong',!!strong); }
function showCard(id){
  const c=$('card'); if(!id){ c.classList.remove('on'); return; }
  const d=CONFIG.sounds[id]; c.querySelector('.nm').textContent=d.name; for(const k of ['.l1','.k1','.g','.kg']) c.querySelector(k).textContent='';   // the name only, in English
  c.classList.add('on');
}

/* ───────── 7. the sequence ───────── */
let state='idle', st=0, clock=0, light=0, flash=0, fadeV=1, endT=0, reveal=0, eyeRev=0, tatT=0, camDrift=0;
let clicks=0, lastClick=0, nextAmbient=0, lastInput=0; const pulses=[]; const heard=new Set();
const go=s=>{ state=s; st=0; };
let onDone=null;
/* the name: asked in the dark before the dream; said alone as the first line of the narration */
let wakeName='', nameDone=false, wakeReady=false;
const nameBox=$('wname'), nameIn=$('wnameIn');
function askName(){ nameDone=false; wakeName=''; nameIn.value=''; nameBox.classList.remove('gone'); wnK=44; setTimeout(()=>{ try{ nameIn.focus({preventScroll:true}); }catch(e){} },300); }
function nameGiven(v){ if(nameDone) return; nameDone=true; wakeName=(v||'').trim().slice(0,20); nameIn.blur(); keyDrop('enter'); nameDrop(true); wnK=60; nameBox.classList.add('gone'); if(wakeReady) startDream(); }
function startDream(){ if(state!=='name') return; if(wakeName){ go('named'); sayName(wakeName); } else { go('dreaming'); say('dreaming'); } }
function sayName(n){ const box=SUB.bottom; riseAway(box);
  subTimers.push(setTimeout(()=>{ box.classList.remove('big'); box.classList.add('mid','named'); const en=box.querySelector('.en'), d0=letters(en,n+'...',0); letters(box.querySelector('.ko'),'',0);
    [...en.children].slice(-3).forEach((c,k)=>{ const d=d0+.9+k*.85; c.style.animationDelay=`${d}s, ${d+1.9}s`;
      subTimers.push(setTimeout(()=>dotDrop(c,k===2),(d+.25)*1000)); }); },700)); }   // each stop falls like a drop of water
/* where the name's letters are, as points in the world (the face's plane, z 0): drawn from the letters on screen, sampled, unprojected */
function nameToGrains(){ const box=SUB.bottom.querySelector('.en'); if(!box||!box.children.length) return false;
  const wr=WK.getBoundingClientRect(), cv=document.createElement('canvas'); cv.width=Math.ceil(wr.width/2); cv.height=Math.ceil(wr.height/2); const g=cv.getContext('2d',{willReadFrequently:true});
  g.textAlign='center'; g.textBaseline='middle'; const nL=box.children.length;
  for(const [ci,c] of [...box.children].entries()){ g.fillStyle=`rgb(${ci+1},255,255)`; const r=c.getBoundingClientRect(), cs=getComputedStyle(c); g.font=`${cs.fontWeight} ${parseFloat(cs.fontSize)/2}px ${cs.fontFamily}`;
    g.fillText(c.textContent,(r.left-wr.left+r.width/2)/2,(r.top-wr.top+r.height/2)/2); }
  const D=g.getImageData(0,0,cv.width,cv.height).data, pts=[]; for(let y=0;y<cv.height;y++) for(let x=0;x<cv.width;x++) if(D[(y*cv.width+x)*4+3]>110) pts.push(x,y,D[(y*cv.width+x)*4]-1);   // (red = which letter)
  if(pts.length<20) return false;
  const S=64, d=new Float32Array(S*S*4), v=new THREE.Vector3(), cam=camera.position;
  for(let i=0;i<S*S;i++){ const j=(R()*pts.length/3|0)*3; v.set((pts[j]+R())/cv.width*2-1,1-(pts[j+1]+R())/cv.height*2,.5).unproject(camera).sub(cam);
    const k=-cam.z/v.z; d[i*4]=cam.x+v.x*k; d[i*4+1]=cam.y+v.y*k; d[i*4+2]=(R()-.5)*.25; d[i*4+3]=nL>1?Math.min(1,Math.max(0,pts[j+2]/(nL-1))):0; }
  const tx=new THREE.DataTexture(d,S,S,THREE.RGBAFormat,THREE.FloatType); tx.minFilter=tx.magFilter=THREE.NearestFilter; tx.needsUpdate=true;
  if(U.uNameT.value) U.uNameT.value.dispose(); U.uNameT.value=tx; U.uNameOK.value=1; return true; }
function dotDrop(c,last){ keyDrop(last?'enter':''); const r=c.getBoundingClientRect(), wr=WK.getBoundingClientRect(), d=document.createElement('div');
  d.className='wnRip'; d.style.left=(r.left-wr.left+r.width/2)+'px'; d.style.top=(r.bottom-wr.top-2)+'px'; if(last) d.style.animationDuration='2.6s';
  WK.appendChild(d); setTimeout(()=>d.remove(),2800); }   // the stops come one by one, slowly: a pause after the name   // three plain stops, tracked like the letters (the face's own … sits small and low)
nameIn.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); nameGiven(nameIn.value); } });
/* the water over the name: a gentle shimmer always, a surge as it rises, a shiver and a ring of light at each key, a deep surge as it sinks */
const wnTurb=$('wnTurb'), wnDisp=$('wnDisp'); let wnK=0, wnT=0;
const mCv=document.createElement('canvas').getContext('2d');
function nameDrop(big){ if(big) wnK=Math.max(wnK,34);   // typing leaves the letters still: only the water under them moves
  const r=nameIn.getBoundingClientRect(), wr=WK.getBoundingClientRect(), cs=getComputedStyle(nameIn), d=document.createElement('div'); d.className='wnRip';
  mCv.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; const ls=parseFloat(cs.letterSpacing)||0, v=nameIn.value;
  const wAll=mCv.measureText(v).width+ls*v.length, wLast=v?mCv.measureText(v.slice(-1)).width+ls:0;   // under the letter that just fell (the text is centred)
  d.style.left=(r.left-wr.left+r.width/2-wAll/2+wAll-wLast/2)+'px'; d.style.top=(r.bottom-wr.top-4)+'px'; WK.appendChild(d); setTimeout(()=>d.remove(),2000); }
/* each key a drop of water: a soft high 'plip' falling in pitch, a whisper of splash, in the wake's own reverb — quiet, close */
let dripBuf=null;
function keyDrop(kind){ if(!AC) return; if(AC.state==='suspended') AC.resume();
  const t=AC.currentTime+.005, base=kind==='enter'?240:kind==='del'?560:900, f=base*(.9+R()*.2), dur=kind==='enter'?.7:.22, vol=kind==='enter'?.09:kind==='del'?.035:.05;
  const o=AC.createOscillator(), g=AC.createGain(); o.type='sine'; o.frequency.setValueAtTime(f*1.7,t); o.frequency.exponentialRampToValueAtTime(f*.55,t+dur*.45);
  g.gain.setValueAtTime(.0001,t); g.gain.linearRampToValueAtTime(vol,t+.005); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g); g.connect(AC.destination); if(AC.rev) g.connect(AC.rev); o.start(t); o.stop(t+dur+.05);
  if(!dripBuf){ const L=AC.sampleRate*.06|0; dripBuf=AC.createBuffer(1,L,AC.sampleRate); const dd=dripBuf.getChannelData(0); for(let i=0;i<L;i++) dd[i]=(R()*2-1)*Math.pow(1-i/L,3); }
  const n=AC.createBufferSource(), bp=AC.createBiquadFilter(), ng=AC.createGain(); n.buffer=dripBuf; bp.type='bandpass'; bp.frequency.value=3200+R()*1500; bp.Q.value=1.4;
  ng.gain.value=kind==='enter'?.02:.012; n.connect(bp); bp.connect(ng); ng.connect(AC.destination); if(AC.rev) ng.connect(AC.rev); n.start(t); }
nameIn.addEventListener('input',e=>{ const del=e.inputType&&e.inputType.startsWith('delete'); keyDrop(del?'del':'key'); if(!del) nameDrop(false); });
function nameWater(dt){ if(state!=='name'&&!(state==='named'&&st<2)) { if(wnK>0){ wnK=0; wnDisp.setAttribute('scale','0'); } return; }
  wnT+=dt; wnK+=(0-wnK)*Math.min(1,dt*1.6);   // settles to still water once the name has risen
  wnTurb.setAttribute('baseFrequency',`${(.011+.002*Math.sin(wnT*.7)).toFixed(4)} ${(.055+.012*Math.sin(wnT*.5+1)).toFixed(4)}`);
  wnDisp.setAttribute('scale',wnK.toFixed(2)); }
/* the beat: echoes, phrases and blooms all sit on one 80 BPM grid (audio clock when there is one) */
const BEAT=60/CONFIG.bpm; let beat0=0;
const onAC=()=>!!AC&&AC.state==='running';                 // a suspended context's clock stands still, so fall back to the frame clock
const beatNow=()=>onAC()?AC.currentTime:clock;
function nextGrid(grid,tol=.05){ const t=beatNow(), g=BEAT*grid, ph=((t-beat0)%g+g)%g; return ph<tol?t:t+g-ph; }   // just past a beat counts as on it
const due=[]; function at(t,fn){ due.push({t,fn,ac:onAC()}); }
function runDue(){ for(let i=due.length-1;i>=0;i--){ const d=due[i]; if(d.t<=(d.ac&&AC?AC.currentTime:clock)+1/120||d.ac!==onAC()){ due.splice(i,1); d.fn(); } } }
let knockPending=false, answerPending=false;
async function begin(){
  if(state!=='idle') return;
  WK.style.display='block'; resize(); audio(); if(AC&&AC.state==='suspended') AC.resume();
  window.SBFace=null; wakeReady=false; go('name'); askName();   // the name first, while the camera wakes
  if(padG){ padG.gain.cancelScheduledValues(AC.currentTime); padG.gain.setValueAtTime(padG.gain.value,AC.currentTime); padG.gain.linearRampToValueAtTime(.9,AC.currentTime+4); }
  if(!srcTex) await startCamera();
  if(!face) loadFace();
  const u=U; u.uOpen.value=0; u.uLight.value=0; u.uCrumble.value=0; u.uNameOK.value=0; u.uMorph.value=0; u.uMorphOut.value=0; u.uFill.value=0; u.uScatter.value=0; ringEchoT=-9; u.uPulseT.value=-1; light=0; fadeV=1; reveal=0; eyeRev=0; ringK=0; scatter=0;
  u.uTat.value=u.uTatShow.value=u.uDrift.value=0; u.uGather.value=0; u.uFocus.value=0; compMat.uniforms.breath.value=0; camDrift=0; tatT=0; mMat.uniforms.uDiss.value=0; skullMat.uniforms.uSkull.value=.06; compMat.uniforms.rip.value=1;
  U.uSrc.value.forEach((s,i)=>s.set(0,0,clock,i?0:.3)); U.uPulseP.value.set(.5,.62);   // the water is already moving: one slow ring from the face
  MARB.length=0; shB.fill(-99); riseMat.uniforms.uK.value=0; riseMat.uniforms.uT.value=0;
  lmFrozen=false; fibers=[]; coat=[null,null]; plN=0; coatShed=false; lqPts.visible=false; xrayT=-9; due.length=0; knockPending=answerPending=false; beat0=beatNow();
  dolMat.uniforms.uSweep.value=-20;   // no engraving sweep: the dolphin's face comes through bare
  clicks=0; pulses.length=0; heard.clear(); ringSpin=.02; dolHover=0; look.set(0,0); dolMat.uniforms.uFade.value=1; for(const s of sign){ s.hv=0; s.hit=-9; }
  dolphin.visible=false; placeDolphin(); camera.position.set(0,0,12); camera.lookAt(0,0,0);
  clearSubs(); wakeReady=true; if(nameDone) startDream();
}
function stopCamera(){                                    // let the webcam go once the face is gone
  const s=video.srcObject; if(s) s.getTracks().forEach(t=>t.stop()); video.srcObject=null;
  if(srcTex){ srcTex.dispose(); srcTex=null; } camOK=false; U.uVid.value=null;
}
function finish(){                                         // hand over to the reef
  state='idle'; if(CAM) SBCam.paused=false; say(null); clearSubs(); showCard(null); setHelp(null); U.uAppear.value=0; lqPts.visible=false; WK.style.display='none';
  if(padG&&AC){ padG.gain.cancelScheduledValues(AC.currentTime); padG.gain.setValueAtTime(padG.gain.value,AC.currentTime); padG.gain.linearRampToValueAtTime(0,AC.currentTime+2.5); }
  nameBox.classList.add('gone'); const cb=onDone; onDone=null; if(cb) cb(wakeName);
}
const toLocal=e=>{ const r=WK.getBoundingClientRect(); return [(e.clientX-r.left)*DPR,(e.clientY-r.top)*DPR]; };
let mouseMovedAt=-9; addEventListener('pointermove',e=>{ if(state==='idle') return; mouse=toLocal(e); lastInput=clock; mouseMovedAt=clock; });
const VIEWH=7.57;   // visible height of the face's plane from the opening camera
function clickPos(e){ let x,y; if(e){ const r=WK.getBoundingClientRect(); x=((e.clientX-r.left)/r.width-.5)*r.width/r.height*VIEWH; y=(.5-(e.clientY-r.top)/r.height)*VIEWH; }
  else { x=(R()-.5)*2.6; y=(R()-.4)*3; }
  const k=Math.hypot(x/2.6,y/3.2); if(k>1){ x/=k; y/=k; } return [x,y]; }
function knock(e){                                        // each click is an echo sent on the nearest beat: a wave drops in where you clicked; on the fifth, the face tears
  if(knockPending||state!=='calling') return; knockPending=true;
  const n=clicks+1, t=nextGrid(CONFIG.echoGrid), sp=clickPos(e); clickTrain(.45+.1*n,n,t);
  at(t,()=>{ knockPending=false; if(state!=='calling') return;
    clicks=n; lastClick=clock; U.uPulseT.value=clock; U.uPulseP.value.set(sp[0]/6+.5,sp[1]/6+.5); U.uSrc.value[n].set(sp[0],sp[1],clock,1); spawnMarbles(sp); setHelp(null);
    if(clicks>=CONFIG.clicksToOpen){ captureFace(); go('light'); burst(); whistle(); say(null); } });
}
function answer(){                                       // the dolphin answers: an echo from the centre, a nod, a call — on the beat
  if(state!=='circle'||answerPending) return; answerPending=true;
  const t=nextGrid(1); clickTrain(.5,3,t);
  at(t,()=>{ answerPending=false; if(state!=='circle') return;
    go('answer'); answerT=clock; showCard(null); setHelp(null); U.uPulseT.value=clock; pulses.push(clock); });
  at(t+BEAT/2,whistle);
}
function leaveCircle(){ go('gather'); say('gather'); showCard(null); setHelp(null); }
addEventListener('pointerdown',e=>{
  if(state==='idle') return;
  mouse=toLocal(e); lastInput=clock;
  if(state==='calling'&&st>.8) knock(e);
  else if(state==='circle'&&st>2){
    const s=sign.find(s=>Math.hypot(mouse[0]-s.x,mouse[1]-s.y)<fx.height*.06);
    if(s){ phrase(s.id); s.lastPlay=clock; heard.add(s.id); }
    else if(Math.hypot(mouse[0]-ringC[0],mouse[1]-ringC[1])<ringR*.8) answer();
  }
});
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase(); if(state==='idle'||(e.target&&e.target.tagName==='INPUT')) return;   // typing the name is not a shortcut
  if(k==='f'){ U.uLook.value=U.uLook.value?0:1; }   // face look preview: depth / grain
  if(k==='d'){ $('wdbg').hidden=!$('wdbg').hidden; if(!$('wdbg').hidden){ video.id='dbgVid'; video.style.display='block'; } else video.style.display='none'; }

});
/* the cursor: a small sonar ring that beats on the bar's pulse and opens over what can be touched; progress as a row of dots */
function drawCursor(){
  if(!['dreaming','human','calling','light','wake','circle'].includes(state)||mouse[0]<-1e3){ if(window.SBCursor&&state!=='idle') SBCursor.hot(0); return; }
  const u=fx.height/900, [x,y]=mouse, B=BEAT, ph=(((beatNow()-beat0)%B)+B)%B/B, pu=Math.exp(-ph*5);
  let hot=0; if(state==='calling'){ const s=fx.height/VIEWH; hot=Math.hypot((x-fx.width/2)/(2.2*s),(y-fx.height/2)/(2.9*s))<1?1:0; }
  else if(state==='circle') hot=hovered?1:dolHover;
  curHot+=(hot-curHot)*.2;
  if(window.SBCursor){ SBCursor.hot(curHot); return; }   // the one cursor of the piece (shared.js) shows it
  fg.save(); fg.globalCompositeOperation='lighter';
  fg.fillStyle='rgba(238,240,250,.85)'; fg.beginPath(); fg.arc(x,y,2.2*u,0,TAU); fg.fill();
  fg.strokeStyle=`rgba(200,208,250,${(.3+.45*pu)*(.6+.4*curHot)})`; fg.lineWidth=1.3*u;
  fg.beginPath(); fg.arc(x,y,(12+curHot*8+pu*4)*u,0,TAU); fg.stroke();
  if(state==='calling'&&curHot>.3){ fg.strokeStyle=`rgba(200,208,250,${(1-ph)*.22*curHot})`; fg.beginPath(); fg.arc(x,y,(14+ph*40)*u,0,TAU); fg.stroke(); }
  fg.restore();
}
let curHot=0;
function drawProgress(){
  let n=0, tot=0; if(state==='calling'&&st>2.5){ n=clicks; tot=CONFIG.clicksToOpen; } else if(state==='circle'&&st>2){ n=heard.size; tot=SIGNS.length; } else return;
  const tb=$('wtb'), hr=(tb&&tb.classList.contains('on')?tb:$('help')).getBoundingClientRect(), wr=WK.getBoundingClientRect();   // under whichever hint is showing
  const u=fx.height/900, y=(hr.bottom-wr.top)*(fx.height/(wr.height||1))+16*u, gap=15*u, x0=fx.width/2-(tot-1)*gap/2, k=state==='circle'?ss(2,3,st):ss(2.5,3.5,st);   // the dots sit just under the help lines, whatever their size
  fg.save(); fg.globalCompositeOperation='lighter';
  for(let i=0;i<tot;i++){ const x=x0+i*gap; if(i<n){ fg.fillStyle=`rgba(232,214,176,${.85*k})`; fg.beginPath(); fg.arc(x,y,2.6*u,0,TAU); fg.fill(); }   // pearl when done
    else { fg.strokeStyle=`rgba(200,208,250,${.4*k})`; fg.lineWidth=1*u; fg.beginPath(); fg.arc(x,y,2.4*u,0,TAU); fg.stroke(); } }
  fg.restore();
}
const CAM=!!(window.SBCam&&SBCam.on);
const flicker=t=>.93+.07*Math.sin(t*37.)*Math.sin(t*13.);
function step(dt){
  st+=dt;
  runDue();
  const u=U;
  nameWater(dt);
  if(state==='name'&&st>45&&!nameDone) nameGiven('');   // nobody types: the dream begins, nameless
  if(state!=='circle'){ for(const s of sign) voiceOff(s); setTb(''); }   // nothing hovered once the ring is gone
  if(state==='named'&&st>5.6){ const ok=nameToGrains(); go('dreaming'); dreamSaid=!ok; if(ok) U.uSrc.value[0].w=0; else say('dreaming');   // the name stays a while, then becomes the face (the words wait for it)
    if(ok){ const ls=[...SUB.bottom.querySelectorAll('.en i')], n=ls.length; ls.forEach((c,i)=>{ const d=.55+(n>1?i/(n-1):0)*.35*4.7;   // each letter sinks as its grains leave, left to right
      c.style.animation='none'; c.style.transition=`opacity 1.1s ease ${d}s, transform 1.4s ease-in ${d}s, filter 1.1s ease ${d}s`; c.style.opacity='0'; c.style.transform='translateY(.7em)'; c.style.filter='blur(4px)'; }); } }
  if(state==='dreaming'){ const nm=u.uNameOK.value>.5; u.uAppear.value=nm?ss(0,.5,st):ss(0,3.5,st); u.uGather.value=nm?ss(.5,5.2,st):ss(0,4.6,st); skull.visible=skullLoaded;
    if(!dreamSaid&&st>4.9){ dreamSaid=true; say('dreaming'); U.uSrc.value[0].set(0,0,clock,.3); }   // the face is whole: the first words, and the water behind it starts to move, together
    if(st>(nm?9.9:5)){ go('human'); say('human'); } }
  else if(state==='human'){ if(st>4.5){ go('calling'); say('calling'); lastClick=clock; nextAmbient=clock+1.2; } }
  else if(state==='calling'){                                   // something inside answers each click; the crack grows
    const stage=clicks/CONFIG.clicksToOpen;
    light=(stage*.5+.06+.05*Math.sin(clock*2.1))*flicker(clock)+.35*Math.exp(-(clock-lastClick)*3.5)*(clicks>0?1:0);
    if(clock>nextAmbient){ clickTrain(.07+stage*.06,0,nextGrid(1)); nextAmbient=clock+2.6+R()*1.6; }
    const idle=clock-lastClick;
    if(st>2.5) setHelp(CAM?'open your mouth to call':'click the face',CAM?'입을 벌려 부르세요':'얼굴을 클릭하세요',idle>CONFIG.clickHintAfter);
    if(CAM&&st>.8&&SBCam.edge('mouth')) knock();   // with the camera: each call is an echo
    if(idle>CONFIG.clickAutoAfter) knock();
  }
  else if(state==='light'){                                     // the fifth echo: the crack at the brow runs the whole seam
    light=Math.max(ss(0,.9,st),.5)*flicker(st); if(st>1.9&&st-dt<=1.9) flash=1;
    if(st>2.5){ go('wake'); say('wake'); dreamFades(); bell(392,.09,7); }
  }
  else if(state==='wake'){                                      // the dolphin's tattoo surfaces in the forehead, once
    light=(.9-.45*ss(0,2.4,st))*flicker(st); u.uTatShow.value=ss(.2,2.9,st); camera.position.z=lerp(12,11.2,ss(0,3.6,st));
    if(st>3.6){ go('open'); say(null); lmFrozen=true; if(CAM) SBCam.begin(); buildCut(); lqPts.visible=true; if(dolLoaded){ placeDolphin(); buildDolT(); } }
  }
  /* the split: the halves open whole, the threads of liquid stretch and give (0–3.4) · everything is thrown out to the edges at once,
     with one low breath (3.4–4.3) · a moment of dark · very fine grains rise from below and the dolphin's eyes come first (4.5–6),
     its body after (5.3–7.6). The skull is not seen. */
  else if(state==='open'){
    u.uOpen.value=ss(0,3.4,st); light=.5*(1-ss(.5,2.5,st)); u.uCrumble.value=ss(3.9,4.8,st); u.uScatter.value=ss(3.9,5.2,st); u.uMorph.value=ss(4.4,9.4,st); u.uFill.value=ss(8.6,10,st); u.uMorphOut.value=ss(9.8,11.4,st);
    if(st>3.9&&st-dt<=3.9){ boom(); whoosh(); deepSwell(); flash=1; pulses.push(clock); pulses.push(clock+.12); }   // after a held breath: the boom, a white ring, and the face lets go
    if(st>9.4&&st-dt<=9.4) firstCall(.35);   // its eyes open: the first, faint click
    skullMat.uniforms.uSkull.value=.06*(1-ss(0,.5,st)); if(st>.6) skull.visible=false;
    const rk=ss(6.4,7.2,st); riseMat.uniforms.uK.value=rk; if(rk>0) riseMat.uniforms.uT.value+=dt;
    eyeRev=ss(9.2,10.2,st); reveal=ss(9.6,11.6,st);
    camera.position.z=lerp(11.2,7.4,ss(0,10.8,st))-1.5*ss(3.7,5.4,st)*(1-ss(5.4,10,st)); camera.position.y=-.25*ss(3.7,5.5,st)*(1-ss(5.5,10,st));   // through the gap as the halves go, then settling back to meet it
    u.uFocus.value=lerp(0,-4.3,ss(7,10.4,st));
    if(st>5.1) lqPts.visible=false; if(st>8.4) dolphin.visible=true;   // not before: its dark body would show against the thrown grains
    if(st>12){ go('circle'); ringK=0; lastInput=clock; stopCamera(); ringEchoT=-9; sign.forEach(s=>s.born=0); firstEcho(); }   // it sends its first echo; the signs answer
  }
  else if(state==='circle'){                                   // the seven sounds, around its head
    light=0; ringK=ss(0,2.5,st); compMat.uniforms.rip.value=1-ss(0,2.5,st); riseMat.uniforms.uK.value=lerp(1,.6,ss(0,3,st)); riseMat.uniforms.uT.value+=dt;
    hovered=null;
    for(const s of sign){ const near=st>1.5&&Math.hypot(mouse[0]-s.x,mouse[1]-s.y)<fx.height*.06; s.hv+=((near?1:0)-s.hv)*Math.min(1,dt*6);
      if(near){ hovered=s; if(!s.voice){ s.lastPlay=clock; voiceOn(s); heard.add(s.id); } } else voiceOff(s); }
    showCard(hovered?hovered.id:null);
    const n=heard.size, all=n>=SIGNS.length;
    if(st>2&&!(CAM&&SBCam.S.full)){ setHelp(null); setTb(all?(CAM?'mouth':'click'):'roll'); }   // the hint at the bottom, small, where the hand is needed
    else if(st>2) { const head=CAM&&SBCam.S.full; setHelp(head?(all?'look at the dolphin · open your mouth':'turn your head toward a sign'):CAM?(all?'click the dolphin · or open your mouth':'hover to listen'):(all?'click the dolphin':'hover to listen'),
      head?(all?'돌고래를 보고 입을 벌리세요':'고개를 돌려 기호를 바라보세요'):CAM?(all?'돌고래를 클릭하거나 입을 벌리세요':'마우스를 올려 소리를 들어 보세요'):(all?'돌고래를 클릭하세요':'마우스를 올려 소리를 들어 보세요'), all); }
    if(CAM&&SBCam.ready){ const pp=SBCam.S.full?SBCam.pointer():null; if(pp&&clock-mouseMovedAt>1.5){   // the head points only in FULL; otherwise the mouse hovers
      mouse=[pp.x*fx.width,pp.y*fx.height]; lastInput=clock; }   // the head is the pointer
      if(st>2&&SBCam.edge('mouth')){ const s=sign.find(s=>Math.hypot(mouse[0]-s.x,mouse[1]-s.y)<fx.height*.06); if(s){ phrase(s.id); s.lastPlay=clock; heard.add(s.id); } else if(heard.size>=SIGNS.length&&(!SBCam.S.full||Math.hypot(mouse[0]-ringC[0],mouse[1]-ringC[1])<ringR*.8)) answer(); } }   // only after every sign has been heard   // English, Korean under it; progress is drawn as dots
    dolHover+=((Math.hypot(mouse[0]-ringC[0],mouse[1]-ringC[1])<ringR*.62&&!hovered?1:0)-dolHover)*Math.min(1,dt*5);
    let tx=Math.sin(clock*.4)*.03, ty=Math.sin(clock*.31)*.02;
    if(hovered){ tx=clamp((hovered.x-ringC[0])/ringR,-1,1)*.38; ty=-clamp((hovered.y-ringC[1])/ringR,-1,1)*.3; }
    look.x+=(tx-look.x)*Math.min(1,dt*2.2); look.y+=(ty-look.y)*Math.min(1,dt*2.2);
    dolphin.rotation.y=look.x*.22;
    if(clock-lastInput>CONFIG.circleIdle) answer();
  }
  else if(state==='answer'){                                   // the signs burst outward
    dolHover*=.9; look.x*=.9; look.y*=.9;
    scatter=ss(0,1.6,st)*.7; compMat.uniforms.rip.value=1+1.6*Math.sin(Math.PI*ss(0,2,st));   // the water wavers as they go
    for(const s of sign){ if(s.hit<answerT&&st>s.i*.04){ s.hit=clock; ping(660*Math.pow(1.122,s.i),.03); } }
    if(st>1.4){ go('swim'); passBy(); }
  }
  else if(state==='swim'){                                     // it swims toward you and dives just under you, its back to the light
    look.x*=.92; look.y*=.92; dolphin.rotation.y*=.92;
    scatter=Math.min(1,.7+ss(0,1.4,st)*.3); compMat.uniforms.rip.value=1-ss(.5,2.5,st);
    const k=ss(0,3.4,st);
    dolphin.position.z=lerp(DOL_HOME.z,14,Math.pow(k,1.6)); dolphin.position.y=lerp(DOL_HOME.y,-3.2,k);
    dolphin.rotation.x=lerp(DOL_PITCH,.42,ss(0,1.4,st));
    camera.lookAt(0,-k*1.1,0);
    dolMat.uniforms.uFade.value=1-ss(2.7,3.3,st);
    if(st>3.6){ go('gather'); say('gather'); dolphin.visible=false; }
  }
  else if(state==='gather'){ if(st>9){ go('find'); say('find'); } }   // words, in the dark (long enough to read twice)
  else if(state==='find'){ fadeV=1-ss(6,7.6,st); if(st>8){ finish(); return; } }
  u.uLight.value=state==='calling'||state==='light'||state==='wake'?light:0; dolMat.uniforms.uReveal.value=reveal; dustMat.uniforms.uReveal.value=reveal*dolMat.uniforms.uFade.value;
  const eg=(state==='open'?eyeRev:reveal)*dolMat.uniforms.uFade.value*(state==='circle'?(heard.size>=SIGNS.length?1.6+.6*Math.sin(clock*4):.8+dolHover*.6)
    :state==='answer'?2.4:state==='swim'?1+1.4*Math.exp(-st*2):.5);
  if(EYES.eyeL){ EYES.eyeL.uniforms.uGlow.value=eg*(1+Math.max(0,look.x)*2.2); EYES.eyeR.uniforms.uGlow.value=eg*(1+Math.max(0,-look.x)*2.2); }
  dolMat.uniforms.uHover.value=dolHover+(state==='answer'?Math.exp(-st*2.2)*1.2:0);
  ringAng+=ringSpin*dt; if(state==='circle') ringSpin=.02;
  dolMat.uniforms.uSwim.value=state==='swim'?1.3:.3;
  flash*=Math.pow(.15,dt);
  if(state==='calling'||state==='light'||state==='wake') U.uTat.value=(tatT+=((clicks/CONFIG.clicksToOpen)-tatT)*Math.min(1,dt*5));
  const da=U.uOpen.value*1.15; doors[0].rotation.y=-da; doors[1].rotation.y=da; for(const d of doors) d.updateMatrixWorld(true);
  if(state==='open'&&lqPts.visible) updateLiquid(st,dt);
  if(state==='answer'||state==='swim') riseMat.uniforms.uT.value+=dt;
  updateMarbles(dt);
  compMat.uniforms.breath.value=state==='wake'?Math.sin(Math.PI*clamp(st/3.4))*.9:0;
  if(state!=='swim'&&state!=='gather'&&state!=='find'){
    const want=state==='dreaming'||state==='human'||state==='calling'||state==='light'||state==='wake'||state==='open'?1:0;
    camDrift+=(want-camDrift)*Math.min(1,dt*.6);
    camera.position.x=Math.sin(clock*.13)*.16*camDrift; camera.position.y=Math.sin(clock*.17+1)*.1*camDrift; camera.lookAt(0,0,0); }
  { const rk=state==='open'?ss(4.8,7.5,st):state==='circle'||state==='answer'?1:state==='swim'?1-ss(1.8,3.4,st):0;
    rayMat.uniforms.uK.value=rk; dolMat.uniforms.uTop.value=rk; }
  /* the mandala lets go from the 4th crack, gone by the end of the 5th */
  const dT=state==='calling'?(clicks>=4?.5:0):state==='light'?.5+.55*ss(0,2.5,st):state==='dreaming'||state==='human'?0:1.25, md=mMat.uniforms.uDiss;
  md.value+=(dT-md.value)*Math.min(1,dt*(state==='calling'?.6:2.5));
}

/* ───────── 8. frame ───────── */
function resize(){ DPR=window.SB_DPR||DPR; renderer.setPixelRatio(DPR);   // (the governor may have lowered it)
  const w=WK.clientWidth||innerWidth, h=WK.clientHeight||innerHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
  fx.width=w*DPR; fx.height=h*DPR; const pix=DPR*h/900; U.uPix.value=pix; dustMat.uniforms.uPix.value=pix;
  const W=w*DPR|0, H=h*DPR|0; [rtMain,rtA,rtB,rtBg].forEach(r=>r&&r.dispose());
  rtMain=new THREE.WebGLRenderTarget(W,H,rtOpts); rtA=new THREE.WebGLRenderTarget(W>>2,H>>2,rtOpts); rtB=new THREE.WebGLRenderTarget(W>>2,H>>2,rtOpts); rtBg=new THREE.WebGLRenderTarget(Math.min(W>>1,1600),Math.min(H>>1,900),rtOpts);
  mMat.uniforms.uSnap.value=rtBg.texture; mMat.uniforms.uAsp.value=w/h; marbleMat.uniforms.uAsp.value=w/h; rayMat.uniforms.uAsp.value=w/h;
  brightMat.uniforms.px.value.set(1/W,1/H); bgMat.uniforms.res.value.set(rtBg.width,rtBg.height); }
addEventListener('resize',resize); resize();
let last=performance.now(), frames=0, fps=0, fpsT=0, lv=0, TS=1;
const tmpV=new THREE.Vector3();
const toScreen=v=>{ tmpV.copy(v).project(camera); return [(tmpV.x+1)/2*fx.width,(1-tmpV.y)/2*fx.height,tmpV]; };
function frame(now){
  const dt=Math.min(.05,(now-last)/1000)*TS; last=now; clock+=dt; frames++; fpsT+=dt; if(fpsT>1){fps=frames;frames=0;fpsT=0;}
  fg.clearRect(0,0,fx.width,fx.height);
  if(state!=='idle'){
    const faceLive=state==='dreaming'||state==='human'||state==='calling'||state==='light'||state==='wake'||(state==='open'&&st<4.6);
    facePts.visible=faceLive||(state==='open'&&U.uDolOK.value>.5&&st<11.8);   // the grains stay on while they become the dolphin
    $('note').style.opacity=faceLive?'':'0';   // the camera note only while the camera is on
    if(CAM) SBCam.paused=faceLive&&camOK;          // while the wake watches the face, the camera control rests
    if(faceLive&&camOK){ readFace(now); if(++lv%15===0) autoLevels(); }
    const u=U; motes.material.uniforms.uK.value=u.uAppear.value;
    u.uCrop.value.set(F.cx,F.cy,F.size); u.uLevels.value.set(lo,hi); u.uTime.value=clock; dolMat.uniforms.uTime.value=clock; dustMat.uniforms.uTime.value=clock;
    if(F.found&&!lmFrozen){ const l=toCrop(F.eyeL), r=toCrop(F.eyeR), t=toCrop(F.third); u.uEyeL.value.set(...l); u.uEyeR.value.set(...r); u.uThird.value.set(...t); }
    else if(!F.found&&!lmFrozen){ const t=u.uThird.value; u.uEyeL.value.set(t.x-.085,t.y-.08); u.uEyeR.value.set(t.x+.085,t.y-.08); }
    step(dt);
    // where the crack is on screen (for the glow), where the dolphin's head is (for the ring of signs)
    const [sx,sy]=toScreen(new THREE.Vector3((u.uThird.value.x-.5)*6,(u.uThird.value.y-.5)*6,0));
    compMat.uniforms.seam.value.set(sx/fx.width,1-sy/fx.height,light*(1-u.uCrumble.value)*(1-u.uOpen.value*.6));
    if(dolLoaded){ dolphin.updateMatrixWorld(); const hp=HEAD.clone().applyMatrix4(dolphin.matrixWorld), [hx,hy]=toScreen(hp);
      if(state==='circle'||state==='open') ringC=[hx,hy-fx.height*.03]; ringR=fx.height*.33; }
    else { ringC=[fx.width/2,fx.height*.45]; ringR=fx.height*.34; }
    drawSigns(clock);
    drawXray(); if(ringK>0||scatter>0||xrayT>clock-1) window.SBG&&SBG.airbrush(fx,{blur:1.5,under:.9,crisp:.45}); drawProgress(); drawCursor();
    for(let i=pulses.length-1;i>=0;i--){ const age=clock-pulses[i]; if(age>2.4){ pulses.splice(i,1); continue; }
      for(let k=0;k<3;k++){ const r=(age-k*.09)*fx.height*ECHO_V; if(r<=0) continue;   // every echo the same: three thin circles from its head
        fg.strokeStyle=`rgba(180,190,245,${.35*(1-age/2.4)*(1-k*.3)})`; fg.lineWidth=1.2*DPR; fg.beginPath(); fg.arc(ringC[0],ringC[1],r,0,TAU); fg.stroke(); } }
    const diss=mMat.uniforms.uDiss.value, bgOn=diss<1.2&&!!u.uVid.value&&faceLive;
    bgMat.uniforms.k.value=Math.min(1,u.uAppear.value*1.2);
    if(bgOn) pass(bgMat,rtBg);
    renderer.setRenderTarget(rtMain); renderer.clear();
    if(bgOn){ quad.material=bgCompMat; bgCompMat.uniforms.t.value=rtBg.texture; renderer.render(qScene,qCam); if(diss>.01) renderer.render(mScene,qCam); }
    if(rayMat.uniforms.uK.value>.001){ quad.material=rayMat; renderer.render(qScene,qCam); }
    renderer.render(scene,camera);
    if(MARB.length&&u.uVid.value){ quad.material=marbleMat; renderer.render(qScene,qCam); }
    brightMat.uniforms.t.value=rtMain.texture; pass(brightMat,rtA);
    blurMat.uniforms.t.value=rtA.texture; blurMat.uniforms.dir.value.set(1.6/rtA.width,0); pass(blurMat,rtB);
    blurMat.uniforms.t.value=rtB.texture; blurMat.uniforms.dir.value.set(0,1.6/rtA.height); pass(blurMat,rtA);
    compMat.uniforms.t.value=rtMain.texture; compMat.uniforms.b.value=rtA.texture; compMat.uniforms.time.value=clock;
    compMat.uniforms.flash.value=flash; compMat.uniforms.fade.value=fadeV;
    renderer.setRenderTarget(null); renderer.clear(); pass(compMat,null);
  } else { renderer.setRenderTarget(null); renderer.clear(); }
  if(!$('wdbg').hidden) $('wdbg').textContent=
    `address    ${location.protocol==='file:'?'file:// (Live Server로 여세요)':location.host}\nstate      ${state}\ncamera     ${camOK?'on':'off (silhouette)'}\nmediapipe  ${faceReady?'ready':'loading / unavailable'}${ERR.mp?'\n           '+ERR.mp:''}\nface       ${F.found?'found':'-'}\nblink L/R  ${F.blinkL.toFixed(2)} / ${F.blinkR.toFixed(2)}\ndolphin    ${dolLoaded?'loaded':'loading'}${ERR.dol?'\n           '+ERR.dol:''}\nfps        ${fps}   particles ${N}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.SBWake={ start(name,cb){ onDone=cb; begin(); },   // the name is asked in the wake now (askName)
  get state(){return state}, get st(){return st}, set speed(v){TS=v}, get scene(){return scene}, get renderer(){return renderer}, knock, answer, sign, bg:bgMat, go(s){ go(s); }, get morph(){ return {ok:U.uDolOK.value,m:U.uMorph.value,face:facePts.visible,dol:dolLoaded}; } };
window.__wake=window.SBWake;
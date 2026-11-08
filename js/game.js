(() => {
'use strict';
/* the Bali reef, 16 s at 8 fps: colour and a matching depth atlas, 256×144 per frame */
const COLOR_SRC='assets/color.jpg', DEPTH_SRC='assets/depth.jpg';
const FRAMES=128, COLS=16, ROWS=8, FPS=8, XF=12, LOOPF=FRAMES-XF;
const TAU=Math.PI*2, R=Math.random;
const touchy = matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const small = touchy || Math.min(innerWidth,innerHeight) < 600;
const GX = small?128:256, GY = small?72:144, NL = small?6:10;   // one particle per pixel of the footage, 10 shells deep
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPEED=16, NEED=4, NEAR=20, FAR=45, WORLD=104, TOP=46;   // TOP: how high you can rise into the open water
const S = new THREE.Vector3(0,0,-20);

/* seven sounds; any four of the six you can hear build a being. EYE (id 'sense', so audio/sense.mp3 still matches) is an easter egg:
   it hides, does not count toward the four, and when found it opens the world and joins the being as a fifth part.
   Colours sit inside the piece's palette: periwinkle / lavender / moonlight, pearl for the heart, teal only for the eye. */
const EL={
  heart: {en:'HEARTBEAT', line:'the rhythm that kept you',  c:[0.91,0.84,0.69], at:[0.7, 1.6, 1.1]},
  voice: {en:'VOICE',     line:'the call you sent into the dark',c:[0.63,0.68,0.95], at:[0.0, 4.4, 0.9]},
  bone:  {en:'BONE',      line:'what held your shape',      c:[0.86,0.86,0.94], at:[0.0,-3.8,-0.5]},
  memory:{en:'MEMORY',    line:'what the water kept of you',c:[0.72,0.69,0.94], at:[0.0, 6.4, 0.2]},
  soul:  {en:'SOUL',      line:'the light behind the eyes', c:[0.80,0.79,0.92], at:[0.0,10.6, 0.0]},
  dream: {en:'DREAM',     line:'the sleep you came from',   c:[0.52,0.58,0.92], at:[0.0,-9.4, 0.0]},
  sense: {en:'EYE',       line:'the eye that was closed',   c:[0.56,0.89,0.85], at:[0.0, 6.2, 1.6], hidden:true},
};
const ORDER=['heart','voice','bone','memory','soul','dream','sense'];
const heard=()=>J.set.filter(id=>!EL[id].hidden).length;   // the four that count

const $=id=>document.getElementById(id);
const stageEl=$('stage'), hintEl=$('hint'), endEl=$('end'), againEl=$('again'),
      dbgEl=$('debug'), partEl=$('part'), sealEl=$('seal'), bigEl=$('big'),
      infoEl=$('info'), carryEl=$('carry'), namesEl=$('names');

/* ───────── renderer ───────── */
const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true,alpha:false,powerPreference:'high-performance'});
let DPR=window.SB_DPR||Math.min(devicePixelRatio||1,2);   // the shared pixel budget (shared.js)
renderer.setPixelRatio(DPR); renderer.autoClear=false; renderer.setClearColor(0x05060c,1);
stageEl.prepend(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(62,16/9,0.1,700);

/* the sonar's wave, bending the whole picture: a ring of displacement in screen space running out from where the echo was sent */
const WARP={value:new THREE.Vector4(0,0,0,0)}; let warpT0=-99, warpC=[0,0], warpAmp=1;
const GLSL_WARP=`
  uniform vec4 uWarp;
  vec4 warpP(vec4 cp){ if(uWarp.w<=0.0) return cp; vec2 n=cp.xy/cp.w, d=n-uWarp.xy; float r=length(d*vec2(1.6,1.0))+1e-4;
    float band=r-uWarp.z*1.25, env=exp(-band*band*5.0)*uWarp.w;
    n+=d/r*sin(r*24.0-uWarp.z*15.0)*env*0.035;
    n+=vec2(sin(n.y*11.0+uWarp.z*7.0),cos(n.x*9.0-uWarp.z*6.0))*0.01*uWarp.w*exp(-uWarp.z*0.8);
    cp.xy=n*cp.w; return cp; }`;
function warpAt(nx,ny,amp=1){ warpT0=clock; warpC=[nx,ny]; warpAmp=amp; }
function warpTick(){ const age=clock-warpT0, a=age<2.4?(1-age/2.4)*warpAmp:0; WARP.value.set(warpC[0],warpC[1],Math.max(0,age),a); }
const bgMat=new THREE.ShaderMaterial({
  transparent:false,depthTest:false,depthWrite:false,
  blending:THREE.CustomBlending,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcAlphaFactor,
  uniforms:{uP:{value:0},uFade:{value:0},uHaze:{value:0.1},uTrail:{value:0.4},uFlash:{value:0},uTint:{value:new THREE.Vector3(1,1,1)},uArc:{value:0},uLift:{value:0},uLook:{value:0}},
  vertexShader:`${GLSL_WARP}varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
  fragmentShader:`
    varying vec2 vUv; uniform float uP,uFade,uHaze,uTrail,uFlash,uArc,uLift,uLook; uniform vec3 uTint;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 c=vUv-0.5; c.x*=1.7778; float r=length(c*vec2(0.62,1.0));
      vec3 deep=vec3(0.022,0.024,0.056), sepia=vec3(0.070,0.056,0.050), lilac=vec3(0.058,0.060,0.110);
      vec3 hz=mix(mix(deep,sepia,smoothstep(0.25,0.6,uP)),lilac,smoothstep(0.75,1.0,uP));
      hz=mix(hz,vec3(0.034,0.038,0.080),uArc);
      vec3 col=vec3(0.008,0.009,0.020)+hz*exp(-r*r*6.0)*(uHaze+uFlash*uTint)*2.0;
      float top=smoothstep(0.25,1.15,vUv.y+uLook*0.7)*(0.45+0.55*uLift)*(1.0-uArc*0.6);      // the open water above: the only light down here
      float sx=vUv.x+(1.0-vUv.y)*0.18;
      float shafts=pow(0.5+0.5*sin(sx*21.0+sin(sx*6.0+uLift*2.0)*2.2),7.0)*0.7+pow(0.5+0.5*sin(sx*9.0-1.3),9.0)*0.5;
      col+=vec3(0.07,0.08,0.18)*top*0.5+vec3(0.20,0.22,0.42)*shafts*top*0.22;
      col+=(h(floor(gl_FragCoord.xy/1.6))-0.5)*0.02;
      col*=mix(0.5,1.0,smoothstep(1.0,0.2,r));
      gl_FragColor=vec4(max(col,0.0)*uFade,uTrail);
    }`
});
const bg=new THREE.Mesh(new THREE.PlaneGeometry(2,2),bgMat);
bg.frustumCulled=false; bg.renderOrder=0; scene.add(bg);

/* ───────── shared GLSL: footage sampling + the sculpture a set of sounds makes ───────── */
const GLSL_COMMON=`
  uniform sampler2D uAtlas;
  vec2 cell(float k, vec2 uv){ uv=clamp(uv,vec2(0.004),vec2(0.996));
    float col=mod(k,${COLS}.0), row=floor(k/${COLS}.0);
    return vec2((col+uv.x)/${COLS}.0,(${ROWS-1}.0-row+uv.y)/${ROWS}.0); }
  vec3 frameAt(float f, vec2 uv){ float k0=floor(f), fr=f-k0, k1=min(k0+1.0,${FRAMES-1}.0);
    return mix(texture2D(uAtlas,cell(k0,uv)).rgb,texture2D(uAtlas,cell(k1,uv)).rgb,fr); }
  vec3 video(vec2 uv, float f){ float s=mod(f,${LOOPF}.0);
    if(s<${XF}.0) return mix(frameAt(s+${LOOPF}.0,uv),frameAt(s,uv),s/${XF}.0);
    return frameAt(s,uv); }
  float lumOf(vec3 c){ return dot(c,vec3(0.299,0.587,0.114)); }
`;
const GLSL_SCULPT=`
  uniform float uLobes,uTwist,uSpikes; uniform vec4 uBH,uBA,uE1,uE2,uLF4;
  float pick4(float L){ float m=mod(L,4.0); if(m<0.5) return uLF4.x; if(m<1.5) return uLF4.y; if(m<2.5) return uLF4.z; return uLF4.w; }
  vec3 sculpt(vec2 a, float lf, float frameF, float t, out float keep, out vec3 cs){
    float sx=a.x-0.5, sy=a.y-0.5;
    float lobes = uE1.y>0.5 ? 5.0 : uLobes;
    vec2 suv=vec2(1.0-abs(fract(a.x*lobes)*2.0-1.0), abs(fract(a.y*2.0)*2.0-1.0));
    cs=video(suv,frameF); float ls=lumOf(cs);
    float ys=sy*18.0;
    float env=1.0+1.3*pow(abs(sin(ys*0.42+1.1)),0.85);
    env+=uBA.x*exp(-pow(ys-uBH.x,2.0)*0.35)+uBA.y*exp(-pow(ys-uBH.y,2.0)*0.35)+uBA.z*exp(-pow(ys-uBH.z,2.0)*0.35)+uBA.w*exp(-pow(ys-uBH.w,2.0)*0.35);
    env+=uE1.x*1.4*exp(-pow(ys-1.5,2.0)*0.5)*(1.0+0.28*exp(-fract(t/1.05)*6.0));
    env*=1.0-pow(abs(ys)/9.3,6.0);
    float th=sx*6.2831853;
    float lobe=1.0+((uSpikes+uE1.z*0.4)*0.5+uE1.y*0.3)*cos(lobes*th);
    float rib=1.0+uE1.z*0.32*pow(max(0.0,cos(ys*4.0)),8.0);
    float rr=env*mix(0.3-uE1.w*0.12,1.0,lf)*(0.7+0.6*ls)*lobe*rib;
    float tw=th+ys*(uTwist+uE1.w*0.22);
    vec3 sp=vec3(sin(tw)*rr,ys,cos(tw)*rr);
    keep=smoothstep(0.36,0.54,ls)*mix(0.55,1.0,lf);
    if(uE2.x>0.5 && lf>0.84){
      float hr=2.8+ls*0.7; sp=vec3(sin(th)*hr,10.6+sin(th*3.0+t)*0.3+(ls-0.5)*0.9,cos(th)*hr); keep=max(keep,0.75); }
    if(uE2.y>0.5 && lf<0.16){
      float strand=floor(a.x*8.0), ang=(strand+0.5)/8.0*6.2831853, L=a.y;
      sp=vec3(sin(ang)*1.6*(1.0-L*0.4),-8.8-L*8.5,cos(ang)*1.6*(1.0-L*0.4));
      sp.x+=sin(t*0.9+L*4.0+strand)*L*1.3; sp.z+=cos(t*0.8+L*3.0+strand)*L*1.3; keep=0.85; }
    return sp;
  }
`;

/* ───────── the reef ───────── */
const NP=GX*GY*NL;
const aUv=new Float32Array(NP*2), aRand=new Float32Array(NP), aLayer=new Float32Array(NP), dummy=new Float32Array(NP*3);
for(let l=0,i=0;l<NL;l++) for(let y=0;y<GY;y++) for(let x=0;x<GX;x++,i++){
  aUv[i*2]=(x+R()*0.9+0.05)/GX; aUv[i*2+1]=(y+R()*0.9+0.05)/GY; aRand[i]=R(); aLayer[i]=l; }
const reefGeo=new THREE.BufferGeometry();
reefGeo.setAttribute('position',new THREE.BufferAttribute(dummy,3));
reefGeo.setAttribute('aUv',new THREE.BufferAttribute(aUv,2));
reefGeo.setAttribute('aRand',new THREE.BufferAttribute(aRand,1));
reefGeo.setAttribute('aLayer',new THREE.BufferAttribute(aLayer,1));

const NRIP=12;   // 4 echoes of your own + 8 answers from the sounds they reach
const ripO=Array.from({length:NRIP},()=>new THREE.Vector4(0,0,0,-99));
const ripD=Array.from({length:NRIP},()=>new THREE.Vector4(0,0,-1,0));
function sculptUniforms(){ return {
  uLobes:{value:2},uTwist:{value:0},uSpikes:{value:0.3},
  uBH:{value:new THREE.Vector4(-4,0,3,6)},uBA:{value:new THREE.Vector4(0.5,0.5,0.5,0.5)},
  uE1:{value:new THREE.Vector4()},uE2:{value:new THREE.Vector4()},uLF4:{value:new THREE.Vector4(0,30,60,90)} }; }
const reefMat=new THREE.ShaderMaterial({
  transparent:false,depthTest:true,depthWrite:true,
  uniforms:Object.assign({
    uAtlas:{value:null},uFrame:{value:0},uTime:{value:0},uP:{value:0},uSymX:{value:0},uSymY:{value:0},
    uInk:{value:0},uBase:{value:0},uSleep:{value:0},uPix:{value:1},uSize:{value:2.2},uFade:{value:0},
    uBass:{value:0},uSpin:{value:0},uLeave:{value:0},uColor:{value:0},uS:{value:S},uRipO:{value:ripO},uRipD:{value:ripD},
    uDepth:{value:null},uEye:{value:new THREE.Vector3(0,0,14)},uViewH:{value:720},uCamTan:{value:Math.tan(31*Math.PI/180)},uRingTint:{value:new THREE.Vector3(0.80,0.84,1.0)},
    uSingP:{value:new THREE.Vector4(0,0,0,0)},uSingC:{value:new THREE.Vector3(1,1,1)},uSphC:{value:new THREE.Vector3(0,-4,-12)},uInkHide:{value:0},
    uBeadP:{value:[0,1,2,3,4].map(()=>new THREE.Vector4(0,0,0,0))},uBeadC:{value:[0,1,2,3,4].map(()=>new THREE.Vector3(1,1,1))},
    uOrbP:{value:[0,1,2,3,4,5,6].map(()=>new THREE.Vector4(0,0,0,0))}, uRest:{value:0}, uDim:{value:1}
  },sculptUniforms()),
  vertexShader:GLSL_COMMON+GLSL_SCULPT+`${GLSL_WARP}
    uniform float uFrame,uTime,uP,uSymX,uSymY,uInk,uBase,uSleep,uPix,uSize,uFade,uBass,uSpin,uLeave,uColor;
    uniform vec3 uS; uniform vec3 uRingTint; uniform vec3 uSphC; uniform float uInkHide; uniform float uDim;
    uniform vec4 uSingP; uniform vec3 uSingC; uniform vec4 uBeadP[5]; uniform vec3 uBeadC[5];
    uniform vec4 uRipO[12]; uniform vec4 uRipD[12]; uniform vec4 uOrbP[7];
    attribute vec2 aUv; attribute float aRand; attribute float aLayer;
    varying vec3 vCol; varying float vVis; varying float vHash; varying float vGlow; varying float vInk;
    uniform sampler2D uDepth; uniform vec3 uEye; uniform float uViewH,uCamTan;
    float depthAt(float f, vec2 uv){ float k0=floor(f), fr=f-k0, k1=min(k0+1.0,${FRAMES-1}.0);
      return mix(texture2D(uDepth,cell(k0,uv)).r,texture2D(uDepth,cell(k1,uv)).r,fr); }
    float snz(vec3 q){ vec3 i=floor(q), fr=fract(q); fr=fr*fr*(3.0-2.0*fr); float n=dot(i,vec3(1.0,57.0,113.0));
      float a=mix(mix(fract(sin(n)*43758.5),fract(sin(n+1.0)*43758.5),fr.x),mix(fract(sin(n+57.0)*43758.5),fract(sin(n+58.0)*43758.5),fr.x),fr.y);
      float b=mix(mix(fract(sin(n+113.0)*43758.5),fract(sin(n+114.0)*43758.5),fr.x),mix(fract(sin(n+170.0)*43758.5),fract(sin(n+171.0)*43758.5),fr.x),fr.y);
      return mix(a,b,fr.z); }
    float depthV(vec2 uv, float f){ float s=mod(f,${LOOPF}.0);
      if(s<${XF}.0) return mix(depthAt(s+${LOOPF}.0,uv),depthAt(s,uv),s/${XF}.0); return depthAt(s,uv); }
    /* five views (forward, right, back, left, floor); layers 5-9 are the same views as an outer shell, further out */
    vec3 panel(float L, vec2 uv, float d, float jit, out float dist, out float wid, out vec3 tint){
      float Lp=mod(L,5.0), shell=L>4.5?1.0:0.0;
      float nearD=Lp>3.5?6.0:12.0, rng=Lp>3.5?16.0:56.0;
      wid=Lp>3.5?3.2:1.18;                                                      // the side views overlap a little
      dist=(nearD+d*rng)*(1.0+shell*0.62)+jit;
      vec3 q=normalize(vec3((uv.x*2.0-1.0)*0.60086*1.7778*wid,(uv.y*2.0-1.0)*0.60086*wid,-1.0))*dist;   // on a sphere, not a flat wall: no corners
      tint=vec3(1.0);
      if(Lp<0.5){}
      else if(Lp<1.5){ q=vec3(-q.z,q.y,q.x); tint=vec3(0.96,1.0,1.04); }
      else if(Lp<2.5){ q=vec3(-q.x,q.y,-q.z); tint=vec3(0.92,0.98,1.06); }
      else if(Lp<3.5){ q=vec3(q.z,q.y,-q.x); tint=vec3(1.02,1.0,0.97); }
      else { q=vec3(q.x,q.z,-q.y); tint=vec3(1.08,0.98,0.86); }
      tint*=1.0-shell*0.18;
      return uEye+q;
    }
    void main(){
      vec2 uv=aUv;
      uv.x=mix(uv.x,0.5-abs(uv.x-0.5),uSymX);
      uv.y=mix(uv.y,abs(fract(uv.y*2.0)*2.0-1.0),uSymY);
      float f=uFrame+mod(aLayer,5.0)*23.0+floor(aLayer/5.0)*11.0;
      vec3 c=video(uv,f);                                    // (the footage now only colours the being when it forms)
      float lf=aLayer/${NL-1}.0;
      /* where this grain lives in the sphere of the sea */
      float th=aUv.x*6.2832, ph=acos(clamp(mix(-1.0,1.0,pow(aUv.y,0.9)),-1.0,1.0)); vec3 dir=vec3(sin(ph)*cos(th),cos(ph),sin(ph)*sin(th));   // the grains go to the floor and the walls, not the open water above
      float n1=snz(dir*2.1+aLayer*0.37), n2=snz(dir*5.3+vec3(aRand*3.0)), n3=snz(dir*3.7-aLayer*0.53+vec3(0.0,uTime*0.01,0.0));
      float shellL=aLayer<5.5?1.0:0.0;
      float dep=depthV(uv,f);                                                    // the old footage's depth still moves the surfaces
      float rdg=pow(1.0-abs(snz(dir*vec3(4.2,7.0,4.2)+aLayer*0.11)*2.0-1.0),3.0);   // ridges, as the reef in the old footage
      float spur=pow(max(0.0,snz(dir*1.15+vec3(3.1,0.0,7.7))-0.52)*2.1,2.0);   /* great spurs of rock jutting in from the far walls */
      float rr=shellL>0.5 ? 64.0+aLayer*1.8+dep*20.0+9.0*n1-15.0*rdg-26.0*spur+aRand*1.5 : 34.0+(aLayer-6.0)*3.5+dep*14.0+7.0*n1-8.0*rdg+aRand*0.8;   // far walls / nearer walls; ridges stand in toward you
      rr+=(snz(dir*2.6+vec3(0.0,uTime*0.05,uTime*0.04))-0.5)*(shellL>0.5?5.0:3.0);   // they breathe a little, but hold their place
      vec3 vp=uSphC+dir*rr*vec3(1.0,dir.y<0.0?0.5:0.62,1.0);   // a low floor below and a reef roof above: a closed sea-cave, wide
      /* layers 0-3: the four footage views stand round the sea's centre as one panorama — each picture spread over a wide arc (130°, so
         neighbours overlap), every pixel pushed out along its own ray as far as its depth says: rocks, ridges and gaps as the footage
         has them. Where two views meet they cross-fade over a ragged band and their surfaces ease toward each other, so there is no
         seam, no box. Layer 4: the floor view, laid flat under you, its depth raising the near rocks. */
      float foot=0.0, edgeF=1.0;
      float rlit=0.0;
      /* the Bali footage, set outside the sphere: each of four views wraps a wide arc (130°) at r 84 and its depth pulls what was near
         the camera inward — only what juts in past the sphere's wall (r < ~66) comes into the sea; the footage's far water stays
         outside, so the sea is open and the rock reaches into it from all round. Its frames run slowly (calmer than the footage).
         Fine grains in a little thickness. Layer 4: the floor view, laid flat and low. */
      float fs=uFrame*0.35+aLayer*23.0;
      if(aLayer<3.5){ float az=aLayer*1.5708+(uv.x-0.5)*2.27, el=(uv.y-0.5)*1.28;
        vec3 fd=vec3(cos(el)*sin(az),sin(el),-cos(el)*cos(az));
        dep=depthV(uv,fs); float jut=pow(clamp(1.0-dep,0.0,1.0),1.5);
        float fdst=84.0-jut*62.0+(aRand-0.5)*3.0*(0.5+jut)+sin(uTime*0.22+az*3.0+el*5.0)*0.4;
        fd=normalize(fd+vec3(fract(aRand*13.7)-0.5,fract(aRand*29.3)-0.5,fract(aRand*7.9)-0.5)*0.014);
        float rag=(snz(vec3(uv.y*6.0,aLayer*3.1,1.7))-0.5)*0.16;
        edgeF=smoothstep(0.0,0.2,uv.x+rag)*smoothstep(1.0,0.8,uv.x+rag)*smoothstep(0.0,0.1,uv.y)*smoothstep(70.0,60.0,fdst);   // only what comes in through the wall
        rlit=0.5*jut;
        vp=uSphC+fd*fdst*vec3(1.0,0.8,1.0); rr=fdst; foot=1.0; }
      else if(aLayer<4.5){ vec2 fq=(uv-0.5)*2.0; float fr=length(fq);
        dep=depthV(uv,fs); rlit=0.3*(1.0-dep);
        edgeF=smoothstep(1.05,0.75,fr+(snz(vec3(fq*3.0,4.2))-0.5)*0.2);
        vp=uSphC+vec3(fq.x*62.0,-27.0+pow(1.0-dep,1.4)*16.0+(aRand-0.5)*2.0,fq.y*62.0); rr=length(vp-uSphC); foot=1.0; }
      float pil=0.0;   // (the pillars are gone)
      if(pil>0.5){ float ci=floor(aRand*5.0), ca=0.4+ci*1.27+ci*ci*0.06, cr=30.0+mod(ci*7.0,14.0), hy=aUv.y;
        float rc=2.4+3.0*abs(sin(hy*4.1+ci*1.7))+dep*2.2+(n1-0.5)*2.0;   /* waisted and swelling, like stacked rock */
        vp=uSphC+vec3(cos(ca)*cr+cos(th)*rc,-30.0+hy*62.0,sin(ca)*cr+sin(th)*rc); rr=cr; }
      /* ridgelines, as in the Bali footage: every layer is a range at its own distance with its own skyline — broad swells, sharper
         peaks and notches — so the walls stand behind one another as silhouettes; above its crest a range is open water, and the crest
         itself catches the light */
      float vy=vp.y-uSphC.y, lay=aLayer<5.5?aLayer:aLayer-6.0;
      float crest=-17.0+(aLayer<5.5?lay*2.6:lay*1.6)+27.0*snz(vec3(cos(th)*1.6,lay*0.83+0.4,sin(th)*1.6))+13.0*(snz(vec3(cos(th)*4.6,lay*1.31+5.0,sin(th)*4.6))-0.5)
                  +5.0*pow(abs(sin(th*7.0+lay*2.3)),6.0)*snz(vec3(cos(th)*2.2,lay+9.0,sin(th)*2.2));
      float under=pil>0.5||foot>0.5?1.0:smoothstep(crest+1.5,crest-3.0,vy), lip=pil>0.5||foot>0.5?0.0:exp(-pow((vy-crest)*0.42,2.0));
      float lum=clamp(mix(0.18+0.9*n2*n2+0.2*n1,lumOf(c),0.65)*(0.55+0.5*dep+0.6*rdg+0.35*spur*shellL)*(0.6+0.4*under)+0.5*lip,0.0,1.0);
      if(foot>0.5) lum=clamp(mix(0.2+0.5*n2*n2,lumOf(video(uv,fs)),0.6)*(0.55+0.5*rlit)+0.25*rlit,0.0,1.0);   // the footage's own light and shade; what juts in nearest is brightest   // light and shade from the footage; crests catch the light, valleys stay dark
      float cloud=pil>0.5?1.0:shellL>0.5?smoothstep(0.30,0.55,n1+0.2+0.25*smoothstep(0.0,-0.6,dir.y))*mix(1.0,0.7,smoothstep(0.15,0.75,dir.y))
                            :smoothstep(0.46,0.62,n1+dep*0.35+0.15*smoothstep(0.0,-0.5,dir.y))*mix(1.0,0.45,smoothstep(0.1,0.6,dir.y));   // the near walls come in pieces, with gaps to see through, mostly low   // dense ridges on the floor, thin above   // the shell is uneven; inside, grains gather into drifting clouds
      cloud=max(cloud*under,lip*0.85);   // the range below its crest, and the crest drawn whole
      if(foot>0.5) cloud=edgeF; else cloud*=aLayer<5.5?0.4:0.22;   // the made shell and inner clouds only a faint haze now: the footage's rock is the place   // footage: whole where it is, fading at its edges; the far water thin
      vec3 tint=vec3(1.0); float srcD=rr, wid=1.15;   // splats wide enough that a wall reads as a surface
      float cv=smoothstep(0.25,0.95,uP);
      vp=uS+(vp-uS)*mix(1.0,0.8,cv);
      vp+=vec3(sin(uTime*0.3+aRand*30.0),cos(uTime*0.25+aRand*17.0),sin(uTime*0.2+aRand*11.0))*0.09;

      float kI=smoothstep(aRand*0.35,aRand*0.35+0.65,uInk);
      vec3 p=vp; float keep=1.0;
      if(uInk>0.001){
        vec3 cs; vec3 sp=sculpt(aUv,lf,pick4(aLayer),uTime,keep,cs);
        float cs2=cos(uSpin), sn2=sin(uSpin); sp.xz=mat2(cs2,-sn2,sn2,cs2)*sp.xz;
        sp=uS+sp*(1.0-0.85*uLeave);
        p=mix(vp,sp,kI); c=mix(c,cs,kI); lum=mix(lum,lumOf(cs),kI);
      }
      float fall=(1.0-keep)*kI;
      p.y-=fall*fall*(3.0+aRand*10.0);

      /* echoes spread from where you are, all around you */
      float ring=0.0, reveal=0.0;
      for(int i=0;i<12;i++){
        vec4 o=uRipO[i]; vec4 dd=uRipD[i]; float tr=uTime-o.w;
        if(tr>0.0 && tr<11.0 && dd.w>0.0){
          vec3 d3=p-o.xyz; float d=length(d3)+0.001; vec3 nd=d3/d; float los=1.0;
          bool ans=dot(dd.xyz,dd.xyz)<0.01; float spd=ans?10.0:${SPEED}.0;   // a sound's answer spreads at half speed, so you can watch it go out
          float cone=ans?1.0:mix(0.32,1.0,smoothstep(-0.2,0.7,dot(nd,dd.xyz)));   // yours travels where you sent it; a sound's answer goes all round
          ring+=ans?exp(-d*d/30.0)*(0.65+0.35*sin(tr*9.0))*exp(-tr*0.7)*dd.w*0.9:exp(-d*d/10.0)*exp(-tr*2.2)*dd.w*0.8;   // yours starts as a glow where it was sent; an answer throbs where the sound is
          float band=d-tr*spd;
          float passed=smoothstep(1.5,-1.5,band);
          float since=max(0.0,tr-d/spd);
          reveal=max(reveal,passed*exp(-since*0.22)*dd.w*cone*exp(-d*(ans?0.016:0.012))*los);
          float wB=ans?0.07:0.11, rg=exp(-band*band*wB)*dd.w*cone*exp(-tr*(ans?0.15:0.15))*(ans?exp(-d*0.009):1.0), push=exp(-band*band*(ans?0.35:0.6))*dd.w*cone*exp(-tr*0.3)*(ans?1.6:0.45);   // yours only stirs them; a sound's answer moves them most   // the glow rides the wave, the push only at its very front
          ring+=rg*(ans?1.8:1.0)*los; p+=nd*push*0.8*(0.4+aRand*1.3)*los;   // a sound's answer is brighter than the reef it crosses
        }
      }
      float kept=mix(1.0,keep,kI);
      /* the edges of each view dissolve into the dark (the top furthest, into the open water), unevenly */
      float Lq=mod(aLayer,5.0), ns=fract(sin(dot(floor(aUv*vec2(23.0,13.0)),vec2(12.9898,78.233)))*43758.5453);
      float ex=min(aUv.x,1.0-aUv.x), ey0=aUv.y, ey1=1.0-aUv.y;
      float edge=Lq>3.5 ? smoothstep(0.0,0.16+0.08*ns,min(ex,min(ey0,ey1)))
                        : smoothstep(0.0,0.10+0.06*ns,ex)*smoothstep(0.0,0.30+0.12*ns,ey1)*smoothstep(0.0,0.05,ey0);
      edge=mix(cloud,1.0,kI);
      float topLit=smoothstep(-8.0,34.0,p.y)*0.14*(1.0-kI);                              // the light from above touches the upper reef
      float vis=max(max(uBase,topLit),reveal)*kept*(1.0-fall)*edge;
      float contour=smoothstep(0.12,0.02,abs(fract(p.y*0.3+0.5)-0.5))*(1.0-kI)*(1.0-0.75*foot);   // (the footage's own forms carry the walls; height lines only a hint there)   // a height line every ~3 units, as on a chart of the sea floor
      vis=max(vis,contour*min(1.0,reveal*2.2)*edge);
      float dS=length(p-uSingP.xyz), sing=uSingP.w*exp(-dS*dS/190.0)*(1.0-kI);   // a sound singing within reach lights the reef around it
      vis=max(vis,sing*0.9);
      float sl=smoothstep(0.0,1.0,uSleep);
      p=mix(p,uS+vec3(0.0,(p.y-uS.y)*0.08-6.0*sl,0.0),sl);

      vec3 g0=vec3(0.015,0.025,0.05), g1=vec3(0.19,0.26,0.42), g2=vec3(0.78,0.85,0.95);   // the key colour: deep blue-teal to moonlight (as the title's water)
      vec3 graded=lum<0.5?mix(g0,g1,lum*2.0):mix(g1,g2,(lum-0.5)*2.0);
      vec3 satc=max(mix(vec3(lum),c,1.35),0.0);
      vec3 col=mix(graded,satc,mix(0.26*(1.0-0.45*uP),0.22,kI));   // the reef's own colours, faint (as with the footage before)
      col=mix(col,graded*vec3(1.15,0.95,0.76)*1.15,smoothstep(0.25,0.7,uP)*0.6*(1.0-kI));
      vec3 ink=mix(vec3(0.52,0.56,0.86),vec3(0.94,0.95,1.0),smoothstep(0.35,0.9,lum));
      col=mix(col,ink,kI);
      vec3 sat=mix(vec3(lum),c,1.9)*1.25;
      col=mix(col,max(sat,0.0),uColor*0.85);
      float bri=(0.28+lum*1.0)*(0.32+0.68*clamp(max(vis,ring),0.0,1.0))+ring*0.8;
      float hk=fract(aRand*53.17); col*=hk<0.035?vec3(1.22,1.02,0.78):(hk<0.22?vec3(0.5):vec3(1.0));   // a few sand specks; some discs darker, in front of the light ones
      col=mix(col*bri,uRingTint,clamp(ring,0.0,1.0)*0.6);
      col+=uRingTint*contour*clamp(reveal*1.6+ring,0.0,1.0)*0.85;   // where the echo has been, the land's lines stay drawn for a while   // the front of an echo reads clearly as it runs over the reef
      float waves=pow(max(0.0,sin(dS*0.9-uTime*4.5)),10.0)*exp(-dS*0.05);                  // and its song spreads through it in rings
      col=mix(col,uSingC*1.25,clamp(sing*0.75+waves*uSingP.w*(1.0-kI)*0.9,0.0,0.85));
      for(int i=0;i<5;i++){ vec4 b=uBeadP[i]; if(b.w>0.0){ float d=length(p-b.xyz); col+=uBeadC[i]*exp(-d*d/7.0)*b.w*kI*0.9; } }   // the four (or five) lights inside the being

      vec4 mv=modelViewMatrix*vec4(p,1.0);
      gl_Position=warpP(projectionMatrix*mv);
      float dz=max(-mv.z,0.3);
      col=mix(col*exp(-max(0.0,dz-10.0)*0.01),vec3(0.035,0.035,0.08),smoothstep(20.0,95.0,dz)*(uDim<0.99?0.35:0.8)*(1.0-kI));   // far reef sinks into the dark (the room has no far wall)
      float cvS=mix(1.0,0.42,smoothstep(0.25,0.95,uP));
      float sw=srcD*2.0*0.60086*wid/${GY}.0*cvS*(1.15+aRand*aRand*1.6);
      float pxSplat=sw*uViewH/(2.0*uCamTan)/dz*0.82;
      float pxInk=uSize*(0.55+aRand*0.8)*(1.0+kI*0.9)*uPix*(12.0/dz);
      float near=0.0; for(int i=0;i<7;i++){ vec4 o=uOrbP[i]; if(o.w>0.0){ vec3 dd2=p-o.xyz; near=max(near,exp(-dot(dd2,dd2)/260.0)*o.w); } }   // grains grow toward a hidden sound
      float szK=mix(foot>0.5?0.55:0.5,1.25,near);   // fine grains: the rock is made of many, not painted with a few
      float bok=1.0+0.15*smoothstep(10.0,3.0,dz);   // close discs open up like out-of-focus light
      gl_PointSize=clamp(mix(min(pxSplat*szK*bok*0.75,(foot>0.5?6.5:8.0)*uPix),pxInk,kI)*(1.0+ring*0.55)*(1.0+uBass*0.3),1.0,40.0);
      vCol=col*uFade*uDim*(1.0-uInkHide*kI); vVis=(vis+ring)*(1.0-uInkHide*kI); vHash=fract(aRand*91.7); vGlow=clamp(ring+lum*0.3,0.0,1.0); vInk=kI;   // once the being stands in its own grains and fibres, the reef lets it go
    }`,
  fragmentShader:`
    varying vec3 vCol; varying float vVis; varying float vHash; varying float vGlow; varying float vInk; uniform float uRest;
    void main(){
      vec2 q=gl_PointCoord*2.0-1.0;
      if(vInk<0.5){ float a=vHash*31.4, cs=cos(a), sn=sin(a); q=mat2(cs,-sn,sn,cs)*q; float el=fract(vHash*17.3); q.x*=1.0+el*el*1.2; }   // each grain turned and drawn out a little, its own way
      float r2=dot(q,q);
      if(r2>1.0 || (vVis<vHash && (vHash>uRest || vInk>0.5))) discard;
      if(vInk<0.5){ float n=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233))+vHash*57.0)*43758.5453); if(n>smoothstep(1.0,0.3,r2)) discard; }   // the edge dissolves in stipple, as airbrush does   // a share of the reef always rests there, dim; the echo shows the rest
      if(vInk>0.5 && r2>0.45+0.55*fract(vHash*7.31)) discard;           // the being stays stippled; the reef is round discs
      float core=exp(-r2*1.3), rim=smoothstep(0.55,1.0,r2);             // a flat disc with a slightly darker edge (the Bali map's bokeh)
      gl_FragColor=vec4(vCol*(0.55+0.6*core)*(1.0-0.22*rim)*(1.0+vGlow*0.25),1.0);
    }`
});
reefMat.uniforms.uWarp=WARP;
const reef=new THREE.Points(reefGeo,reefMat); reef.frustumCulled=false; reef.renderOrder=1; scene.add(reef);



/* ───────── with the EYE in it, every sound in the being grows its own aura of lines, at its own place on the body:
   HEARTBEAT  a burst of fine rays with beads at their tips        (iwhiteplant's core)
   VOICE      long looping wings, fanned and mirrored                (ref 57's wings)
   BONE       an ornamented column: the axis with paired S-curls     (ref 57's centre)
   MEMORY     spirals that roll inward, fringed with hair            (iwhiteplant's curls)
   SOUL       a crown of petals with a fringe of fine hairs          (iwhiteplant's petals)
   DREAM      thin tilted orbits strung with beads
   EYE        an almond eye whose lashes radiate out
   All of it is stippled like the being, and grows outward from each part. ───────── */
const AU_MAX=60000;
const auPos=new Float32Array(AU_MAX*3), auU=new Float32Array(AU_MAX), auR=new Float32Array(AU_MAX);
for(let i=0;i<AU_MAX;i++) auR[i]=R();
const auGeo=new THREE.BufferGeometry();
auGeo.setAttribute('position',new THREE.BufferAttribute(auPos,3));
auGeo.setAttribute('aU',new THREE.BufferAttribute(auU,1));
auGeo.setAttribute('aRand',new THREE.BufferAttribute(auR,1));
auGeo.setDrawRange(0,0);
const auraMat=new THREE.ShaderMaterial({
  transparent:true,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,   // drawn over the body, like ink on the print
  uniforms:{uTime:{value:0},uPix:{value:1},uShow:{value:0},uSpin:{value:0},uLeave:{value:0},uS:{value:S}},
  vertexShader:`${GLSL_WARP}attribute float aU,aRand; uniform float uTime,uPix,uShow,uSpin,uLeave; uniform vec3 uS; varying float vA;
    void main(){
      vec3 p=position;
      p+=vec3(sin(uTime*0.5+p.y*0.6+aRand),cos(uTime*0.4+p.x*0.5),sin(uTime*0.45+p.z*0.5))*0.06*aU;   // a slow drift at the outer ends
      float c=cos(uSpin), s=sin(uSpin); p.xz=mat2(c,-s,s,c)*p.xz;
      p=uS+p*(1.0-0.85*uLeave);
      vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=warpP(projectionMatrix*mv); float dz=max(-mv.z,0.3);
      gl_PointSize=clamp((1.0+aRand*0.9)*uPix*(12.0/dz),1.0,6.0);
      vA=step(aU,uShow*1.25-0.05)*(0.55+0.45*aRand)*(1.0-aU*0.35)*1.9;            // drawn outward from the body, line by line
    }`,
  fragmentShader:`varying float vA; void main(){ vec2 q=gl_PointCoord-0.5; gl_FragColor=vec4(vec3(0.80,0.83,1.0),exp(-dot(q,q)*12.0)*vA); }`
});
const aura=new THREE.Points(auGeo,auraMat); aura.frustumCulled=false; aura.renderOrder=3; scene.add(aura);

function auraCloud(parts,density,P,U){                            // the aura of a set of parts, written into P (xyz) and U (growth); returns the count
  let n=0; const MAX=U.length;
  const put=(x,y,z,u)=>{ if(n>=MAX||R()>density) return; P[n*3]=x+(R()-0.5)*0.05; P[n*3+1]=y+(R()-0.5)*0.05; P[n*3+2]=z+(R()-0.5)*0.05; U[n]=u; n++; };
  /* one stroke: f(t) -> [x,y,z] for t in 0..1, sampled densely; u says how far out it is (for the growth) */
  const stroke=(f,count,u0,u1)=>{ for(let i=0;i<count;i++){ const t=i/(count-1), q=f(t); put(q[0],q[1],q[2],u0+(u1-u0)*t); } };
  const both=(f,count,u0,u1)=>{ stroke(f,count,u0,u1); stroke(t=>{ const q=f(t); return [-q[0],q[1],q[2]]; },count,u0,u1); };   // mirrored
  const at=id=>EL[id].at;
  const STY={
    heart(){ const [x0,y0,z0]=at('heart');
      for(let i=0;i<70;i++){ const a=R()*TAU, b=(R()-0.5)*1.4, L=3.0+Math.pow(R(),2)*6.0, d=[Math.cos(a)*Math.cos(b),Math.sin(b),Math.sin(a)*Math.cos(b)];
        stroke(t=>[x0+d[0]*L*t,y0+d[1]*L*t,z0+d[2]*L*t],Math.round(60+L*45),0,1);
        if(L>5) for(let k=0;k<40;k++){ const a2=k/40*TAU; put(x0+d[0]*L+Math.cos(a2)*0.12,y0+d[1]*L+Math.sin(a2)*0.12,z0+d[2]*L,1); } } },
    voice(){ const [x0,y0,z0]=at('voice');
      for(let i=0;i<11;i++){ const a=-0.35+i*0.15, L=4.5+i*0.45+Math.sin(i*1.7)*0.6, w=0.55+i*0.04, dx=Math.cos(a), dy=Math.sin(a);
        both(t=>{ const th=t*TAU, along=L*0.5*(1-Math.cos(th)), side=w*Math.sin(th);
          return [x0+0.4+dx*along-dy*side, y0+dy*along+dx*side, z0+Math.sin(th)*0.3*(i%3-1)]; },420,0.1,1); } },
    bone(){ const [x0,y0,z0]=at('bone');
      stroke(t=>[x0,y0-6+t*12,z0],900,0,0.4);
      for(let i=0;i<9;i++){ const y=y0-5+i*1.25, s=1.9+0.9*Math.sin(i*0.9);       // wide enough to clear the body
        both(t=>{ const a=t*Math.PI*1.6; return [x0+t*1.8*s, y+Math.sin(a)*0.45*s-t*0.3, z0+Math.cos(a)*0.2]; },160,0.3,0.8);
        both(t=>[x0+1.8*s+Math.cos(t*TAU)*0.22*s, y-0.3+Math.sin(t*TAU)*0.22*s, z0],50,0.8,0.85); } },
    memory(){ const [x0,y0,z0]=at('memory');
      for(let j=0;j<3;j++) both(t=>{ const a=0.4+j*0.7+t*TAU*1.9, r=(3.6-j*0.6)*(1-t*0.85); return [x0+3.4+Math.cos(a)*r, y0-0.6+Math.sin(a)*r*0.9, z0+j*0.25]; },700,0.1,1);
      for(let j=0;j<2;j++) for(let k=0;k<70;k++){ const t=k/70, a=0.4+j*0.7+t*TAU*1.9, r=(3.6-j*0.6)*(1-t*0.85), nx=Math.cos(a), ny=Math.sin(a), hl=0.25+0.35*Math.sin(k*1.3)**2;   // hair on the outer edge
        both(s=>[x0+3.4+nx*(r+s*hl), y0-0.6+ny*(r+s*hl)*0.9, z0+j*0.25],14,0.2+t*0.8,0.25+t*0.8); } },
    soul(){ const [x0,y0,z0]=at('soul');
      for(let i=0;i<3;i++){ const a=0.9+i*0.32, L=3.2+i*0.6, dx=Math.cos(a), dy=Math.sin(a);
        both(t=>{ const th=t*TAU, along=L*0.5*(1-Math.cos(th)), side=0.75*Math.sin(th); return [x0+dx*along-dy*side, y0+dy*along+dx*side, z0]; },380,0.1,1);
        for(let k=0;k<46;k++){ const th=k/46*TAU, along=L*0.5*(1-Math.cos(th)), side=0.75*Math.sin(th), bx=dx*along-dy*side, by=dy*along+dx*side, nl=Math.hypot(bx,by)||1, hl=0.25+0.3*R();   // the fringe
          both(s=>[x0+bx+bx/nl*s*hl, y0+by+by/nl*s*hl, z0],10,0.3+k/46*0.7,0.35+k/46*0.7); } } },
    dream(){ const [x0,y0,z0]=at('dream');
      for(let i=0;i<4;i++){ const rx=4.2+i*0.9, ry=0.9+i*0.25, tilt=(i-1.5)*0.18;
        stroke(t=>{ const a=t*TAU; const x=Math.cos(a)*rx, y=Math.sin(a)*ry; return [x0+x*Math.cos(tilt)-y*Math.sin(tilt), y0+x*Math.sin(tilt)+y*Math.cos(tilt), z0+Math.sin(a)*rx*0.5]; },700,0.2+i*0.15,0.2+i*0.15);
        for(let k=0;k<7;k++){ const a=k/7*TAU+i; const cx=Math.cos(a)*rx, cy=Math.sin(a)*ry; for(let m=0;m<30;m++){ const b=m/30*TAU; put(x0+cx*Math.cos(tilt)-cy*Math.sin(tilt)+Math.cos(b)*0.13, y0+cx*Math.sin(tilt)+cy*Math.cos(tilt)+Math.sin(b)*0.13, z0+Math.sin(a)*rx*0.5, 0.3+i*0.15); } } } },
    sense(){ const [x0,y0,z0]=at('sense'), w=2.2;
      both(t=>{ const x=-w+t*2*w; return [x0+x, y0+(1-(x/w)**2)*0.9, z0+0.5]; },300,0,0.3);
      both(t=>{ const x=-w+t*2*w; return [x0+x, y0-(1-(x/w)**2)*0.9, z0+0.5]; },300,0,0.3);
      for(let r=0;r<3;r++) stroke(t=>[x0+Math.cos(t*TAU)*(0.35+r*0.22), y0+Math.sin(t*TAU)*(0.35+r*0.22), z0+0.5],160,0.2,0.2);
      for(let k=0;k<26;k++){ const u=k/25, x=-w+u*2*w, y=(1-(x/w)**2)*0.9, a=Math.PI/2+(u-0.5)*2.2, L=0.8+Math.sin(u*Math.PI)*2.2;   // lashes radiating out
        stroke(t=>[x0+x+Math.cos(a)*L*t, y0+y+Math.sin(a)*L*t, z0+0.5],Math.round(30+L*25),0.3,1);
        stroke(t=>[x0+x+Math.cos(-a)*L*0.6*t, y0-y+Math.sin(-a)*L*0.6*t, z0+0.5],Math.round(20+L*15),0.3,0.8); } },
  };
  for(const id of parts) if(STY[id]) STY[id]();
  return n;
}
function buildAura(parts){ const n=auraCloud(parts,1,auPos,auU); auGeo.setDrawRange(0,n); auGeo.attributes.position.needsUpdate=true; auGeo.attributes.aU.needsUpdate=true; }
/* the same auras in THE DEEP, hung on each being (so they float and scale with it) */
const deepAuraMat=auraMat.clone();
deepAuraMat.uniforms.uTime=auraMat.uniforms.uTime; deepAuraMat.uniforms.uPix=auraMat.uniforms.uPix; deepAuraMat.uniforms.uS={value:new THREE.Vector3()};
function auraFor(parts,density){
  const cap=Math.round(AU_MAX*density)+2000, P=new Float32Array(cap*3), U=new Float32Array(cap), Rr=new Float32Array(cap).map(()=>R());
  const n=auraCloud(parts,density,P,U), geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(P,3)); geo.setAttribute('aU',new THREE.BufferAttribute(U,1)); geo.setAttribute('aRand',new THREE.BufferAttribute(Rr,1));
  geo.setDrawRange(0,n); const pts=new THREE.Points(geo,deepAuraMat); pts.frustumCulled=false; pts.renderOrder=4; return pts;
}




/* ───────── marine snow ───────── */
const ND=small?3000:18000;
const dPos=new Float32Array(ND*3), dR=new Float32Array(ND);
for(let i=0;i<ND;i++){ dPos[i*3]=(R()*2-1)*84; dPos[i*3+1]=-24+R()*76; dPos[i*3+2]=-110+R()*180; dR[i]=R(); }
const dustGeo=new THREE.BufferGeometry();
dustGeo.setAttribute('position',new THREE.BufferAttribute(dPos,3));
dustGeo.setAttribute('aRand',new THREE.BufferAttribute(dR,1));
const dustMat=new THREE.ShaderMaterial({
  transparent:true,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{uTime:{value:0},uPix:{value:1},uFade:{value:0}},
  vertexShader:`${GLSL_WARP}attribute float aRand; uniform float uTime,uPix,uFade; varying float vA;
    void main(){ vec3 p=position;
      p.y=mod(p.y+24.0-uTime*(0.1+aRand*0.22),76.0)-24.0;
      p.x+=sin(uTime*0.2+aRand*40.0)*0.5;
      vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=warpP(projectionMatrix*mv);
      float dz=max(-mv.z,0.3);
      gl_PointSize=clamp((1.0+aRand*2.4)*uPix*(12.0/dz),1.0,18.0);
      vA=(0.14+0.34*aRand)*uFade*exp(-max(0.0,dz-8.0)*0.025); }`,
  fragmentShader:`varying float vA; void main(){ vec2 q=gl_PointCoord-0.5; gl_FragColor=vec4(vec3(0.66,0.68,0.90),exp(-dot(q,q)*18.0)*vA); }`
});
dustMat.uniforms.uWarp=WARP;
const dust=new THREE.Points(dustGeo,dustMat); dust.frustumCulled=false; dust.renderOrder=2; scene.add(dust);

/* ───────── sounds to find ───────── */
const orbs=ORDER.map(id=>({id,el:EL[id],base:new THREE.Vector3(),pos:new THREE.Vector3(),state:'hidden',glow:0,tState:0,litAt:-99,pulse:-99,near:false}));
const EYE=new THREE.Vector3(0,0,14), TANV=0.60086;
const PANEL=[{n:12,r:56,w:1.18},{n:12,r:56,w:1.18},{n:12,r:56,w:1.18},{n:12,r:56,w:1.18},{n:6,r:16,w:3.2}];
const DEP={data:null,w:0};
function depthPx(L,u,v){
  if(!DEP.data) return 0.5;
  const k=(L*23)%LOOPF, col=k%COLS, row=(k/COLS)|0;
  const x=Math.min(255,Math.max(0,(u*256)|0))+col*256, y=Math.min(143,Math.max(0,((1-v)*144)|0))+row*144;
  return DEP.data[(y*DEP.w+x)*4]/255;
}
function unproject(L,u,v,frac,out){
  const P=PANEL[L], d=(P.n+depthPx(L,u,v)*P.r)*frac;
  let x=(u*2-1)*TANV*1.7778*P.w, y=(v*2-1)*TANV*P.w, z=-1; const nl=d/Math.hypot(x,y,z); x*=nl; y*=nl; z*=nl;   // same sphere as the shader
  if(L===1) [x,z]=[-z,x]; else if(L===2){ x=-x; z=-z; } else if(L===3) [x,z]=[z,-x]; else if(L===4) [y,z]=[z,-y];
  return out.set(x,y,z).add(EYE);
}
/* the sounds hide inside the reef: at, or just behind, the surface you see */
const SPH=new THREE.Vector3(0,-4,-12);   // the sea is a sphere round here (shell ≈ 40–60 out)
function inSphere(rMin,rMax,yMin,yMax,out){ for(let k=0;k<200;k++){ const u=R()*2-1, a=R()*TAU, s=Math.sqrt(1-u*u), r=rMin+R()*(rMax-rMin);
    out.set(SPH.x+Math.cos(a)*s*r, SPH.y+u*r*0.72, SPH.z+Math.sin(a)*s*r); if(out.y>=yMin&&out.y<=yMax) return out; } return out; }
function placeOrbs(){
  const placed=[]; let ring5=0; const ringA=R()*TAU;
  for(const o of orbs){
    o.state='hidden'; o.glow=0; o.litAt=-99; o.pulse=-99; o.spW=undefined; o.nextCall=0; o.near=false; o.looked=false;
    const b=new THREE.Vector3(); let tries=0;
    if(o.el.hidden){                                           // the EYE: far off and low
      do{ inSphere(40,56,-30,-10,b); tries++; } while(tries<600 && (b.distanceTo(EYE)<38 || placed.some(q=>q.distanceTo(b)<20)));
    } else if(o.id==='soul'){                                   // the light behind the eyes waits up in the open water
      do{ inSphere(26,50,14,28,b); tries++; } while(tries<400 && (b.distanceTo(EYE)<38 || placed.some(q=>q.distanceTo(b)<26)));
    } else {                                                    // the five others: one to each fifth of the circle round you, so they surround you
      const sl=ring5++, a0=ringA+sl*TAU/5;
      do{ const a=a0+(R()-.5)*(0.7+tries/500), r=32+R()*22; b.set(SPH.x+Math.cos(a)*r, -16+R()*34, SPH.z+Math.sin(a)*r); tries++; }   // the slot nearest the start slides round until it is far enough
      while(tries<3000 && (b.distanceTo(EYE)<40 || placed.some(q=>q.distanceTo(b)<26)));
    }
    o.base.copy(b); o.pos.copy(b); placed.push(b.clone());
  }
}
placeOrbs();
const NO=orbs.length;
const oPos=new Float32Array(NO*3), oA=new Float32Array(NO), oC=new Float32Array(NO*3);
orbs.forEach((o,i)=>{ oC[i*3]=o.el.c[0]; oC[i*3+1]=o.el.c[1]; oC[i*3+2]=o.el.c[2]; });
const orbGeo=new THREE.BufferGeometry();
orbGeo.setAttribute('position',new THREE.BufferAttribute(oPos,3));
orbGeo.setAttribute('aA',new THREE.BufferAttribute(oA,1));
orbGeo.setAttribute('aC',new THREE.BufferAttribute(oC,3));
const orbMat=new THREE.ShaderMaterial({
  transparent:true,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{uPix:{value:1},uFade:{value:0}},
  vertexShader:`${GLSL_WARP}attribute float aA; attribute vec3 aC; uniform float uPix,uFade; varying float vA; varying vec3 vC;
    void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=warpP(projectionMatrix*mv);
      gl_PointSize=clamp((22.0+aA*50.0)*uPix*(12.0/max(-mv.z,0.3)),3.0,220.0); vA=aA*uFade; vC=aC; }`,
  fragmentShader:`varying float vA; varying vec3 vC; void main(){ vec2 q=gl_PointCoord-0.5; float d=dot(q,q);
    float halo=exp(-d*10.0)*0.45, core=exp(-d*90.0)*0.6;
    gl_FragColor=vec4(mix(vC,vec3(1.0),core),(core+halo)*vA*0.7); }`
});
const orbPts=new THREE.Points(orbGeo,orbMat); orbPts.frustumCulled=false; orbPts.renderOrder=3; scene.add(orbPts);
/* each sound carries its sign, the same one it has on the surface */
const signs=orbs.map(o=>{
  const cv=document.createElement('canvas'); cv.width=cv.height=256;
  const tex=new THREE.CanvasTexture(cv); tex.minFilter=THREE.LinearFilter;
  const mat=new THREE.SpriteMaterial({map:tex,color:new THREE.Color(...o.el.c).lerp(new THREE.Color(1,1,1),0.55),blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,depthTest:true,opacity:0});
  const sp=new THREE.Sprite(mat); sp.renderOrder=4; scene.add(sp);
  return {cv,tex,mat,sp};
});
function paintSign(i){ const s=signs[i], g=s.cv.getContext('2d'); g.clearRect(0,0,256,256); g.save(); g.translate(128,128);
  if(!SBG.SYM[orbs[i].id]){ g.filter='blur(6px)'; SBG.paint(g,orbs[i].id,0.3,92); g.filter='none'; }
  SBG.paint(g,orbs[i].id,0.3,92); g.restore(); s.tex.needsUpdate=true; }
orbs.forEach((o,i)=>paintSign(i));
SBG.onSym(id=>{ const i=ORDER.indexOf(id); if(i>=0) paintSign(i); });
const UP4=new THREE.Vector3(0,4,0);
const slotPos=id=>new THREE.Vector3(S.x+EL[id].at[0],S.y+EL[id].at[1],S.z+EL[id].at[2]);


/* ───────── THE DEEP: floating beings + the dolphin ───────── */
const arcGroup=new THREE.Group(); arcGroup.visible=false; scene.add(arcGroup);
const AGX=small?32:44, AGY=small?20:26, ANL=4, ANP=AGX*AGY*ANL;
const arcGeo=new THREE.BufferGeometry();
{ const u=new Float32Array(ANP*2), r=new Float32Array(ANP), l=new Float32Array(ANP);
  for(let k=0,i=0;k<ANL;k++) for(let y=0;y<AGY;y++) for(let x=0;x<AGX;x++,i++){ u[i*2]=(x+R())/AGX; u[i*2+1]=(y+R())/AGY; r[i]=R(); l[i]=k; }
  arcGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(ANP*3),3));
  arcGeo.setAttribute('aUv',new THREE.BufferAttribute(u,2)); arcGeo.setAttribute('aRand',new THREE.BufferAttribute(r,1)); arcGeo.setAttribute('aLayer',new THREE.BufferAttribute(l,1)); }
const arcBase=new THREE.ShaderMaterial({
  transparent:true,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:Object.assign({uAtlas:{value:null},uTime:{value:0},uPix:{value:1},uFade:{value:1},uNear:{value:0},uPhase:{value:0},
    uColor:{value:0},uGlow:{value:0},uDolL:{value:new THREE.Vector3()},uTint:{value:new THREE.Vector3(1,1,1)},uPingO:{value:new THREE.Vector3()},uPingT:{value:-99},uMine:{value:0},uFiber:{value:0}},sculptUniforms()),
  vertexShader:GLSL_COMMON+GLSL_SCULPT+`${GLSL_WARP}
    attribute vec2 aUv; attribute float aRand; attribute float aLayer;
    uniform float uTime,uPix,uFade,uNear,uPhase,uColor,uGlow,uPingT,uMine,uFiber; uniform vec3 uDolL,uTint,uPingO;
    varying vec3 vCol; varying float vA;
    void main(){
      float t=uTime+uPhase;
      vec2 a=aUv; a.y=mix(fract(a.y+t*0.012*(0.4+aRand)),a.y,uFiber);   // grains drift along the form; fibres hold it
      float keep; vec3 cs;
      vec3 p=sculpt(a,aLayer/3.0,pick4(aLayer),t,keep,cs);
      p*=1.0+0.04*sin(t*0.7);
      p+=vec3(sin(t*0.6+aRand*20.0),cos(t*0.5+aRand*13.0),sin(t*0.7+aRand*7.0))*0.14;
      p+=vec3(sin(uTime*37.0+aRand*50.0),cos(uTime*41.0+aRand*31.0),sin(uTime*29.0+aRand*17.0))*0.09*uNear*(1.0-uFiber);
      p+=vec3(sin(a.y*8.0+t*0.9+aRand*6.0),sin(a.y*5.0-t*0.6+aRand*3.0)*0.4,cos(a.y*7.0-t*0.8+aRand*4.0))*0.35*uFiber*(0.4+a.y);   // fibres sway like weed in a current, more toward their ends
      if(uFiber<0.5&&aRand>0.86){ float k=fract(uTime*0.35+aRand*9.0); p=mix(p,uDolL,k*uNear*0.95); }
      float ls=lumOf(cs);
      vec3 ink=mix(vec3(0.52,0.56,0.86),vec3(0.94,0.95,1.0),smoothstep(0.35,0.9,ls));
      vec3 col=mix(ink,ink*uTint*1.3,0.6);
      col=mix(col,mix(vec3(ls),cs,1.8)*1.5,uColor*0.8);
      vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=warpP(projectionMatrix*mv);
      float dz=max(-mv.z,0.3);
      gl_PointSize=clamp((2.3+aRand*2.0)*uPix*(12.0/dz),1.2,24.0);
      /* the dolphin's echo: a shell runs out from it; where it has passed the being wakes, then sleeps again */
      vec3 wp=(modelMatrix*vec4(p,1.0)).xyz; float pd=length(wp-uPingO), pt=uTime-uPingT, band=pd-pt*34.0;
      float shell=uPingT<0.0?0.0:exp(-band*band*0.08)*exp(-pt*0.25), seen=uPingT<0.0?0.0:smoothstep(2.0,-2.0,band)*exp(-max(0.0,pt-pd/34.0)*0.22);
      vA=keep*(0.35+ls*0.8)*(mix(0.0,0.5,uMine)+0.9*seen+1.6*shell+uGlow+uNear*0.6*max(uMine,seen))*uFade*exp(-max(0.0,dz-24.0)*0.006);   // others stay dark until your echo finds them
      vA*=mix(1.0,0.22+1.5*pow(0.5+0.5*sin(a.y*14.0-uTime*1.3+aRand*6.283),6.0),uFiber);   // light travels along each fibre
      vCol=mix(col,mix(col,vec3(0.96,0.97,1.0),0.35),uFiber);
    }`,
  fragmentShader:`varying vec3 vCol; varying float vA; void main(){ vec2 q=gl_PointCoord-0.5; float d=dot(q,q);
    float n=fract(sin(dot(floor(gl_FragCoord.xy*0.8),vec2(12.9898,78.233)))*43758.5453); if(n>0.35+0.65*exp(-d*9.0)) discard;   // sprayed: a soft disc broken into grain
    gl_FragColor=vec4(vCol,(exp(-d*14.0)+exp(-d*5.0)*0.35)*vA*1.3); }`
});

/* the fibres: a few dozen strands per layer, each one line along the form (aUv.y), drawn with the being's own uniforms */
const FBN=small?14:26, FBS=36, fibGeoA=new THREE.BufferGeometry();
{ const n=ANL*FBN*FBS*2, uv=new Float32Array(n*2), rr=new Float32Array(n), ll=new Float32Array(n); let k=0;
  for(let L=0;L<ANL;L++) for(let f=0;f<FBN;f++){ const x=(f+0.5+(R()-0.5)*0.6)/FBN, r=R();
    for(let s=0;s<FBS;s++) for(const e of [0,1]){ uv[k*2]=x; uv[k*2+1]=(s+e)/FBS; rr[k]=r; ll[k]=L; k++; } }
  fibGeoA.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3)); fibGeoA.setAttribute('aUv',new THREE.BufferAttribute(uv,2));
  fibGeoA.setAttribute('aRand',new THREE.BufferAttribute(rr,1)); fibGeoA.setAttribute('aLayer',new THREE.BufferAttribute(ll,1)); }
const fibFrag=`varying vec3 vCol; varying float vA; void main(){ gl_FragColor=vec4(vCol,vA*0.55); }`;
function fibresFor(mat){ const m=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:Object.assign({},mat.uniforms,{uFiber:{value:1}}),vertexShader:arcBase.vertexShader,fragmentShader:fibFrag});
  const l=new THREE.LineSegments(fibGeoA,m); l.frustumCulled=false; l.renderOrder=3; return l; }
const dolGeo=new THREE.BufferGeometry();
{ const pts=[], ts=[]; const W=t=>t<0.12?0.10+0.30*(t/0.12):t<0.78?0.40+0.22*Math.sin((t-0.12)/0.66*Math.PI):0.40*(1-(t-0.78)/0.22)+0.05; const L=3.2;
  const push=(x,y,z,t)=>{pts.push(x,y,z);ts.push(t);};
  let n=0; while(n<(small?1800:3000)){ const t=R(), w=W(t); if(R()>w/0.62) continue; const th=R()*TAU; push(Math.cos(th)*w*0.85,Math.sin(th)*w,-L/2+t*L,t); n++; }
  const tri=(a,b,c,m,t)=>{ for(let i=0;i<m;i++){ let u=R(),v=R(); if(u+v>1){u=1-u;v=1-v;} push(a[0]+(b[0]-a[0])*u+(c[0]-a[0])*v,a[1]+(b[1]-a[1])*u+(c[1]-a[1])*v,a[2]+(b[2]-a[2])*u+(c[2]-a[2])*v,t); } };
  tri([0,0.55,-0.25],[0,0.55,0.25],[0,1.1,0.55],260,0.45);
  tri([0,0,1.55],[0.8,0,1.95],[0.1,0,1.7],200,1); tri([0,0,1.55],[-0.8,0,1.95],[-0.1,0,1.7],200,1);
  tri([0.4,-0.2,-0.5],[0.4,-0.2,-0.2],[0.9,-0.45,0.1],120,0.3); tri([-0.4,-0.2,-0.5],[-0.4,-0.2,-0.2],[-0.9,-0.45,0.1],120,0.3);
  dolGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pts),3));
  dolGeo.setAttribute('aT',new THREE.BufferAttribute(new Float32Array(ts),1)); }
const dolMat=new THREE.ShaderMaterial({
  transparent:true,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{uTime:{value:0},uPix:{value:1},uFade:{value:0},uSwim:{value:0.4}},
  vertexShader:`${GLSL_WARP}attribute float aT; uniform float uTime,uPix,uFade,uSwim; varying float vA; varying float vT;
    void main(){ vec3 p=position;
      float bend=sin(uTime*5.0-aT*4.0)*0.42*pow(aT,2.2)*uSwim; p.y+=bend;
      vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=warpP(projectionMatrix*mv);
      float carve=0.55+0.45*step(0.5,fract(aT*14.0+sin(atan(position.y,position.x)*3.0)*0.15));
      gl_PointSize=clamp(1.9*uPix*(12.0/max(-mv.z,0.3)),1.0,10.0);
      vA=uFade*carve; vT=aT; }`,
  fragmentShader:`varying float vA; varying float vT; void main(){ vec2 q=gl_PointCoord-0.5;
    gl_FragColor=vec4(mix(vec3(0.78,0.82,1.0),vec3(0.93,0.88,0.80),vT),exp(-dot(q,q)*14.0)*vA*0.55); }`
});
dolMat.uniforms.uWarp=WARP;
const dolPts=new THREE.Points(dolGeo,dolMat); dolPts.frustumCulled=false; dolPts.renderOrder=4;

/* in THE DEEP you swim as the same dolphin the wake showed: black body, rim light, normal + engrave maps.
   The grain dolphin above stays as a fallback until the mesh has loaded. */
const dolphin=new THREE.Group(); dolphin.visible=false; scene.add(dolphin); dolphin.add(dolPts);
const dolMeshMat=new THREE.ShaderMaterial({
  extensions:{derivatives:true},
  uniforms:{uNormal:{value:null},uEngrave:{value:null},uTime:{value:0},uSwim:{value:0.4},uFade:{value:0}},
  vertexShader:`${GLSL_WARP}uniform float uTime,uSwim; varying vec3 vN; varying vec3 vView; varying vec2 vUv; varying float vZ;
    void main(){ vec3 p=position; float t=smoothstep(2.0,-9.2,p.z);
      p.y+=sin(uTime*3.2-p.z*0.42)*uSwim*1.1*t*t;
      vZ=p.z; vUv=uv; vec4 mv=modelViewMatrix*vec4(p,1.0); vView=mv.xyz; vN=normalize(normalMatrix*normal); gl_Position=warpP(projectionMatrix*mv); }`,
  fragmentShader:`uniform sampler2D uNormal,uEngrave; uniform float uTime,uFade; varying vec3 vN; varying vec3 vView; varying vec2 vUv; varying float vZ;
    vec3 perturb(vec3 eye,vec3 n,vec3 m){ vec3 q0=dFdx(eye), q1=dFdy(eye); vec2 st0=dFdx(vUv), st1=dFdy(vUv);
      vec3 q1p=cross(q1,n), q0p=cross(n,q0); vec3 T=q1p*st0.x+q0p*st1.x, B=q1p*st0.y+q0p*st1.y;
      float det=max(dot(T,T),dot(B,B)), s=det==0.0?0.0:inversesqrt(det); return normalize(T*(m.x*s)+B*(m.y*s)+n*m.z); }
    void main(){
      vec3 m=texture2D(uNormal,vUv).xyz*2.0-1.0; m.xy*=1.6;
      vec3 n=normalize(vN); if(!gl_FrontFacing) n=-n;
      vec3 N=perturb(vView,n,m), V=normalize(-vView);
      float fres=pow(1.0-max(dot(N,V),0.0),6.0);
      vec3 L=normalize(vec3(0.3,0.9,0.5)); float spec=pow(max(dot(reflect(-L,N),V),0.0),36.0);
      float eng=smoothstep(0.62,0.95,texture2D(uEngrave,vUv).r);
      float sweep=exp(-pow((vZ-mod(uTime*3.0,26.0)+13.0)*0.45,2.0));            // a band of light keeps passing along the body
      vec3 col=vec3(0.012,0.014,0.03)+vec3(0.55,0.66,0.98)*(fres*2.1+0.06)+vec3(0.86,0.88,1.0)*spec*0.3+vec3(0.62,0.70,0.98)*eng*(0.06+sweep*0.7)*(0.35+fres);
      float gr=fract(sin(dot(floor(gl_FragCoord.xy*0.7)+floor(uTime*12.0),vec2(12.9898,78.233)))*43758.5453);   // the same grain as the beings and the music
      col*=0.72+0.56*gr; col+=vec3(0.55,0.66,0.98)*fres*step(0.82,gr)*0.6;
      gl_FragColor=vec4(col*uFade,1.0);
    }`
});
dolMeshMat.uniforms.uWarp=WARP;
(async()=>{
  try{
    const rj=await fetch('assets/dolphin.json'), rb=await fetch('assets/dolphin.bin'); if(!rj.ok||!rb.ok) throw new Error('dolphin files');
    const meta=await rj.json(), bin=await rb.arrayBuffer(), tl=new THREE.TextureLoader();
    dolMeshMat.uniforms.uNormal.value=tl.load('assets/dolphin_normal.jpg'); dolMeshMat.uniforms.uEngrave.value=tl.load('assets/dolphin_engrave.jpg');
    const get=(mesh,kind)=>{ const m=meta.find(x=>x.mesh===mesh&&x.kind===kind); return kind==='idx'?new Uint32Array(bin,m.offset,m.count):new Float32Array(bin,m.offset,m.count); };
    const body=new THREE.Group();
    for(const name of ['body','eyeL','eyeR']){
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.BufferAttribute(get(name,'pos'),3)); g.setAttribute('normal',new THREE.BufferAttribute(get(name,'nrm'),3));
      g.setAttribute('uv',new THREE.BufferAttribute(get(name,'uv'),2)); g.setIndex(new THREE.BufferAttribute(get(name,'idx'),1));
      const mesh=new THREE.Mesh(g,name==='body'?dolMeshMat:new THREE.MeshBasicMaterial({color:0xd6dcfa})); mesh.frustumCulled=false; body.add(mesh);
    }
    const box=new THREE.Box3().setFromObject(body), size=box.getSize(new THREE.Vector3()), ctr=box.getCenter(new THREE.Vector3());
    body.children.forEach(m=>m.position.sub(ctr));
    body.scale.setScalar(3.4/Math.max(size.z,0.001)); body.rotation.y=Math.PI;   // same length as the grain dolphin; the model faces +z, we swim toward -z
    dolphin.add(body); dolPts.visible=false;
  }catch(e){ console.warn('THE DEEP: dolphin mesh not loaded, keeping the grain dolphin',e); }
})();


/* ───────── audio: one piece in A minor, 80 BPM, 16 bars — every layer loops in lock-step ───────── */
const BPM=80, BEAT=60/BPM, BAR=BEAT*4, LOOP=BAR*16, LOOP_IN=1.0;
const STEM_IDS=['pad','melody','heart','voice','bone','memory','soul','dream','sense'];
const pick = arr => arr[(R()*arr.length)|0];
const A = { ctx:null, buf:{}, ready:false, bus:{}, spG:{}, spP:{}, base:{pad:0,melody:0}, set:[], scale:1 };
const RAW = {};
const audioFetch = Promise.all(STEM_IDS.concat(ORDER.map(id=>'p_'+id)).map(n=>
  fetch('audio/'+n+'.mp3').then(r=>{ if(!r.ok) throw new Error(n); return r.arrayBuffer(); }).then(b=>{ RAW[n]=b; }).catch(()=>{})));

function makeNoise(C,sec){ const b=C.createBuffer(1,C.sampleRate*sec,C.sampleRate), d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=R()*2-1; return b; }
function makeIR(C,dur,dec){ const L=C.sampleRate*dur|0, b=C.createBuffer(2,L,C.sampleRate);
  for(let c=0;c<2;c++){ const d=b.getChannelData(c); for(let i=0;i<L;i++) d[i]=(R()*2-1)*Math.pow(1-i/L,dec); } return b; }
function osc(C,type,f){ const o=C.createOscillator(); o.type=type; o.frequency.value=f; return o; }
function decode(C,ab){ return new Promise(res=>{ try{ const p=C.decodeAudioData(ab.slice(0),res,()=>res(null)); if(p&&p.then) p.then(res,()=>res(null)); }catch(e){ res(null); } }); }
function setPos(pn,p){ if(pn.positionX){ pn.positionX.value=p.x; pn.positionY.value=p.y; pn.positionZ.value=p.z; } else pn.setPosition(p.x,p.y,p.z); }
function ramp(param,v,when,tau){ const C=A.ctx, now=C.currentTime; param.cancelScheduledValues(now); param.setValueAtTime(param.value,now); param.setTargetAtTime(v,Math.max(now,when),tau); }

let decoding=null;
function audioInit(){
  if (A.ctx){ if(A.ctx.state==='suspended') A.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
  const C = new AC(); A.ctx = C;
  const master=C.createGain(); master.gain.value=0.95;
  const comp=C.createDynamicsCompressor(); comp.threshold.value=-14; comp.knee.value=10; comp.ratio.value=4; comp.attack.value=0.01; comp.release.value=0.3;
  master.connect(comp); comp.connect(C.destination);
  const an=C.createAnalyser(); an.fftSize=512; an.smoothingTimeConstant=0.8; comp.connect(an);
  A.an=an; A.fft=new Uint8Array(an.frequencyBinCount);
  const conv=C.createConvolver(); conv.buffer=makeIR(C,4.2,2.4); const rv=C.createGain(); rv.gain.value=0.5; conv.connect(rv); rv.connect(master);
  const dly=C.createDelay(2); dly.delayTime.value=BEAT*0.75; const fb=C.createGain(); fb.gain.value=0.38;
  const dlp=C.createBiquadFilter(); dlp.type='lowpass'; dlp.frequency.value=2400;
  dly.connect(dlp); dlp.connect(fb); fb.connect(dly);
  const dout=C.createGain(); dout.gain.value=0.45; dlp.connect(dout); dout.connect(master); dout.connect(conv);
  A.master=master; A.rev=conv; A.dly=dly; A.noise=makeNoise(C,3);
  const music=C.createGain(); music.gain.value=1.5; music.connect(master); A.music=music;
  const og=C.createGain(); og.gain.value=0; og.connect(master); A.ocean=og;
  { const s=C.createBufferSource(); s.buffer=A.noise; s.loop=true; const lp=C.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=420;
    const g=C.createGain(); g.gain.value=0.07; const l=osc(C,'sine',0.07), lg=C.createGain(); lg.gain.value=0.04; l.connect(lg); lg.connect(g.gain);
    s.connect(lp); lp.connect(g); g.connect(og); s.start(); l.start();
    const s2=C.createBufferSource(); s2.buffer=A.noise; s2.loop=true; const bp=C.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=3200; bp.Q.value=1.4;
    const g2=C.createGain(); g2.gain.value=0.008; s2.connect(bp); bp.connect(g2); g2.connect(og); s2.start(0,1.3); }
  for(const id of STEM_IDS){ const g=C.createGain(); g.gain.value=0; A.bus[id]=g; const Ro=ROLE[id]; let o=g;   // each layer its own colour (filter) and place (pan), so you can tell them apart
    if(Ro.hp){ const f=C.createBiquadFilter(); f.type='highpass'; f.frequency.value=Ro.hp; o.connect(f); o=f; }
    if(Ro.lp){ const f=C.createBiquadFilter(); f.type='lowpass'; f.frequency.value=Ro.lp; o.connect(f); o=f; }
    if(Ro.gain){ const f=C.createGain(); f.gain.value=Ro.gain; o.connect(f); o=f; }
    if(C.createStereoPanner){ const pn=C.createStereoPanner(); pn.pan.value=Ro.pan||0; o.connect(pn); o=pn;
      if(Ro.auto){ const l=osc(C,'sine',Ro.auto), lg=C.createGain(); lg.gain.value=.55; l.connect(lg); lg.connect(pn.pan); l.start(); } }   // slowly circling
    o.connect(music);
    const rs=C.createGain(); rs.gain.value=Ro.rev; o.connect(rs); rs.connect(conv);   // one shared room for every layer, each as deep in it as its role wants
    if(Ro.dly){ const ds=C.createGain(); ds.gain.value=Ro.dly; o.connect(ds); ds.connect(dly); } }
  A.anB={}; for(const id of STEM_IDS){ const an=C.createAnalyser(); an.fftSize=512; A.bus[id].connect(an); A.anB[id]={an,buf:new Float32Array(512)}; }   // each stem measured as it plays (THE DEEP draws them)
  /* each hidden sound sings from where it hides: full inside 20, a trace out to 45 */
  for(const id of ORDER){
    const g=C.createGain(); g.gain.value=0; const pn=C.createPanner(); pn.panningModel='HRTF'; pn.distanceModel='exponential';
    pn.refDistance=1; pn.rolloffFactor=0;   // the panner only places it; nearness is spD below
    const lp=C.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=6000;
    const dg=C.createGain(); dg.gain.value=0; g.connect(lp); lp.connect(dg); dg.connect(pn); pn.connect(music);
    A.spG[id]=g; A.spP[id]=pn; A['spL_'+id]=lp; A['spD_'+id]=dg;
  }
  decoding=audioFetch.then(()=>Promise.all(Object.keys(RAW).map(n=>decode(C,RAW[n]).then(b=>{ if(b) A.buf[n]=b; })))).then(startLoops);
}
function startLoops(){
  const C=A.ctx, T0=C.currentTime+0.2;
  for(const id of STEM_IDS){ const b=A.buf[id]; if(!b) continue;
    const s=C.createBufferSource(); s.buffer=b; s.loop=true;
    const inn=Math.min(LOOP_IN,Math.max(0,b.duration-LOOP-0.01)); s.loopStart=inn; s.loopEnd=Math.min(b.duration,inn+LOOP);
    s.connect(A.bus[id]); if(A.spG[id]) s.connect(A.spG[id]); s.start(T0,inn); }
  A.T0=T0; A.ready=true;
  applyBase(0); applyMix(0);
}
function nextGrid(unit){ const C=A.ctx; if(!C||!A.ready) return C?C.currentTime:0; const ph=(C.currentTime+0.05-A.T0)/unit; return A.T0+Math.ceil(ph)*unit; }
const nextBar=()=>nextGrid(BAR), nextBeat=()=>nextGrid(BEAT);

/* each sound found is its own instrument in the piece, over the ambient pad that never stops:
   HEARTBEAT the kick, a low pulse · BONE the percussion, the rhythm · VOICE the voice, and with it the melody line ·
   MEMORY a repeating figure that echoes (dotted-8th delay) · SOUL a long held line · DREAM a shimmer far back in the room ·
   the EYE a quick bright arpeggio. rev / dly: how far into the shared room and the echo each one sits */
const ROLE={pad:{rev:.2,lp:5200}, melody:{rev:.25,pan:0},
  heart:{rev:.03,lp:170,gain:1.5},                 // only the body of it: a deep pulse you feel
  bone:{rev:.1,hp:260,pan:-.35},                   // the knock and click, left of centre
  voice:{rev:.34,hp:180,pan:.15},
  memory:{rev:.2,dly:.5,hp:500,pan:.45,auto:.05},  // a figure that answers itself, drifting right
  soul:{rev:.26,lp:3800,pan:-.12},                 // warm, held, near the middle
  dream:{rev:.62,hp:1400,pan:0,auto:.03},          // high and far back, wide
  sense:{rev:.3,dly:.18,hp:1800,auto:.11}};        // bright, quick, circling
const LV={pad:1, melody:0.8, heart:1, voice:1, bone:1, memory:1, soul:1, dream:1.1, sense:1.1};
function applyBase(when){ if(!A.ready) return; ramp(A.bus.pad.gain,A.base.pad*LV.pad,when,1.4); }   // the base is the ambient pad alone; the melody belongs to VOICE (applyMix)
/* layers come in as an arrangement would bring them: on the next chord change (every 2 bars), swelling over about two bars; and
   as they pile up each sits a little lower, so the whole stays one balanced piece rather than getting louder */
function applyMix(when){ if(!A.ready) return; const n=A.set.length, sit=n>1?1/Math.sqrt(1+.35*(n-1)):1, cue=nextGrid(BAR*2);
  const fresh=ORDER.filter(id=>A.set.includes(id)&&A.bus[id].gain.value<=.02&&A.scale>=.5), C=A.ctx;
  for(const id of ORDER){ const on=A.set.includes(id), was=A.bus[id].gain.value>.02, v=on?LV[id]*A.scale*sit:0;
    ramp(A.bus[id].gain, fresh.length&&on?v*(fresh.includes(id)?1.45:.55):v, on&&!was?cue:when, on?(was?1.2:2.4):1.0);   // the new one steps forward; the others make room
    if(fresh.length&&on) A.bus[id].gain.setTargetAtTime(v,cue+BAR*4,2.5); }   // after four bars it takes its place among them
  const mOn=A.set.includes('voice')&&A.scale>=.5, mWas=A.bus.melody.gain.value>.02;   // the melody line comes with the voice
  ramp(A.bus.melody.gain, mOn?LV.melody*A.scale*sit:0, mOn&&!mWas?cue:when, mOn?(mWas?1.2:2.4):1.0); }
function setBase(pad){ A.base.pad=pad; if(A.ctx) applyBase(nextBar()); }
function setMix(set,scale=1,name=''){ A.set=set.slice(); A.scale=scale; if(A.ctx) applyMix(nextBar()); }   // (the phrase echoes below are off: they made the layers sound like a set, not one piece)
/* ───────── each being's own song: no new instruments — every sound you find comes back as echoes of its own recorded phrase,
   drifting over the stems on the bar grid: as it is, an octave down and slowed, or reversed so it swells in, deep in the reverb.
   The order you found them in decides the song: the first leads (more often, louder, nearer), the later ones answer more rarely
   and further off; where each falls comes from your name and that order, so no two beings sing quite the same ───────── */
const STEP=BEAT/4;
function hashS(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function rngOf(seed){ let a=seed>>>0; return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const SONG={key:'', parts:[], plan:[], lvl:0, step:-1, bus:null};
const PH_LEN=128;   // 8 bars, then it comes round again
function songPlan(parts,name){ const plan=[], used=new Set();   // each bar is left to one sound: they take turns, never pile up
  parts.forEach((id,i)=>{ const r=rngOf(hashS(name+'|'+parts.slice(0,i+1).join('>'))), ev={};   // a part hangs on the name and what came before it: it stays put as later sounds join
    const hits=[3,2,2,1][i]||1, lv=[.5,.4,.34,.3][i]||.3;
    for(let h=0;h<hits;h++){ let bar; do{ bar=Math.floor(r()*8); } while(used.has(bar)&&used.size<8); used.add(bar);
      const kind=r(), s=bar*16+[0,0,4,8,12,6][Math.floor(r()*6)];   // mostly on the bar, now and then on a beat
      ev[s]={id, rate:kind<.45?1:.5, rev:kind>.72, pan:(r()-.5)*(i?1.6:.8), v:lv}; }   // as it is / an octave down, slowed / reversed, swelling in
    plan.push({id,ev}); });
  return plan; }
function songBus(){ if(SONG.bus||!A.ctx) return SONG.bus; const C=A.ctx;
  const bus=C.createGain(); bus.gain.value=0; const lp=C.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=2600; bus.connect(lp);   // softened, as if heard through water
  const dry=C.createGain(); dry.gain.value=.45; lp.connect(dry); dry.connect(A.music);
  const rv=C.createGain(); rv.gain.value=1; lp.connect(rv); rv.connect(A.rev);
  const dl=C.createGain(); dl.gain.value=.5; lp.connect(dl); dl.connect(A.dly);
  SONG.bus=bus; return bus; }
function revBuf(id){ const k='r_'+id; if(A.buf[k]) return A.buf[k]; const b=A.buf['p_'+id]; if(!b) return null;
  const C=A.ctx, o=C.createBuffer(b.numberOfChannels,b.length,b.sampleRate);
  for(let c=0;c<b.numberOfChannels;c++){ const s=b.getChannelData(c), d=o.getChannelData(c); for(let i=0,n=s.length;i<n;i++) d[i]=s[n-1-i]; }
  return A.buf[k]=o; }
function echoPhrase(t,e){ const C=A.ctx, b=e.rev?revBuf(e.id):A.buf['p_'+e.id]; if(!b) return;
  const s=C.createBufferSource(); s.buffer=b; s.playbackRate.value=e.rate;
  const g=C.createGain(), len=b.duration/e.rate; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(e.v,t+(e.rev?len*.6:.08)); g.gain.setTargetAtTime(0,t+len*.85,.4);   // reversed ones swell in slowly
  const pn=C.createStereoPanner(); pn.pan.value=e.pan; s.connect(g); g.connect(pn); pn.connect(SONG.bus); s.start(t); s.stop(t+len+.1); }
/* the song follows what is heard: the parts (in the order they were found) and the name; lvl 0 lets it fall silent */
function songTo(parts,name,lvl){ if(!A.ctx) return; songBus(); const key=parts.join('>')+'|'+name;
  if(key!==SONG.key){ SONG.key=key; SONG.parts=parts.slice(); SONG.plan=songPlan(parts,name); }
  SONG.lvl=parts.length?lvl:0; ramp(SONG.bus.gain,SONG.lvl,A.ready?nextBar():A.ctx.currentTime,SONG.lvl?0.8:1.5); }
function songTick(){ if(!A.ready||!SONG.bus) return; const now=A.ctx.currentTime;
  if(SONG.step<0||A.T0+SONG.step*STEP<now-0.5) SONG.step=Math.ceil((now+0.05-A.T0)/STEP);   // (re)join the grid after a stall
  while(A.T0+SONG.step*STEP<now+0.2){ const g=SONG.step++; if(SONG.lvl<=0) continue;
    for(const p of SONG.plan){ const e=p.ev[g%PH_LEN]; if(e) echoPhrase(A.T0+g*STEP,e); } } }

function oceanTo(v,tau=2){ if(A.ctx) ramp(A.ocean.gain,v,A.ctx.currentTime,tau); }

function playPhrase(id,when,dest,v=1,dur=0){
  const C=A.ctx, b=A.buf['p_'+id]; if(!C||!b) return false; const t=Math.max(C.currentTime,when);
  const s=C.createBufferSource(); s.buffer=b; const g=C.createGain(); g.gain.value=v; s.connect(g); g.connect(dest); s.start(t);
  if(dur){ g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+.25); g.gain.setTargetAtTime(0,t+dur*.45,dur*.22); s.stop(t+dur+.4); }   // a glimpse of it, swelling in and dying away
  return true;
}
function panned(pos,ref=12){
  const C=A.ctx; const pn=C.createPanner(); pn.panningModel='HRTF'; pn.distanceModel='inverse'; pn.refDistance=ref; pn.rolloffFactor=0.75;
  setPos(pn,pos); pn.connect(A.master); return pn;
}
function orbCall(o,v=1){ if(!A.ctx) return; const pn=panned(o.pos), rs=A.ctx.createGain(); rs.gain.value=.6; pn.connect(rs); rs.connect(A.rev); playPhrase(o.id,nextBeat(),pn,v*1.3,1.8); }   // a hidden sound answers with a short ping of its timbre — never its tune, so before anything is found there is no melody

function updateSpatial(){
  if(!A.ready) return; const now=A.ctx.currentTime;
  for(const o of orbs){
    setPos(A.spP[o.id],o.pos);
    const d=o.pos.distanceTo(me.pos);
    const want=(state==='play' && firstEchoT>0 && finaleT<0 && o.state==='hidden') ? (o.el.hidden?0.8:1.0) : 0;
    if(o.spW!==want){ const leaving=o.spW>0&&want===0&&o.state!=='hidden'; o.spW=want; ramp(A.spG[o.id].gain,want,leaving?nextBar():now,leaving?0.5:1.2); }
    /* further away sounds duller */
    A['spL_'+o.id].frequency.setTargetAtTime(d<NEAR?7000:Math.max(500,7000*Math.pow(NEAR/d,2.2)),now,0.3);
    { const nr=o.el.hidden?3:9, fr=o.el.hidden?18:40, x=Math.min(1,Math.max(0,(fr-d)/(fr-nr))); A['spD_'+o.id].gain.setTargetAtTime(x*x,now,0.25); }   // heard only as you come near
  }
}
function allSleep(){
  if(!A.ctx) return; const now=A.ctx.currentTime;
  ORDER.slice().reverse().forEach((id,i)=>ramp(A.bus[id].gain,0,now+i*0.9,0.8));
  ramp(A.bus.melody.gain,0,now+5,1.0); ramp(A.bus.pad.gain,0,now+6.5,1.2); ramp(A.ocean.gain,0,now+6,1.5);
  for(const id of ORDER) ramp(A.spG[id].gain,0,now,0.5);
}
function echoSound(strength, stage){
  const C=A.ctx; if(!C) return; const t=C.currentTime+0.005;
  const n=C.createBufferSource(); n.buffer=A.noise; const hp=C.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=2500;
  const ng=C.createGain(); ng.gain.setValueAtTime(0.4*strength,t); ng.gain.exponentialRampToValueAtTime(0.0001,t+0.02);
  n.connect(hp); hp.connect(ng); ng.connect(A.master); ng.connect(A.dly); n.start(t,R()*2,0.03);
  const f0=[1318.5,1568,1760,2093,2349.3][Math.min(4,stage)], o=osc(C,'sine',f0), og=C.createGain();
  o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(f0*0.25,t+0.26);
  og.gain.setValueAtTime(0.0001,t); og.gain.linearRampToValueAtTime(0.22*strength,t+0.008); og.gain.exponentialRampToValueAtTime(0.0001,t+0.34);
  o.connect(og); og.connect(A.master); og.connect(A.dly); og.connect(A.rev); o.start(t); o.stop(t+0.4);
  const s=osc(C,'sine',88), sg=C.createGain(); s.frequency.setValueAtTime(88,t); s.frequency.exponentialRampToValueAtTime(34,t+0.45);
  sg.gain.setValueAtTime(0.0001,t); sg.gain.linearRampToValueAtTime(0.42*strength,t+0.01); sg.gain.exponentialRampToValueAtTime(0.0001,t+0.61);
  s.connect(sg); sg.connect(A.master); s.start(t); s.stop(t+0.7);
}
function denySound(){ const C=A.ctx; if(!C) return; const t=C.currentTime, o=osc(C,'sine',220), g=C.createGain();
  o.frequency.setValueAtTime(220,t); o.frequency.exponentialRampToValueAtTime(160,t+0.2); g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.08,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+0.3);
  o.connect(g); g.connect(A.master); o.start(t); o.stop(t+0.35); }
function setListener(pos,fw){
  if(!A.ctx) return; const L=A.ctx.listener;
  if(L.positionX){ L.positionX.value=pos.x; L.positionY.value=pos.y; L.positionZ.value=pos.z;
    L.forwardX.value=fw.x; L.forwardY.value=fw.y; L.forwardZ.value=fw.z; L.upX.value=0; L.upY.value=1; L.upZ.value=0; }
  else { L.setPosition(pos.x,pos.y,pos.z); L.setOrientation(fw.x,fw.y,fw.z,0,1,0); }
}

/* ───────── THE DEEP store (shared across everyone who plays) ───────── */
let db=null, entries=[], arcDirty=true, ownId=null, ownLocal=null; const LOCAL_KEY='slipbeneath.thedeep';
const clampN=(v,a,b,d)=>{ v=Number(v); return Number.isFinite(v)?Math.max(a,Math.min(b,v)):d; };
const cleanName=s=>String(s||'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,20);
function clean(id,d){
  const parts=(Array.isArray(d.parts)?d.parts:[]).filter(p=>EL[p]).slice(0,4);
  const arr=(x,n,a,b,def)=>Array.from({length:n},(_,i)=>clampN(Array.isArray(x)?x[i]:undefined,a,b,def[i]));
  return {id, parts, name:cleanName(d.name), createdAt:clampN(d.createdAt,0,9e15,0), lobes:clampN(d.lobes,2,6,3), twist:clampN(d.twist,-0.5,0.5,0), spikes:clampN(d.spikes,0,1,0.3),
    bh:arr(d.bh,4,-8,8,[-5,-1.5,2,5.5]), ba:arr(d.ba,4,0,2.5,[0.6,0.6,0.6,0.6]), frames:arr(d.frames,4,0,LOOPF-1,[0,30,60,90]),
    echoes:clampN(d.echoes,0,9999,0), secs:clampN(d.secs,0,99999,0)};
}
function randomBeing(i){
  const pool=ORDER.filter(x=>x!=='sense'); const parts=[];
  while(parts.length<4){ const p=pick(R()<0.12&&!parts.includes('sense')?['sense']:pool); if(!parts.includes(p)) parts.push(p); }
  return clean('local'+i,{parts,createdAt:i,lobes:2+(R()*5|0),twist:(R()-0.5)*0.6,spikes:R(),bh:[-6+R()*4,-2+R()*3,1+R()*3,4+R()*3],ba:[R()*2,R()*2,R()*2,R()*2],frames:[R()*115,R()*115,R()*115,R()*115]});
}
(async()=>{
  try{ db = (window.claude && window.claude.use) ? await window.claude.use('db') : null; }catch(e){ db=null; }
  if(!db){ // local run: THE DEEP lives in this browser's storage, so it keeps growing through the exhibition
    let saved=[]; try{ saved=JSON.parse(localStorage.getItem(LOCAL_KEY)||'[]'); }catch(e){}
    entries=saved.length?saved.map((d,i)=>clean('l'+i,d)):Array.from({length:14},(_,i)=>randomBeing(i)); arcDirty=true; return; }
  db.collection('archive').orderBy('createdAt','asc').limit(300).onSnapshot(snap=>{
    entries=snap.docs.map(d=>clean(d.id,d.data()||{})); arcDirty=true;
  },()=>{ if(!entries.length){ entries=Array.from({length:14},(_,i)=>randomBeing(i)); arcDirty=true; } });
})();
async function saveBeing(doc){
  ownLocal=clean('mine',doc); ownId=null;
  if(db){ try{ const ref=await db.collection('archive').add(doc); ownId=ref.id; }catch(e){ ownId=null; } }
  else { try{ const all=JSON.parse(localStorage.getItem(LOCAL_KEY)||'[]'); all.push(doc); localStorage.setItem(LOCAL_KEY,JSON.stringify(all.slice(-300)));
    entries=all.map((d,i)=>clean('l'+i,d)); ownId='l'+(all.length-1); }catch(e){} }
  arcDirty=true;
}

/* ───────── swimmer ───────── */
const me={pos:new THREE.Vector3(0,0,14), vel:new THREE.Vector3(), yaw:0, pitch:0};
const fwd=new THREE.Vector3(), right=new THREE.Vector3(), tmp=new THREE.Vector3(), tmp2=new THREE.Vector3(), lastPos=new THREE.Vector3(0,0,14);
const keys=new Set();
function forwardVec(out){ const cp=Math.cos(me.pitch); return out.set(-Math.sin(me.yaw)*cp, Math.sin(me.pitch), -Math.cos(me.yaw)*cp); }

/* ───────── journey → your being ───────── */
const J={echoes:0, ys:[], yaw:0, path:0, start:0, frames:[], set:[], name:''};
function applyBeing(u,b){
  u.uLobes.value=b.lobes; u.uTwist.value=b.twist; u.uSpikes.value=b.spikes;
  u.uBH.value.set(...b.bh); u.uBA.value.set(...b.ba); u.uLF4.value.set(...b.frames);
  const has=id=>b.parts.includes(id)?1:0;
  u.uE1.value.set(has('heart'),has('voice'),has('bone'),has('memory')); u.uE2.value.set(has('soul'),has('dream'),has('sense'),0);
}
function beingFromJourney(){
  const ys=J.ys.slice().sort((a,b)=>a-b); const q=[0,0,0,0], n=[0,0,0,0];
  ys.forEach((y,i)=>{ const k=Math.min(3,Math.floor(i/Math.max(1,ys.length)*4)); q[k]+=y; n[k]++; });
  const bh=q.map((s,k)=>n[k]?s/n[k]:[-5,-1.5,2,5.5][k]).map(y=>Math.max(-8,Math.min(8,(y+12)/26*16-8)));
  const ba=n.map(c=>0.35+1.6*(c/Math.max(1,ys.length)));
  return {parts:J.set.slice(), name:J.name, createdAt:Date.now(), lobes:[2,3,4,5,6][J.echoes%5], twist:Math.max(-1,Math.min(1,J.yaw/(TAU*4)))*0.34,
    spikes:Math.max(0.12,Math.min(1,0.12+J.path/1600)), bh, ba, frames:J.frames.slice(0,4), echoes:J.echoes, secs:Math.round(clock-J.start)};
}

/* ───────── state ───────── */
let state='loading', clock=0, playT=0, sleepT=0, endT=0, finaleT=-1, firstEchoT=-1, arcT=0, lastFind=0, lastInput=0;
let secIdx=0, finaleBeing=null;
let p=0, fade=0, fadeTarget=0.25, bass=0, flash=0, ripIdx=0, base=0, colorV=0, colorT=0;
let holdP=0, hintShown='', sleepV=0, moveHintDone=false, auto=0, partUntil=0, bigUntil=0, saved=false;
let beings=[], nearB=null, nearV=0, mixKey='', replayUntil=0, arcHintDone=false;
let paused=true, pendingStart=false, loaded=false;
const flashTint=new THREE.Vector3(1,1,1);
const ptr={down:false,drag:false,x:0,y:0,sx:0,sy:0,t:0};


/* every instruction carries a Korean line under the English (the sounds' names stay English only) */
const KR={
  'click · send an echo':'클릭해서 에코를 보내세요',
  'nothing within reach · send an echo':'가까이에 아무것도 없습니다 · 에코를 보내 보세요',
  'the eye is open · the sounds show themselves':'눈이 열렸습니다 · 소리들이 모습을 드러냅니다',
  'drag to look around':'드래그해서 둘러보세요',
  'move to look':'움직여서 둘러보기',
  'swim  ·  move to look':'헤엄치기 · 움직여서 둘러보기',
  'turn the ring to swim  ·  roll to look':'링을 돌려 헤엄치기 · 공을 굴려 둘러보기',
  'follow the sound · echo again when it grows loud':'소리를 따라가세요 · 소리가 커지면 다시 에코를 보내세요',
  'sounds grow louder and brighter as you near them':'가까이 갈수록 소리가 더 크고 밝아집니다',
  'the sea is still loading':'바다를 불러오는 중입니다',
  'swim  ·  drag to look':'헤엄치기 · 드래그로 둘러보기',
  'send an echo':'에코 보내기',
  'find four sounds in the dark':'어둠 속에서 소리 네 개를 찾으세요',
  'hold the mouse to sleep':'마우스를 길게 눌러 잠드세요',
  'take the sound':'소리 가져오기',
  'swim closer to a being · then open your palm':'존재 가까이 헤엄쳐 간 뒤 손바닥을 펴세요',
  'hand tracking is not loaded · hold E to listen':'손 인식을 불러오지 못했습니다 · E를 길게 눌러 들어 보세요',
  'echo again · find the next sound':'다시 에코를 보내 다음 소리를 찾으세요',
  'glide toward the loudest answer · echo again':'가장 크게 대답하는 쪽으로 헤엄치세요 · 다시 에코를 보내세요',
};
const krOf=en=>KR[en]||(en.startsWith('space · take ')?'스페이스를 눌러 소리를 가져오세요':en.startsWith('make a fist · take ')?'주먹을 쥐어 소리를 가져오세요'
  :'');
const CAMG=!!(window.SBCam&&SBCam.on);   // cam.html: a step more of guidance, a gesture legend, fist hints
/* ───────── the tutorial: one card at a time, drawn as thin keycaps; each waits until you have done what it asks ───────── */
const tutEl=$('tut'), namedEl=$('named');
const KEY=(x,y,w,l)=>`<rect x="${x}" y="${y}" width="${w}" height="34" rx="6"/><text x="${x+w/2}" y="${y+22}" text-anchor="middle">${l}</text>`;
/* a trackball, drawn thin (the exhibition's mouse): body, two buttons, the ring, the ball — `on` lights the part being taught */
const TBP=on=>`<rect x="2" y="4" width="60" height="36" rx="16"/><path d="M14 6V38M50 6V38"/><path ${on==='btn'?'class="on"':''} d="M5 22Q4 10 14 6V38Q4 34 5 22Z"/>`
  +`<circle ${on==='ring'?'class="on"':''} cx="32" cy="22" r="15"/><circle ${on==='ball'?'class="on"':''} cx="32" cy="22" r="10"/>`;
const TB=on=>`<svg viewBox="0 0 64 44" style="height:clamp(24px,2.3vw,38px)">${TBP(on)}</svg>`;
/* the same trackball inside a hold ring (the long press that puts you to sleep) */
const TBH=on=>`<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="36" class="track"/><circle cx="40" cy="40" r="36" class="hold" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 40 40)"/><g transform="translate(14,25) scale(.81)">${TBP(on)}</g></svg>`;
const TUT={
  swim:{svg:TB('ring'), en:'turn the ring to swim  ·  roll to look'},
  echo:{svg:TB('btn'), en:'send an echo'},
  goal:{svg:`<svg viewBox="0 0 122 22" style="height:clamp(12px,1.1vw,20px)"><circle cx="15" cy="11" r="6"/><circle cx="46" cy="11" r="6"/><circle cx="77" cy="11" r="6"/><circle cx="108" cy="11" r="6"/></svg>`, en:'find four sounds in the dark'},
  deep:{html:`<div class="pair">${TB('btn')}<div class="t"><span class="en">echo<br>find the others</span><span class="kr">에코로 다른 존재 찾기</span></div></div>`
    +`<div class="pair listen"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="36" class="track"/><circle cx="40" cy="40" r="36" class="hold ehold" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 40 40)"/><rect x="22" y="23" width="36" height="34" rx="6"/><text x="40" y="46" text-anchor="middle">E</text></svg><div class="t"><span class="en">near a being<br>hold E</span><span class="kr">존재 가까이에서 E를 길게 눌러 듣기</span></div></div>`
    +`<div class="pair">${TBH('btn')}<div class="t"><span class="en">hold<br>to sleep</span><span class="kr">길게 눌러 잠들기</span></div></div>`},
  sleep:{svg:`${TBH('btn')}`, en:'hold the mouse to sleep'},
  take:{svg:`<svg viewBox="0 0 172 40" style="height:clamp(24px,2.3vw,38px)">${KEY(3,3,166,'SPACE')}</svg>`, en:'take the sound'},
};
/* with the camera (cam.html): the same cards, saying what to do with your body */
if(window.SBCam&&SBCam.on){
  const FACE=`<svg viewBox="0 0 80 80" style="height:clamp(24px,2.3vw,38px)"><ellipse cx="40" cy="40" rx="20" ry="26"/><path d="M33 52Q40 58 47 52" class="on"/></svg>`;
  const HAND=`<svg viewBox="0 0 80 80" style="height:clamp(24px,2.3vw,38px)"><rect x="26" y="30" width="28" height="30" rx="8"/><path d="M30 30V16M38 30V12M46 30V14M54 34V20"/></svg>`;
  if(SBCam.S.full) TUT.swim={svg:FACE.replace('<path d="M33 52Q40 58 47 52" class="on"/>','<path d="M20 40H8M60 40H72" class="on"/>'), en:'turn your head · you swim that way; lean in to go faster', kr:'고개를 돌리면 그쪽으로 헤엄칩니다 · 몸을 기울이면 빨라집니다'};
  TUT.echo={svg:FACE.replace('<path d="M33 52Q40 58 47 52" class="on"/>','<ellipse cx="40" cy="54" rx="6" ry="5" class="on"/>'), en:'open your mouth · send an echo', kr:'입을 벌려 에코를 보내세요'};
  if(!SBCam.S.full) TUT.swim={svg:TB('ring'), en:'turn the ring to swim  ·  roll to look', kr:'링을 돌려 헤엄치기 · 공을 굴려 둘러보기'};   // with the camera: the mouse alone moves you
  TUT.take={svg:HAND, en:'make a fist or press space · take the sound', kr:'주먹을 쥐거나 스페이스를 눌러 소리를 가져오세요'};
  TUT.listen={svg:`<svg viewBox="0 0 80 80" style="height:clamp(24px,2.3vw,38px)"><circle cx="40" cy="40" r="5" class="on"/><path d="M26 26A20 20 0 0 0 26 54M54 26A20 20 0 0 1 54 54M16 16A34 34 0 0 0 16 64M64 16A34 34 0 0 1 64 64"/></svg>`,
    en:'listen · each sound answers your echo from where it hides', kr:'귀 기울이세요 · 소리는 숨은 곳에서 에코에 대답합니다'};
  /* always there while you play, small, where the camera's mirror was: what each gesture does here */
  var camLegend=document.createElement('div'); camLegend.id='camLegend'; camLegend.className='gone';
  camLegend.style.cssText='position:fixed;left:1.6vw;bottom:2.4vh;z-index:6;display:grid;gap:.55em;pointer-events:none;font:300 clamp(9px,.72vw,12px) var(--sans,"Josefin Sans",sans-serif);letter-spacing:.24em;text-transform:uppercase;color:rgba(238,240,250,.5);transition:opacity 1s';
  document.body.appendChild(camLegend);
  var camLegendFor='';
  var camLegendSet=(k)=>{ if(camLegendFor===k) return; camLegendFor=k; camLegend.style.opacity=k?'1':'0'; if(!k) return;
    const rows=k==='play'?[['mouth','echo','입 · 에코'],['fist','take','주먹 · 가져오기'],['ring','swim','링 · 헤엄치기'],['ball','look','공 굴리기 · 둘러보기']]
      :[['mouth','echo','입 · 에코'],['palm, still','listen','손바닥 · 듣기'],['eyes closed','sleep','눈 감기 · 잠들기']];
    camLegend.innerHTML=rows.map(([g,a,kr])=>`<div><b style="font-weight:400;color:rgba(238,240,250,.78)">${g}</b> · ${a}<span style="display:block;margin-top:.3em;font-family:var(--ko,sans-serif);font-weight:200;letter-spacing:.08em;opacity:.75">${kr}</span></div>`).join(''); };
  if(!SBCam.S.full) TUT.deep.html=TUT.deep.html.replace('<span class="en">echo<br>find the others</span><span class="kr">에코로 다른 존재 찾기</span>','<span class="en">open your mouth<br>find the others</span><span class="kr">입을 벌려 다른 존재 찾기</span>')
    .replace(/<div class="pair"><svg(?:(?!<div class="pair).)*?<\/svg>(<div class="t"><span class="en">open your mouth<br>find the others)/s,   // the open mouth, not the mouse
      (m,rest)=>`<div class="pair">${FACE.replace('<path d="M33 52Q40 58 47 52" class="on"/>','<ellipse cx="40" cy="54" rx="6" ry="5" class="on"/>')}${rest}`)
    .replace(/<div class="pair listen">(?:(?!<div class="pair).)*?<span class="en">near a being<br>hold E<\/span><span class="kr">존재 가까이에서 E를 길게 눌러 듣기<\/span><\/div><\/div>/s,   // with the camera an open palm listens (E still works)
      `<div class="pair listen">${HAND.replace('</svg>','<circle cx="40" cy="40" r="36" class="hold palmHold" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 40 40)"/></svg>')}<div class="t"><span class="en">near a being<br>open palm, still</span><span class="kr">존재 가까이에서 손바닥 펴고 멈추기</span></div></div>`)
    .replace(/<div class="pair"><svg[^<]*<circle[^>]*class="track"\/><circle[^>]*class="hold"[^>]*\/>(?:(?!<div class="pair).)*?<span class="en">hold<br>to sleep<\/span><span class="kr">길게 눌러 잠들기<\/span><\/div><\/div>/s,   // with the camera you sleep by closing your eyes (the ring fills as they stay closed)
      `<div class="pair">${FACE.replace('<path d="M33 52Q40 58 47 52" class="on"/>','<path d="M30 36H36M44 36H50" class="on"/><circle cx="40" cy="40" r="36" class="hold eyesHold" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 40 40)"/>')}<div class="t"><span class="en">close your eyes<br>to sleep</span><span class="kr">눈을 감아 잠들기</span></div></div>`);
  else TUT.deep={html:`<div class="pair">${FACE.replace('<path d="M33 52Q40 58 47 52" class="on"/>','<ellipse cx="40" cy="54" rx="6" ry="5" class="on"/>')}<div class="t"><span class="en">open your mouth<br>find the others</span><span class="kr">입을 벌려 다른 존재 찾기</span></div></div>`
    +`<div class="pair listen">${HAND.replace('</svg>','<circle cx="40" cy="40" r="36" class="hold palmHold" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 40 40)"/></svg>')}<div class="t"><span class="en">near a being<br>open palm, still</span><span class="kr">존재 가까이에서 손바닥 펴고 멈추기</span></div></div>`
    +`<div class="pair">${FACE.replace('<path d="M33 52Q40 58 47 52" class="on"/>','<path d="M30 36H36M44 36H50" class="on"/>')}<div class="t"><span class="en">close your eyes<br>to sleep</span><span class="kr">눈을 감고 잠들기</span></div></div>`};
  KR['open your mouth · send an echo']='입을 벌려 에코를 보내세요';
}
function camTick(dt){
  if(CAMG) camLegendSet(state==='play'&&finaleT<0&&firstEchoT>0?'play':'');   // (in THE DEEP the cards at the bottom already say it)
  if(!(window.SBCam&&SBCam.on&&SBCam.ready)) return;
  if(state!=='play'&&state!=='archive') return;
  if(auto===0&&!ptr.drag){ const lk=SBCam.look(dt); if(lk){ me.yaw+=lk.dYaw; if(state==='play'&&finaleT<0) J.yaw+=lk.dYaw; me.pitch=Math.max(-1.3,Math.min(1.3,me.pitch+lk.dPitch)); } }
  if(SBCam.edge('mouth')){ lastInput=clock; if(state==='play'){ forwardVec(fwd); echo(fwd.clone()); } else deepPing(); }
  if(state==='play'&&SBCam.edge('fist')){ lastInput=clock; tryCollect(); }
  if(state==='archive'){
    const S=SBCam.S, PALM=.8;
    { const ring=tutEl.querySelector('.palmHold'); if(ring) ring.style.strokeDashoffset=String(100-Math.min(1,S.palmT/PALM)*100); }   // the palm card's ring fills as the palm is held
    if(!SBCam.hasHand&&!camHandWarned&&clock-arcT>8){ camHandWarned=true; console.warn('SBCam: hand tracking unavailable · E listens'); setHint('hand tracking is not loaded · hold E to listen'); setTimeout(()=>{ if(hintShown.startsWith('hand tracking')) setHint(''); },7000); }
    if(S.palmT>=PALM&&!camPalmDone&&!SCORE.want&&!(nearB&&nearV>LISTEN_V)){ camPalmDone=true; setHint('swim closer to a being · then open your palm'); setTimeout(()=>{ if(hintShown.startsWith('swim closer')) setHint(''); },5000); }   // a palm with no one near: say so, instead of nothing
    if(S.palmT>=PALM&&!camPalmDone){   // an open palm held still: listen / let go (both modes)
      camPalmDone=true; lastInput=clock; if(SCORE.want) scoreClose(); else if(nearB&&nearV>LISTEN_V) scoreOpen(nearB); } if(S.palmT<.2) camPalmDone=false;
    { const ring=tutEl.querySelector('.eyesHold'); if(ring) ring.style.strokeDashoffset=String(100-Math.min(1,S.eyesT/2)*100); }
    if(S.eyesT>=2) startSleep(); }
}
const LISTEN_V=0.12;   // how near a being must be to listen to it (E, palm, tap): about 15, where it already stands large before you
let camPalmDone=false, camHandWarned=false;
const ECHO_HINT=window.SBCam&&SBCam.on?'open your mouth · send an echo':'click · send an echo';
let tut={step:0,shown:'',move:0,goalT:0};
function tutShow(k){
  if(tut.shown===k) return; tut.shown=k; tutEl.classList.add('gone'); stageEl.classList.toggle('tutOn',!!k); if(!k) return;
  setTimeout(()=>{ if(tut.shown!==k) return; const c=TUT[k];
    tutEl.innerHTML=c.html||(c.svg+`<div class="t"><span class="en">${c.en}</span><span class="kr">${c.kr||krOf(c.en)}</span></div>`);
    tutEl.classList.remove('gone'); },500);
}
function tutReset(){ tut={step:touchy?4:0,shown:'',move:0,goalT:0}; tutEl.classList.add('gone'); }
let eyeHintUntil=0;
function setHint(text){
  if(hintShown===text) return;
  if(hintShown.startsWith('the eye is open') && performance.now()<eyeHintUntil && !text.startsWith('the eye is open')) return;   // the EYE's line is not talked over
  if(text.startsWith('the eye is open')) eyeHintUntil=performance.now()+12000;
  hintShown=text;
  hintEl.classList.add('gone'); if(!text) return;
  setTimeout(()=>{ if(hintShown===text){ hintEl.querySelector('.en').textContent=text; hintEl.querySelector('.kr').textContent=krOf(text); hintEl.classList.remove('gone'); } },700);
}
/* finding the EYE: the sealed eye opens — lids part, the iris rings in, fibres grow out of it (after the Ezorealism eye) */
const eyeCv=partEl.querySelector('.eyeOpen'), eg=eyeCv.getContext('2d'); let eyeRaf=0;
function eyeOpens(){
  cancelAnimationFrame(eyeRaf); eyeCv.hidden=false; partEl.classList.add('eye');
  const W=eyeCv.width, H=eyeCv.height, cx=W/2, cy=H/2, rw=W*.36, t0=performance.now();
  const fib=[...Array(46)].map((_,i)=>({a:i/46*TAU+R()*.08, len:.55+R()*.6, bend:(R()-.5)*1.4, w:.5+R()}));
  const ease=x=>x<0?0:x>1?1:x*x*(3-2*x);
  const frame=now=>{
    const t=(now-t0)/1000, open=ease((t-.9)/1.5), ring=ease((t-1.6)/1.4), grow=ease((t-2.4)/2.4);
    eg.clearRect(0,0,W,H); eg.save(); eg.globalCompositeOperation='lighter'; eg.lineCap='round';
    const ink=a=>`rgba(214,220,250,${a})`, teal=a=>`rgba(143,227,216,${a})`;
    const lid=rw*.62*open;                                   // half-height of the opening
    /* fibres: fine, slightly curling lines that grow out from the eye into the dark */
    for(const f of fib){ const r0=rw*.95, r1=r0+rw*f.len*grow*1.1; if(grow<=0) break;
      eg.strokeStyle=ink(.22*grow); eg.lineWidth=f.w; eg.beginPath();
      for(let s=0;s<=16;s++){ const u=s/16, r=r0+(r1-r0)*u, a=f.a+f.bend*u*u*.6; const x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r*.62; s?eg.lineTo(x,y):eg.moveTo(x,y); }
      eg.stroke(); }
    /* the iris: rings and striations, clipped by the lids */
    eg.save(); eg.beginPath(); eg.moveTo(cx-rw,cy); eg.quadraticCurveTo(cx,cy-lid*2,cx+rw,cy); eg.quadraticCurveTo(cx,cy+lid*2,cx-rw,cy); eg.clip();
    const ir=rw*.42;
    for(let k=0;k<9;k++){ eg.strokeStyle=(k%3?ink:teal)((.12+.5*(1-k/9))*ring); eg.lineWidth=k?0.7:1.4; eg.beginPath(); eg.arc(cx,cy,ir*(.35+k*.09),0,TAU); eg.stroke(); }
    for(let k=0;k<60;k++){ const a=k/60*TAU; eg.strokeStyle=ink(.18*ring); eg.lineWidth=.6; eg.beginPath(); eg.moveTo(cx+Math.cos(a)*ir*.38,cy+Math.sin(a)*ir*.38); eg.lineTo(cx+Math.cos(a+.05)*ir*(.8+.15*Math.sin(k*3.1)),cy+Math.sin(a+.05)*ir*(.8+.15*Math.sin(k*3.1))); eg.stroke(); }
    eg.globalCompositeOperation='source-over'; eg.fillStyle='rgba(4,5,12,.95)'; eg.beginPath(); eg.arc(cx,cy,ir*.3*(1-.25*ring),0,TAU); eg.fill();
    eg.globalCompositeOperation='lighter'; eg.fillStyle=ink(.9*ring); eg.beginPath(); eg.arc(cx-ir*.1,cy-ir*.1,ir*.06,0,TAU); eg.fill();
    eg.restore();
    /* the lids: one line while sealed, parting into an almond; lashes turn from down to out */
    for(let j=0;j<3;j++){ const tt=t-2.1-j*.45; if(tt>0&&tt<2.4){ const rr=ir*(1+tt*2.4); eg.strokeStyle=teal(.5*(1-tt/2.4)); eg.lineWidth=1.2; eg.beginPath(); eg.ellipse(cx,cy,rr,rr*.62,0,0,TAU); eg.stroke(); } }   // the opened eye sends out its own sonar
    eg.strokeStyle=ink(.9); eg.lineWidth=1.6;
    eg.beginPath(); eg.moveTo(cx-rw,cy); eg.quadraticCurveTo(cx,cy-lid*2,cx+rw,cy); eg.stroke();
    eg.beginPath(); eg.moveTo(cx-rw,cy); eg.quadraticCurveTo(cx,cy+lid*2,cx+rw,cy); eg.stroke();
    for(let k=1;k<12;k++){ const u=k/12, x=cx-rw+u*2*rw, y=cy-lid*2*2*u*(1-u), a=Math.PI/2+(u-.5)*1.2-open*Math.PI;   // lashes: down while shut, up once open
      eg.strokeStyle=ink(.55); eg.lineWidth=1; eg.beginPath(); eg.moveTo(x,y); eg.lineTo(x+Math.cos(a)*rw*.13,y+Math.sin(a)*rw*.13); eg.stroke(); }
    eg.restore();
    if(t<6) eyeRaf=requestAnimationFrame(frame);
  };
  eyeRaf=requestAnimationFrame(frame);
}
function showPart(o,k){
  if(o.el.hidden) eyeOpens(); else { cancelAnimationFrame(eyeRaf); eyeCv.hidden=true; partEl.classList.remove('eye'); }
  partEl.style.setProperty('--pc',`rgb(${o.el.c.map(v=>Math.round(v*255)).join(',')})`);
  partEl.querySelector('.en').textContent=o.el.en; partEl.querySelector('.ko').textContent='';   // the name only
  partEl.querySelector('.no').textContent=o.el.hidden?'a hidden sound':`${k} / ${NEED}`; partEl.querySelector('.kr').textContent=o.el.hidden?'숨겨진 소리':'';
  partEl.classList.remove('gone'); partUntil=clock+(o.el.hidden?10:7);
  let d=o.el.hidden?null:carryEl.children[k-1];
  if(o.el.hidden){ d=document.createElement('i'); d.className='eye'; carryEl.appendChild(d); }   // the EYE takes no place of its own: it joins the row at the end
  if(d){ d.classList.add('on'); d.style.backgroundImage=`url(${signs[ORDER.indexOf(o.id)].cv.toDataURL()})`; }
}
function showBig(en,ko,secs,kr){ bigEl.querySelector('.en').textContent=en; bigEl.querySelector('.ko').textContent=ko; bigEl.querySelector('.kr').textContent=kr||''; bigEl.classList.remove('gone'); bigUntil=clock+secs; }

const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
function dirFromScreen(cx,cy){
  const r=renderer.domElement.getBoundingClientRect();
  ndc.set(((cx-r.left)/r.width)*2-1, -((cy-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc,camera); return ray.ray.direction.clone();
}

/* an echo leaves from where you are, in every direction. What it touches within 45 answers; within 20 it glows. */
function echo(dir){
  if(state!=='play') return;
  const o=me.pos;
  lastEchoAt=clock; ripO[ripIdx].set(o.x,o.y,o.z,clock); ripD[ripIdx].set(dir.x,dir.y,dir.z,REDUCED?0.7:1); ripIdx=(ripIdx+1)%4;
  for(const s of orbs){ if(s.state!=='hidden') continue; const d=s.pos.distanceTo(o), reach=s.el.hidden?NEAR+4:55; if(d>reach) continue;   // the sounds it reaches answer
    const k=4+(secIdx++%8); ripO[k].set(s.pos.x,s.pos.y,s.pos.z,clock+d/SPEED); ripD[k].set(0,0,0,(s.el.hidden?.55:.9)*Math.max(.45,1.2-d/reach)); }
  flash=0.75; flashTint.set(0.8,0.95,1); echoSound(1,J.set.length); warpAt(0,0,0.45);   // you feel the sonar go out
  if(firstEchoT<0){ firstEchoT=clock; J.start=clock; lastFind=clock; carryEl.classList.remove('gone'); setBase(0.9); }   // the ambient pad alone: every sound you find adds its own instrument over it
  if(finaleT>=0) return;
  me.vel.addScaledVector(dir,1.6); J.echoes++; J.ys.push(o.y);
  for(const b of orbs){ if(b.state!=='hidden') continue;
    const d=b.pos.distanceTo(o);
    if(d<FAR && (!b.el.hidden||d<NEAR+4)) b.litAt=clock+d/SPEED;
    const reachA=b.el.hidden?NEAR+4:55;
    if(d<reachA){ const back=2*d/SPEED, v=d<NEAR?1.1:lerp(0.6,0.14,(d-NEAR)/(reachA-NEAR)); setTimeout(()=>{ if(b.state==='hidden'){ orbCall(b,v); b.pulse=clock; } }, back*1000); }
  }
  if(hintShown===ECHO_HINT) setHint('');
}
function tryCollect(){
  if(state!=='play'||finaleT>=0||firstEchoT<0) return;
  let best=null, bd=NEAR;
  for(const o of orbs){ if(o.state!=='hidden'||!o.near) continue; const d=o.pos.distanceTo(me.pos); if(d<bd){bd=d;best=o;} }
  if(best) collect(best); else { denySound(); setHint('nothing within reach · send an echo'); setTimeout(()=>{ if(hintShown==='nothing within reach · send an echo') setHint(''); },4600); }
}

function collect(o){
  o.state='flying'; o.tState=clock; o.from=o.pos.clone();
  J.set.push(o.id); J.frames.push((clock*FPS+J.set.length*21)%LOOPF);
  showPart(o,heard()); lastFind=clock;
  if(CAMG&&heard()<NEED&&o.id!=='sense'){ const n=heard(), msg='echo again · find the next sound'; setTimeout(()=>{ if(finaleT<0&&heard()===n) setHint(msg); },3200); setTimeout(()=>{ if(hintShown===msg) setHint(''); },9500); }
  flash=0.9; flashTint.set(...o.el.c);
  const when=A.ctx?nextBeat():0;
  if(A.ctx) playPhrase(o.id,when,A.master,1.25);
  setMix(J.set,1,J.name);
  if(o.id==='sense'){
    const bloom=A.ctx?Math.max(0,when-A.ctx.currentTime)+2.2:2.2;
    colorT=clock+bloom;
    setTimeout(()=>{ const fl=document.createElement('div'); fl.className='eyeFlood'; document.body.appendChild(fl); setTimeout(()=>fl.remove(),3400); },Math.max(0,bloom-.7)*1000);   // light floods out of the eye
    setTimeout(()=>{ stageEl.classList.add('sense'); document.body.classList.add('sense'); warpAt(0,0,1.4); },bloom*1000);
    setTimeout(()=>{ if(finaleT<0){ setHint('the eye is open · the sounds show themselves'); signs.forEach(sg=>sg.mat.depthTest=false); } },(bloom+4)*1000);   // only while there is still something to find
    setTimeout(()=>{ if(hintShown.startsWith('the eye is open')) setHint(''); },(bloom+22)*1000);
  }
  if(heard()>=NEED){ if(J.set.includes('sense')) buildAura(J.set);   // the being is whole: its four instruments over the pad are its piece
    for(const q of orbs) if(q.state==='kept'||q.state==='flying'){ q.from=slotPos(q.id).add(new THREE.Vector3(0,24,0)); q.state='toSlot'; q.tState=clock; } finaleT=clock; auto=1; const b=clean('mine',beingFromJourney()); applyBeing(reefMat.uniforms,b); makeFinaleBeing(b); J.being=b; J.said=false; J.vortex=false; J.named=false;
    for(const q of orbs) if(q.state==='hidden') q.state='gone'; setHint(''); }
}
function makeFinaleBeing(b){ dropFinaleBeing();
  const mat=arcBase.clone(); mat.uniforms.uAtlas.value=reefMat.uniforms.uAtlas.value; mat.uniforms.uWarp=WARP; applyBeing(mat.uniforms,b);
  const tint=new THREE.Vector3(); b.parts.forEach(p=>tint.add(new THREE.Vector3(...EL[p].c))); mat.uniforms.uTint.value.copy(tint.multiplyScalar(1/Math.max(1,b.parts.length)));
  mat.uniforms.uColor.value=b.parts.includes('sense')?1:0; mat.uniforms.uMine.value=1; mat.uniforms.uGlow.value=0.4; mat.uniforms.uFade.value=0; mat.uniforms.uPix.value=arcBase.uniforms.uPix.value;
  const obj=new THREE.Points(arcGeo,mat); obj.frustumCulled=false; obj.renderOrder=3; obj.add(fibresFor(mat)); obj.position.copy(S); scene.add(obj); finaleBeing=obj; }
function dropFinaleBeing(){ if(finaleBeing){ scene.remove(finaleBeing); finaleBeing.material.dispose(); finaleBeing=null; } }
function goArchive(){ if(faceIr&&faceIr.userData.face!==window.SBFace){ iris.remove(faceIr); faceIr.geometry.dispose(); faceIr.material.dispose(); faceIr=null; } dropFinaleBeing();
  tutShow(''); namedEl.classList.add('gone');
  state='archive'; arcT=clock; reef.visible=true; reef.scale.setScalar(DEEP_CAVE);   // the reef stays, far and faint: THE DEEP is a cave, not a void
  orbPts.visible=false; signs.forEach(s=>s.sp.visible=false); arcGroup.visible=true; dolphin.visible=true;
  carryEl.classList.add('gone'); me.pos.set(0,1.5,34); me.vel.set(0,0,0); me.yaw=0; me.pitch=0;
  const eye=J.set.includes('sense');
  fade=0; fadeTarget=1; arcDirty=true; setMix(eye?['sense']:[],eye?0.22:0); setBase(0); oceanTo(1,3); arcHintDone=false; J.pinged=false;   // THE DEEP opens on the sea alone (with the EYE, its sound faintly under it)
  if(eye) showBig('THE DEEP','where the beings dream',8,'존재들이 꿈꾸는 곳');
  else showBig('THE DEEP','where the beings sleep',8,'존재들이 잠든 곳');
}
let lastPing={t:-99,o:new THREE.Vector3()};
const DEEP_CAVE=1.8;   // the cave round THE DEEP: the reef, grown so the beings sit well inside it
let warpT=-99;
function deepPing(sx,sy){ if(state!=='archive') return; warpT=clock;
  forwardVec(fwd); ripO[ripIdx].set(me.pos.x/DEEP_CAVE,me.pos.y/DEEP_CAVE,me.pos.z/DEEP_CAVE,clock); ripD[ripIdx].set(fwd.x,fwd.y,fwd.z,0.9); ripIdx=(ripIdx+1)%4;   // the ping runs over the cave walls too
  { const r=stageEl.getBoundingClientRect(); if(sx==null){ proj.copy(me.pos).project(camera); warpAt(proj.x,proj.y,1.2); } else warpAt((sx-r.left)/r.width*2-1,1-(sy-r.top)/r.height*2,1.2); }
  { const r=stageEl.getBoundingClientRect(); if(sx==null){ proj.copy(me.pos).project(camera); sx=r.left+(proj.x+1)/2*r.width; sy=r.top+(1-proj.y)/2*r.height; }
    SCORE.pings.push({x:(sx-r.left)/r.width,y:(sy-r.top)/r.height,t:clock}); } lastPing.t=clock; lastPing.o.copy(me.pos); kinMat.uniforms.uPingO.value.copy(me.pos); kinMat.uniforms.uPingT.value=clock; nrMat.uniforms.uPingO.value.copy(me.pos); nrMat.uniforms.uPingT.value=clock; irMat.uniforms.uPingO.value.copy(me.pos); irMat.uniforms.uPingT.value=clock; for(const b of beings){ const u=b.obj.material.uniforms; u.uPingO.value.copy(me.pos); u.uPingT.value=clock; } echoSound(.8,2); flash=.35; flashTint.set(.8,.9,1); }   // in THE DEEP too you see with sound
function startSleep(){ tutShow(''); state='sleep'; sleepT=clock; setHint(''); holdP=0; allSleep(); infoEl.classList.add('gone'); namesEl.replaceChildren(); }
function reset(){
  finaleT=-1; firstEchoT=-1; p=0; sleepV=0; base=0; auto=0; colorV=0; colorT=0; saved=false; moveHintDone=false;
  J.echoes=0; J.ys=[]; J.yaw=0; J.path=0; J.frames=[]; J.set=[]; J.being=null;
  placeOrbs(); ripD.forEach(d=>d.w=0); dropFinaleBeing();
  carryEl.querySelectorAll('.eye').forEach(d=>d.remove());
  [...carryEl.children].forEach(d=>{ d.classList.remove('on'); d.style.backgroundImage=''; });
  reef.visible=true; reef.scale.setScalar(1); orbPts.visible=true; signs.forEach(s=>{ s.sp.visible=true; s.mat.depthTest=true; }); arcGroup.visible=false; dolphin.visible=false;
  me.pos.set(0,0,14); me.vel.set(0,0,0); me.yaw=0; me.pitch=0; lastPos.copy(me.pos);
  endEl.classList.add('gone'); againEl.classList.add('gone'); infoEl.classList.add('gone'); namesEl.replaceChildren();
  reefMat.uniforms.uLeave.value=0;
  state='play'; playT=clock; lastInput=clock; fade=0; fadeTarget=1; tutReset();
  audioInit(); setMix([],1); setBase(0.6); oceanTo(1,3);
  stageEl.classList.remove('sense'); document.body.classList.remove('sense');
  stageEl.focus({preventScroll:true});
}
/* back to the surface: the hole waits for the next visitor */
function toOpening(){
  tutShow(''); namedEl.classList.add('gone');
  state=loaded?'ready':'loading'; paused=true; setHint(''); pendingStart=false;
  [partEl,bigEl,infoEl,endEl,againEl].forEach(e=>e.classList.add('gone')); carryEl.classList.add('gone'); namesEl.replaceChildren();
  stageEl.classList.remove('sense'); document.body.classList.remove('sense');
  if(A.ctx){ allSleep(); }
  SCORE.want=0; SCORE.P=0; SCORE.drawn=true; scoreDraw(0,0,false); SCORE.veil=null; scVeil.style.opacity='0';
  window.SBOpen && SBOpen.show();
}

/* ───────── THE DEEP scene build ───────── */
/* with the EYE, THE DEEP shows what the echo cannot: which beings are kin (two or more sounds in common), as fine threads */
const KSEG=24, KMAX=48;
const kinGeo=new THREE.BufferGeometry(), kinPos=new Float32Array(KMAX*KSEG*2*3), kinT=new Float32Array(KMAX*KSEG*2), kinPh=new Float32Array(KMAX*KSEG*2);
kinGeo.setAttribute('position',new THREE.BufferAttribute(kinPos,3)); kinGeo.setAttribute('aT',new THREE.BufferAttribute(kinT,1)); kinGeo.setAttribute('aPh',new THREE.BufferAttribute(kinPh,1));
const kinMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{uTime:{value:0},uFade:{value:0},uPingO:{value:new THREE.Vector3()},uPingT:{value:-99}},
  vertexShader:`${GLSL_WARP} attribute float aT; attribute float aPh; uniform float uTime,uPingT; uniform vec3 uPingO; varying float vA;
    void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=warpP(projectionMatrix*mv);
      float b=fract(uTime*0.06+aPh), bead=exp(-pow((aT-b)*22.0,2.0));                    // a bead of light drifts from one to the other
      float pd=length(position-uPingO), pt=uTime-uPingT, flare=uPingT<0.0?0.0:exp(-pow(pd-pt*34.0,2.0)*0.02)*exp(-pt*0.4);
      vA=(0.10+0.7*bead+0.8*flare)*smoothstep(0.0,0.08,aT)*smoothstep(1.0,0.92,aT)*exp(-max(0.0,-mv.z-30.0)*0.01); }`,
  fragmentShader:`uniform float uFade; varying float vA; void main(){ gl_FragColor=vec4(vec3(0.80,0.83,1.0)*vA*uFade,1.0); }`});
kinMat.uniforms.uWarp=WARP;
const kinLines=new THREE.LineSegments(kinGeo,kinMat); kinLines.frustumCulled=false; kinLines.renderOrder=2; kinLines.visible=false; scene.add(kinLines);
let kin=[];
function kinBuild(seeing){
  kin=[]; kinLines.visible=!!seeing; if(!seeing) return;
  for(let i=0;i<beings.length&&kin.length<KMAX;i++) for(let j=i+1;j<beings.length&&kin.length<KMAX;j++){
    const n=beings[i].e.parts.filter(q=>beings[j].e.parts.includes(q)).length; if(n>=2) kin.push({a:beings[i],b:beings[j],ph:R(),sag:3+R()*5}); }
  kinGeo.setDrawRange(0,kin.length*KSEG*2);
}
const _ka=new THREE.Vector3(), _kb=new THREE.Vector3();
/* the floor of THE DEEP grows strange branching plants, half weed, half neuron: almost unseen, swaying; an echo shows them
   for a moment as it passes; with the EYE, small signals climb their branches */
const nrPos=[], nrH=[], nrS=[];
for(let i=0;i<46;i++){ const a=R()*TAU, r=14+Math.sqrt(R())*95, x0=Math.cos(a)*r, z0=Math.sin(a)*r-6, s=R();
  const f=.02+R()*.03, ph=R()*TAU, amp=2+R()*6, lean=(R()-.5)*.12, N=48, y0=-80, y1=80;
  let px=null; for(let k=0;k<=N;k++){ const q=k/N, y=y0+(y1-y0)*q, x=x0+Math.sin(y*f+ph)*amp+y*lean, z=z0+Math.cos(y*f*.8+ph*1.3)*amp*.6;   // a long thread, gently curving
    if(px){ nrPos.push(px[0],px[1],px[2],x,y,z); nrH.push(px[3],q); nrS.push(s,s); } px=[x,y,z,q]; } }
const nrGeo=new THREE.BufferGeometry(); nrGeo.setAttribute('position',new THREE.Float32BufferAttribute(nrPos,3)); nrGeo.setAttribute('aH',new THREE.Float32BufferAttribute(nrH,1)); nrGeo.setAttribute('aS',new THREE.Float32BufferAttribute(nrS,1));
const nrMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{uTime:{value:0},uFade:{value:0},uPingO:{value:new THREE.Vector3()},uPingT:{value:-99},uSee:{value:0}},
  vertexShader:`${GLSL_WARP} attribute float aH; attribute float aS; uniform float uTime,uPingT,uSee; uniform vec3 uPingO; varying float vA; varying float vSig;
    void main(){ vec3 p=position; float sway=sin(aH*3.1416)*1.4;   // they sway most in the middle, slowly, each its own way
      p.x+=sin(uTime*0.35+aS*31.0+aH*2.0)*sway; p.z+=cos(uTime*0.29+aS*17.0+aH*1.7)*sway*0.8;
      vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=warpP(projectionMatrix*mv);
      float pd=length(p-uPingO), pt=uTime-uPingT, band=pd-pt*34.0;
      float pass=uPingT<0.0?0.0:exp(-band*band*0.006)*exp(-pt*0.3);                      // the echo shows them as it passes
      float after=uPingT<0.0?0.0:smoothstep(4.0,-4.0,band)*exp(-max(0.0,pt-pd/34.0)*0.6)*0.35;   // and they fade back
      float sig=fract(uTime*0.18+aS*7.0)*1.6-0.3; vSig=uSee*exp(-pow((aH-sig)*9.0,2.0));      // with the EYE: a signal climbing the branches
      vA=(0.028+pass*0.28+after*0.1)*exp(-max(0.0,-mv.z-40.0)*0.012); }`,
  fragmentShader:`uniform float uFade; varying float vA; varying float vSig; void main(){ gl_FragColor=vec4((vec3(0.55,0.62,0.95)*vA+vec3(0.6,0.95,0.9)*vSig*0.22)*uFade,1.0); }`});
nrMat.uniforms.uWarp=WARP;
const neurons=new THREE.LineSegments(nrGeo,nrMat); neurons.frustumCulled=false; neurons.renderOrder=1; neurons.visible=false; scene.add(neurons);
function neuronTick(t){ const on=state==='archive'||state==='sleep'; neurons.visible=on; if(!on) return;
  const u=nrMat.uniforms; u.uTime.value=t; u.uFade.value=fade; u.uSee.value=J.set.includes('sense')?1:0; }
function kinTick(t){
  if(!kinLines.visible) return; const u=kinMat.uniforms; u.uTime.value=t; u.uFade.value=fade;
  let v=0;
  kin.forEach(k=>{ _ka.copy(k.a.obj.position); _kb.copy(k.b.obj.position); _ka.y+=4*k.a.sc; _kb.y+=4*k.b.sc;   // from heart to heart, sagging like a thread in water
    for(let s=0;s<KSEG;s++) for(const q of [s/KSEG,(s+1)/KSEG]){ const o=v*3;
      kinPos[o]=_ka.x+(_kb.x-_ka.x)*q; kinPos[o+1]=_ka.y+(_kb.y-_ka.y)*q-Math.sin(q*Math.PI)*k.sag+Math.sin(t*0.4+q*6+k.ph*9)*0.4; kinPos[o+2]=_ka.z+(_kb.z-_ka.z)*q;
      kinT[v]=q; kinPh[v]=k.ph; v++; } });
  kinGeo.attributes.position.needsUpdate=true; kinGeo.attributes.aT.needsUpdate=true; kinGeo.attributes.aPh.needsUpdate=true;
}
/* the being's card spells itself out of noise, as a sonar return resolving */
let infoFor=null;
const DEC='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·';
function decodeInto(el,txt){ const t0=performance.now(), dur=700;
  const step=now=>{ const k=Math.min(1,(now-t0)/dur); let s='';
    for(let i=0;i<txt.length;i++){ const c=txt[i]; s+=(c===' '||i/txt.length<k*1.15-.15)?c:DEC[(Math.random()*DEC.length)|0]; }
    el.textContent=k>=1?txt:s; if(k<1&&el.isConnected) requestAnimationFrame(step); };
  requestAnimationFrame(step); }
/* with the EYE, THE DEEP looks back: far behind the beings a vast eye of grains — rings, the iris's fibres, the lids — opens as
   your echo reaches it, holds, and slowly closes again */
const irPos=[], irK=[];
{ const C=new THREE.Vector3(0,6,-175), Rr=78;
  for(let i=0;i<5200;i++){ const u=Math.random(); let x,y,k;
    if(u<.45){ const a=Math.random()*Math.PI*2, r=Rr*(.32+.66*Math.pow(Math.random(),.8)); const sp=Math.floor(Math.random()*90)/90*Math.PI*2+(Math.random()-.5)*.045;   // the iris's fibres
      x=Math.cos(sp)*r; y=Math.sin(sp)*r; k=0; }
    else if(u<.75){ const ring=[.3,.36,.55,.82,.98][Math.floor(Math.random()*5)], a=Math.random()*Math.PI*2, r=Rr*ring*(1+(Math.random()-.5)*.02);   // its rings
      x=Math.cos(a)*r*(1+(Math.random()-.5)*.05); y=Math.sin(a)*r*(1+(Math.random()-.5)*.05); k=1; }
    else { const s=Math.random()<.5?1:-1, q=Math.random()*2-1, w=Rr*2.1;   // the lids: two long curves, almond
      x=q*w; y=s*(1-q*q)*Rr*1.15+(Math.random()-.5)*4.0; k=2; }
    irPos.push(C.x+x,C.y+y*.9,C.z+(Math.random()-.5)*4); irK.push(k+Math.random()*.9); } }
const irGeo=new THREE.BufferGeometry(); irGeo.setAttribute('position',new THREE.Float32BufferAttribute(irPos,3)); irGeo.setAttribute('aK',new THREE.Float32BufferAttribute(irK,1));
const irMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,   // a vision: it shows through the cave's far walls
  uniforms:{uTime:{value:0},uFade:{value:0},uPingO:{value:new THREE.Vector3()},uPingT:{value:-99},uPix:{value:1},uLook:{value:new THREE.Vector3()}},
  vertexShader:`${GLSL_WARP} attribute float aK; uniform float uTime,uPingT,uPix; uniform vec3 uPingO,uLook; varying float vA; varying float vK;
    void main(){ vec3 pos=position; if(aK<1.5) pos.xy+=uLook.xy;   /* the iris turns toward you; the lids stay */
      vec4 mv=modelViewMatrix*vec4(pos,1.0); gl_Position=warpP(projectionMatrix*mv);
      float pd=length(position-uPingO), pt=uTime-uPingT, arrive=pd/70.0, since=pt-arrive;   /* the deep answers quickly */
      float open=uPingT<0.0?0.0:smoothstep(-0.4,1.6,since)*exp(-max(0.0,since-2.0)*0.45);   /* it opens as the echo reaches it, holds, then closes */
      float r=length(position.xy-vec2(0.0,6.0))/78.0, lid=step(1.5,aK)*(1.0-step(2.5,aK));
      vA=(0.05+open)*(lid>0.5?0.55:(0.35+0.4*smoothstep(0.3,0.6,r)))*(0.6+0.4*sin(uTime*1.3+aK*20.0));   /* faintly there always: you can feel it watching */
      vK=aK; gl_PointSize=clamp((1.6+fract(aK*7.0)*1.8)*uPix*(300.0/max(1.0,-mv.z)),1.2,4.5); }`,
  fragmentShader:`uniform float uFade; varying float vA; varying float vK; void main(){ vec2 q=gl_PointCoord-0.5; float d=dot(q,q); if(d>0.25) discard;
    vec3 c=vK<1.0?vec3(0.55,0.86,0.82):vec3(0.86,0.90,1.0); gl_FragColor=vec4(c*exp(-d*9.0)*vA*0.75*uFade,1.0); }`});
irMat.uniforms.uWarp=WARP;
const iris=new THREE.Points(irGeo,irMat); iris.frustumCulled=false; iris.renderOrder=0; iris.visible=false; scene.add(iris);
function irisTick(t){ const on=(state==='archive'||state==='sleep')&&J.set.includes('sense'); iris.visible=on; if(!on) return;
  const u=irMat.uniforms; u.uTime.value=t; u.uFade.value=fade; u.uPix.value=reefMat.uniforms.uPix.value;
  _ka.set(0,6,-175); _kb.subVectors(me.pos,_ka); const L=Math.hypot(_kb.x,_kb.y,_kb.z)||1;   // where you are, from the eye
  u.uLook.value.lerp(_kb.set(_kb.x/L*30,_kb.y/L*24,0),Math.min(1,0.05));   // its gaze follows you, a little behind
  if(window.SBFace&&!faceIr) makeFaceIr(); if(faceIr){ const fu=faceIr.material.uniforms; fu.uTime.value=t; fu.uFade.value=fade; fu.uLook.value.copy(u.uLook.value); fu.uPingO.value.copy(u.uPingO.value); fu.uPingT.value=u.uPingT.value; fu.uPix.value=u.uPix.value; } }
/* A: your own face, for this visit only, in the pupil of the eye — grains set by the brightness the wake remembered; it surfaces as
   the eye opens and drifts apart as it closes */
let faceIr=null;
function makeFaceIr(){ const F=window.SBFace, P=[], K=[];
  for(let y=0;y<F.h;y++) for(let x=0;x<F.w;x++){ const v=F.lum[y*F.w+x]; if(v<.18) continue;
    const u=(x/(F.w-1)-.5), w=(y/(F.h-1)-.5), ex=u/0.42, ey=w/0.5; if(ex*ex+ey*ey>1) continue;   // only the oval of the face
    for(let k=0;k<1+(v>.6?1:0);k++){ P.push(u*34+(Math.random()-.5)*.6, 6-w*44+(Math.random()-.5)*.6, -173); K.push(v); } }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); geo.setAttribute('aL',new THREE.Float32BufferAttribute(K,1));
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,
    uniforms:{uTime:{value:0},uFade:{value:0},uPingO:{value:new THREE.Vector3()},uPingT:{value:-99},uPix:{value:1},uLook:{value:new THREE.Vector3()}},
    vertexShader:`${GLSL_WARP} attribute float aL; uniform float uTime,uPingT,uPix; uniform vec3 uPingO,uLook; varying float vA;
      void main(){ vec3 pos=position; pos.xy+=uLook.xy;
        float pd=length(pos-uPingO), since=uTime-uPingT-pd/70.0;
        float surf=uPingT<0.0?0.0:smoothstep(0.4,2.0,since)*exp(-max(0.0,since-2.6)*0.5);           /* it surfaces after the eye has opened */
        float apart=uPingT<0.0?0.0:max(0.0,since-2.6); pos.xy+=normalize(pos.xy-vec2(0.0,6.0)+0.001)*apart*apart*1.4;   /* and drifts apart as it closes */
        vec4 mv=modelViewMatrix*vec4(pos,1.0); gl_Position=warpP(projectionMatrix*mv);
        vA=surf*aL*0.8; gl_PointSize=clamp((1.4+aL*1.6)*uPix*(300.0/max(1.0,-mv.z)),1.2,4.5); }`,
    fragmentShader:`uniform float uFade; varying float vA; void main(){ vec2 q=gl_PointCoord-0.5; float d=dot(q,q); if(d>0.25) discard; gl_FragColor=vec4(vec3(0.80,0.88,1.0)*exp(-d*9.0)*vA*uFade,1.0); }`});
  mat.uniforms.uWarp=WARP; faceIr=new THREE.Points(geo,mat); faceIr.userData.face=F; faceIr.frustumCulled=false; faceIr.renderOrder=0; iris.add(faceIr); }
function numberOf(id){ const i=entries.findIndex(e=>e.id===id); return i<0?entries.length+1:i+1; }
function buildArchive(){
  arcDirty=false;
  for(const b of beings){ arcGroup.remove(b.obj); b.obj.material.dispose(); b.obj.children.forEach(c=>{ c.geometry&&c.geometry.dispose(); if(c.isSprite) c.material.dispose(); }); } beings=[];
  const seeing=J.set.includes('sense');                            // carrying the EYE, you see every being's aura and what it is made of
  const mine = ownId ? (entries.find(e=>e.id===ownId)||ownLocal) : ownLocal;
  const others = entries.filter(e=>e.id!==ownId).slice(-23).reverse();
  const list = (mine?[{e:mine,mine:true}]:[]).concat(others.map(e=>({e,mine:false})));
  namesEl.replaceChildren();
  list.forEach((it,i)=>{
    const mat=arcBase.clone(); mat.uniforms.uAtlas.value=reefMat.uniforms.uAtlas.value; mat.uniforms.uWarp=WARP;
    applyBeing(mat.uniforms,it.e);
    const tint=new THREE.Vector3(); it.e.parts.forEach(p=>tint.add(new THREE.Vector3(...EL[p].c))); tint.multiplyScalar(1/Math.max(1,it.e.parts.length));
    mat.uniforms.uTint.value.copy(tint); mat.uniforms.uColor.value=it.e.parts.includes('sense')?1:0;
    mat.uniforms.uPhase.value=R()*50; mat.uniforms.uGlow.value=it.mine?0.5:0; mat.uniforms.uMine.value=it.mine?1:(seeing?0.3:0);
    const obj=new THREE.Points(arcGeo,mat); obj.frustumCulled=false; obj.renderOrder=3; obj.add(fibresFor(mat));
    let pos; if(i===0&&it.mine) pos=new THREE.Vector3(0,0,0);
    else { const k=it.mine?i:i+1, a=k*2.399963, r=16+Math.sqrt(k)*15; pos=new THREE.Vector3(Math.cos(a)*r, Math.sin(k*1.7)*7, Math.sin(a)*r-6); }
    const sc=0.55+R()*0.2; obj.position.copy(pos); obj.scale.setScalar(sc);
    if(seeing){ obj.add(auraFor(it.e.parts,it.mine?1:0.25));
      it.e.parts.forEach((id,k,arr)=>{ const sm=new THREE.SpriteMaterial({map:signs[ORDER.indexOf(id)].tex,blending:THREE.AdditiveBlending,transparent:true,depthTest:false,depthWrite:false,opacity:0.85});
        const sp=new THREE.Sprite(sm); sp.position.set((k-(arr.length-1)/2)*3.2,13.5,0); sp.scale.setScalar(3); sp.renderOrder=6; obj.add(sp); }); }
    arcGroup.add(obj);
    const tag=document.createElement('span'); tag.textContent=it.e.name||'nameless'; tag.style.opacity=0; namesEl.appendChild(tag);
    beings.push({obj,e:it.e,mine:it.mine,home:pos.clone(),sc,phase:R()*10,tag});
  });
  kinBuild(seeing);
  nearB=null; mixKey='';
}
function playBeing(b){
  if(!A.ctx||!b) return; const t=nextBeat();
  b.e.parts.forEach((id,i)=>playPhrase(id,t+i*BEAT*2,A.master,1.15));
  const span=b.e.parts.length*BEAT*2;
  replayUntil=clock+span+9; setTimeout(()=>{ if(nearB===b) setMix(b.e.parts,1,b.e.name); },span*1000);
  b.obj.material.uniforms.uGlow.value=1.2;
}

/* ───────── THE DEEP · a being's music, drawn (hold E near a being) ─────────
   Not an instrument of its own: the base melody plays on, the being's four sounds rise over it in lock-step, and what they make
   together is drawn as it plays (VisRef/6, 9). It arrives the way 9 opens — a wide ring swells out of the dark with an arc of grains —
   then a "now" line grows upright and the four lanes draw out of it. Grains drift in toward the line; on each sound's hit a wave of
   rings, an airbrush bloom, a bead on its lane, and now and then long threads: a curve that bends to another height and runs on with
   beads (9), a stem stepping down from above (6), a small spiked burst (6). The past drifts left and thins out before the being.
   Each sound keeps its own wave (timing, ring count, speed, how slowly it blooms), not its own colour. One light per world: cool
   in THE DEEP, warm sepia when you carry the EYE. Drawn on a canvas of its own, then softened (a blur under, stippled grain over,
   short trails) so it sits in the archive's airbrushed grain instead of reading as vector graphics. */
const SC_BEATS={ heart:[0,4,8,12,16,20,24,28].flatMap(k=>[[k,1],[k+1,.45]]),
  voice:[[6,.8],[14,.55],[22,.8],[30,.55]], bone:[[0,1],[8,.5],[16,1],[24,.5]], memory:[[3,.7],[13,.6],[19,.7],[29,.8]],
  soul:[[0,1],[20,.45]], dream:[[10,.8],[26,.8]], sense:[[28,.7]] };
/* how each sound moves the water: rings (count, gap, speed px/s at 900p, life s, wobble), how slowly its bloom swells and goes,
   and which threads it tends to leave */
const SC_WAVE={
  heart: {n:2,gap:.1, spd:170,life:.9, wob:0,  bloomIn:.12,bloomOut:2.2,blob:.75, curve:.15,stem:.1, burst:.05},   // a quick double pulse
  voice: {n:1,gap:0,  spd:70, life:2.8,wob:0,  bloomIn:.7, bloomOut:5,  blob:1.1, curve:.75,stem:.1, burst:.05},   // one wide slow ring, long threads
  bone:  {n:3,gap:.05,spd:230,life:.6, wob:0,  bloomIn:.08,bloomOut:1.6,blob:.5,  curve:.1, stem:.75,burst:.05},   // short hard rings, stepped stems
  memory:{n:2,gap:.45,spd:95, life:2.2,wob:0,  bloomIn:.5, bloomOut:5.5,blob:.9,  curve:.5, stem:.15,burst:.05},   // it comes back: an echo ring after a pause
  soul:  {n:1,gap:0,  spd:45, life:3.8,wob:0,  bloomIn:1.3,bloomOut:7,  blob:1.7, curve:.2, stem:.05,burst:.45},   // a slow halo that swells in
  dream: {n:4,gap:.28,spd:60, life:3.2,wob:.12,bloomIn:.9, bloomOut:6,  blob:1.2, curve:.45,stem:.05,burst:.05},   // drifting, wavering rings
  sense: {n:2,gap:.16,spd:120,life:1.6,wob:0,  bloomIn:.3, bloomOut:3.5,blob:.8,  curve:.2, stem:.2, burst:.6 } }; // thin rings, a spark
const SC_LANE=[-.17,-.085,.085,.17];
const scCv=document.createElement('canvas'); scCv.id='score'; scCv.setAttribute('aria-hidden','true');
scCv.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:screen;z-index:0';
const sprayCv=document.createElement('canvas'); sprayCv.setAttribute('aria-hidden','true');   // THE DEEP's airbrush: the 3D picture sprayed back over itself
sprayCv.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:screen;z-index:0;opacity:0';
const sprayG=sprayCv.getContext('2d');
const raysEl=document.createElement('div'); raysEl.setAttribute('aria-hidden','true');
{ const c=document.createElement('canvas'), w=512, h=256; c.width=w; c.height=h; const x2=c.getContext('2d'), d=x2.createImageData(w,h);
  const pools=[...Array(4)].map(()=>({c:Math.random(),w:.18+Math.random()*.22,a:.5+Math.random()*.5}));   // a few wide, soft pools of light: a haze, not beams
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const v=y/h, u=x/w; let I=.55;
    for(const r of pools){ let dx=Math.abs(u-r.c); dx=Math.min(dx,1-dx); I+=r.a*Math.exp(-dx*dx/(r.w*r.w)); }   // wraps, so it can repeat as you turn
    I*=Math.pow(1-v,2.2)*.6; const n=(Math.random()-.5)*2.2, i=(y*w+x)*4;                                    // pre-dithered: no banding
    d.data[i]=Math.max(0,Math.min(255,78*I+n)); d.data[i+1]=Math.max(0,Math.min(255,112*I+n)); d.data[i+2]=Math.max(0,Math.min(255,165*I+n)); d.data[i+3]=255; }
  x2.putImageData(d,0,0);
  raysEl.style.cssText=`position:absolute;inset:0;pointer-events:none;z-index:0;mix-blend-mode:screen;opacity:0;background:url(${c.toDataURL()}) 0 0/auto 100% repeat-x;filter:blur(18px)`; }
renderer.domElement.after(raysEl);
function raysTick(){ const on=state==='play'&&!paused;   // only in the sea: THE DEEP is the abyss, no light reaches it
  const look=sstep(-0.7,0.25,me.pitch);   // looking up: the light; looking down: the floor
  raysEl.style.opacity=on?((state==='play'?0.38:0.24)*fade*(0.25+0.75*look)).toFixed(3):'0';
  if(on){ const w=raysEl.clientHeight*2; raysEl.style.backgroundPosition=`${(-(me.yaw/TAU)*w*1.5).toFixed(1)}px ${(Math.min(0,me.pitch)*raysEl.clientHeight*0.35).toFixed(1)}px`; } }   // only ever slides up: its top edge never shows
let sprayN=0;
function sprayTick(){ const on=!paused&&(state==='archive'||state==='sleep'||state==='play'); sprayCv.style.opacity=on?String((state==='play'?.7:.85)*fade):'0'; scVeil.style.opacity=on?'1':'0'; if(!on||(++sprayN&1)) return;   // every other frame: the copy back from the GPU is the costly part
  const w=Math.max(1,renderer.domElement.width/4|0), h=Math.max(1,renderer.domElement.height/4|0); if(sprayCv.width!==w){ sprayCv.width=w; sprayCv.height=h; scVeil.width=w; scVeil.height=h; veilMask.width=w; veilMask.height=h; }
  sprayG.globalCompositeOperation='copy'; sprayG.filter='blur(3px)'; sprayG.drawImage(renderer.domElement,0,0,w,h); sprayG.filter='none';
  // the mask: the picture's edges (a gaussian softening toward the rim), and — while a being's music is open — the area behind it
  vmG.globalCompositeOperation='source-over'; vmG.clearRect(0,0,w,h); vmG.globalCompositeOperation='lighter';
  vmG.save(); vmG.translate(w/2,h*.55); vmG.scale(1,h/w*1.25); const eg=vmG.createRadialGradient(0,0,w*.2,0,0,w*.6); eg.addColorStop(0,'rgba(0,0,0,0)'); eg.addColorStop(1,`rgba(0,0,0,${state==='play'?.95:.8})`); vmG.fillStyle=eg; vmG.fillRect(-w,-w,w*2,w*2); vmG.restore();
  const V=SCORE.veil; if(V&&V.a>0.01){ const sx=w/stageEl.clientWidth; vmG.save(); vmG.translate(V.x*sx,V.y*sx); vmG.scale(1,V.ry/V.rx); const vg=vmG.createRadialGradient(0,0,0,0,0,V.rx*sx);
    vg.addColorStop(0,`rgba(0,0,0,${V.a})`); vg.addColorStop(.4,`rgba(0,0,0,${V.a*.8})`); vg.addColorStop(.75,`rgba(0,0,0,${V.a*.35})`); vg.addColorStop(1,'rgba(0,0,0,0)'); vmG.fillStyle=vg; vmG.fillRect(-V.rx*sx,-V.rx*sx,V.rx*sx*2,V.rx*sx*2); vmG.restore(); }
  veilG.globalCompositeOperation='copy'; veilG.filter='blur(4px)'; veilG.drawImage(sprayCv,0,0); veilG.filter='none'; veilG.globalCompositeOperation='destination-in'; veilG.drawImage(veilMask,0,0);
  if(V&&V.a>0.01){ veilG.globalCompositeOperation='source-atop'; veilG.fillStyle=`rgba(0,0,0,${.28*V.a})`; veilG.fillRect(0,0,w,h); }   // and a little hush behind the music
  veilG.globalCompositeOperation='source-over'; }
{ const eb=document.getElementById('edgeblur'); if(eb) eb.style.display='none'; }   // replaced by the masked blur below
const scVeil=document.createElement('canvas'); scVeil.setAttribute('aria-hidden','true');   // the blurred picture, shown at the edges and behind a being's music
scVeil.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0';
const veilG=scVeil.getContext('2d'), veilMask=document.createElement('canvas'), vmG=veilMask.getContext('2d');
renderer.domElement.after(sprayCv); sprayCv.after(scVeil); scVeil.after(scCv);
const scG=scCv.getContext('2d'), scRaw=document.createElement('canvas'), scR=scRaw.getContext('2d'), scTmp=document.createElement('canvas'), scT=scTmp.getContext('2d'), scBl=document.createElement('canvas'), scB=scBl.getContext('2d'),
  scRing=document.createElement('canvas'), scQ=scRing.getContext('2d'), scMix=document.createElement('canvas'), scM=scMix.getContext('2d');
const scGrain=(()=>{ const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d'), d=g.createImageData(256,256);
  for(let i=0;i<d.data.length;i+=4){ const v=Math.pow(R(),.55); d.data[i]=d.data[i+1]=d.data[i+2]=255; d.data[i+3]=v*255|0; } g.putImageData(d,0,0); return c; })();
const SCORE={b:null,want:0,P:0,evs:[],axis:[],grains:[],last:null,env:{},eDown:false,eT:0,eDone:false,pings:[]};
function scoreResize(){ const w=stageEl.clientWidth||innerWidth, h=stageEl.clientHeight||innerHeight;
  scCv.width=w*DPR|0; scCv.height=h*DPR|0; const k=.6; for(const c of [scRaw,scTmp,scRing,scMix]){ c.width=scCv.width*k|0; c.height=scCv.height*k|0; } scBl.width=scCv.width/3|0; scBl.height=scCv.height/3|0; }   // not too small: a coarser copy shows as bands when laid back
function scoreOpen(b){ SCORE.b=b; SCORE.want=1; SCORE.last=null; if(A.ctx){ setBase(0.85); setMix(b.e.parts,1,b.e.name); oceanTo(.45,2); } }   // the base melody and the being's four rise over the sea
function scoreClose(){ if(!SCORE.want) return; SCORE.want=0; mixKey=''; if(A.ctx&&state==='archive'){ setBase(0); const eye=J.set.includes('sense'); setMix(eye?['sense']:[],eye?0.22:0); oceanTo(1,3); } }
function scoreMeasure(dt){ if(!A.anB) return; for(const id of STEM_IDS){ const M=A.anB[id]; if(!M) continue; M.an.getFloatTimeDomainData(M.buf); let s=0; for(let i=0;i<M.buf.length;i+=2) s+=M.buf[i]*M.buf[i];
  const v=Math.min(1,Math.sqrt(s/(M.buf.length/2))*6); SCORE.env[id]=(SCORE.env[id]||0)+(v-(SCORE.env[id]||0))*Math.min(1,dt*10); } }
function scRnd(seed){ let s=seed; return ()=>(s=(s*16807)%2147483647)/2147483647; }
function scoreEvents(tNow){
  if(!(SCORE.want&&SCORE.P>1.2&&SCORE.b)){ SCORE.last=null; return; }
  const STEP=BEAT/4, s=Math.floor(tNow/STEP); if(SCORE.last===null) SCORE.last=s;
  for(let q=SCORE.last+1;q<=s;q++){ const m=((q%32)+32)%32;
    SCORE.b.e.parts.forEach((id,k)=>{ const hit=(SC_BEATS[id]||[]).find(h=>h[0]===m); if(!hit) return;
      const v=hit[1]*(.6+.6*Math.min(1,(SCORE.env[id]||.25)*2)), W=SC_WAVE[id], seed=1+R()*2e9|0, r=scRnd(seed), kinds=[];
      if(r()<W.curve) kinds.push({t:'curve',to:Math.max(-.3,Math.min(.3,SC_LANE[k]+(r()-.5)*.26)),L:.05+r()*.14,run:.1+r()*.32});
      if(r()<W.stem) kinds.push({t:'stem',from:(r()<.5?-1:1)*(.27+r()*.06),j:.01+r()*.03,steps:1+(r()*3|0)});
      if(r()<W.burst*v) kinds.push({t:'burst',n:12+(r()*10|0)});
      SCORE.evs.push({k,id,v,te:q*STEP,seed,kinds}); SCORE.b.obj.material.uniforms.uGlow.value=Math.min(1.6,SCORE.b.obj.material.uniforms.uGlow.value+.35*v); });
    if(m%4===0) SCORE.axis.push({te:q*STEP,v:.35+Math.min(1,(SCORE.env.melody||0)*2.5)*.65,bar:m%16===0}); }
  SCORE.last=s; }
function scoreDraw(dt,tNow,warm){
  const Wd=scRaw.width, H=scRaw.height, u=H/900, g=scR, P=SCORE.P;
  // short trails: the old frame fades rather than vanishing (as the archive's water does)
  g.globalCompositeOperation='destination-out'; g.fillStyle=`rgba(0,0,0,${Math.min(1,dt*9)})`; g.fillRect(0,0,Wd,H);
  if(P<=.001||!SCORE.b){ SCORE.veil=null; if(SCORE.drawn){ g.clearRect(0,0,Wd,H); scQ.clearRect(0,0,Wd,H); scG.clearRect(0,0,scCv.width,scCv.height); SCORE.drawn=false; } SCORE.evs=[]; SCORE.axis=[]; SCORE.grains=[]; return; }
  SCORE.drawn=true; scG.clearRect(0,0,scCv.width,scCv.height);
  proj.copy(SCORE.b.obj.position).project(camera); if(proj.z>1) return;
  const bx=(proj.x+1)/2*Wd, cy=(1-proj.y)/2*H, gA=sstep(.6,2.2,P);
  const X0=Math.min(Wd*.8,bx+H*.36), V=105*u, xL=bx+H*.15, xR=Math.min(Wd*.98,X0+Wd*.42);
  { const sw=stageEl.clientWidth/Wd, cxv=((xL+xR)/2+Wd*.03)*sw, cyv=cy*sw, rx=(xR-xL)*.55*sw, ry=H*.46*sw, m=`radial-gradient(ellipse ${rx*1.25|0}px ${ry*1.15|0}px at ${cxv+rx*.15|0}px ${cyv|0}px, rgba(0,0,0,1) 0%, rgba(0,0,0,.75) 35%, rgba(0,0,0,.3) 70%, rgba(0,0,0,0) 100%)`;
    SCORE.veil={x:cxv+rx*.15,y:cyv,rx:rx*1.25,ry:ry*1.15,a:sstep(.2,1.6,P)}; }
  const sx=te=>X0-(tNow-te)*V, fadeX=x=>Math.max(0,Math.min(1,(x-xL)/(90*u)))*Math.max(0,Math.min(1,(xR-x)/(70*u)));
  const C=warm?[255,226,184]:[206,218,255], C2=warm?[236,160,92]:[96,140,255];   // the light, and its airbrush wash
  const col=(a,c=C)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;
  g.globalCompositeOperation='lighter';
  g.save(); g.beginPath(); g.rect(xL-10*u,0,Wd,H); g.clip();
  const env=SCORE.env, parts=SCORE.b.e.parts, grow=sstep(.8,2.4,P);
  // grains drifting in toward the now line, more where a sound is loud
  if(SCORE.want&&P>1){ parts.forEach((id,k)=>{ if(R()<dt*(3+22*(env[id]||0))) SCORE.grains.push({y:SC_LANE[k]+(R()-.5)*.02,x:xR+R()*40*u,s:R()}); }); if(R()<dt*6) SCORE.grains.push({y:(R()-.5)*.5,x:xR,s:R()}); }
  g.fillStyle=col(.8*gA); for(const p of SCORE.grains){ p.x-=V*dt*(1.05+p.s*.4); const a=fadeX(p.x)*gA*(.35+.65*p.s); if(a<=0) continue; g.globalAlpha=a; g.fillRect(p.x,cy+p.y*H,(2+p.s*6)*u,1.3*u); }
  g.globalAlpha=1; SCORE.grains=SCORE.grains.filter(p=>p.x>X0);
  // the lanes and the axis (the base melody), drawn out of the now line as it arrives
  const reachL=X0-xL, reachR=lerp(xL,xR,grow)-X0;   // the lanes draw out of the sculpture's side, toward the right
  if(reachL+reachR>1){
    parts.forEach((id,k)=>{ const y=cy+SC_LANE[k]*H, e=Math.min(1,(env[id]||0)*2), lg=g.createLinearGradient(X0-reachL,0,X0+reachR,0);
      lg.addColorStop(0,col(0)); lg.addColorStop(.25,col(.4*gA)); lg.addColorStop(.75,col(.28*gA)); lg.addColorStop(1,col(0));
      g.strokeStyle=lg; g.lineWidth=(.7+e*2.4)*u; g.beginPath(); g.moveTo(X0-reachL,y); g.lineTo(X0+reachR,y); g.stroke(); });
    const lg=g.createLinearGradient(X0-reachL,0,X0+reachR,0); lg.addColorStop(0,col(0)); lg.addColorStop(.2,col(.75*gA)); lg.addColorStop(.85,col(.5*gA)); lg.addColorStop(1,col(0));
    g.strokeStyle=lg; g.lineWidth=2.2*u; g.beginPath(); g.moveTo(X0-reachL,cy); g.lineTo(X0+reachR,cy); g.stroke(); }
  for(const b of SCORE.axis){ const x=sx(b.te), a=fadeX(x)*gA*sstep(0,.3,tNow-b.te+.3); if(a<=0) continue; const r=(b.bar?5:3)*u*(.6+b.v*.8); g.fillStyle=col(.9*a); g.beginPath(); g.ellipse(x,cy,r*1.7,r,0,0,TAU); g.fill(); }
  SCORE.axis=SCORE.axis.filter(b=>sx(b.te)>xL-40*u);
  // what each hit leaves, in its own time
  for(const e of SCORE.evs){ const age=tNow-e.te, x=sx(e.te), y=cy+SC_LANE[e.k]*H, fa=fadeX(x)*gA; if(fa<=0||age<0) continue; const W=SC_WAVE[e.id], r=scRnd(e.seed);
    { const rb=(40+130*sstep(0,W.bloomIn*2+.4,age))*u*(.6+.5*e.v)*W.blob, ab=sstep(0,W.bloomIn,age)*(1-sstep(W.bloomOut*.3,W.bloomOut,age))*.5*e.v*fa;   // the airbrush bloom: in slowly, out slowly
      if(ab>0){ const gr=g.createRadialGradient(x,y,0,x,y,rb); gr.addColorStop(0,col(ab,C2)); gr.addColorStop(.45,col(ab*.45,C2)); gr.addColorStop(1,col(0,C2)); g.fillStyle=gr; g.beginPath(); g.arc(x,y,rb,0,TAU); g.fill(); } }
    for(let i=0;i<W.n;i++){ const ag=age-i*W.gap; if(ag<0) continue;                                                        // the wave
      const rr=(5+ag*W.spd)*u*(.7+.4*e.v), a=sstep(0,.06,ag)*(1-sstep(W.life*.25,W.life,ag))*fa*(1-i*.18);
      if(a>0){ g.strokeStyle=col(a*.8); g.lineWidth=(1.5-i*.25)*u;
        if(W.wob>0){ g.beginPath(); for(let j=0;j<=48;j++){ const an=j/48*TAU, w=1+W.wob*Math.sin(an*5+ag*3+i); j?g.lineTo(x+Math.cos(an)*rr*w,y+Math.sin(an)*rr*w):g.moveTo(x+Math.cos(an)*rr*w,y+Math.sin(an)*rr*w); } g.stroke(); }
        else { g.beginPath(); g.arc(x,y,rr,0,TAU); g.stroke(); } } }
    { const ra=(3+5*e.v)*u, a=fa*sstep(0,.05,age); g.fillStyle=col(.95*a); g.beginPath(); g.ellipse(x,y,ra*1.4,ra,0,0,TAU); g.fill();   // the bead
      g.strokeStyle=col(.55*a); g.lineWidth=1*u; g.beginPath(); g.arc(x,y,ra*2.4,0,TAU); g.stroke(); }
    for(const kd of e.kinds){
      if(kd.t==='curve'){ const gr=sstep(0,.8,age), ex=x-kd.L*Wd, ey=cy+kd.to*H, run=kd.run*Wd, a=fa*sstep(0,.2,age);
        g.strokeStyle=col(.75*a); g.lineWidth=1.3*u; g.beginPath(); g.moveTo(x,y); for(let i=1;i<=24*gr;i++){ const q=i/24; g.lineTo(lerp(x,ex,q),lerp(y,ey,sstep(0,1,q))); } g.stroke();
        if(gr>=1){ const rg=sstep(.8,1.8,age); g.beginPath(); g.moveTo(ex,ey); g.lineTo(ex-run*rg,ey); g.stroke(); g.fillStyle=col(.9*a);
          for(let i=0;i<=5*rg;i++){ const bx2=ex-run*i/5; g.beginPath(); g.arc(bx2,ey,(i===0?3.2:2)*u,0,TAU); g.fill(); } } }
      else if(kd.t==='stem'){ const gr=sstep(0,.9,age), y0=cy+kd.from*H, jx=kd.j*Wd, a=fa*sstep(0,.2,age); g.strokeStyle=col(.6*a); g.lineWidth=1.1*u;
        const pts=[[x-jx*kd.steps,y0]]; for(let s=0;s<kd.steps;s++){ const yy=lerp(y0,y,(s+1)/(kd.steps+1)); pts.push([x-jx*(kd.steps-s),yy],[x-jx*(kd.steps-s-1),yy]); } pts.push([x,y]);
        let L=0; for(let i=1;i<pts.length;i++) L+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]); let left=L*gr;
        g.beginPath(); g.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length&&left>0;i++){ const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1])||1, q=Math.min(1,left/d); g.lineTo(lerp(pts[i-1][0],pts[i][0],q),lerp(pts[i-1][1],pts[i][1],q)); left-=d; } g.stroke();
        g.fillStyle=col(.85*a); g.beginPath(); g.arc(pts[0][0],pts[0][1],2.4*u,0,TAU); g.fill(); }
      else if(kd.t==='burst'){ const a=sstep(0,.1,age)*(1-sstep(.3,1.8,age))*fa; if(a>0){ g.strokeStyle=col(.8*a); g.lineWidth=.8*u;
        for(let i=0;i<kd.n;i++){ const an=i/kd.n*TAU+age*.4, r1=(9+r()*14)*u*sstep(0,.4,age); g.beginPath(); g.moveTo(x+Math.cos(an)*4*u,y-26*u+Math.sin(an)*4*u); g.lineTo(x+Math.cos(an)*r1,y-26*u+Math.sin(an)*r1); g.stroke(); } } } } }
  SCORE.evs=SCORE.evs.filter(e=>sx(e.te)>xL-Wd*.35);
  g.restore(); g.save();
  SCORE.pings=SCORE.pings.filter(pg=>clock-pg.t<3);
  g.restore(); g.save(); g.beginPath(); g.rect(xL-10*u,0,Wd,H); g.clip();
  // the now line: upright, soft, swelling where the sounds are loud (9)
  { const hk=sstep(.5,1.8,P), y0=lerp(cy,cy-H*.3,hk), y1=lerp(cy,cy+H*.3,hk);
    if(y1-y0>1){ const lg=g.createLinearGradient(0,y0,0,y1); lg.addColorStop(0,col(0)); lg.addColorStop(.15,col(.75*gA)); lg.addColorStop(.85,col(.75*gA)); lg.addColorStop(1,col(0));
      g.strokeStyle=lg; g.lineWidth=2.6*u; g.beginPath(); g.moveTo(X0,y0); g.lineTo(X0,y1); g.stroke();
      const sw=(yy,amt)=>{ if(amt<.02) return; const rh=(8+amt*50)*u, gr=g.createRadialGradient(X0,yy,0,X0,yy,rh); gr.addColorStop(0,col(.8*gA*Math.min(1,amt*1.5))); gr.addColorStop(1,col(0));
        g.fillStyle=gr; g.beginPath(); g.ellipse(X0,yy,(3+amt*16)*u,rh,0,0,TAU); g.fill(); };
      parts.forEach((id,k)=>sw(cy+SC_LANE[k]*H,Math.min(1,(env[id]||0)*2.4)));
      sw(cy,Math.min(1,((env.pad||0)+(env.melody||0))*1.6)); } }
  g.restore();
  g.globalCompositeOperation='destination-out'; { const eg=g.createLinearGradient(xL-10*u,0,xL+240*u,0); eg.addColorStop(0,'rgba(0,0,0,1)'); eg.addColorStop(.5,'rgba(0,0,0,.45)'); eg.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=eg; g.fillRect(xL-10*u,0,250*u,H); }
  g.globalCompositeOperation='source-over';
  // the arrival ring, on its own layer so the fade at the sculpture's side never cuts it; then both together make the drawing
  { const q=scQ; q.globalCompositeOperation='destination-out'; q.fillStyle=`rgba(0,0,0,${Math.min(1,dt*9)})`; q.fillRect(0,0,Wd,H); q.globalCompositeOperation='lighter';
  // arriving (VisRef/9's opening): a wide ring swells out of the dark, an arc of grains sweeps round it
  { const k=sstep(0,2.2,P), a=Math.sin(Math.PI*Math.min(1,P/2.4))*(SCORE.want?1:.5); if(a>.01){ const r=lerp(H*.08,H*.55,k), Xc=bx;
      const rg=q.createRadialGradient(Xc,cy,r*.9,Xc,cy,r*1.08); rg.addColorStop(0,col(0,C2)); rg.addColorStop(.5,col(a*.55,C2)); rg.addColorStop(1,col(0,C2)); q.fillStyle=rg; q.beginPath(); q.arc(Xc,cy,r*1.1,0,TAU); q.fill();
      q.strokeStyle=col(a*.85); q.lineWidth=(1.5+5*(1-k))*u; q.beginPath(); q.arc(Xc,cy,r,0,TAU); q.stroke();
      q.lineWidth=1*u; q.strokeStyle=col(a*.35); q.beginPath(); q.arc(Xc,cy,r*.62,0,TAU); q.stroke();
      q.fillStyle=col(a*.9); for(let i=0;i<90;i++){ const an=-2.1+P*1.4+i*.02+Math.sin(i*7.1)*.025, rr=r*(1.02+.06*Math.sin(i*3.3)); q.beginPath(); q.arc(Xc+Math.cos(an)*rr,cy+Math.sin(an)*rr,(.9+(i%6===0)*1.2)*u,0,TAU); q.fill(); } } }
    q.globalCompositeOperation='source-over'; }
  scM.globalCompositeOperation='copy'; scM.drawImage(scRaw,0,0); scM.globalCompositeOperation='lighter'; scM.drawImage(scRing,0,0); scM.globalCompositeOperation='source-over';
  // into the archive's grain: a wide soft blur under, the drawing stippled through grain over it, the names of the four by the line
  const D=scCv.width/Wd;
  scB.clearRect(0,0,scBl.width,scBl.height); scB.filter='blur(3px)'; scB.drawImage(scMix,0,0,scBl.width,scBl.height); scB.filter='none';   // blurred small, then laid back large: cheap airbrush
  // an echo bends the drawing: lay it down in horizontal strips, each pushed sideways by the wave passing its height
  const pg=SCORE.pings[SCORE.pings.length-1], pAge=pg?clock-pg.t:9, bend=pAge<2.2?(1-pAge/2.2):0;
  const lay=(img,alpha)=>{ scG.globalAlpha=alpha; if(bend<=0){ scG.drawImage(img,0,0,scCv.width,scCv.height); return; }
    const n=90, sh=scCv.height/n, iy=img.height/n, cx=pg.x*scCv.width, cyp=pg.y*scCv.height, front=pAge*scCv.height*.9;
    for(let i=0;i<n;i++){ const y=i*sh+sh/2, dy=y-cyp, reachX=Math.sqrt(Math.max(0,front*front-dy*dy)), w=Math.exp(-Math.pow((Math.abs(dy)-front)/(scCv.height*.12),2))+.35*(reachX>0?1:0);
      const off=Math.sin(y*.045-pAge*14)*scCv.height*.018*bend*w; scG.drawImage(img,0,i*iy,img.width,iy,off,i*sh,scCv.width,sh+1); } };
  scG.globalCompositeOperation='source-over'; scG.imageSmoothingEnabled=true; lay(scBl,.9);
  scT.globalCompositeOperation='source-over'; scT.clearRect(0,0,scTmp.width,scTmp.height); scT.drawImage(scMix,0,0);
  scT.globalCompositeOperation='destination-in'; const pat=scT.createPattern(scGrain,'repeat'); scT.save(); scT.translate(R()*256,R()*256); scT.fillStyle=pat; scT.fillRect(-256,-256,scTmp.width+512,scTmp.height+512); scT.restore();
  lay(scTmp,1); lay(scMix,.45); scG.globalAlpha=1;
  scG.globalCompositeOperation='soft-light'; scG.globalAlpha=.08; scG.fillStyle=scG.createPattern(scGrain,'repeat'); scG.fillRect(0,0,scCv.width,scCv.height); scG.globalAlpha=1; scG.globalCompositeOperation='source-over';   // dither: no smooth gradient left to band
  const lA=sstep(1.4,2.6,P); if(lA>0){ scG.font=`300 ${9*u*D}px "Josefin Sans"`; scG.textAlign='left'; scG.fillStyle=col(.6*lA);
    parts.forEach((id,k)=>scG.fillText(EL[id].en.split('').join(String.fromCharCode(8202)),(X0+12*u)*D,(cy+SC_LANE[k]*H-6*u)*D)); }
  // while E is held, a pearl ring fills by the being
  if(SCORE.eDown&&!SCORE.eDone&&clock-SCORE.eT>.12){ const k=Math.min(1,(clock-SCORE.eT)/.6), hx=bx*D, hy=(cy+H*.2)*D; scG.strokeStyle='rgba(232,214,176,.9)'; scG.lineWidth=1.8*u*D;
    scG.beginPath(); scG.arc(hx,hy,16*u*D,-Math.PI/2,-Math.PI/2+TAU*k); scG.stroke(); }
}
/* each frame in THE DEEP: hold E to open / close; walking away or sleeping lets it go; the view turns so the being sits left of its music */
function scoreTick(dt){
  const inDeep=state==='archive';
  if(SCORE.eDown&&!SCORE.eDone&&clock-SCORE.eT>=.6){ SCORE.eDone=true; if(SCORE.want) scoreClose(); else if(nearB&&nearV>LISTEN_V) scoreOpen(nearB); }
  if(SCORE.want&&(!inDeep||!SCORE.b||SCORE.b!==nearB&&SCORE.b.obj.position.distanceTo(me.pos)>24)) scoreClose();
  SCORE.P=Math.max(0,Math.min(3,SCORE.P+(SCORE.want?dt:-dt*1.6)));
  if(SCORE.want&&SCORE.b&&!ptr.drag&&!keys.size){ const c=SCORE.b.obj.position, d=tmp2.subVectors(c,me.pos), dist=d.length();      // turn gently so the being sits left of its music
    forwardVec(fwd); right.set(-fwd.z,0,fwd.x).normalize(); const aim=tmp.copy(c).addScaledVector(right,dist*.42).sub(me.pos), k=Math.min(1,dt*1.2)*sstep(0,1.2,SCORE.P);
    me.yaw+=angTo(me.yaw,Math.atan2(-aim.x,-aim.z))*k; me.pitch+=(Math.asin(Math.max(-1,Math.min(1,aim.y/aim.length())))-me.pitch)*k; me.vel.multiplyScalar(1-Math.min(1,dt*1.5)); }
  if(A.ctx&&A.ready){ scoreMeasure(dt); const tNow=A.ctx.currentTime-A.T0; scoreEvents(tNow); scoreDraw(dt,tNow,J.set.includes('sense')); }
  else scoreDraw(dt,clock,J.set.includes('sense'));
}


/* ───────── into THE DEEP: not a black hole but the sea — the picture wavers as if seen through a surface, streams of bubbles rush
   up past you as you sink, the light from above thins out and is gone; THE DEEP then rises out of the dark ───────── */
const wvSvg=document.createElementNS('http://www.w3.org/2000/svg','svg'); wvSvg.setAttribute('width','0'); wvSvg.setAttribute('height','0'); wvSvg.style.position='absolute';
wvSvg.innerHTML='<filter id="sbSink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence id="sbSinkT" type="fractalNoise" baseFrequency="0.006 0.022" numOctaves="2" seed="7" result="n"/><feDisplacementMap id="sbSinkD" in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter>';
document.body.appendChild(wvSvg);
const sinkCv=document.createElement('canvas'); sinkCv.setAttribute('aria-hidden','true');
sinkCv.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4;opacity:0';
stageEl.appendChild(sinkCv); const sinkG=sinkCv.getContext('2d');
let sink=null;
function sinkSound(){ const C=A.ctx; if(!C) return; const t=C.currentTime;
  const n=C.createBufferSource(); n.buffer=A.noise; n.loop=true; const lp=C.createBiquadFilter(); lp.type='lowpass'; lp.frequency.setValueAtTime(1800,t); lp.frequency.exponentialRampToValueAtTime(180,t+4);
  const g=C.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.32,t+0.5); g.gain.linearRampToValueAtTime(0.0001,t+4.8); n.connect(lp); lp.connect(g); g.connect(A.master); g.connect(A.rev); n.start(t); n.stop(t+5);
  for(let i=0;i<26;i++){ const s=t+0.2+Math.pow(R(),1.6)*3.6, o=osc(C,'sine',500+R()*900), og=C.createGain();   // bubbles going up
    o.frequency.setValueAtTime(o.frequency.value,s); o.frequency.exponentialRampToValueAtTime(o.frequency.value*2.2,s+0.06);
    og.gain.setValueAtTime(0,s); og.gain.linearRampToValueAtTime(0.025,s+0.005); og.gain.exponentialRampToValueAtTime(0.0001,s+0.09); o.connect(og); og.connect(A.master); og.connect(A.rev); o.start(s); o.stop(s+0.1); } }
function sinkInto(done){
  const w=stageEl.clientWidth, h=stageEl.clientHeight; sinkCv.width=w*DPR|0; sinkCv.height=h*DPR|0;
  sink={t0:clock,done,swapped:false,b:Array.from({length:420},()=>({x:R(),y:1+R()*1.6,s:R(),w:R()*TAU}))}; sinkSound();
}
function sinkTick(dt){
  if(!sink){ if(renderer.domElement.style.filter) renderer.domElement.style.filter=''; return; } const T=clock-sink.t0, W=sinkCv.width, H=sinkCv.height, u=H/900;
  // the picture wavers and blurs as it goes under, then comes back clear in the dark below
  const wav=sstep(0,1.4,T)*(1-sstep(3.4,4.6,T)), dim=sstep(.6,2.8,T)*(1-sstep(3.2,4.8,T));
  const D=document.getElementById('sbSinkD'), Tn=document.getElementById('sbSinkT');
  if(D){ D.setAttribute('scale',(wav*46).toFixed(1)); Tn.setAttribute('baseFrequency',`${(0.006+0.004*Math.sin(T*1.3)).toFixed(4)} ${(0.022+0.006*Math.sin(T*.9)).toFixed(4)}`); }
  renderer.domElement.style.filter=wav>0.01||dim>0.01?`url(#sbSink) blur(${(wav*3).toFixed(1)}px) brightness(${(1-dim*.85).toFixed(2)})`:'';
  // streams of bubbles rush up past you, fast, then thin out
  sinkCv.style.opacity=String(sstep(0,.4,T)*(1-sstep(4,5.4,T)));
  sinkG.clearRect(0,0,W,H); if(true){ sinkCv.style.opacity='0'; } else { sinkG.globalCompositeOperation='lighter';
  const spd=sstep(.2,1.6,T)*(1-sstep(3.6,5.2,T)*.7);
  for(const p of sink.b){ p.y-=dt*(.35+p.s*1.6)*spd; p.x+=Math.sin(T*3+p.w)*dt*.01; if(p.y<-.1){ p.y=1.05+R()*.4; p.x=R(); }
    const x=p.x*W, y=p.y*H, r=(1+p.s*p.s*5)*u, L=(6+p.s*40)*u*spd, a=(.12+.5*p.s)*(T<3.6?1:1-sstep(3.6,5.2,T));
    const lg=sinkG.createLinearGradient(x,y,x,y+L); lg.addColorStop(0,`rgba(200,214,255,${a})`); lg.addColorStop(1,'rgba(200,214,255,0)');
    sinkG.strokeStyle=lg; sinkG.lineWidth=r*.8; sinkG.beginPath(); sinkG.moveTo(x,y); sinkG.lineTo(x,y+L); sinkG.stroke();
    if(p.s>.75){ sinkG.strokeStyle=`rgba(220,230,255,${a*.8})`; sinkG.lineWidth=.8*u; sinkG.beginPath(); sinkG.arc(x,y,r*1.4,0,TAU); sinkG.stroke(); } }
  // the light from above thins and goes
  const lg=sinkG.createLinearGradient(0,0,0,H); lg.addColorStop(0,`rgba(120,140,220,${.22*(1-sstep(.8,2.6,T))*sstep(0,.5,T)})`); lg.addColorStop(.5,'rgba(120,140,220,0)');
  sinkG.globalCompositeOperation='source-over'; sinkG.fillStyle=lg; sinkG.fillRect(0,0,W,H); }   // (the rising streaks are off: only the wavering is kept)
  if(T>3.1&&!sink.swapped){ sink.swapped=true; sink.done(); }
  if(T>5.4){ renderer.domElement.style.filter=''; sinkG.clearRect(0,0,W,H); sinkCv.style.opacity='0'; sink=null; }
}

/* ───────── frame ───────── */
const sstep=(a,b,x)=>{ const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
const lerp=(a,b,k)=>a+(b-a)*k;
function swim(dt,bounds){
  forwardVec(fwd); right.set(Math.cos(me.yaw),0,-Math.sin(me.yaw));
  const acc=tmp.set(0,0,0);
  if(auto===0 && (state==='play'||state==='archive')){
    if(keys.has('w')||keys.has('arrowup')) acc.add(fwd);
    if(keys.has('s')||keys.has('arrowdown')) acc.sub(fwd);
    if(keys.has('d')||keys.has('arrowright')) acc.add(right);
    if(keys.has('a')||keys.has('arrowleft')) acc.sub(right);
    if(keys.has('e')&&state==='play') acc.y+=1; if(keys.has('q')) acc.y-=1;
  }
  if(acc.lengthSq()>0){ acc.normalize().multiplyScalar(13); me.vel.addScaledVector(acc,dt); moveHintDone=true; tut.move+=dt; }
  if(auto===0&&(state==='play'||state==='archive')&&window.SBCam&&SBCam.on){ const k=SBCam.swim(), sd=SBCam.side(); if(k>0){ me.vel.addScaledVector(fwd,k*6*dt); me.vel.addScaledVector(right,sd*4*dt); tut.move+=dt*Math.min(1,k); } else if(k<0) me.vel.addScaledVector(fwd,-SBCam.back()*5*dt); }   // with the camera: swim where you look, lean in to speed up
  me.vel.multiplyScalar(Math.pow(0.2,dt)); me.pos.addScaledVector(me.vel,dt);
  me.pos.x=Math.max(-bounds,Math.min(bounds,me.pos.x)); me.pos.y=Math.max(-20,Math.min(TOP,me.pos.y)); me.pos.z=Math.max(-bounds-30,Math.min(bounds,me.pos.z));
  if(state==='play'&&window.SBCam&&SBCam.on){ const d=tmp.subVectors(me.pos,SPH), r=d.length(), RMAX=60; if(r>RMAX){ d.multiplyScalar(1/r); me.pos.copy(SPH).addScaledVector(d,RMAX); const out=me.vel.dot(d); if(out>0) me.vel.addScaledVector(d,-out); } }   // with the camera you always glide: keep inside the sea's sphere, where the grains are
}
const proj=new THREE.Vector3();
let look=null, lastEchoAt=-99, nudgeAt=-99;   // a sound you have just reached: the view turns to it, briefly
const angTo=(a,b)=>{ let d=b-a; while(d>Math.PI) d-=TAU; while(d<-Math.PI) d+=TAU; return d; };
function tick(dt){
  clock+=dt; const t=clock;
  const cv=sstep(0.25,0.95,p);

  if(state==='play'){
    swim(dt,78);   // stay inside the sea
    if(look && t-look.t0<1.8 && auto===0 && !ptr.drag){ const dx=look.o.pos.x-me.pos.x, dy=look.o.pos.y-me.pos.y, dz=look.o.pos.z-me.pos.z, k=Math.min(1,dt*2.6)*(1-sstep(1.2,1.8,t-look.t0));
      me.yaw+=angTo(me.yaw,Math.atan2(-dx,-dz))*k; me.pitch+=(Math.asin(Math.max(-1,Math.min(1,dy/Math.hypot(dx,dy,dz))))-me.pitch)*k; }
    if(finaleT<0 && firstEchoT>0) J.path+=me.pos.distanceTo(lastPos);
    lastPos.copy(me.pos);
  }
  if(auto>0){
    const k=Math.min(1,dt*0.7);
    me.pos.x=lerp(me.pos.x,0,k); me.pos.y=lerp(me.pos.y,0,k); me.pos.z=lerp(me.pos.z,S.z+24,k);
    me.yaw=lerp(me.yaw,0,k); me.pitch=lerp(me.pitch,0,k);
    auto-=dt/6; if(auto<=0) auto=0;
  }

  if(state==='play'){
    const stuck=t-lastFind;
    let canTake=null;
    for(let i=0;i<orbs.length;i++){ const o=orbs[i];
      if(o.state==='hidden'){
        o.pos.set(o.base.x*lerp(1,0.8,cv)+Math.sin(t*0.07+i)*1.5, o.base.y*lerp(1,0.8,cv)+Math.sin(t*0.11+i*2)*0.8, S.z+(o.base.z-S.z)*lerp(1,0.8,cv));
        const d=o.pos.distanceTo(me.pos), since=t-o.litAt, lit=o.litAt>0&&since>0&&since<22;
        let g=0;
        if(firstEchoT>0 && lit){
          const reach=o.el.hidden?9:NEAR, far=o.el.hidden?16:FAR;                    // the EYE answers only from close by
          if(d<reach*0.78) g=0.5+0.2*Math.sin(t*2.2+i)+0.9*Math.exp(-since*1.4);         // within reach: it shines (come a little closer than before)
          else if(d<far*0.75) g=(o.el.hidden?.06:.12)*Math.exp(-since*0.9);           // out of reach: a faint glint, and only from nearer
        }
        if(colorV>0 && !o.el.hidden) g=Math.max(g,(0.5+0.12*Math.sin(t*1.4+i))*colorV);   // seen, now: no echo needed
        { const lim=o.el.hidden?22:80; if(firstEchoT>0&&d<lim&&t>(o.nextBreath||0)){ o.nextBreath=t+8+R()*4; const k=4+(secIdx++%8); ripO[k].set(o.pos.x,o.pos.y,o.pos.z,t); ripD[k].set(0,0,0,(o.el.hidden?.35:.7)*Math.max(.45,1.1-d/lim)); } }   // a hint, even unasked
        if(firstEchoT>0 && d<(o.el.hidden?9:NEAR) && t>o.nextCall && lit){ o.nextCall=t+6+R()*3; orbCall(o,1); o.pulse=t; }
        if(g>0.05&&(o.gs||0)<0.05) o.appearT=t;   // it begins to show
        o.gs=(o.gs||0)+(g-(o.gs||0))*Math.min(1,dt*(g>(o.gs||0)?1.6:3));   // in slowly, out a little quicker
        o.glow=o.gs; o.near=d<(o.el.hidden?9:NEAR) && lit && since>0;
        if(o.near){ canTake=o; if(!o.looked){ o.looked=true; look={o,t0:t}; } }
      } else if(o.state==='flying'){
        const k=sstep(0,1.3,t-o.tState); tmp.copy(me.pos).addScaledVector(fwd,9).add(UP4); o.pos.lerpVectors(o.from,tmp,k); o.glow=1.5*(1-k); if(k>=1){ o.state='kept'; o.glow=0; }   // up and away, into the row at the top
      } else if(o.state==='kept'){ o.glow=0;
      } else if(o.state==='toSlot'){ const k=sstep(0,2.6,t-o.tState); o.pos.lerpVectors(o.from,slotPos(o.id),k); o.glow=0.4+0.8*k; if(k>=1) o.state='bead';   // the being calls them home
      } else if(o.state==='bead'){ const lv=reefMat.uniforms.uLeave.value; o.pos.copy(slotPos(o.id)).sub(S).multiplyScalar(1-0.85*lv).add(S); o.glow=(0.5+0.25*Math.sin(t*1.3+i)+bass*0.4)*(1-lv); }
      else o.glow=Math.max(0,o.glow-dt);
    }
    if(tut.step<4 && (finaleT>=0 || heard()>0)){ tut.step=4; tutShow(''); }   // once a sound is taken (or the being forms) the tutorial is over
    if(finaleT<0 && tut.step<4){                                    // the tutorial runs first; the old hints wait
      if(CAMG&&canTake&&firstEchoT>0) tutShow('take');   // (cam.html) a sound within reach: how to take it comes first, whatever card was up
      else if(tut.step===0){ if(t-playT>1.5) tutShow('swim'); if(tut.move>1.4||(CAMG&&t-playT>8)) tut.step=1; }   // scrolling counts as moving; with the camera the echo card follows anyway
      else if(tut.step===1){ tutShow('echo'); if(firstEchoT>0){ tut.step=2; tut.goalT=t; } }
      else if(tut.step===2){ tutShow(CAMG&&t-tut.goalT>4.5?'listen':'goal'); if(t-tut.goalT>(CAMG?10:4.5)){ tut.step=3; tutShow(''); } }
      else { tutShow(canTake?'take':''); if(heard()>0){ tut.step=4; tutShow(''); } }
    }
    if((touchy||(window.SBCam&&SBCam.on)) && firstEchoT<0 && t-playT>4) setHint(ECHO_HINT);
    if(tut.step>=4 && finaleT<0 && !canTake && !hintShown && t-lastEchoAt>6 && t-nudgeAt>22){ nudgeAt=t; setHint(ECHO_HINT); }   // gentle, and rare
    if(hintShown==='click · send an echo' && tut.step>=4 && t-nudgeAt>8) setHint('');
    if(firstEchoT>0 && finaleT<0 && tut.step>=3){
      const since=t-firstEchoT;
      if(canTake){ if(tut.step>=4) setHint((CAMG?'make a fist · take ':'space · take ')+canTake.el.en.toLowerCase()); }
      else if(touchy && !moveHintDone && since>5 && since<18) setHint('drag to look around');
      else if(heard()===0 && since>=14 && since<38) setHint(CAMG?'glide toward the loudest answer · echo again':'follow the sound · echo again when it grows loud');
      else if(stuck>50 && heard()<NEED) setHint('sounds grow louder and brighter as you near them');
      else if(hintShown.startsWith('space ·')||hintShown.startsWith('make a fist')||hintShown.startsWith('glide toward')||hintShown.startsWith('drag')||hintShown.startsWith('follow')||hintShown.startsWith('sounds grow')) setHint('');
    }
    if(finaleT>0){
      const ft=t-finaleT;
      if(ft>10 && !saved){ saved=true; saveBeing(beingFromJourney()); }
      if(ft>5.5 && !J.named){ J.named=true; namedEl.querySelector('.nm').textContent=(J.name||'nameless'); namedEl.classList.remove('gone'); }
      if(ft>12.5 && J.named && !namedEl.classList.contains('gone')) namedEl.classList.add('gone');
      if(ft>13 && !J.said){ J.said=true; showBig('DESCENDING DEEPER','your being slips beneath',7.5,'당신의 존재가 깊이 가라앉습니다'); }
      reefMat.uniforms.uLeave.value=sstep(15,21,ft);
      if(ft>19.5 && !J.vortex){ J.vortex=true; fadeTarget=1;
        sinkInto(()=>goArchive()); }   // the sea takes you down (the black hole is only the way in, at the title)
    }
    if(partUntil && t>partUntil){ partEl.classList.add('gone'); partUntil=0; }
    if(t-lastInput>150 && finaleT<0) toOpening();
  }

  /* ── THE DEEP ── */
  if(state==='archive'){
    swim(dt,90);
    if(arcDirty) buildArchive();
    const aT=t-arcT;
    let best=null, bd=1e9;
    const r=renderer.domElement.getBoundingClientRect();
    for(const b of beings){
      b.obj.position.y=b.home.y+Math.sin(t*0.35+b.phase)*1.2; b.obj.position.x=b.home.x+Math.sin(t*0.13+b.phase)*0.8;
      const u=b.obj.material.uniforms; u.uTime.value=t; u.uFade.value=fade;
      const d=b.obj.position.distanceTo(me.pos); if(d<bd){ bd=d; best=b; }
      u.uGlow.value=Math.max(b.mine?0.35:0,u.uGlow.value-dt*0.15);
      /* each being's name hangs just below it */
      proj.copy(b.obj.position); proj.y-=9.8*b.sc; proj.project(camera);
      const vis=proj.z<1 && Math.abs(proj.x)<1.1 && Math.abs(proj.y)<1.1 && d<55;
      const pd=b.obj.position.distanceTo(lastPing.o), since=t-lastPing.t-pd/34, seenK=b.mine?1:(lastPing.t<0||since<0?0:Math.exp(-since*0.22));
      b.u_seen=seenK; if(seenK>0.15) b.seenAt=t;   // once an echo has shown it, it stays within reach of listening for a while
      b.tag.style.opacity=vis?(Math.min(1,(55-d)/20)*(b.mine?0.95:0.6)*fade*seenK).toFixed(2):0;
      if(vis){ b.tag.style.left=((proj.x+1)/2*r.width)+'px'; b.tag.style.top=((1-proj.y)/2*r.height)+'px'; }
    }
    const known=best&&(best.mine||(best.u_seen||0)>0.15||t-(best.seenAt??-99)<30||J.set.includes('sense'));   // seen by an echo (in the last 30 s), or the EYE is open: then every being can be listened to
    const nearT = best && bd<17 && known ? sstep(17,6,bd) : 0;
    if(best!==nearB){ if(nearB) nearB.obj.material.uniforms.uNear.value=0; nearB=best; mixKey=''; }
    nearV+=(nearT-nearV)*Math.min(1,dt*2);
    if(nearB){ const u=nearB.obj.material.uniforms; u.uNear.value=nearV;
      tmp2.copy(me.pos).sub(nearB.obj.position).multiplyScalar(1/nearB.sc); u.uDolL.value.copy(tmp2); }
    const key = nearB && nearV>0.08 ? nearB.e.id+':'+(nearV*5|0) : 'none';
    if(SCORE.want){ if(mixKey!=='score'){ mixKey='score'; setMix(SCORE.b.e.parts,1,SCORE.b.e.name); } }
    // (no music by nearness alone any more: in THE DEEP you hear the sea until you hold E)
    if(nearB && nearV>LISTEN_V && infoFor!==nearB){ infoFor=nearB;   // a new being comes near: its card comes in, and the sonar passes through it
      decodeInto(infoEl.querySelector('.no'),`THE DEEP ${String(nearB.mine&&!ownId?entries.length+1:numberOf(nearB.e.id)).padStart(3,'0')}${nearB.mine?'  ·  YOU':''}`);
      decodeInto(infoEl.querySelector('.parts'),nearB.e.parts.map(p=>EL[p].en).join(' / '));
      infoEl.querySelector('.ko').textContent=nearB.e.name?`dreamt by ${nearB.e.name}  ·  ${nearB.e.name}의 꿈`:'dreamt by someone nameless  ·  이름 없는 이의 꿈';
      infoEl.querySelector('.act').textContent=touchy?'tap · listen  ·  탭해서 듣기':'';   // on a keyboard, the bottom row says it
      infoEl.classList.remove('show'); void infoEl.offsetWidth; infoEl.classList.add('show');
      const bu=nearB.obj.material.uniforms; bu.uPingO.value.copy(nearB.obj.position); bu.uPingT.value=clock;
    }
    if(infoFor && (!nearB || nearB!==infoFor || nearV<0.2)){ infoFor=null; infoEl.classList.remove('show'); }   // a little slack, so it does not flicker at the edge
    infoEl.classList.toggle('gone',!infoFor);
    if(aT>5){ tutShow(touchy?'sleep':'deep'); const ring=tutEl.querySelector('.hold:not(.ehold):not(.palmHold):not(.eyesHold)'); if(ring) ring.style.strokeDashoffset=String(100-holdP*100);   // stays until you sleep
      const ls=tutEl.querySelector('.listen'); if(ls) ls.classList.toggle('dim',!(SCORE.want||nearB&&nearV>LISTEN_V));          // E lights up only when a being is close enough to listen to
      if(CAMG&&ls&&ls.dataset.on!==String(SCORE.want)){ ls.dataset.on=String(SCORE.want); const en=ls.querySelector('.en'), kr=ls.querySelector('.kr');   // (cam.html) while you listen, the same palm lets go
        if(en) en.innerHTML=SCORE.want?'open your palm<br>to stop':'near a being<br>open palm, still'; if(kr) kr.textContent=SCORE.want?'손바닥을 펴서 그만 듣기':'존재 가까이에서 손바닥 펴고 멈추기'; }
      const er=tutEl.querySelector('.ehold'); if(er) er.style.strokeDashoffset=String(100-(SCORE.eDown&&!SCORE.eDone?Math.min(1,(clock-SCORE.eT)/.6):0)*100); }   // and its ring fills while E is held
    if(ptr.down && !ptr.drag && t-ptr.t>0.6){ holdP=Math.min(1,holdP+dt/2.0); if(holdP>=1) startSleep(); } else holdP=Math.max(0,holdP-dt*1.5);
    if(t-lastInput>90) startSleep();
    forwardVec(fwd);
    dolphin.position.copy(me.pos); dolphin.rotation.set(me.pitch,me.yaw,0,'YXZ');
    dolMat.uniforms.uSwim.value=0.35+Math.min(1,me.vel.length()/4)*0.9; dolMat.uniforms.uTime.value=t; dolMat.uniforms.uFade.value=fade;
    dolMeshMat.uniforms.uSwim.value=dolMat.uniforms.uSwim.value; dolMeshMat.uniforms.uTime.value=t; dolMeshMat.uniforms.uFade.value=fade;
  }

  if(state==='sleep'){
    const ts=t-sleepT; sleepV=sstep(0.2,5.5,ts); fadeTarget=1-sstep(5,9,ts);
    for(const b of beings){ b.obj.material.uniforms.uFade.value=fade; b.obj.material.uniforms.uTime.value=t; b.obj.position.y-=dt*0.6; }
    dolMat.uniforms.uFade.value=fade; dolMeshMat.uniforms.uFade.value=fade; dolphin.position.y-=dt*0.4;
    if(ts>10){ state='end'; endT=t;
      const no='THE DEEP '+String(ownId?numberOf(ownId):entries.length+1).padStart(3,'0');   // only which one you are, and your name
      sealEl.textContent=J.name?`${no}  ·  ${J.name.toUpperCase()}`:no;
      { const v=endEl.querySelector('.verse'), s=v.dataset.t||(v.dataset.t=v.textContent); v.replaceChildren(...[...s].map((ch,i)=>{ const c=document.createElement('i'); c.textContent=ch; c.style.animationDelay=(0.3+i*0.07)+'s'; return c; })); }   // letter by letter, out of the water
      endEl.classList.remove('gone'); }
  } else if(state==='end'){ if(t-endT>4) againEl.classList.remove('gone'); if(t-endT>25) toOpening(); }

  if(bigUntil && t>bigUntil){ bigEl.classList.add('gone'); bigUntil=0; }
  raysTick(); neuronTick(t); irisTick(t); camTick(dt); if(state==='archive'||state==='sleep') kinTick(t); else if(kinLines.visible) kinLines.visible=false; scoreTick(dt); sinkTick(dt); warpTick(); sprayTick();

  forwardVec(fwd);
  if(state==='archive'||(state==='sleep'&&dolphin.visible)||(state==='end'&&dolphin.visible)){
    camera.position.copy(me.pos).addScaledVector(fwd,-7).add(tmp.set(0,1.8,0));
    camera.lookAt(tmp.copy(me.pos).addScaledVector(fwd,4));
  } else { camera.position.copy(me.pos); camera.lookAt(tmp.copy(me.pos).add(fwd)); }
  if(document.pointerLockElement===stageEl&&state!=='play'&&state!=='archive'&&state!=='sleep') document.exitPointerLock();
  if(!touchy&&document.pointerLockElement!==stageEl&&(state==='play'||state==='archive')&&auto===0&&!ptr.down&&hov.x>=0){   // the cursor free: at the screen's edge you keep turning that way
    const ex=hov.x/innerWidth, ey=hov.y/innerHeight, sx=ex<.06?-(1-ex/.06):ex>.94?(ex-.94)/.06:0, sy=ey<.06?-(1-ey/.06):ey>.94?(ey-.94)/.06:0;
    if(sx){ me.yaw+=sx*1.4*dt; if(finaleT<0&&state==='play') J.yaw+=sx*1.4*dt; } if(sy) me.pitch=Math.max(-1.3,Math.min(1.3,me.pitch-sy*.9*dt)); }
  setListener(me.pos,fwd); updateSpatial(); songTick();

  const nSet=heard();
  p+=(Math.min(nSet,NEED)/NEED-p)*Math.min(1,dt*0.3);
  if(colorT>0 && clock>colorT) colorV=Math.min(1,colorV+dt*0.25);
  const baseTarget = firstEchoT<0 ? 0 : finaleT>0 ? 1 : 0.015+0.3*p+0.25*colorV;   // the sea is dark: the echo and the light from above do the showing
  base+=(baseTarget-base)*Math.min(1,dt*(finaleT>0?0.35:0.6));
  fade+=(fadeTarget-fade)*Math.min(1,dt*(fadeTarget>fade?0.7:1.2));
  if(state==='sleep') fade=Math.min(fade,fadeTarget+0.02);
  flash*=Math.pow(0.12,dt);
  if(A.an){ A.an.getByteFrequencyData(A.fft); let b=0; for(let i=0;i<5;i++) b+=A.fft[i]; b/=5*255; bass+=(b-bass)*0.25; }
  const uB=REDUCED?0:Math.max(0,bass-0.55)*2.4;
  const ink=finaleT>0?sstep(0,7,t-finaleT):0;
  reefMat.uniforms.uInkHide.value=finaleT>0?sstep(4,8.5,t-finaleT)*0.92:0;
  if(finaleBeing){ const fu=finaleBeing.material.uniforms, lv=reefMat.uniforms.uLeave.value; fu.uTime.value=t; fu.uFade.value=sstep(3.5,8,t-finaleT)*fade*(1-lv); finaleBeing.scale.setScalar(1-0.85*lv); }

  const u=reefMat.uniforms;
  u.uFrame.value=t*FPS; u.uTime.value=t; u.uP.value=p;
  u.uSymX.value=sstep(0.1,0.5,p); u.uSymY.value=sstep(0.45,0.8,p);
  const deepSea=state==='archive'||(state==='sleep'&&dolphin.visible);
  u.uRest.value=deepSea?0.38:firstEchoT<0?0.1:lerp(0.09+0.06*p,0.55,colorV);   // in play, what no wave has touched is all but dark — until the EYE is open: then the sea is seen without an echo u.uInk.value=deepSea?0:ink; u.uBase.value=deepSea?0.02:base; u.uDim.value=deepSea?0.55:1; u.uSleep.value=state==='sleep'&&!dolphin.visible?sleepV:0; u.uBass.value=uB;
  u.uSpin.value=REDUCED?0:t*0.06*ink; u.uFade.value=fade; u.uColor.value=colorV;
  deepAuraMat.uniforms.uShow.value=(state==='archive'||state==='sleep')?fade:0;
  { const T=auraMat.uniforms; T.uTime.value=t; T.uSpin.value=u.uSpin.value; T.uLeave.value=u.uLeave.value; T.uShow.value=finaleT>=0&&J.set.includes('sense')?ink*fade:0; }
  u.uRingTint.value.set(lerp(0.80,0.93,colorV),lerp(0.84,0.84,colorV),lerp(1.0,0.78,colorV));
  dustMat.uniforms.uTime.value=t; dustMat.uniforms.uFade.value=fade;
  for(let i=0;i<NO;i++){ const o=orbs[i]; oPos[i*3]=o.pos.x; oPos[i*3+1]=o.pos.y; oPos[i*3+2]=o.pos.z; oA[i]=o.glow;
    const s=signs[i], seen=colorV>0&&o.state==='hidden'&&!o.el.hidden;   // after the EYE: readable from anywhere, like a mark on a chart
    const wv=o.state==='hidden'&&o.appearT?Math.exp(-(t-o.appearT)*1.3):0;   // just appeared: it wavers like something seen through water, then settles
    s.sp.position.copy(o.pos); if(wv>0.01){ s.sp.position.x+=Math.sin(t*5.3+i)*0.35*wv; s.sp.position.y+=Math.sin(t*4.1+i*2)*0.25*wv; }
    s.sp.scale.setScalar(Math.max(2.4+Math.min(1.5,o.glow)*1.6, seen?o.pos.distanceTo(me.pos)*0.11*colorV:0)*(1+0.14*Math.sin(t*7.0+i)*wv)); s.mat.rotation=0.12*Math.sin(t*3.2+i)*wv; s.mat.opacity=Math.min(1,o.glow*1.4)*fade; }
  orbGeo.attributes.position.needsUpdate=true; orbGeo.attributes.aA.needsUpdate=true;
  { let best=null; for(const o of orbs) if(o.state==='hidden'&&o.near&&(!best||o.glow>best.glow)) best=o;
    const SP=reefMat.uniforms.uSingP.value; if(best){ SP.set(best.pos.x,best.pos.y,best.pos.z,Math.min(1,SP.w+dt*1.5)); reefMat.uniforms.uSingC.value.set(...best.el.c); } else SP.w=Math.max(0,SP.w-dt*0.8);
    let k=0; const BP=reefMat.uniforms.uBeadP.value, BC=reefMat.uniforms.uBeadC.value;
    for(const o of orbs) if((o.state==='bead'||o.state==='toSlot')&&k<5){ BP[k].set(o.pos.x,o.pos.y,o.pos.z,Math.min(1.2,o.glow)); BC[k].set(...o.el.c); k++; }
    for(;k<5;k++) BP[k].w=0;
    const OP=reefMat.uniforms.uOrbP.value; orbs.forEach((o,i)=>{ if(i<7) OP[i].set(o.pos.x,o.pos.y,o.pos.z,o.state==='hidden'&&firstEchoT>0?(o.el.hidden?0.6:1):0); }); }
  orbMat.uniforms.uFade.value=fade;
  const b=bgMat.uniforms; b.uP.value=state==='archive'?1:p; b.uFade.value=state==='end'?0:Math.max(fade,0.3);
  b.uHaze.value=0.06+0.45*p+uB*0.2; b.uFlash.value=flash; b.uTint.value.copy(flashTint); b.uArc.value=state==='archive'||dolphin.visible?1:0;
  b.uTrail.value=REDUCED?0.7:0.4; b.uLift.value=sstep(-6,TOP,me.pos.y); b.uLook.value=Math.sin(me.pitch);
  if(!dbgEl.hidden){ const nh=orbs.filter(o=>o.state==='hidden').map(o=>`${o.el.en} ${o.pos.distanceTo(me.pos).toFixed(0)}${o.near?' ●':''}`).join('\n');
    dbgEl.textContent=`${state}  ${nSet}/${NEED}  particles ${NP}\n${nh}\necho ${J.echoes}  path ${J.path.toFixed(0)}\nTHE DEEP ${entries.length}  db ${db?'on':'off'}\naudio ${A.ready?Object.keys(A.buf).length:'-'}`; }
  renderer.clearDepth();
  renderer.render(scene,camera);
}

/* ───────── sizing & input ───────── */
function resize(){
  DPR=window.SB_DPR||DPR; renderer.setPixelRatio(DPR);   // (the governor may have lowered it)
  const w=document.body.clientWidth, h=document.body.clientHeight;
  // fill the whole screen (no letterbox); the camera widens or narrows with it
  const sw=w, sh=h;
  stageEl.style.width=sw+'px'; stageEl.style.height=sh+'px';
  camera.aspect=sw/sh; camera.updateProjectionMatrix();
  renderer.setSize(sw,sh,false);
  renderer.domElement.style.width=sw+'px'; renderer.domElement.style.height=sh+'px';
  const pix=DPR*sh/720;
  reefMat.uniforms.uPix.value=pix*Math.sqrt(128/GX); reefMat.uniforms.uViewH.value=DPR*sh; dustMat.uniforms.uPix.value=pix; orbMat.uniforms.uPix.value=pix; auraMat.uniforms.uPix.value=pix;
  arcBase.uniforms.uPix.value=pix*(44/AGX); dolMat.uniforms.uPix.value=pix;
  for(const b of beings) b.obj.material.uniforms.uPix.value=pix*(44/AGX);
  scoreResize(); renderer.clear();
}
addEventListener('resize',resize); resize();

const live=()=>!paused && state!=='loading' && state!=='ready';
stageEl.addEventListener('pointerdown',ev=>{
  if(!live()) return;
  ev.preventDefault(); stageEl.focus({preventScroll:true}); lastInput=clock;
  if(state==='end'){ if(!againEl.classList.contains('gone')) toOpening(); return; }
  ptr.down=true; ptr.drag=false; ptr.x=ptr.sx=ev.clientX; ptr.y=ptr.sy=ev.clientY; ptr.t=clock;
  try{ stageEl.setPointerCapture(ev.pointerId); }catch(e){}
  if(!touchy&&(state==='play'||state==='archive')&&document.pointerLockElement!==stageEl&&stageEl.requestPointerLock){ try{ const r=stageEl.requestPointerLock(); if(r&&r.catch) r.catch(()=>{}); }catch(e){} }   // from the first click the cursor is held: moving the mouse (rolling the ball) turns you
});
const hov={x:-1,y:-1};   // where the free cursor is (when the cursor could not be held)
document.addEventListener('mousemove',ev=>{
  hov.x=ev.clientX; hov.y=ev.clientY;
  const locked=document.pointerLockElement===stageEl;
  if((!locked&&(touchy||ptr.down))||!live()||(state!=='play'&&state!=='archive')||auto!==0) return; lastInput=clock;   // held or not, moving the mouse (rolling the ball) turns you; a drag still works as before
  const k=.0026, dx=Math.max(-120,Math.min(120,ev.movementX)), dy=Math.max(-120,Math.min(120,ev.movementY));   // (a stray jump is clipped)
  me.yaw+=dx*k; if(finaleT<0&&state==='play') J.yaw+=dx*k; me.pitch=Math.max(-1.3,Math.min(1.3,me.pitch-dy*k)); tut.move+=Math.abs(dx)*.0008; moveHintDone=true;
});
stageEl.addEventListener('pointermove',ev=>{
  if(!live()) return; lastInput=clock;
  if(!ptr.down || (state!=='play'&&state!=='archive')) return;
  const dx=ev.clientX-ptr.x, dy=ev.clientY-ptr.y; ptr.x=ev.clientX; ptr.y=ev.clientY;
  if(!ptr.drag && Math.hypot(ev.clientX-ptr.sx,ev.clientY-ptr.sy)>7){ ptr.drag=true; stageEl.classList.add('dragging'); }
  if(ptr.drag && auto===0){ const k=touchy?0.006:0.0035; me.yaw+=dx*k; if(finaleT<0&&state==='play') J.yaw+=dx*k; me.pitch=Math.max(-1.3,Math.min(1.3,me.pitch-dy*k)); if(touchy) moveHintDone=true; }
});
function up(ev){
  if(!ptr.down) return; ptr.down=false; stageEl.classList.remove('dragging');
  if(ptr.drag || clock-ptr.t>=0.6) return;
  if(state==='play') echo(dirFromScreen(ev.clientX,ev.clientY));
  else if(state==='archive'){ if(touchy&&nearB&&nearV>LISTEN_V){ if(SCORE.want) scoreClose(); else scoreOpen(nearB); } else deepPing(ev.clientX,ev.clientY); }
}
stageEl.addEventListener('pointerup',up); stageEl.addEventListener('pointercancel',()=>{ptr.down=false;stageEl.classList.remove('dragging');});
stageEl.addEventListener('contextmenu',ev=>ev.preventDefault());
stageEl.addEventListener('wheel',ev=>{ if(!live()) return; ev.preventDefault(); if((state==='play'||state==='archive')&&auto===0){ forwardVec(fwd); me.vel.addScaledVector(fwd,-ev.deltaY*0.02); tut.move+=Math.min(.5,Math.abs(ev.deltaY)*.004); } },{passive:false});   // with the camera the wheel is the way to swim: a longer glide
/* Shift+S, anywhere but the name field: save THE DEEP to a file (a backup during the exhibition, and the archive afterwards) */
function exportDeep(){
  let list=entries; if(!list.length){ try{ list=JSON.parse(localStorage.getItem(LOCAL_KEY)||'[]'); }catch(e){ list=[]; } }
  const d=new Date(), day=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const blob=new Blob([JSON.stringify({piece:'SLIP BENEATH',exported:d.toISOString(),source:db?'shared db':'this browser',count:list.length,beings:list},null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`thedeep_export_${day}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  const t=$('toast'); if(t){ t.textContent=`THE DEEP · ${list.length} beings saved to file`; t.style.opacity=1; setTimeout(()=>t.style.opacity=0,2400); }
}
addEventListener('keydown',ev=>{ if(ev.shiftKey && ev.key.toLowerCase()==='s' && !ev.repeat && ev.target.tagName!=='INPUT'){ ev.preventDefault(); exportDeep(); } });
stageEl.addEventListener('keydown',ev=>{
  if(!live() || ev.target.tagName==='INPUT') return;
  const k=ev.key.toLowerCase(); lastInput=clock;
  if(state==='play' && k==='y'){ const o=orbs.find(q=>q.el.hidden&&q.state==='hidden'); if(o){ ev.preventDefault();   // testing: Y takes you just in front of the EYE, facing it
      const d=new THREE.Vector3(0,0,7); me.pos.copy(o.pos).add(d); me.vel.set(0,0,0); me.yaw=Math.atan2(d.x,d.z); me.pitch=0; if(firstEchoT<0){ forwardVec(fwd); echo(fwd.clone()); } } return; }
  if(state==='archive' && k==='e'){ ev.preventDefault(); if(!ev.repeat){ SCORE.eDown=true; SCORE.eT=clock; SCORE.eDone=false; } return; }   // hold E: listen to a being, and see its music
  if(['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){ ev.preventDefault(); keys.add(k); return; }
  if(ev.repeat) return;
  if(k===' '){ ev.preventDefault();
    if(state==='play') tryCollect();
    else if(state==='end'){ if(!againEl.classList.contains('gone')) toOpening(); }
    else if(state==='archive'){ ptr.down=true; ptr.drag=false; ptr.t=clock; } }
  else if(k==='enter'){ ev.preventDefault(); if(state==='archive') deepPing(); else if(state==='play'){ forwardVec(fwd); echo(fwd.clone()); } else if(state==='end'&&!againEl.classList.contains('gone')) toOpening(); }
  else if(k==='g'){ dbgEl.hidden=!dbgEl.hidden; }
  else if(k==='n' && state==='play'){
    if(firstEchoT<0){ forwardVec(fwd); echo(fwd.clone()); }
    const o=orbs.filter(o=>o.state==='hidden'&&!o.el.hidden).sort((a,b)=>a.pos.distanceTo(me.pos)-b.pos.distanceTo(me.pos))[0];
    if(o){ me.pos.copy(o.pos).add(tmp.subVectors(me.pos,o.pos).normalize().multiplyScalar(10)); lastPos.copy(me.pos); me.vel.set(0,0,0);
      const d=tmp.subVectors(o.pos,me.pos).normalize(); me.yaw=Math.atan2(-d.x,-d.z); me.pitch=Math.asin(Math.max(-1,Math.min(1,d.y))); echo(d.clone()); } }
});
stageEl.addEventListener('keyup',ev=>{ const k=ev.key.toLowerCase(); keys.delete(k); if(k===' ') ptr.down=false;
  if(k==='e'&&SCORE.eDown) SCORE.eDown=false; });
addEventListener('blur',()=>{ keys.clear(); ptr.down=false; SCORE.eDown=false; });

/* ───────── boot ───────── */
const texL=new THREE.TextureLoader(); let texN=0;
function gotTex(){ if(++texN===2){ ready.atlas=true; maybeReady(); } }
const prep=t=>{ t.minFilter=THREE.LinearFilter; t.magFilter=THREE.LinearFilter; t.generateMipmaps=false; return t; };
texL.load(COLOR_SRC,tex=>{ prep(tex); reefMat.uniforms.uAtlas.value=tex; arcBase.uniforms.uAtlas.value=tex; gotTex(); });
texL.load(DEPTH_SRC,tex=>{ prep(tex); reefMat.uniforms.uDepth.value=tex;
  try{ const im=tex.image, cv=document.createElement('canvas'); cv.width=im.width; cv.height=im.height;
    const cx=cv.getContext('2d'); cx.drawImage(im,0,0); DEP.data=cx.getImageData(0,0,im.width,im.height).data; DEP.w=im.width; }catch(e){}
  if(state==='loading'||state==='ready') placeOrbs();
  gotTex(); });
const ready={atlas:false,audio:false};
function maybeReady(){ if(ready.atlas&&ready.audio&&!loaded){ loaded=true; if(state==='loading') state='ready'; if(pendingStart){ pendingStart=false; reset(); } } }
audioFetch.then(()=>{ ready.audio=true; maybeReady(); }); setTimeout(()=>{ ready.audio=true; maybeReady(); },20000);
let last=performance.now(), TS=1;
function loop(now){ const dt=Math.min(0.033,Math.max(0.001,(now-last)/1000))*TS; last=now; if(!paused) tick(dt); else clock+=dt; requestAnimationFrame(loop); }
requestAnimationFrame(loop);

/* what the surface needs from below */
window.SBGame={
  A, audioInit, playPhrase, EL,
  deepCount:()=>entries.length,
  start(name){ J.name=cleanName(name); paused=false; renderer.clear();
    if(loaded) reset(); else { pendingStart=true; state='loading'; setHint('the sea is still loading'); } },
  exportDeep,
  debug:{song:()=>({key:SONG.key,lvl:SONG.lvl,step:SONG.step,ctx:A.ctx&&A.ctx.state,plan:SONG.plan.map(p=>p.id+':'+Object.keys(p.ev).map(s=>s+(p.ev[s].rev?'r':'')+(p.ev[s].rate<1?'↓':'')).join(','))}), set speed(v){TS=v}, get state(){return state}, orbs, me, collect:o=>collect(o), echo:()=>{forwardVec(fwd);echo(fwd.clone())}, finale(){ for(const o of orbs.slice(0,4)){ if(J.set.length<NEED) collect(o);} },
    sink(){ sinkInto(()=>goArchive()); }, ping(){ deepPing(); }, iris:()=>({vis:iris.visible, pt:irMat.uniforms.uPingT.value, t:irMat.uniforms.uTime.value, fade:irMat.uniforms.uFade.value, pix:irMat.uniforms.uPix.value, face:!!faceIr}), listen(){ const b=nearB||beings[0]; if(b) scoreOpen(b); },
    deep(eye){ paused=false; audioInit(); if(eye&&!J.set.includes('sense')) J.set.push('sense'); goArchive(); }, score:SCORE, get near(){ return nearB&&{d:nearB.obj.position.distanceTo(me.pos),v:nearV}; }, goNear(){ const b=beings[1]||beings[0]; if(b){ me.pos.copy(b.obj.position).add(new THREE.Vector3(0,0,14)); me.vel.set(0,0,0); me.yaw=0; me.pitch=0; } } }
};
})();

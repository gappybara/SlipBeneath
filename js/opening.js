/* ───────── the surface: a hole in a dark silk, and the vortex that takes you (and later your being) down ───────── */
/* the title: the hole, the silk, the six sounds on their orbits — under water (refraction, a ring now and then from the hole,
   light from the surface, marine snow; the title's band left still). See CLAUDE.md 2026-10-25 (22–27). */
window.SBOpen=(()=>{
const {TAU,REDUCED,IDS,SYM,setSym,paint}=SBG;
const G=window.SBGame;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ss=(a,b,x)=>{x=clamp((x-a)/(b-a));return x*x*(3-2*x)};
const rnd=(s=>()=>(s=(s*16807)%2147483647)/2147483647)(90210);
const $=id=>document.getElementById(id);
const stage=$('stage'), cv=$('op'), ui=$('opui'), nameEl=$('name');
const world=document.createElement('canvas'), W2=world.getContext('2d');
const titleCv=document.createElement('canvas'), T2=titleCv.getContext('2d',{willReadFrequently:true});
const layer=document.createElement('canvas'), L2=layer.getContext('2d');
/* "click to dive" sits on its own canvas above the shader, so the lens does not push it away from the hole */
const arcCv=document.createElement('canvas'), A2=arcCv.getContext('2d');
arcCv.setAttribute('aria-hidden','true'); arcCv.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:5;pointer-events:none'; cv.after(arcCv);
const HAS_FILTER=(()=>{const c=document.createElement('canvas').getContext('2d');c.filter='blur(2px)';return c.filter==='blur(2px)'})();
const SIL='236,238,250', GLOW='150,165,240', SWB_V=4.6, SWB_D=8.6;   // moonlight ink, periwinkle bloom · how long a swallow lasts: the game's end (vortex) / the dive from the title, slower: the seven signs go in one by one
let SWB=SWB_V;
/* three bands: title on top, the hole and its orbits in the middle, name + footer below. Graphics stay out of the text bands. */
const ORB_K=.85, TITLE_Y=.16, HOLE_Y=.535, HOLE_R=.095;

let W,H,S,CX,CY,RH, pts=null, orbs=[];
let mode='surface', sw=null, src=null, onBlack=null, hover=0, mx=-1e4, my=-1e4, clock=0, titleBottom=false;

/* title font candidates — F cycles them (name shows in a toast) */
const FONTS=[
  {name:'Syncopate',css:'400 {s}px Syncopate, "Helvetica Neue", Arial, sans-serif',track:.5},
  {name:'Lexend Zetta 200',css:'200 {s}px "Lexend Zetta", "Helvetica Neue", Arial, sans-serif',track:.36},
  {name:'Tenor Sans',css:'400 {s}px "Tenor Sans", "Helvetica Neue", Arial, sans-serif',track:.55},
  {name:'Marcellus',css:'400 {s}px Marcellus, "Helvetica Neue", Arial, sans-serif',track:.5},
  {name:'Italiana',css:'400 {s}px Italiana, "Helvetica Neue", Arial, sans-serif',track:.55},
  {name:'Josefin Sans 200',css:'200 {s}px "Josefin Sans", "Helvetica Neue", Arial, sans-serif',track:.6},
  {name:'Poiret One',css:'400 {s}px "Poiret One", "Helvetica Neue", Arial, sans-serif',track:.55},
  {name:'Gruppo',css:'400 {s}px Gruppo, "Helvetica Neue", Arial, sans-serif',track:.5},
];
let FI=FONTS.findIndex(F=>F.name==='Josefin Sans 200'), mirror=0;   // chosen title face (Josefin; drafts B and C are the short list)

/* the six sounds you can meet on the surface, each on its own orbit around the hole */
const ORB_DEF=[ // id, label, halo tint, orbit radius (×H), flatness, tilt, size
  // spread wide across the screen, flat enough to stay inside the middle band (≤ .27H above/below the hole)
  // tilts come in mirrored pairs (−/+) so the orbits cross symmetrically; tints stay in the palette, heart is the one warm sign
  ['heart','heartbeat','232,214,176',.30,.46,-.16,.95],
  ['voice','voice','160,172,240',.39,.40,.16,.8],
  ['bone','bone','201,200,232',.48,.42,-.10,.72],
  ['memory','memory','180,175,240',.57,.36,.10,.85],
  ['soul','soul','201,200,232',.66,.33,-.05,.62],
  ['dream','dream','160,172,240',.76,.29,.05,1.0],
];

function spaced(g,text,x,y,align,track){
  const ws=[...text].map(ch=>g.measureText(ch).width);
  const tot=ws.reduce((a,b)=>a+b,0)+track*(ws.length-1);
  let cx=align==='right'?x-tot:align==='center'?x-tot/2:x;
  [...text].forEach((ch,i)=>{g.fillText(ch,cx,y);cx+=ws[i]+track});
  return tot;
}
function sparkle(g,x,y,s,a){
  g.save(); g.translate(x,y); g.globalCompositeOperation='lighter';
  const gr=g.createRadialGradient(0,0,0,0,0,s*.5); gr.addColorStop(0,`rgba(255,255,255,${a})`); gr.addColorStop(1,'rgba(200,240,245,0)');
  g.fillStyle=gr; g.beginPath(); g.arc(0,0,s*.5,0,TAU); g.fill(); g.fillStyle=`rgba(245,252,255,${a})`;
  for(const [L,w] of [[s,s*.07],[s*.6,s*.06]]){ g.beginPath(); g.moveTo(-L,0); g.quadraticCurveTo(0,-w,L,0); g.quadraticCurveTo(0,w,-L,0); g.fill(); g.rotate(Math.PI/2); }
  g.restore();
}

/* title drafts — keys 1–5 switch them (name shows in a toast); T (top/bottom) and F (face) still apply */
const TITLES=['A · current','B · quiet','C · sinking','D · waterline','E · corner'];
let TV=1;
function drawTitleDraft(){
  const F=FONTS[FI], g=T2, TXT='SLIP BENEATH', v=TV; g.clearRect(0,0,W,H); g.textBaseline='alphabetic'; g.textAlign='start';
  let fs=H*[.058,.034,.046,.05,.022][v]; const tk=F.track*[1,1.6,1.15,1.1,1.1][v], setF=()=>g.font=F.css.replace('{s}',fs.toFixed(1)); setF();
  const wOf=()=>[...TXT].reduce((a,ch)=>a+g.measureText(ch).width,0)+fs*tk*11;
  if(wOf()>W*.74){ fs*=W*.74/wOf(); setF(); }
  const track=fs*tk, ty=titleBottom?H*.785:H*TITLE_Y, base=ty+fs*.36, tw=wOf();
  const glow=(b,a)=>{g.shadowColor=`rgba(${GLOW},${a})`; g.shadowBlur=b};
  const hair=(y,x0,x1,a)=>{const lg=g.createLinearGradient(x0,0,x1,0); lg.addColorStop(0,`rgba(${SIL},0)`); lg.addColorStop(.5,`rgba(${SIL},${a})`); lg.addColorStop(1,`rgba(${SIL},0)`);
    g.fillStyle=lg; g.fillRect(x0,y,x1-x0,Math.max(1,S))};
  if(v===0){ // A: glow + mirror + sparkles (as it was)
    glow(fs*.45,.9); g.fillStyle='rgba(214,216,245,.5)'; spaced(g,TXT,CX,base,'center',track);
    g.shadowBlur=fs*.12; g.shadowColor='rgba(255,255,255,.9)'; g.fillStyle=`rgb(${SIL})`; spaced(g,TXT,CX,base,'center',track); g.shadowBlur=0;
    L2.clearRect(0,0,W,H); L2.save(); L2.translate(0,base*2+fs*.14); L2.scale(1,-1); L2.drawImage(titleCv,0,0); L2.restore();
    L2.globalCompositeOperation='destination-in'; const lg=L2.createLinearGradient(0,base,0,base+fs*.75);
    lg.addColorStop(0,'rgba(0,0,0,.3)'); lg.addColorStop(1,'rgba(0,0,0,0)'); L2.fillStyle=lg; L2.fillRect(0,base,W,fs); L2.globalCompositeOperation='source-over';
    g.drawImage(layer,0,0);
    sparkle(g,CX-tw/2-fs*.9,ty,fs*.34,.95); sparkle(g,CX+tw/2+fs*.8,ty,fs*.34,.95);
  } else if(v===1){ // B: smaller, wider, one soft glow, two points of light instead of the sparkles
    glow(fs*.7,.5); g.fillStyle=`rgba(${SIL},.9)`; spaced(g,TXT,CX,base,'center',track); g.shadowBlur=0;
    for(const s of [-1,1]) dot(g,CX+s*(tw/2+fs*1.2),base-fs*.36,fs*.06,.85);
  } else if(v===2){ // C: BENEATH slips under a hairline surface, letter by letter, dimmer and softer as it sinks
    const ch=[...TXT], ws=ch.map(c=>g.measureText(c).width), wl=base+fs*.22; let x=CX-tw/2;
    hair(wl,CX-tw/2-fs*1.5,CX+tw/2+fs*1.5,.4);
    ch.forEach((c,i)=>{ const j=i-5, k=j<0?0:Math.pow((j+1)/7,1.3), a=1-k*.75;
      if(HAS_FILTER&&k>.05) g.filter=`blur(${(k*fs*.05).toFixed(1)}px)`;
      glow(fs*.4,.6*a); g.fillStyle=`rgba(${SIL},${a.toFixed(3)})`; g.fillText(c,x,base+k*fs*.95); g.filter='none'; x+=ws[i]+track; });
    g.shadowBlur=0;
  } else if(v===3){ // D: crisp above a waterline, a broken wavering reflection below
    glow(fs*.35,.7); g.fillStyle=`rgb(${SIL})`; spaced(g,TXT,CX,base,'center',track); g.shadowBlur=0;
    const wl=base+fs*.12, depth=fs*1.2;
    L2.clearRect(0,0,W,H); L2.save(); L2.translate(0,wl*2); L2.scale(1,-1); L2.drawImage(titleCv,0,0); L2.restore();
    if(HAS_FILTER) g.filter='blur(1.4px)';
    for(let y=0;y<depth;y+=2){ if((y>>1)%3===2) continue; const k=y/depth, off=Math.sin(y/fs*16)*fs*.06*(.3+k);
      g.globalAlpha=.32*(1-k)*(1-k); g.drawImage(layer,0,wl+y,W,2,off,wl+y,W,2); }
    g.filter='none'; g.globalAlpha=1; hair(wl,CX-tw/2-fs,CX+tw/2+fs,.3);
  } else { // E: a small credit in the top-left corner; the hole is the only thing in the middle
    const x0=W*.026, yb=H*.045+fs; glow(fs*.5,.5); g.fillStyle=`rgba(${SIL},.92)`; spaced(g,TXT,x0,yb,'left',track); g.shadowBlur=0;
    g.fillStyle=`rgba(${SIL},.35)`; g.fillRect(x0,yb+fs*.8,fs*4,Math.max(1,S)); dot(g,x0+fs*4.6,yb+fs*.8+.5,fs*.07,.85);
  }
}
function layout(){
  const cw=stage.clientWidth||innerWidth, ch=stage.clientHeight||innerHeight, dpr=window.SB_DPR||Math.min(devicePixelRatio||1,2);
  const k=Math.min(dpr,2560/cw); W=Math.round(cw*k); H=Math.round(ch*k);
  for(const c of [world,titleCv,layer,cv,arcCv]){c.width=W;c.height=H}
  S=Math.min(H/1080,W/1920); CX=W*.5; CY=H*HOLE_Y; RH=Math.max(34,H*HOLE_R);
  document.body.classList.toggle('titlebottom',titleBottom);
  drawTitleDraft();
  const g=T2;
  // particles from the bright core of the letters
  const id=g.getImageData(0,0,W,H).data, step=Math.max(2,Math.round(2*S)), P=[];
  for(let y=0;y<H;y+=step)for(let x=0;x<W;x+=step){const i4=(y*W+x)*4; if(id[i4+3]>140&&id[i4]>140)P.push(x+rnd()*step,y+rnd()*step)}
  const n=P.length/2; pts={n,r:new Float32Array(n),a:new Float32Array(n),q:new Float32Array(n)};
  for(let i=0;i<n;i++){const dx=P[i*2]-CX,dy=P[i*2+1]-CY; pts.r[i]=Math.hypot(dx,dy); pts.a[i]=Math.atan2(dy,dx); pts.q[i]=rnd();}
  orbs=ORB_DEF.map(([id,label,tint,a,flat,tilt,sz],i)=>{const px=sz*46*S, c=document.createElement('canvas'); c.width=c.height=Math.ceil(px*2.9);
    const A=a*H*ORB_K, nodes=Array.from({length:3+Math.floor(rnd()*3)},()=>({a:rnd()*TAU,s:rnd()})),
      dust=Array.from({length:14},()=>({k:rnd(),sp:.22+rnd()*.3,side:rnd()*2-.6,r:.6+rnd()*.9}));
    return {id,label,tint,px,cv:c,A,B:A*flat,tilt,nodes,dust,w:.16*Math.pow(.235/a,1.5)*(REDUCED?.4:1),th0:rnd()*TAU,hv:0,lastPlay:-9,x:0,y:0}});
  if(gl) gl.viewport(0,0,W,H);
}
const orbitPt=(o,th)=>{const x=Math.cos(th)*o.A, y=Math.sin(th)*o.B, c=Math.cos(o.tilt), s=Math.sin(o.tilt); return [CX+c*x-s*y, CY+s*x+c*y]};

/* ---------------- the world (transparent layer, lensed over the silk on the GPU) ---------------- */
function drawFrame(g,t,fadeK){
  g.clearRect(0,0,W,H); const lw=Math.max(.6,.8*S); g.lineWidth=lw;
  g.globalAlpha=fadeK;
  for(const rot of [.34,-.34]){g.strokeStyle=`rgba(${SIL},${(.12*(1-.7*waterK)).toFixed(3)})`; g.beginPath(); g.ellipse(CX,CY,Math.min(W*.4,H*.72),H*.13,rot,0,TAU); g.stroke();}
  if(waterK<.99){ g.globalAlpha=fadeK*(1-waterK); g.strokeStyle=`rgba(${SIL},.14)`; g.beginPath(); g.moveTo(0,CY); g.lineTo(W,CY); g.stroke(); }   // water: no ruled horizon under water
  g.globalAlpha=1;
}
/* "click to dive" travels the hole's own orbit, fading in and out */
function drawArc(g,t,k){
  if(k<=0) return;
  const R2=RH*1.55, txt='click to dive', fs=Math.max(12,H*.019);
  g.font=`300 ${fs.toFixed(1)}px "Josefin Sans","Helvetica Neue",sans-serif`; g.textAlign='center'; g.textBaseline='middle';
  const track=fs*.62, ws=[...txt].map(ch=>g.measureText(ch).width+track), tot=ws.reduce((a,b)=>a+b,0);
  const head=-Math.PI/2-tot/R2/2+Math.sin(t*.21)*.9+t*.12;       // drifts along the orbit, clockwise
  const pulse=.6+.4*(.5+.5*Math.sin(t*1.25));   // breathes, but never fades out of reach
  let acc=0;
  [...txt].forEach((ch,i)=>{ const mid=acc+ws[i]/2; acc+=ws[i];
    const an=head+mid/R2, u=mid/tot, edge=Math.sin(u*Math.PI);
    const x=CX+Math.cos(an)*R2, y=CY+Math.sin(an)*R2;
    g.save(); g.translate(x,y); g.rotate(an+Math.PI/2); g.shadowColor='rgba(2,4,12,.9)'; g.shadowBlur=fs*.7; g.fillStyle=`rgba(${SIL},${(pulse*(.5+.5*edge)*k).toFixed(3)})`; g.fillText(ch,0,0); g.shadowBlur=0; g.restore(); });   // a soft dark under each letter: it reads over silk and lip
  g.textAlign='start'; g.textBaseline='alphabetic';
}
function signTo(o,t){
  const c=o.cv, g=c.getContext('2d'), m=c.width/2; g.clearRect(0,0,c.width,c.height);
  const hv=o.hv;
  const gr=g.createRadialGradient(m,m,0,m,m,m); gr.addColorStop(0,`rgba(${o.tint},${.2+hv*.25})`); gr.addColorStop(.55,`rgba(${o.tint},${.06+hv*.1})`); gr.addColorStop(1,`rgba(${o.tint},0)`);
  g.fillStyle=gr; g.fillRect(0,0,c.width,c.height);
  g.save(); g.translate(m,m); const br=1+.03*Math.sin(t*1.1+o.th0)+hv*.12; g.scale(br,br); paint(g,o.id,t,o.px); g.restore();
}
/* a small point of light: soft halo, white core */
function dot(g,x,y,r,a,tint=SIL){
  if(a<=.004) return;
  const gr=g.createRadialGradient(x,y,0,x,y,r*4); gr.addColorStop(0,`rgba(${tint},${a.toFixed(3)})`); gr.addColorStop(.25,`rgba(${tint},${(a*.4).toFixed(3)})`); gr.addColorStop(1,`rgba(${tint},0)`);
  g.fillStyle=gr; g.beginPath(); g.arc(x,y,r*4,0,TAU); g.fill();
  g.fillStyle=`rgba(255,255,255,${a.toFixed(3)})`; g.beginPath(); g.arc(x,y,r,0,TAU); g.fill();
}
/* the orbit and the sign's wake: fine tapering trail, a loose thread around it, beads left behind, fixed star points, shed dust */
function drawWake(g,o,th,t,lw,K){
  const hk=.7+o.hv*.5, span=1.6;
  g.lineCap='round';
  if(waterK<.99){ g.strokeStyle=`rgba(${SIL},${(.11*K*(1-waterK)).toFixed(3)})`; g.lineWidth=lw*.8; g.beginPath(); g.ellipse(CX,CY,o.A,o.B,o.tilt,0,TAU); g.stroke(); }
  if(waterK>.01){ const back=2.9, ahead=.9, M=70; g.lineWidth=lw*.8;   // water: only the stretch of orbit round the sign, so the orbits no longer tangle
    for(let i=0;i<M;i++){ const u=i/M, a0=th-back+(back+ahead)*u, a1=th-back+(back+ahead)*(i+1)/M, [x0,y0]=orbitPt(o,a0), [x1,y1]=orbitPt(o,a1);
      const fade=Math.sin(Math.PI*(a0<th?(a0-(th-back))/back*.5:.5+(a0-th)/ahead*.5));   // rises along the trail behind, brightest at the sign, gone a little ahead
      g.strokeStyle=`rgba(${SIL},${(.13*K*waterK*Math.max(0,fade)).toFixed(3)})`; g.beginPath(); g.moveTo(x0,y0); g.lineTo(x1,y1); g.stroke(); } }
  // star points fixed on the orbit; they flare as the sign passes and cool slowly behind it
  for(const nd of o.nodes){ const [x,y]=orbitPt(o,nd.a), back=((th-nd.a)%TAU+TAU)%TAU, lit=Math.exp(-back*1.6)+Math.exp(-(TAU-back)*14)*.5;
    dot(g,x,y,lw*(.55+nd.s*.5)*(1+lit*.8),((.22+.08*Math.sin(t*1.3+nd.s*9))*(1-.88*waterK)+.7*lit)*K,lit>.2?o.tint:SIL); }
  // main trail: many short segments, thin and silver at the tail, thicker and tinted at the head
  const N=80;
  for(let i=0;i<N;i++){ const f=i/N, [x0,y0]=orbitPt(o,th-span*(1-f)), [x1,y1]=orbitPt(o,th-span*(1-(i+1)/N));
    g.strokeStyle=`rgba(${f>.6?o.tint:SIL},${(.85*Math.pow(f,1.6)*K*hk).toFixed(3)})`; g.lineWidth=lw*(.45+1.5*Math.pow(f,1.3));
    g.beginPath(); g.moveTo(x0,y0); g.lineTo(x1,y1); g.stroke(); }
  // a loose thread that weaves around the trail and settles back onto it at the head
  for(const s of [1,-1]){ let px=null, py=null;
    for(let i=0;i<=N;i++){ const f=i/N, [x,y]=orbitPt(o,th-span*1.1*(1-f)), dx=x-CX, dy=y-CY, dl=Math.hypot(dx,dy)||1;
      const off=s*Math.sin(f*TAU*1.5+t*.7*s+o.th0)*(1-f)*o.px*.22, qx=x+dx/dl*off, qy=y+dy/dl*off;
      if(px!=null){ g.strokeStyle=`rgba(${SIL},${(.38*Math.pow(f,1.2)*K*hk).toFixed(3)})`; g.lineWidth=lw*.5; g.beginPath(); g.moveTo(px,py); g.lineTo(qx,qy); g.stroke(); }
      px=qx; py=qy; } }
  // beads dropped at even steps along the orbit; they stay where they fell and fade as the sign moves on
  const step=span/10, a0=Math.floor(th/step)*step;
  for(let j=0;j<10;j++){ const a=a0-j*step, f=1-(th-a)/span; if(f<=0) continue;
    const [x,y]=orbitPt(o,a); dot(g,x,y,lw*(.35+.75*f),.85*Math.pow(f,1.3)*K*hk,f>.6?o.tint:SIL); }
  // dust shed from the head, drifting off the orbit
  for(const d of o.dust){ const life=(t*d.sp+d.k)%1, [x,y]=orbitPt(o,th-o.w*life/d.sp-.05), dx=x-CX, dy=y-CY, dl=Math.hypot(dx,dy)||1;
    const off=d.side*life*o.px*.75, qx=x+dx/dl*off+Math.sin(t+d.k*20)*life*o.px*.1, qy=y+dy/dl*off+life*o.px*.15;
    dot(g,qx,qy,lw*d.r*.5*(1-life*.5),.7*Math.sin(Math.PI*Math.sqrt(life))*K,o.tint); }
  g.lineCap='butt';
}
function drawOrbs(g,t,T){
  const lw=Math.max(.7,.9*S);
  for(const o of orbs){
    let th=o.th0+o.w*t, [x,y]=orbitPt(o,th), rot=0, sx=1, sy=1, al=1;
    const lineK=T==null?1:1-ss(0,.7,T);
    if(lineK>0) drawWake(g,o,th,t,lw,lineK);
    if(T==null||T-.2-o.delay<0){ o.x=x; o.y=y; o.r0=Math.hypot(x-CX,y-CY); o.a0=Math.atan2(y-CY,x-CX); }   // waiting its turn, a sign keeps to its orbit
    signTo(o,t); const c=o.cv;
    const D=SWB===SWB_D, ghosts=T==null?1:D?14:4, gstep=D?.016:.045;   // the dive: a long, close-set trail, so the fall reads as one smooth smear
    for(let k=ghosts-1;k>=0;k--){
      if(T!=null){ const dur=SWB===SWB_D?1.9:2.4, u=clamp((T-k*gstep-.2-o.delay)/dur), e=u*u*(3-2*u)*u, r=o.r0*Math.pow(1-e,1.3), a=o.a0+e*(SWB===SWB_D?4.5:7)*(1+(o.rank!=null&&SWB===SWB_D?o.rank*.08:o.delay));
        x=CX+Math.cos(a)*r; y=CY+Math.sin(a)*r; rot=a+Math.PI/2; sx=1+e*(SWB===SWB_D?8:5); sy=1/(1+e*(SWB===SWB_D?2.6:1.8)); /* stretched thin as it nears the horizon */ al=(1-ss(.82,1,e))*(k?(u>0?(D?.34*(1-k/ghosts):.45-k*.1):0):1); }
      g.save(); g.globalAlpha=al; g.translate(x,y); g.rotate(rot); g.scale(sx,sy); g.globalCompositeOperation='lighter';
      if(HAS_FILTER&&!k){g.filter=`blur(${Math.max(3,o.px*.1)}px)`; g.drawImage(c,-c.width/2,-c.height/2); g.filter='none';}
      g.drawImage(c,-c.width/2,-c.height/2); g.restore();
    }
    if(T==null||T<.5){ const la=(T==null?1:1-T/.5)*(.45+o.hv*.5); g.strokeStyle=`rgba(${SIL},${la*.6})`; g.lineWidth=Math.max(.6,.7*S);
      const lx=x+o.px*1.05, ly=y+o.px*.8; g.beginPath(); g.moveTo(x+o.px*.7,y+o.px*.55); g.lineTo(lx,ly); g.lineTo(lx+20*S,ly); g.stroke();
      const sfs=Math.max(11,Math.min(16,W*.008));   // the same small type as the footer: size and .22em of tracking
      g.fillStyle=`rgba(${SIL},${la})`; g.font=`300 ${sfs.toFixed(1)}px "Josefin Sans","Helvetica Neue",sans-serif`; g.letterSpacing=`${(sfs*.22).toFixed(2)}px`; g.fillText(o.label.toUpperCase(),lx+25*S,ly+3.5*S); g.letterSpacing='0px'; }
  }
}
function drawTitle(g,t,T){
  const fade=T==null?1:1-ss(.1,.7,T);
  if(fade>0){ g.globalAlpha=fade; g.drawImage(titleCv,0,0); g.globalAlpha=1; }
  if(T==null) return;
  // the letters come apart and stream in along the spiral
  g.strokeStyle=`rgba(${SIL},${SWB===SWB_D?.4:.85})`; g.lineWidth=Math.max(1,1.1*S); g.lineCap='round'; g.beginPath();   // (the dive: the letters stream in fainter, as threads, not dashes)
  const pos=(i,TT)=>{const r0=pts.r[i], q=pts.q[i], delay=.08+.55*(r0/(H*.6))*(.5+.5*q), u=clamp((TT-delay)/(1.9+q*.6)), e=u*u*(3-2*u);
    return [r0*Math.pow(1-e,1.35), pts.a[i]+e*(5+q*4), u];};
  for(let i=0;i<pts.n;i++){ const [r,a,u]=pos(i,T); if(u<=0&&fade>.05)continue; if(r<RH*.55)continue;
    const [r1,a1]=pos(i,T-.05); g.moveTo(CX+Math.cos(a1)*r1,CY+Math.sin(a1)*r1); g.lineTo(CX+Math.cos(a)*r+.5,CY+Math.sin(a)*r+.5); }
  g.stroke();
}

/* ---------------- shader: silk light, lens, vortex, hole ---------------- */
let gl=null, U={}, tex;
try{gl=cv.getContext('webgl',{antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:false})}catch(e){}
if(gl){
  const vs=`attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
  const fs=`precision highp float;
  uniform sampler2D T; uniform vec2 R,C; uniform float RH,RE,VORT,VT,FLASH,TIME,MODE,HOVER,BLACK,MIRROR,WATER; uniform vec3 RIP;
  float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  float vn(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){float s=0.,a=.5; for(int i=0;i<5;i++){s+=a*vn(p); p=p*2.03+vec2(1.7,9.2); a*=.5;} return s;}
  vec4 tx(vec2 q){return texture2D(T,vec2(q.x/R.x,1.-q.y/R.y));}
  vec2 rot(vec2 v,float a){float c=cos(a),s=sin(a);return vec2(c*v.x-s*v.y,s*v.x+c*v.y);}
  /* dark liquid silk: log-spiral sheets anchored on the hole, crests catching teal-silver light */
  vec3 silk(vec2 q){
    vec2 u=(q-C)/R.y; float t=TIME*.045;
    if(MIRROR>.5) u.x=abs(u.x);   /* bilateral symmetry, like the visionary references */
    float an=smoothstep(.0,.38,length(u));
    vec2 w=u;
    w+=an*.2*vec2(sin(w.y*2.1+t*5.),sin(w.x*1.8-t*4.3));
    w+=an*.08*vec2(sin(w.y*4.3-t*3.1+1.),sin(w.x*3.9+t*2.4+2.));
    w+=WATER*an*.07*vec2(sin(w.y*1.4+t*2.3),.4*sin(w.x*1.1-t*1.7));   /* water: the sheets lean with a slow current */
    float r=length(w)+1e-3, a=atan(w.y,w.x), lr=log(r);
    vec3 col=vec3(.008,.009,.02);
    float env=smoothstep(.02,.2,r)*(.35+.65*exp(-r*.9));
    /* frosted grain inside the sheets: the light breaks up like mist on glass, not clean CG */
    float frost=fbm(u*vec2(26.,9.)+vec2(t*2.,-t*3.));
    /* water: the sheets carry caustic light — a moving net of bright veins, as light through a rippled surface */
    float cst=0.; if(WATER>.001){ vec2 cw=w*7.+vec2(t*1.6,-t*1.2); float c1=1.-abs(vn(cw)-vn(cw*1.31+vec2(4.2,-t*.9))); float c2=1.-abs(vn(cw*2.1+9.)-vn(cw*2.7-vec2(t*1.3,2.))); cst=pow(c1,6.)*.75+pow(c2,9.)*.45; }
    for(int k=0;k<3;k++){
      float fk=float(k);
      float s=a*(2.+fk)+lr*(3.2-fk*.7)-t*(3.+fk*1.3)+fk*2.1;
      float v=sin(s);
      float body=smoothstep(.1,1.,v);
      float crest=exp(-pow((v-.97)*9.,2.))*smoothstep(.6,1.,v);
      float shade=.55+.45*sin(a+lr*1.3+fk+t);
      float br=mix(.55+.9*frost,.55+1.4*cst,WATER*.14);   /* water: the crest's light breaks into caustic veins */
      col+=vec3(.035,.05,.12)*body*env*(1.-fk*.25);
      col+=mix(vec3(.40,.50,.86),vec3(.30,.62,.66),fk*.35)*pow(crest,1.4)*env*shade*(.46-fk*.1)*br;
      col+=vec3(.18,.34,.46)*cst*body*env*(.045-fk*.01)*WATER;   /* and the body of the sheet glints with them, faintly */
      col+=vec3(.86,.88,1.)*pow(crest,5.)*env*shade*.35*br;
    }
    /* lavender haze drifting through the dark (ASTRX / 69 / 70) */
    float mist=fbm(u*2.2+vec2(t*.9,t*.4)); mist=smoothstep(.45,.95,mist);
    col+=mix(vec3(.20,.20,.34),vec3(.10,.19,.27),WATER)*mist*(.25+.75*smoothstep(.1,.6,length(u)))*.32;   /* lavender haze → deep water */
    vec2 v2=q/R-vec2(.95,1.05); col+=vec3(.12,.12,.32)*exp(-dot(v2,v2)*7.);
    vec2 v3=q/R-vec2(.05,-.05); col+=vec3(.08,.07,.20)*exp(-dot(v3,v3)*9.);
    /* keep the silk out of the title band and the name/footer band (released as the vortex takes over) */
    float yy=q.y/R.y, calm=smoothstep(.28,.17,yy)+.6*smoothstep(.80,.9,yy);
    col*=1.-.75*clamp(calm,0.,1.)*(1.-clamp(VORT*3.,0.,1.));
    return col;
  }
  vec3 scene(vec2 q){ if(MODE>1.5) return tx(q).rgb; vec3 c=silk(q); vec4 o=tx(q); return mix(c,o.rgb,o.a); }
  void main(){
    vec2 p0=vec2(gl_FragCoord.x,R.y-gl_FragCoord.y);
    float gr=(h(p0+fract(TIME*7.13)*91.)-.5);
    /* water: a slow flow of refraction over everything (least at the hole's lip), and the rings the hole sends out */
    vec2 f1=p0/R.y*3.2+vec2(TIME*.05,-TIME*.035), f2=p0/R.y*8.+vec2(-TIME*.08,TIME*.06);
    vec2 flow=(vec2(vn(f1),vn(f1+17.3))-.5)*R.y*.016+(vec2(vn(f2+5.1),vn(f2+31.7))-.5)*R.y*.006;
    vec2 dd0=p0-C; float r0=length(dd0)+1e-3; float lipK=smoothstep(RH*1.15,RH*2.6,r0);
    float rip=0.; for(int i=0;i<3;i++){ float age=RIP[i]; if(age>0.){ float x=r0-age*R.y*.16; rip+=sin(x*.055)*exp(-x*x/(R.y*R.y*.004))*exp(-age*.55); } }
    float still=smoothstep(R.y*.34,R.y*.22,p0.y)*(1.-clamp(VORT*4.,0.,1.));   /* the title's band is left still — until the dive, when it falls in with the rest */
    vec2 p=p0+WATER*(flow*(.35+.65*lipK)+dd0/r0*rip*R.y*.012*lipK)*(1.-still);
    vec2 d=p-C; float r=length(d)+1e-3, a=atan(d.y,d.x);
    float k=RE*RE/(r*r);
    k*=1.-still*WATER*.97;   /* water version: the lens leaves the title's band alone too, so the name sits on one straight line */
    vec2 lq=d*(1.-k); float lr=length(lq)+1e-3;
    vec3 col;
    float spinA=0.;
    if(VORT<.002){
      float ab=mix(1.,.3,WATER); vec2 qr=C+d*(1.-k*(1.-.035*ab)), qg=C+lq, qb=C+d*(1.-k*(1.+.04*ab));   /* water: much less rainbow at the lip */
      vec4 cr=tx(qr),cg=tx(qg),cb=tx(qb);
      if(MODE>1.5) col=vec3(cr.r,cg.g,cb.b);
      else { vec3 s=silk(qg); col=vec3(mix(s.r,cr.r,cr.a),mix(s.g,cg.g,cg.a),mix(s.b,cb.b,cb.a)); }
    } else {
      /* the vortex: inner water turns faster than outer (differential rotation) and everything drifts inward */
      float v2=VORT*VORT;
      /* log-spiral winding: the tighter in, the more turned; the whole whirl also spins faster over time */
      float RH0=R.y*${HOLE_R.toFixed(4)};
      float wind=log(max(R.y*.62/max(lr,RH0*.4),1.));
      float om=v2*3.4*wind+VORT*VT*1.1*pow(RH0/max(lr,RH0*.4),.5)+VORT*1.2;
      spinA=-om;   /* the whirl turns the way the signs were drawn in (clockwise on screen) */
      float inflow=1.+v2*2.4*pow(RH0/max(lr,RH0*.45),.55);
      vec3 acc=vec3(0.); float ws=0.;
      for(int i=0;i<7;i++){ float f=float(i)/6.;
        vec2 q=C+rot(lq,-(om-f*(.08+.5*VORT)*(.4+wind*.35)))*inflow*(1.+f*.05*VORT);
        float w=1.-f*.55; acc+=scene(q)*w; ws+=w; }
      col=acc/ws;
      float la=atan(lq.y,lq.x);
      float ph=la-om;
      float arms=pow(.5+.5*sin(3.*ph),5.);
      float env=exp(-pow((lr-RH*1.9)/(RH*2.2*(1.+VORT)),2.))*smoothstep(RH*.8,RH*1.3,lr);
      col+=vec3(.45,.55,.92)*arms*env*VORT*.9+vec3(.9,.97,1.)*pow(arms,5.)*env*v2*.45;
    }
    float br=.5+.5*sin(TIME*.9);
    float ea=a+spinA*.35;
    float edge=RH*(1.+.05*sin(ea*3.+TIME*.35)+.035*sin(ea*7.-TIME*.27)+.03*br+.05*HOVER);
    float spray=(h(p*1.37+floor(TIME*24.))-.5)*RH*.38;
    float ringn=.6+.4*sin(ea*5.+TIME*.8)*sin(ea*2.-TIME*.5);
    float ring=exp(-pow((r-edge*1.1)/(RH*.07),2.))*ringn+exp(-pow((r-edge*1.1)/(RH*.35),2.))*.25;
    col+=vec3(.62,.74,.98)*ring*(.35+.25*br+HOVER*.45+FLASH*1.5+VORT*.8);
    float hole=1.-smoothstep(edge*.5,edge*1.08,r+spray*smoothstep(edge*.4,edge*1.1,r));
    col=mix(col,vec3(0.,.002,.006),hole);
    vec2 q=rot(d,.18+TIME*.02+spinA*.2)/RH;
    float pearl=exp(-dot(q,q)*420.)*1.2+exp(-dot(q,q)*28.)*.22;
    float arm=exp(-abs(q.x)*55.)*exp(-abs(q.y)*(3.2-FLASH*2.))+exp(-abs(q.y)*55.)*exp(-abs(q.x)*(3.2-FLASH*2.));
    vec2 q2=rot(q,.785); arm+=.3*(exp(-abs(q2.x)*70.)*exp(-abs(q2.y)*7.)+exp(-abs(q2.y)*70.)*exp(-abs(q2.x)*7.));
    arm*=mix(1.,.3,WATER);   /* water: the cross of starlight softens to a glint under water */
    float glow=(pearl+arm*.55)*(.55+.45*br+HOVER*.4)+FLASH*(pearl*3.+arm*2.+exp(-r/RH*1.3)*.6);
    col+=glow*vec3(.74,.80,1.)*(1.-VORT*.6);
    if(WATER>.001){
      float yN=gl_FragCoord.y/R.y;   /* 1 at the top: the surface is up there */
      vec3 wcol=col*vec3(.84,1.0,1.06)+vec3(0.,.006,.012);
      wcol+=vec3(.07,.13,.19)*pow(smoothstep(.45,1.,yN),1.6)*.55;   /* light coming down from the surface */
      vec2 cq=p/R.y*3.3; float ca=1.-abs(vn(cq+vec2(TIME*.05,TIME*.03))-vn(cq*1.37+vec2(-TIME*.04,TIME*.06)+7.));
      wcol+=vec3(.22,.34,.44)*pow(ca,10.)*.05*smoothstep(.5,1.,yN);   /* caustic veins */
      float snow=0.; for(int L=0;L<2;L++){ float cell=R.y*(L==0?.045:.07); vec2 gq=(p0+vec2(sin(TIME*.2+float(L))*20.,-TIME*R.y*(L==0?.008:.014)))/cell;
        vec2 id=floor(gq), f=fract(gq)-.5-(vec2(h(id),h(id+3.1))-.5)*.6; snow+=step(h(id+float(L)*7.),.12)*exp(-dot(f,f)*(L==0?260.:140.))*(L==0?.5:.8); }
      wcol+=vec3(.55,.62,.72)*snow*.12*(1.-VORT);   /* marine snow, drifting down */
      col=mix(col,wcol,WATER);
    }
    col+=gr*.04;
    /* oval vignette: follows the screen's own shape (1 at the edge midpoints, 1.41 at the corners) */
    vec2 uv=gl_FragCoord.xy/R-.5; uv.y+=.06; uv.y*=uv.y<0.?.85:1.;   /* centre sits a little low and the bottom falls off more gently */
    float ve=length(uv*2.); col*=1.-.6*smoothstep(.7,1.4,ve);
    col+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)*(1.6/255.);   /* dither: no banding in the dark */
    gl_FragColor=vec4(col*(1.-BLACK),1.);
  }`;
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(o);return o};
  try{const prog=gl.createProgram(); gl.attachShader(prog,sh(gl.VERTEX_SHADER,vs)); gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(prog); gl.useProgram(prog);
    const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const l=gl.getAttribLocation(prog,'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0);
    for(const n of ['T','R','C','RH','RE','VORT','VT','FLASH','TIME','MODE','HOVER','BLACK','MIRROR','WATER','RIP'])U[n]=gl.getUniformLocation(prog,n);
    tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
  }catch(e){console.warn(e);gl=null}
}
const F2=gl?null:cv.getContext('2d');

/* ---------------- sound on the surface (shares the piece's audio graph) ---------------- */
let OA=null;
function oa(){
  const A=G.A; if(!A.ctx) return null; if(OA) return OA;
  const c=A.ctx, amb=c.createGain(), fx=c.createGain(); amb.gain.value=0; fx.gain.value=1; amb.connect(A.master); fx.connect(A.master);
  const nb=c.createBuffer(1,c.sampleRate*4,c.sampleRate), nd=nb.getChannelData(0); let lp=0;
  for(let i=0;i<nd.length;i++){lp=lp*.97+(Math.random()*2-1)*.03;nd[i]=lp*6}
  const noise=c.createBufferSource(); noise.buffer=nb; noise.loop=true;
  const nf=c.createBiquadFilter(); nf.type='lowpass'; nf.frequency.value=700; const ng=c.createGain(); ng.gain.value=.05;
  noise.connect(nf).connect(ng).connect(amb); noise.start();
  const drones=[220,329.6,493.9,659.3].map((f,i)=>{const o=c.createOscillator(); o.frequency.value=f; const g=c.createGain(); g.gain.value=[.028,.018,.01,.007][i];
    const lfo=c.createOscillator(), lg=c.createGain(); lfo.frequency.value=.07+i*.031; lg.gain.value=g.gain.value*.8; lfo.connect(lg).connect(g.gain); lfo.start(); o.connect(g).connect(amb); o.start(); return o});
  const dl=c.createDelay(2), fbk=c.createGain(), dlf=c.createBiquadFilter(); dl.delayTime.value=.42; fbk.gain.value=.45; dlf.type='lowpass'; dlf.frequency.value=2200;
  dl.connect(dlf).connect(fbk).connect(dl); dlf.connect(fx);
  OA={c,amb,fx,nf,ng,drones,dl}; ambUp(); return OA;
}
function ambUp(){ if(!OA)return; const t=OA.c.currentTime;
  for(const o of OA.drones){o.detune.cancelScheduledValues(t);o.detune.setValueAtTime(0,t)}
  OA.nf.frequency.cancelScheduledValues(t); OA.nf.frequency.setValueAtTime(700,t); OA.ng.gain.cancelScheduledValues(t); OA.ng.gain.setValueAtTime(.05,t);
  OA.amb.gain.cancelScheduledValues(t); OA.amb.gain.setValueAtTime(OA.amb.gain.value,t); OA.amb.gain.linearRampToValueAtTime(.9,t+2.5);
  OA.fx.gain.cancelScheduledValues(t); OA.fx.gain.setValueAtTime(1,t); }
function ping(f,t,v){ if(!OA)return; const c=OA.c, o=c.createOscillator(), g=c.createGain();
  o.frequency.setValueAtTime(f,t); o.frequency.exponentialRampToValueAtTime(f*.62,t+.5);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+.01); g.gain.exponentialRampToValueAtTime(.0008,t+1.3);
  o.connect(g); g.connect(OA.fx); g.connect(OA.dl); o.start(t); o.stop(t+1.4);}
function soundDown(withAmb){
  const a=oa(); if(!a)return; const c=a.c, t=c.currentTime;
  a.fx.gain.cancelScheduledValues(t); a.fx.gain.setValueAtTime(1,t);
  if(withAmb){
    for(const o of a.drones){o.detune.setValueAtTime(0,t+.2); o.detune.linearRampToValueAtTime(-2600,t+SWB-.6);}
    a.nf.frequency.setValueAtTime(700,t); a.nf.frequency.exponentialRampToValueAtTime(2400,t+.4); a.nf.frequency.exponentialRampToValueAtTime(90,t+SWB-.6);
    a.ng.gain.linearRampToValueAtTime(.16,t+1.2);
    a.amb.gain.setValueAtTime(a.amb.gain.value,t+SWB-.07); a.amb.gain.linearRampToValueAtTime(0,t+SWB);
  }
  const sub=c.createOscillator(), sg=c.createGain(); sub.frequency.setValueAtTime(26,t); sub.frequency.exponentialRampToValueAtTime(54,t+SWB-.4);
  sg.gain.setValueAtTime(0,t); sg.gain.linearRampToValueAtTime(.45,t+SWB-.5); sub.connect(sg).connect(a.fx); sub.start(t); sub.stop(t+SWB+.3);
  ping(1760,t+.02,.14);
  [1318.5,987.8,1760,739.9,1174.7,880,1567.98].forEach((f,i)=>{const o=c.createOscillator(), g=c.createGain(); o.type=i%2?'triangle':'sine';
    const s=t+(withAmb?SIGN_ARR(i):.25+i*.34); /* with the dive: as each sign crosses the edge */ o.frequency.setValueAtTime(f,s); o.frequency.exponentialRampToValueAtTime(f/16,s+2.6);
    g.gain.setValueAtTime(0,s); g.gain.linearRampToValueAtTime(.06,s+.05); g.gain.exponentialRampToValueAtTime(.001,s+2.8);
    o.connect(g); g.connect(a.fx); g.connect(a.dl); o.start(s); o.stop(s+2.9);});
  a.fx.gain.setValueAtTime(1,t+SWB-.06); a.fx.gain.linearRampToValueAtTime(0,t+SWB);
}
function hoverSound(o){
  const A=G.A; if(!A.ctx||A.ctx.state!=='running') return; const a=oa(); if(!a) return;
  if(clock-o.lastPlay<3.2) return;
  if(G.playPhrase(o.id,A.ctx.currentTime+.02,a.fx,.9)) o.lastPlay=clock;
}

/* ---------------- flow ---------------- */
const SIGN_ARR=i=>.35+i*.85+.2+1.9*.88;   // when sign i reaches the edge of the hole
function begin(){
  if(mode!=='surface') return;
  SWB=SWB_D; G.audioInit(); oa(); soundDown(true);
  mode='swallow'; sw={t:0,name:nameEl.value};
  nameEl.blur(); ui.style.opacity=0; ui.style.pointerEvents='none';
  orbs.slice().sort((a,b)=>(a.r0||0)-(b.r0||0)).forEach((o,i)=>{ o.rank=i; o.delay=.35+i*.85; o.arr=SIGN_ARR(i); o.flashed=false; });   // one by one, the nearest first
}
function finishBlack(){
  const cb=onBlack, wasOpening=mode==='swallow', name=sw&&sw.name; mode='off'; sw=null; onBlack=null; src=null;
  cv.style.display=arcCv.style.display='none'; ui.style.display='none';
  if(wasOpening){ if(window.SBWake) SBWake.start('',nm=>G.start(nm||'')); else G.start(''); }   // title → wake (the name is asked there) → play   // title → wake → play
  else if(cb) cb();
}
function show(){
  mode='surface'; sw=null; cv.style.display=arcCv.style.display='block'; ui.style.display=''; ui.style.opacity=1; ui.style.pointerEvents='';
  nameEl.value=''; layout(); ambUp();
}
function vortex(source,cb){
  if(mode==='vortex') return;
  SWB=SWB_V; src=source; onBlack=cb; mode='vortex'; sw={t:0}; cv.style.display='block'; arcCv.style.display='none'; ui.style.display='none';
  layout(); soundDown(false);
}

function toPx(e){const r=cv.getBoundingClientRect(); return [(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height]}
cv.addEventListener('pointermove',e=>{ [mx,my]=toPx(e); if(!G.A.ctx) G.audioInit(); oa(); });
cv.addEventListener('pointerleave',()=>{mx=my=-1e4});
cv.addEventListener('pointerdown',e=>{
  if(mode!=='surface') return;
  const [x,y]=toPx(e); G.audioInit(); oa();
  if(Math.hypot(x-CX,y-CY)<RH*1.7) begin(); else ping(2637,OA?OA.c.currentTime:0,.03);
});
addEventListener('keydown',e=>{
  if(mode!=='surface') return;
  if(e.target===nameEl){ if(e.key==='Enter'){ e.preventDefault(); begin(); } return; }
  const k=e.key.toLowerCase();
  if(k==='enter'||k===' '){ e.preventDefault(); begin(); }
  else if(k==='t'){ titleBottom=!titleBottom; layout(); toast(titleBottom?'title · bottom':'title · top'); }
  else if(k==='f'){ FI=(FI+1)%FONTS.length; layout(); toast(FONTS[FI].name); }
  else if(k>='1'&&k<='5'){ TV=+k-1; layout(); toast('title · '+TITLES[TV]); }
  else if(k==='m'){ mirror=1-mirror; toast(mirror?'silk · mirrored':'silk · free'); }
});
nameEl.addEventListener('pointerdown',()=>{ G.audioInit(); oa(); });
function toast(s){const t=$('toast'); t.textContent=s; t.style.opacity=1; clearTimeout(toast.h); toast.h=setTimeout(()=>t.style.opacity=0,1600)}
addEventListener('resize',()=>{ if(mode==='surface') layout(); });

/* drop symbol artwork straight onto the page to preview it everywhere */
let dragN=0;
addEventListener('dragenter',e=>{e.preventDefault(); if(++dragN===1)$('drop').classList.add('on')});
addEventListener('dragleave',()=>{if(--dragN<=0){dragN=0;$('drop').classList.remove('on')}});
addEventListener('dragover',e=>e.preventDefault());
addEventListener('drop',e=>{e.preventDefault(); dragN=0; $('drop').classList.remove('on');
  const files=[...(e.dataTransfer?.files||[])].filter(f=>/^image\//.test(f.type)); const placed=[];
  for(const f of files){const nm=f.name.toLowerCase(); let id=IDS.find(k=>nm.includes(k)); if(!id||placed.includes(id))id=IDS.find(k=>!SYM[k]&&!placed.includes(k))||IDS.find(k=>!placed.includes(k)); if(!id)break;
    placed.push(id); const im=new Image(); im.onload=()=>setSym(id,im); im.src=URL.createObjectURL(f);}
  if(placed.length)toast('symbol → '+placed.join(' · '));});

setInterval(()=>{ const n=G.deepCount(); $('deepN').textContent=n?String(n).padStart(3,'0'):'—'; },1000);

let last=performance.now(), TS=1, frames=0, waterK=1, WATER_ON=true, nextRip=2, ripT=[null,null,null];
function frame(now){
  const dt=Math.min(.05,(now-last)/1000)*TS; last=now; clock+=dt; frames++;
  if(mode!=='off'){
    const t=clock*(REDUCED?.4:1);
    let vort=0, re=RH*1.38, rh=RH, flash=0, black=0, m=0;
    const hv=mode==='surface'&&Math.hypot(mx-CX,my-CY)<RH*1.7?1:0; hover+=(hv-hover)*Math.min(1,dt*4);
    cv.style.cursor=hv?'pointer':'default'; if(window.SBCursor) SBCursor.hot(Math.max(hv,...orbs.map(o=>o.hv||0)));
    if(mode==='surface'){ re*=1+hover*.12;
      for(const o of orbs){ const on=Math.hypot(mx-o.x,my-o.y)<o.px*1.15; o.hv+=((on?1:0)-o.hv)*Math.min(1,dt*5); if(on) hoverSound(o); } }
    if(sw){ sw.t+=dt; const T=sw.t;
      flash=Math.exp(-Math.pow((T-.12)/.1,2))+.25*ss(0,.1,T)*(1-ss(.1,1.4,T));
      const D=SWB===SWB_D, vEnd=D?7.8:3.4, vk=D?Math.pow(ss(.15,vEnd,T),1.7):ss(.15,vEnd,T);   // the whirl begins under the click's flash (no switch to see later); in the dive it gathers slowly, so each sign is seen going in
      vort=T>.15?Math.max(.003,REDUCED?vk*.5:vk):0;   // (past the flash the whirl's way of drawing is on at once, however faint: no visible switch later)
      re=RH*(1.38+1.4*ss(.1,D?7.4:3,T));
      rh=RH*(1+.3*ss(.2,D?5.5:2.6,T)+Math.pow(ss(D?SWB-1.9:2.8,SWB-.05,T),2.4)*(Math.hypot(W,H)/RH));
      if(D&&mode==='swallow') for(const o of orbs) if(o.arr!=null) flash+=.2*Math.exp(-Math.pow((T-o.arr)/.26,2));   // a soft swell of light as each sign goes in (not a strobe)
      black=ss(SWB-.3,SWB,T); }
    if(mode==='vortex'){ m=2; if(sw.t<.35) flash*=.6; }
    else { const T=mode==='swallow'?sw.t:null;
      drawFrame(W2,t,T==null?1:1-ss(0,1.2,T)); drawOrbs(W2,t,T); SBG.airbrush(world,{blur:1.6,under:.85,crisp:.45}); drawTitle(W2,t,T); SBG.airbrush(world,{blur:1.1,under:.45,crisp:.85,dots:.35,small:4}); A2.clearRect(0,0,W,H); drawArc(A2,t,T==null?1:1-ss(0,.4,T)); }   // signs and trails airbrushed into the grain; the title stays clean
    if(gl){ gl.bindTexture(gl.TEXTURE_2D,tex);
      try{ gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,m===2?src:world); }catch(e){}
      gl.uniform1i(U.T,0); gl.uniform2f(U.R,W,H); gl.uniform2f(U.C,CX,CY); gl.uniform1f(U.RH,rh); gl.uniform1f(U.RE,re);
      gl.uniform1f(U.VORT,vort); gl.uniform1f(U.VT,sw?sw.t:0); gl.uniform1f(U.FLASH,flash); gl.uniform1f(U.TIME,t); gl.uniform1f(U.MODE,m); gl.uniform1f(U.HOVER,hover); gl.uniform1f(U.BLACK,black); gl.uniform1f(U.MIRROR,mirror);
      waterK+=((WATER_ON?1:0)-waterK)*Math.min(1,dt*2); gl.uniform1f(U.WATER,waterK);
      if(t>nextRip){ ripT.unshift(t); ripT.length=3; nextRip=t+5; }   // the hole breathes out a ring of water now and then
      gl.uniform3f(U.RIP,...ripT.map(x=>x==null?-1:t-x));
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    } else { F2.fillStyle='#04080c'; F2.fillRect(0,0,W,H); F2.drawImage(m===2?src:world,0,0,W,H);
      const g=F2.createRadialGradient(CX,CY,0,CX,CY,rh*1.15); g.addColorStop(0,'#000'); g.addColorStop(.6,'#000'); g.addColorStop(1,'rgba(0,0,0,0)');
      F2.fillStyle=g; F2.beginPath(); F2.arc(CX,CY,rh*1.2,0,TAU); F2.fill(); if(black>0){F2.fillStyle=`rgba(0,0,0,${black})`; F2.fillRect(0,0,W,H);} }
    if(sw && sw.t>=SWB+.25) finishBlack();
  }
  requestAnimationFrame(frame);
}
const fontsReady=Promise.race([Promise.all([...FONTS.map(F=>F.css.replace('{s}',60)),'300 12px "Josefin Sans"'].map(f=>document.fonts.load(f,'SLIP BENEATH'))).catch(()=>{}),new Promise(r=>setTimeout(r,2500))]);
fontsReady.then(()=>{ layout(); requestAnimationFrame(t=>{last=t;frame(t)}); });
return {show,vortex,begin,get mode(){return mode},set speed(v){TS=v},get frames(){return frames}};
})();

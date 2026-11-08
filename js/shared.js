/* ───────── shared: the seven signs, drawn the same way everywhere (until real artwork replaces them) ───────── */
window.SB_DPR=(()=>{ const q=new URLSearchParams(location.search).get('q'), budget=q==='low'?1.4e6:q==='high'?1e9:2.4e6;   // pixels a frame
  return Math.max(.55,Math.min(devicePixelRatio||1,2,Math.sqrt(budget/Math.max(1,innerWidth*innerHeight)))); })();
/* a governor: if the frame rate stays under 30 for two looks (2 s each), draw 15% fewer pixels, down to a floor — so a slower
   machine eases itself instead of stalling (each scene re-reads SB_DPR on resize) */
(()=>{ if(new URLSearchParams(location.search).get('q')==='high') return;   // the high-quality version (for recording) keeps its full resolution
  const floor=Math.max(.7,window.SB_DPR*.75); let n=0, t0=performance.now(), low=0; const f=t=>{ n++; const el=t-t0; if(el>2000){ const fps=n*1000/el; n=0; t0=t;
    if(document.visibilityState==='visible'&&fps<30&&window.SB_DPR>floor+.01){ if(++low>=2){ low=0; window.SB_DPR=Math.max(floor,window.SB_DPR*.88); dispatchEvent(new Event('resize')); } } else low=0; }
  requestAnimationFrame(f); }; requestAnimationFrame(f); })();
window.SBCursor=(()=>{ let el=null, ring=null, x=-1e4, y=-1e4, hot=0, want=0, shown=true; const t0=performance.now();
  function make(){ if(el) return; const st=document.createElement('style');
    st.textContent='html,body,body *{cursor:none!important}'
      +'#sbcur{position:fixed;left:0;top:0;z-index:2147483000;pointer-events:none;will-change:transform}'
      +'#sbcur i{position:absolute;left:0;top:0;border-radius:50%;transform:translate(-50%,-50%)}'
      +'#sbcur .d{width:.5vh;height:.5vh;min-width:4px;min-height:4px;background:rgba(238,240,250,.85);box-shadow:0 0 6px rgba(200,208,250,.6)}'
      +'#sbcur .r{border:max(1px,.145vh) solid rgba(200,208,250,.6)}';
    document.head.appendChild(st); el=document.createElement('div'); el.id='sbcur'; el.innerHTML='<i class="r"></i><i class="d"></i>'; document.body.appendChild(el); ring=el.firstChild; requestAnimationFrame(tick); }
  function tick(now){ hot+=(want-hot)*.2;
    const ph=((now-t0)/750)%1, pu=Math.exp(-ph*5), h=innerHeight/900;   // the beat: 80 BPM, as the wake's
    const d=2*(12+hot*8+pu*4)*h; ring.style.width=ring.style.height=d+'px'; ring.style.opacity=((.3+.45*pu)*(.6+.4*hot)/.75).toFixed(3);
    el.style.display=shown&&!document.pointerLockElement?'block':'none'; el.style.transform=`translate(${x}px,${y}px)`;
    requestAnimationFrame(tick); }
  addEventListener('mousemove',e=>{ x=e.clientX; y=e.clientY; },{passive:true});
  if(document.body) make(); else addEventListener('DOMContentLoaded',make);
  return { hot(v){ want=Math.max(0,Math.min(1,v)); }, show(v){ shown=!!v; } };
})();
window.SBG=(()=>{
  const TAU=Math.PI*2, REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C_CORE='rgba(248,249,255,', C_SIL='rgba(232,234,250,', C_PERI='rgba(111,127,208,', C_LIL='rgba(201,200,232,';
  function flare(g,x,y,size,a){ if(a<=0)return;
    let gr=g.createRadialGradient(x,y,0,x,y,size*.9); gr.addColorStop(0,C_CORE+(.95*a)+')'); gr.addColorStop(.18,C_SIL+(.45*a)+')'); gr.addColorStop(1,C_PERI+'0)');
    g.fillStyle=gr; g.beginPath(); g.arc(x,y,size*.9,0,TAU); g.fill();
    for(const [dx,dy,L] of [[1,0,size*3.2],[0,1,size*2.4]]){const lg=g.createLinearGradient(x-dx*L,y-dy*L,x+dx*L,y+dy*L);
      lg.addColorStop(0,C_SIL+'0)'); lg.addColorStop(.5,C_CORE+(.85*a)+')'); lg.addColorStop(1,C_SIL+'0)');
      g.strokeStyle=lg; g.lineWidth=Math.max(.8,size*.05); g.beginPath(); g.moveTo(x-dx*L,y-dy*L); g.lineTo(x+dx*L,y+dy*L); g.stroke();}}
  function pearl(g,x,y,r,a=1){const gr=g.createRadialGradient(x-r*.4,y-r*.4,0,x,y,r); gr.addColorStop(0,C_CORE+a+')'); gr.addColorStop(.5,`rgba(214,214,240,${.85*a})`); gr.addColorStop(1,`rgba(111,127,208,${.25*a})`);
    g.fillStyle=gr; g.beginPath(); g.arc(x,y,r,0,TAU); g.fill();}
  function spiral(g,x,y,S,dir,turns,t,r0,a,w){g.strokeStyle=C_SIL+a+')'; g.lineWidth=w; g.beginPath();
    for(let i=0;i<=100;i++){const k=i/100, an=dir+k*turns*TAU+(REDUCED?0:t*.2), r=r0*S*(1-k*.92); const px=x+Math.cos(an)*r, py=y+Math.sin(an)*r; i?g.lineTo(px,py):g.moveTo(px,py);} g.stroke();}
  function drawGlyph(g,id,t,S){
    const a=1, w=Math.max(1,S*.03);
    g.save(); g.globalCompositeOperation='lighter'; g.lineCap='round';
    if(id==='soul'){ g.setLineDash([S*.03,S*.05]);
      for(let i=0;i<11;i++){const an=-Math.PI/2+(i/10-.5)*Math.PI*1.3; g.strokeStyle=C_SIL+(.55*a)+')'; g.lineWidth=w*.7; g.beginPath();
        g.moveTo(Math.cos(an)*S*.2,S*.15+Math.sin(an)*S*.2); g.lineTo(Math.cos(an)*S*(i%2?.55:.75),S*.15+Math.sin(an)*S*(i%2?.55:.75)); g.stroke();}
      g.setLineDash([]); pearl(g,0,S*.15,S*.17,a); flare(g,0,S*.15,S*.1,.5*a);
    } else if(id==='dream'){ g.strokeStyle=C_SIL+(.6*a)+')'; g.lineWidth=w; g.beginPath(); g.arc(0,0,S*.62,0,TAU); g.stroke();
      for(let k=1;k<=3;k++){const rx=S*.62*Math.abs(Math.cos(k/4*Math.PI/2+(REDUCED?0:t*.3))); g.strokeStyle=C_SIL+(.35*a)+')'; g.lineWidth=w*.7; g.beginPath(); g.ellipse(0,0,rx,S*.62,0,0,TAU); g.stroke();}
      g.strokeStyle=C_LIL+(.35*a)+')'; g.beginPath(); g.ellipse(0,0,S*.62,S*.1,0,0,TAU); g.stroke();
    } else if(id==='voice'){ for(const sx of [-1,1]){ g.strokeStyle=C_SIL+(.7*a)+')'; g.lineWidth=w; g.beginPath();
        g.moveTo(sx*S*.06,S*.45); g.quadraticCurveTo(sx*S*.75,S*.25,sx*S*.5,-S*.6); g.stroke();
        for(let i=1;i<5;i++){const u=i/5, x=(1-u)*(1-u)*.06+2*(1-u)*u*.62+u*u*.47, y=(1-u)*(1-u)*.45+2*(1-u)*u*.25+u*u*-.6; pearl(g,sx*S*x*.86,S*y,S*.035,a*(REDUCED?.7:.5+.5*Math.sin(t*1.6+i)));}}
    } else if(id==='heart'){ const ph=REDUCED?.3:(t%.75)/.75, beat=Math.exp(-ph*5);
      for(let i=0;i<4;i++){g.strokeStyle=C_SIL+((.65-i*.12)*a)+')'; g.lineWidth=w*.8; g.beginPath(); g.arc(0,0,S*(.12+i*.14)*(1+beat*.04*(4-i)),0,TAU); g.stroke();}
      pearl(g,0,0,S*(.1+beat*.03),a);
    } else if(id==='sense'){ const open=REDUCED?1:.6+.4*Math.abs(Math.sin(t*.6));
      g.strokeStyle=C_CORE+(.7*a)+')'; g.lineWidth=w; g.beginPath(); g.moveTo(-S*.6,0); g.quadraticCurveTo(0,-S*.42*open,S*.6,0); g.quadraticCurveTo(0,S*.42*open,-S*.6,0); g.stroke();
      for(let i=0;i<2;i++){g.strokeStyle=C_SIL+((.5-i*.15)*a)+')'; g.beginPath(); g.arc(0,0,S*(.12+i*.08),0,TAU); g.stroke();}
      pearl(g,0,0,S*.08,a); pearl(g,-S*.78,0,S*.07,a); pearl(g,S*.78,0,S*.07,a);
    } else if(id==='memory'){ for(const sx of [-1,1]) spiral(g,sx*S*.3,S*.05,S,sx>0?0:Math.PI,1.9,t,.34,.8*a,w);
    } else if(id==='bone'){ for(let i=0;i<6;i++){const yy=S*(-.5+i*.18), ww=S*(.2-i*.02);
        g.strokeStyle=C_SIL+(.7*a)+')'; g.lineWidth=w; g.beginPath(); g.ellipse(0,yy,ww,S*.05,0,0,TAU); g.stroke();
        for(const sx of [-1,1]){g.beginPath(); g.moveTo(0,yy); g.quadraticCurveTo(sx*ww*1.8,yy-S*.03,sx*ww*1.4,yy+S*.09); g.stroke();}}
      g.strokeStyle=C_CORE+(.6*a)+')'; g.beginPath(); g.moveTo(0,-.62*S); g.lineTo(0,.62*S); g.stroke();
    }
    g.restore();
  }
  const IDS=['heart','voice','bone','memory','soul','dream','sense'];
  const SYM={}, subs=[];
  function setSym(id,img){SYM[id]=img; subs.forEach(f=>f(id))}
  /* real artwork, when it is published next to the page as symbols/<id>.png (or .svg / .webp) */
  IDS.forEach(id=>{const tryExt=ex=>{if(!ex.length)return; const im=new Image(); im.onload=()=>setSym(id,im); im.onerror=()=>tryExt(ex.slice(1)); im.src=`symbols/${id}.${ex[0]}`}; tryExt(['png','svg','webp'])});
  /* one sign into a square canvas, centred, S = half-size of the sign */
  function paint(g,id,t,S){ const img=SYM[id];
    if(img){const iw=img.naturalWidth||img.width||1, ih=img.naturalHeight||img.height||1, k=Math.min(S*2/iw,S*2/ih); g.drawImage(img,-iw*k/2,-ih*k/2,iw*k,ih*k);}
    else drawGlyph(g,id,t,S); }
  /* film grain over every scene: a few pre-baked noise tiles flicked at ~14 fps, strength set per scene via SBG.grain(x) */
  const grainEl=document.createElement('div'); grainEl.id='grain'; grainEl.setAttribute('aria-hidden','true');
  const tiles=[...Array(4)].map(()=>{const c=document.createElement('canvas'); c.width=c.height=192; const g=c.getContext('2d'), im=g.createImageData(192,192), d=im.data;
    for(let i=0;i<d.length;i+=4){const v=128+((Math.random()+Math.random()+Math.random())/3-.5)*255; d[i]=d[i+1]=d[i+2]=v; d[i+3]=255}
    g.putImageData(im,0,0); return `url(${c.toDataURL()})`});
  let gi=0; const flick=()=>{grainEl.style.backgroundImage=tiles[gi=(gi+1)%tiles.length]; grainEl.style.backgroundPosition=`${(Math.random()*192)|0}px ${(Math.random()*192)|0}px`};
  flick(); if(!REDUCED) setInterval(flick,70);
  (document.getElementById('stage')||document.body).appendChild(grainEl);
  const grain=v=>grainEl.style.setProperty('--grain',v);
  /* airbrush: soften a 2D layer in place so it sits in the piece's grain instead of reading as vector graphics —
     a small blurred copy laid back large (the spray), the drawing stippled through grain (the dots), a little of it crisp */
  const GR=(()=>{const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d'), d=g.createImageData(256,256);
    for(let i=0;i<d.data.length;i+=4){ d.data[i]=d.data[i+1]=d.data[i+2]=255; d.data[i+3]=Math.pow(Math.random(),.55)*255|0; } g.putImageData(d,0,0); return c;})();
  const AB={}; const mk=(w,h)=>{const c=document.createElement('canvas'); c.width=Math.max(1,w|0); c.height=Math.max(1,h|0); return c;};
  function airbrush(cv,o={}){ const W=cv.width, H=cv.height; if(!W||!H) return; const k=o.small||6, key=W+'x'+H+'/'+k;
    const c=AB[key]||(AB[key]={a:mk(W,H),s:mk(W/k,H/k)}), g=cv.getContext('2d'), ag=c.a.getContext('2d'), sg=c.s.getContext('2d');
    ag.globalCompositeOperation='copy'; ag.globalAlpha=1; ag.drawImage(cv,0,0);
    sg.globalCompositeOperation='copy'; sg.filter=`blur(${o.blur||1.5}px)`; sg.drawImage(cv,0,0,c.s.width,c.s.height); sg.filter='none';
    g.save(); g.setTransform(1,0,0,1,0,0); g.filter='none';
    g.globalCompositeOperation='copy'; g.globalAlpha=o.under??.9; g.drawImage(c.s,0,0,W,H);
    g.globalCompositeOperation='source-over'; g.globalAlpha=o.crisp??.4; g.drawImage(c.a,0,0);
    ag.globalCompositeOperation='destination-in'; ag.save(); ag.translate(Math.random()*256,Math.random()*256); ag.fillStyle=ag.createPattern(GR,'repeat'); ag.fillRect(-256,-256,W+512,H+512); ag.restore();
    g.globalAlpha=o.dots??1; g.drawImage(c.a,0,0); g.restore(); }
  return {TAU,REDUCED,IDS,SYM,setSym,onSym:f=>subs.push(f),paint,drawGlyph,grain,airbrush};
})();

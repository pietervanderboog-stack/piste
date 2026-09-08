/* Piste — app.js. No build step. Data in data/*.json. */
(async function(){
"use strict";
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const RM=window.matchMedia("(prefers-reduced-motion:reduce)").matches;
const esc=t=>String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

/* ---------- data ---------- */
let CLIMBS,LOGI,ORIGINS;
try{
  [CLIMBS,LOGI,ORIGINS]=await Promise.all(["data/climbs.json","data/logistics.json","data/origins.json"].map(u=>fetch(u).then(r=>{if(!r.ok)throw new Error(u);return r.json()})));
}catch(e){
  $("#list").innerHTML='<div class="empty">De gegevens laden niet. Open de site via een webserver (bijvoorbeeld <code>python -m http.server</code>), niet als los bestand.</div>';
  return;
}
const slug=s=>s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-");
ORIGINS.forEach(o=>o.id=slug(o.n));

/* ---------- model ---------- */
function hav(a,b,c,d){const R=6371,r=Math.PI/180;const x=(c-a)*r,y=(d-b)*r;
  const h=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h));}
const CROSS={uk:{a:[50.95,1.86],b:[51.13,1.31],h:2},no:{a:[57.59,9.96],b:[58.15,8.00],h:4.5},
             co:{a:[43.55,10.31],b:[42.70,9.45],h:7},sa:{a:[43.55,10.31],b:[40.92,9.50],h:12}};
function driveH(o,c,ev){
  let gc,fixed=0;const x=c.cross?CROSS[c.cross]:null;
  if(x){gc=hav(o.lat,o.lng,x.a[0],x.a[1])+hav(x.b[0],x.b[1],c.lat,c.lng);fixed=x.h;}
  else gc=hav(o.lat,o.lng,c.lat,c.lng);
  const road=gc*1.15,sp=road<150?62:road<400?85:100;
  let h=road/sp+fixed;
  h+=Math.max(0,Math.floor((road-300)/300))*(20/60);
  if(ev) h+=Math.max(0,Math.ceil((road-250)/300))*(15/60);
  return h;
}
const fmtH=h=>{const t=Math.round(h*60);return Math.floor(t/60)+" u "+String(t%60).padStart(2,"0");};
const band=h=>h<5?"near":h<9?"mid":"far";
const BANDCOL={near:"#3E6150",mid:"#C89A3E",far:"#9A4E2A"};
const BIKELBL={gravel:"Gravelbike prima",grens:"Grensgeval",mtb:"MTB slimmer"};
const SEGLBL={a:"asfalt",g:"grind",r:"ruw"};
const LOGI_LBL={base:"Basisdorp",sleep:"Slapen",park:"Parkeren en laden",water:"Water",food:"Eten en bevoorrading",season:"Seizoen en toegang"};
const SHIFT={gravel:"grens",grens:"mtb",mtb:"mtb"};
/* verdicts are calibrated on 55 mm; narrower tyres shift one step */
const bikeFor=c=>state.tyre<45?SHIFT[c.bike]:c.bike;

const state={origin:{...ORIGINS[0]},maxh:30,type:"alle",bike:"alle",sort:"drive",ev:true,tyre:55,layer:"relief",sel:null,picking:false,view:"home"};

/* ---------- URL state ---------- */
function readHash(){
  const h=location.hash.replace(/^#\/?/,"");
  const [path,qs]=h.split("?");
  const q=new URLSearchParams(qs||"");
  if(q.has("from")){
    const v=q.get("from");const o=ORIGINS.find(x=>x.id===v);
    if(o)state.origin={...o};
    else{const m=v.match(/^(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)$/);if(m)state.origin={n:"Eigen punt",id:"custom",lat:+m[1],lng:+m[3]};}
  }
  if(q.has("max"))state.maxh=Math.min(30,Math.max(2,+q.get("max")||30));
  if(q.has("type")&&["alle","parallel","puur"].includes(q.get("type")))state.type=q.get("type");
  if(q.has("bike")&&["alle","gravel","grens","mtb"].includes(q.get("bike")))state.bike=q.get("bike");
  if(q.has("sort")&&["drive","alt","gravel","gain"].includes(q.get("sort")))state.sort=q.get("sort");
  if(q.has("ev"))state.ev=q.get("ev")!=="0";
  if(q.has("tyre"))state.tyre=+q.get("tyre")||55;
  if(q.has("layer")&&["relief","sat"].includes(q.get("layer")))state.layer=q.get("layer");
  return path||"";
}
function writeHash(path){
  const q=new URLSearchParams();
  if(state.origin.id!==ORIGINS[0].id)q.set("from",state.origin.id==="custom"?state.origin.lat.toFixed(3)+","+state.origin.lng.toFixed(3):state.origin.id);
  if(state.maxh<30)q.set("max",state.maxh);
  if(state.type!=="alle")q.set("type",state.type);
  if(state.bike!=="alle")q.set("bike",state.bike);
  if(state.sort!=="drive")q.set("sort",state.sort);
  if(!state.ev)q.set("ev","0");
  if(state.tyre!==55)q.set("tyre",state.tyre);
  if(state.layer!=="relief")q.set("layer",state.layer);
  const s=q.toString();
  const next="#/"+(path||"")+(s?"?"+s:"");
  if(location.hash!==next)history.replaceState(null,"",next);
}
let suppressHash=false;

/* ---------- overview map ---------- */
const RASTER={
  relief:{type:"raster",tiles:["https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}"],tileSize:256,maxzoom:13,attribution:"Esri"},
  labels:{type:"raster",tiles:["https://a.basemaps.cartocdn.com/rastertiles/light_only_labels/{z}/{x}/{y}.png","https://b.basemaps.cartocdn.com/rastertiles/light_only_labels/{z}/{x}/{y}.png","https://c.basemaps.cartocdn.com/rastertiles/light_only_labels/{z}/{x}/{y}.png"],tileSize:256,maxzoom:18,attribution:"CARTO, OpenStreetMap"},
  sat:{type:"raster",tiles:["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],tileSize:256,maxzoom:17,attribution:"Esri, Maxar"},
  dem:{type:"raster-dem",tiles:["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],encoding:"terrarium",tileSize:256,maxzoom:14,attribution:"Mapzen Terrarium"}
};
const map=new maplibregl.Map({container:"map",style:{version:8,sources:RASTER,layers:[
  {id:"relief",type:"raster",source:"relief",paint:{"raster-saturation":-.3,"raster-brightness-min":.05}},
  {id:"sat",type:"raster",source:"sat",layout:{visibility:"none"}},
  {id:"labels",type:"raster",source:"labels",paint:{"raster-opacity":.9}}
]},center:[7.5,47.5],zoom:4.6,minZoom:3,maxZoom:15,attributionControl:{compact:true},scrollZoom:true});
map.addControl(new maplibregl.NavigationControl({showCompass:false}),"bottom-right");
map.on("load",()=>{applyLayer();render(true);});
function applyLayer(){
  map.setLayoutProperty("sat","visibility",state.layer==="sat"?"visible":"none");
  map.setLayoutProperty("relief","visibility",state.layer==="sat"?"none":"visible");
  $$(".layers button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.layer===state.layer));
}
$$(".layers button").forEach(b=>b.addEventListener("click",()=>{state.layer=b.dataset.layer;applyLayer();writeHash(currentPath());}));

let markers={},homeMarker=null,popup=null;
function drawHome(){
  if(homeMarker)homeMarker.remove();
  const el=document.createElement("div");el.className="home-pin";el.title="Vertrekpunt: "+state.origin.n;
  homeMarker=new maplibregl.Marker({element:el}).setLngLat([state.origin.lng,state.origin.lat]).addTo(map);
}
function drawMarkers(rows,fit){
  Object.values(markers).forEach(m=>m.remove());markers={};
  if(popup){popup.remove();popup=null;}
  rows.forEach((c,i)=>{
    const el=document.createElement("div");el.className="pin"+(c.done?" done":"")+(state.sel===c.id?" sel":"");
    el.style.background=BANDCOL[band(c._h)];el.textContent=i+1;el.title=c.name;
    el.addEventListener("click",e=>{e.stopPropagation();focusOn(c,false);});
    markers[c.id]=new maplibregl.Marker({element:el}).setLngLat([c.lng,c.lat]).addTo(map);
  });
  if(fit&&rows.length){
    const b=new maplibregl.LngLatBounds([state.origin.lng,state.origin.lat],[state.origin.lng,state.origin.lat]);
    rows.forEach(c=>b.extend([c.lng,c.lat]));
    const mobile=window.innerWidth<=820;
    map.fitBounds(b,{padding:mobile?{top:60,bottom:window.innerHeight*.5,left:30,right:30}:{top:60,bottom:60,left:480,right:60},maxZoom:9,duration:RM?0:900});
  }
}
function focusOn(c,fly=true){
  state.sel=c.id;
  $$(".pin.sel").forEach(p=>p.classList.remove("sel"));
  const m=markers[c.id];if(m)m.getElement().classList.add("sel");
  $$(".card").forEach(el=>el.classList.toggle("sel",el.dataset.id===c.id));
  const card=$('.card[data-id="'+c.id+'"]');if(card)card.scrollIntoView({block:"nearest",behavior:RM?"auto":"smooth"});
  if(fly)map.flyTo({center:[c.lng,c.lat],zoom:Math.max(map.getZoom(),8),duration:RM?0:900});
  if(popup)popup.remove();
  popup=new maplibregl.Popup({offset:18,closeButton:false,maxWidth:"260px"}).setLngLat([c.lng,c.lat])
    .setHTML('<div class="pop"><span class="pn">'+esc(c.name)+'</span><span class="pm">'+esc(c.area)+', '+fmtH(c._h)+' rijden</span><a href="#/'+c.id+'">Bekijk de klim</a></div>').addTo(map);
}

/* ---------- list ---------- */
function bandHTML(c,i,big){
  const lo=c.segs[0][0],hi=c.segs[c.segs.length-1][1];
  const span=Math.max(1,Math.abs(hi-lo));
  const segs=c.segs.map(s=>'<div class="sg '+s[2]+'" style="width:'+(Math.abs(s[1]-s[0])/span*100)+'%" title="'+SEGLBL[s[2]]+' van '+s[0]+' tot '+s[1]+' m"></div>').join("");
  const g=c.segs.find(s=>s[2]!=="a");
  return '<div class="band'+(big?" big":"")+'"><div class="band-track" style="--i:'+(i||0)+'">'+segs+'</div>'+
    '<div class="band-axis"><span>'+lo+' m</span>'+(g?'<span class="n">onverhard vanaf '+g[0]+' m</span>':'')+'<span>'+hi+' m</span></div></div>';
}
function tagsHTML(c){
  const b=bikeFor(c),t=[];
  if(c.done)t.push('<span class="tagp done">Zelf gereden</span>');
  t.push(c.type==="parallel"?'<span class="tagp par">Naast '+esc(c.parallel)+'</span>':'<span class="tagp puur">Puur grind</span>');
  t.push('<span class="tagp'+(b==="mtb"?" mtb":"")+'">'+BIKELBL[b]+'</span>');
  if(LOGI[c.id])t.push('<span class="tagp logi">Logistiek uitgezocht</span>');
  t.push('<span class="tagp">'+esc(c.land)+'</span>');
  return '<div class="tags">'+t.join("")+'</div>';
}
function cardHTML(c,i){
  const bd=band(c._h);
  return '<button class="card'+(state.sel===c.id?" sel":"")+'" data-id="'+c.id+'" style="--i:'+i+'">'+
   '<div class="card-top"><div><h3 class="cname">'+esc(c.name)+'</h3><div class="carea">'+esc(c.area)+'</div></div>'+
   '<div class="drive '+bd+'"><div class="h">'+fmtH(c._h)+'</div><div class="l">rijden</div></div></div>'+
   bandHTML(c,i)+
   '<div class="meta"><span><b>'+c.top+' m</b> top</span><span><b>'+c.gain+' m</b> stijging</span><span><b>'+c.gravel+' km</b> grind</span></div>'+
   tagsHTML(c)+'</button>';
}
function rows(){
  let r=CLIMBS.map(c=>({...c,_h:driveH(state.origin,c,state.ev)}));
  r=r.filter(c=>c._h<=state.maxh+.001);
  if(state.type!=="alle")r=r.filter(c=>c.type===state.type);
  if(state.bike!=="alle")r=r.filter(c=>bikeFor(c)===state.bike);
  const S={drive:(a,b)=>a._h-b._h,alt:(a,b)=>b.top-a.top,gravel:(a,b)=>b.gravel-a.gravel,gain:(a,b)=>b.gain-a.gain};
  return r.sort(S[state.sort]);
}
function render(fit){
  const r=rows();
  $("#cnt").textContent=r.length;
  $("#cntlbl").textContent=(r.length===1?"beklimming":"beklimmingen")+" binnen "+(state.maxh<30?fmtH(state.maxh):"bereik")+" vanaf "+state.origin.n;
  $("#list").innerHTML=r.length?r.map(cardHTML).join(""):'<div class="empty">Niets binnen deze filters.<button class="pill" id="resetBtn" type="button">Zet de filters terug</button></div>';
  const rb=$("#resetBtn");if(rb)rb.addEventListener("click",()=>{state.maxh=30;state.type="alle";state.bike="alle";syncControls();render(true);writeHash("");});
  $$("#list .card").forEach(el=>{
    el.addEventListener("click",()=>{location.hash="#/"+el.dataset.id+hashQuery();});
    el.addEventListener("mouseenter",()=>{const c=r.find(x=>x.id===el.dataset.id);if(c&&window.innerWidth>820)focusOn(c,false);});
  });
  $("#tyrenote").hidden=state.tyre>=45;
  drawHome();drawMarkers(r,fit);
}
const hashQuery=()=>{const i=location.hash.indexOf("?");return i>-1?location.hash.slice(i):"";};
const currentPath=()=>state.view==="profile"?state.sel:"";

/* ---------- controls ---------- */
const sel=$("#origin");
ORIGINS.forEach(o=>{const op=document.createElement("option");op.value=o.id;op.textContent=o.n;sel.appendChild(op)});
const opc=document.createElement("option");opc.value="custom";opc.textContent="Eigen punt";opc.hidden=true;sel.appendChild(opc);
sel.addEventListener("change",()=>{const o=ORIGINS.find(x=>x.id===sel.value);if(o){state.origin={...o};render(true);writeHash(currentPath());}});
$("#pickBtn").addEventListener("click",()=>{state.picking=!state.picking;$("#pickBtn").setAttribute("aria-pressed",state.picking);$("#picknote").hidden=!state.picking;map.getCanvas().style.cursor=state.picking?"crosshair":"";});
$("#pickCancel").addEventListener("click",()=>{state.picking=false;$("#pickBtn").setAttribute("aria-pressed","false");$("#picknote").hidden=true;map.getCanvas().style.cursor="";});
map.on("click",e=>{
  if(!state.picking)return;
  state.origin={n:"Eigen punt",id:"custom",lat:e.lngLat.lat,lng:e.lngLat.lng};
  state.picking=false;$("#pickBtn").setAttribute("aria-pressed","false");$("#picknote").hidden=true;map.getCanvas().style.cursor="";
  syncControls();render(true);writeHash("");toast("Vertrekpunt gezet");
});
$("#maxh").addEventListener("input",e=>{state.maxh=+e.target.value;$("#maxhv").textContent=state.maxh<30?fmtH(state.maxh):"30 uur";render(false);writeHash("");});
$("#maxh").addEventListener("change",()=>render(true));
$("#ev").addEventListener("change",e=>{state.ev=e.target.checked;render(false);writeHash("");});
$("#sort").addEventListener("change",e=>{state.sort=e.target.value;render(false);writeHash("");});
$("#tyre").addEventListener("change",e=>{state.tyre=+e.target.value;render(false);writeHash("");});
function chipGroup(s,key){
  const g=$(s);
  g.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
    state[key]=b.dataset.f;g.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));render(true);writeHash("");});
}
chipGroup("#typeChips","type");chipGroup("#bikeChips","bike");
function syncControls(){
  sel.value=state.origin.id;
  $("#maxh").value=state.maxh;$("#maxhv").textContent=state.maxh<30?fmtH(state.maxh):"30 uur";
  $("#ev").checked=state.ev;$("#sort").value=state.sort;$("#tyre").value=String(state.tyre);
  $$("#typeChips button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.f===state.type));
  $$("#bikeChips button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.f===state.bike));
}
$("#share").addEventListener("click",async()=>{
  writeHash("");
  try{await navigator.clipboard.writeText(location.href);toast("Link gekopieerd");}
  catch(e){toast(location.href);}
});
/* mobile drawer */
const drawer=$("#drawer");
try{if(localStorage.getItem("piste-intro")==="1")$("#intro").hidden=true;}catch(e){}
$("#introClose").addEventListener("click",()=>{$("#intro").hidden=true;try{localStorage.setItem("piste-intro","1");}catch(e){}});
if(window.innerWidth>820)drawer.classList.add("filt");
$("#filtBtn").addEventListener("click",()=>{const on=drawer.classList.toggle("filt");$("#filtBtn").setAttribute("aria-expanded",on);});
$("#handle").addEventListener("click",()=>{
  if(drawer.classList.contains("up"))drawer.classList.replace("up","down");
  else if(drawer.classList.contains("down"))drawer.classList.remove("down");
  else drawer.classList.add("up");
});
let toastT;function toast(m){let t=$(".toast");if(!t){t=document.createElement("div");t.className="toast";document.body.appendChild(t);}t.textContent=m;t.classList.add("on");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("on"),2400);}

/* ---------- profile page ---------- */
let map3d=null,spin=null;
const srcLink=u=>u?'<a class="src" href="'+esc(u)+'" target="_blank" rel="noopener">bron</a>':'<span class="src">onbevestigd</span>';
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,"");}catch(e){return u;}};
function voiceHTML(v){
  return '<div class="voice"><blockquote>“'+esc(v.q)+'”</blockquote>'+(v.tr?'<div class="tr">'+esc(v.tr)+'</div>':'')+
    '<div class="who">'+esc(v.who)+', <a href="'+esc(v.url)+'" target="_blank" rel="noopener">'+esc(host(v.url))+'</a></div></div>';
}
function logiHTML(c){
  const L=LOGI[c.id];
  if(!L)return '<h2 class="sec" id="logistiek">Logistiek</h2><div class="nolog">Voor deze bestemming is de logistiek nog niet uitgezocht. Kijk bij de citaten hierboven en check de lokale bron voor slapen, parkeren en water.</div>';
  let h='';
  ["base","sleep","park","water","food","season"].forEach(k=>{
    if(!L[k]||!L[k].length)return;
    h+='<h2 class="sec" id="'+k+'">'+LOGI_LBL[k]+'</h2><ul class="facts">'+L[k].map(f=>'<li>'+esc(f.t)+srcLink(f.u)+'</li>').join("")+'</ul>';
  });
  if(L.gap)h+='<div class="gap">'+esc(L.gap)+'</div>';
  if(L.quotes&&L.quotes.length)h+='<h2 class="sec" id="praktijk">Rijders over de praktijk</h2>'+L.quotes.map(voiceHTML).join("");
  return h;
}
function gpxHTML(c){
  const L=LOGI[c.id];const g=(L&&L.gpx)||c.gpx||[];
  if(!g.length)return '<p class="sub">Nog geen gecontroleerde route gevonden. Zoek op Komoot of RideWithGPS op de naam van de klim en controleer of het onverharde deel erin zit.</p>';
  return '<div class="gpx">'+g.map(x=>'<a href="'+esc(x.u)+'" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M3 17l6-9 4 6 3-4 5 7"/></svg><span>'+esc(x.t)+'</span></a>').join("")+'</div>';
}
function openProfile(id){
  const c=CLIMBS.find(x=>x.id===id);if(!c){location.hash="#/";return;}
  state.sel=id;state.view="profile";
  const h=driveH(state.origin,c,state.ev),b=bikeFor(c),shifted=b!==c.bike;
  const L=LOGI[id];
  const nav=[["oordeel","Oordeel"],["praktisch","Praktisch"],["stemmen","Rijders"]];
  if(L)["base","sleep","park","water","food","season"].forEach(k=>{if(L[k]&&L[k].length)nav.push([k,LOGI_LBL[k]]);});
  nav.push(["routes","Routes"]);
  const all=rows();const idx=all.findIndex(x=>x.id===id);
  const prev=idx>0?all[idx-1]:null,next=idx>-1&&idx<all.length-1?all[idx+1]:null;
  const q=hashQuery();
  $("#profile").innerHTML=
   '<div class="hero"><div class="m3d" id="m3d"></div>'+
   '<a class="back" href="#/'+q+'"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>Alle beklimmingen</a>'+
   '<div class="hero-note"><span>Hoogte 1,4× uitvergroot</span><button type="button" id="spinBtn" aria-pressed="true">Draaien</button></div>'+
   '<div class="titlebox"><div class="in"><div class="area">'+esc(c.area)+', '+esc(c.land)+'</div><h1>'+esc(c.name)+'</h1>'+
   '<div class="dh"><b>'+fmtH(h)+'</b> rijden vanaf '+esc(state.origin.n)+(state.ev?', inclusief laadstops':'')+(c.cross?', inclusief overtocht':'')+'</div></div></div></div>'+
   '<nav class="pnav">'+nav.map(n=>'<a href="#'+n[0]+'" data-go="'+n[0]+'">'+n[1]+'</a>').join("")+'</nav>'+
   '<div class="pbody"><div class="pmain">'+
     '<p class="lead">'+esc(c.line)+'</p>'+bandHTML(c,0,true)+
     '<div class="stats"><div class="stat"><div class="v">'+c.top+' m</div><div class="k">hoogste punt</div></div>'+
       '<div class="stat"><div class="v">'+c.gain+' m</div><div class="k">stijging</div></div>'+
       '<div class="stat"><div class="v">'+c.len+' km</div><div class="k">klim</div></div>'+
       '<div class="stat"><div class="v">'+c.gravel+' km</div><div class="k">onverhard</div></div></div>'+
     tagsHTML(c)+
     '<div class="verdict" id="oordeel"><h2>Is dit echt een goede optie?</h2>'+esc(c.verdict)+
       (shifted?'<div class="tyreline">Dit oordeel is geschreven voor 55 mm. Op jouw '+state.tyre+' mm tonen we het label één stap strenger: '+BIKELBL[b].toLowerCase()+'.</div>':'')+'</div>'+
     '<h2 class="sec" id="praktisch">Kort praktisch</h2><ul class="notes-list">'+c.notes.map(n=>'<li>'+esc(n)+'</li>').join("")+'</ul>'+
     '<h2 class="sec" id="stemmen">Wat rijders over de route zeggen</h2>'+c.voices.map(voiceHTML).join("")+
     logiHTML(c)+
     '<div class="nextprev">'+(prev?'<a href="#/'+prev.id+q+'"><small>Vorige, '+fmtH(prev._h)+' rijden</small>'+esc(prev.name)+'</a>':'<span></span>')+
       (next?'<a href="#/'+next.id+q+'" style="text-align:right"><small>Volgende, '+fmtH(next._h)+' rijden</small>'+esc(next.name)+'</a>':'')+'</div>'+
   '</div><aside class="pside">'+
     '<div class="side-card" id="routes"><h2>Routes om te laden</h2>'+gpxHTML(c)+'</div>'+
     '<div class="side-card"><h2>In het kort</h2><ul class="facts">'+
       '<li>'+(c.type==="parallel"?'Loopt naast '+esc(c.parallel):'Staat op zichzelf, puur grind')+'</li>'+
       '<li>'+BIKELBL[b]+(shifted?' op '+state.tyre+' mm':' op 55 mm')+'</li>'+
       '<li>Onverhard vanaf '+(c.segs.find(s=>s[2]!=="a")||c.segs[0])[0]+' m</li>'+
       (L?'<li>Logistiek uitgezocht, '+Object.keys(LOGI_LBL).reduce((a,k)=>a+((L[k]||[]).length),0)+' feiten met bron</li>':'<li>Logistiek nog niet uitgezocht</li>')+
     '</ul></div>'+
     '<div class="side-card"><h2>Deel deze klim</h2><p class="sub">De link onthoudt je vertrekpunt en filters.</p><button class="pill" id="shareClimb" type="button">Kopieer link</button></div>'+
   '</aside></div>';
  $("#profile").hidden=false;$("#home").setAttribute("aria-hidden","true");
  $("#profile").scrollTop=0;
  $$(".pnav a").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();const el=document.getElementById(a.dataset.go);if(el)el.scrollIntoView({behavior:RM?"auto":"smooth",block:"start"});}));
  $("#shareClimb").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(location.href);toast("Link gekopieerd");}catch(e){toast(location.href);}});
  document.title=c.name+" — Piste";
  mount3d(c);
}
function mount3d(c){
  if(map3d){map3d.remove();map3d=null;}
  if(spin){cancelAnimationFrame(spin);spin=null;}
  const bearing=(c.lng*37)%360;
  map3d=new maplibregl.Map({container:"m3d",style:{version:8,sources:{sat:RASTER.sat,dem:RASTER.dem,dem2:RASTER.dem,labels:RASTER.labels},
    layers:[{id:"sat",type:"raster",source:"sat"},{id:"hill",type:"hillshade",source:"dem2",paint:{"hillshade-exaggeration":.35,"hillshade-shadow-color":"#2b2f2a","hillshade-highlight-color":"#fff8e6"}}],
    sky:{"sky-color":"#cfdde8","horizon-color":"#f6f3ec","fog-color":"#f6f3ec","fog-ground-blend":.55,"horizon-fog-blend":.7,"sky-horizon-blend":.6,"atmosphere-blend":.8},
    terrain:{source:"dem",exaggeration:1.4}},
    center:[c.lng,c.lat-.012],zoom:12.7,pitch:66,bearing,maxPitch:75,attributionControl:{compact:true},cooperativeGestures:true});
  map3d.addControl(new maplibregl.NavigationControl({visualizePitch:true}),"top-right");
  const el=document.createElement("div");el.className="pin sel";el.style.background=BANDCOL[band(driveH(state.origin,c,state.ev))];el.textContent="";el.style.width="16px";el.style.height="16px";
  new maplibregl.Marker({element:el}).setLngLat([c.lng,c.lat]).addTo(map3d);
  let spinning=true;
  const step=()=>{if(!spinning)return;map3d.setBearing(map3d.getBearing()+.04);spin=requestAnimationFrame(step);};
  map3d.on("load",()=>{if(spinning)spin=requestAnimationFrame(step);});
  const stop=()=>{spinning=false;$("#spinBtn")?.setAttribute("aria-pressed","false");};
  ["mousedown","touchstart","wheel"].forEach(ev=>map3d.getCanvas().addEventListener(ev,stop,{passive:true}));
  $("#spinBtn").addEventListener("click",()=>{spinning=!spinning;$("#spinBtn").setAttribute("aria-pressed",spinning);if(spinning)spin=requestAnimationFrame(step);});
}
function closeProfile(){
  state.view="home";
  $("#profile").hidden=true;$("#home").removeAttribute("aria-hidden");
  if(map3d){map3d.remove();map3d=null;}if(spin){cancelAnimationFrame(spin);spin=null;}
  document.title="Piste — onverharde beklimmingen op weekendafstand";
  map.resize();
  const c=rows().find(x=>x.id===state.sel);if(c)focusOn(c,true);
}

/* ---------- routing ---------- */
function route(){
  if(suppressHash){suppressHash=false;return;}
  const path=readHash();
  syncControls();
  if(path&&CLIMBS.some(c=>c.id===path)){render(false);openProfile(path);}
  else{if(state.view==="profile")closeProfile();else render(true);}
}
window.addEventListener("hashchange",route);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&state.view==="profile")location.hash="#/"+hashQuery();});
const initial=readHash();syncControls();
if(initial&&CLIMBS.some(c=>c.id===initial)){map.once("load",()=>openProfile(initial));}
})();

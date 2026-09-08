// Merge research/logi/*.json into data/logistics.json and apply research/verify/*.json fixes.
// Usage: node tools/apply-research.cjs [--dry]
const fs=require("fs"),path=require("path");
const dry=process.argv.includes("--dry");
const root=path.join(__dirname,"..");
const rd=f=>JSON.parse(fs.readFileSync(path.join(root,f),"utf8"));
const CLIMBS=rd("data/climbs.json"),LOGI=rd("data/logistics.json");
const byId=Object.fromEntries(CLIMBS.map(c=>[c.id,c]));
const SECT=["base","sleep","park","water","food","season"];
const isFact=f=>f&&typeof f.t==="string"&&f.t.trim()&&(f.u===null||(typeof f.u==="string"&&/^https?:\/\//.test(f.u)));
const isQuote=q=>q&&typeof q.q==="string"&&q.q.trim()&&typeof q.url==="string"&&/^https?:\/\//.test(q.url)&&typeof q.who==="string";
const log=[];const warn=m=>log.push("WARN "+m);
let added=0,facts=0,factsUrl=0,fixes=0,removed=0,gpx=0;

// 1. new dossiers
const ldir=path.join(root,"research/logi");
for(const f of fs.existsSync(ldir)?fs.readdirSync(ldir).filter(x=>x.endsWith(".json")):[]){
  const id=f.replace(/\.json$/,"");
  if(!byId[id]){warn(`logi/${f}: unknown climb id`);continue;}
  let d;try{d=rd("research/logi/"+f);}catch(e){warn(`logi/${f}: invalid JSON`);continue;}
  const out={};
  for(const k of SECT){const arr=Array.isArray(d[k])?d[k].filter(x=>{const ok=isFact(x);if(!ok)warn(`logi/${id}.${k}: dropped malformed fact ${JSON.stringify(x).slice(0,80)}`);return ok;}):[];if(arr.length)out[k]=arr;facts+=arr.length;factsUrl+=arr.filter(x=>x.u).length;}
  out.gpx=Array.isArray(d.gpx)?d.gpx.filter(isFact).filter(x=>x.u):[];gpx+=out.gpx.length;
  out.quotes=Array.isArray(d.quotes)?d.quotes.filter(q=>{const ok=isQuote(q);if(!ok)warn(`logi/${id}.quotes: dropped malformed quote`);return ok;}).map(q=>({who:q.who,q:q.q,tr:q.tr||"",url:q.url})):[];
  out.gap=typeof d.gap==="string"?d.gap:"";
  if(LOGI[id]){warn(`logi/${id}: dossier already exists in data, merging gpx only`);LOGI[id].gpx=[...(LOGI[id].gpx||[]),...out.gpx];continue;}
  if(!SECT.some(k=>out[k])){warn(`logi/${id}: no valid sections, skipped`);continue;}
  LOGI[id]=out;added++;
}

// 2. verification fixes
const vdir=path.join(root,"research/verify");
for(const f of fs.existsSync(vdir)?fs.readdirSync(vdir).filter(x=>x.endsWith(".json")):[]){
  const id=f.replace(/\.json$/,"");const c=byId[id];
  if(!c){warn(`verify/${f}: unknown climb id`);continue;}
  let v;try{v=rd("research/verify/"+f);}catch(e){warn(`verify/${f}: invalid JSON`);continue;}
  // voices: apply fixes, removals last (descending index)
  const rem=[];
  for(const e of (v.voices||[])){
    if(!e.fix)continue;const t=c.voices[e.i];if(!t){warn(`verify/${id}: voices[${e.i}] missing`);continue;}
    if(e.fix.remove){rem.push(e.i);continue;}
    if(e.fix.url&&/^https?:\/\//.test(e.fix.url)){t.url=e.fix.url;fixes++;}
    if(e.fix.q){t.q=e.fix.q;if(e.fix.tr)t.tr=e.fix.tr;fixes++;}
    if(e.fix.who){t.who=e.fix.who;fixes++;}
  }
  rem.sort((a,b)=>b-a).forEach(i=>{c.voices.splice(i,1);removed++;});
  // logistics facts (removals deferred so indices stay valid)
  const lrem=[];
  for(const e of (v.logi||[])){
    if(!e.fix)continue;const L=LOGI[id];if(!L){warn(`verify/${id}: logi fix but no dossier`);continue;}
    const arr=e.section==="quotes"?L.quotes:L[e.section];const t=arr&&arr[e.i];
    if(!t){warn(`verify/${id}: ${e.section}[${e.i}] missing`);continue;}
    if(e.fix.remove){lrem.push([arr,e.i]);continue;}
    if("u" in e.fix){t.u=e.fix.u&&/^https?:\/\//.test(e.fix.u)?e.fix.u:null;fixes++;}
    if(e.fix.t){t.t=e.fix.t;fixes++;}
    if(e.fix.url&&e.section==="quotes"){t.url=e.fix.url;fixes++;}
  }
  lrem.sort((a,b)=>b[1]-a[1]).forEach(([arr,i])=>{if(arr[i]){arr.splice(i,1);removed++;}});
  // gpx
  const g=(v.gpx||[]).filter(isFact).filter(x=>x.u);
  if(g.length){if(LOGI[id]){LOGI[id].gpx=[...(LOGI[id].gpx||[]),...g];}else{c.gpx=[...(c.gpx||[]),...g];}gpx+=g.length;}
  // dedupe gpx by url
  const dd=a=>{const s=new Set();return a.filter(x=>!s.has(x.u)&&s.add(x.u));};
  if(LOGI[id]&&LOGI[id].gpx)LOGI[id].gpx=dd(LOGI[id].gpx);if(c.gpx)c.gpx=dd(c.gpx);
  if(v.numbers&&v.numbers.status&&v.numbers.status!=="ok")log.push(`NUMBERS ${id}: ${v.numbers.note} (${v.numbers.source||"?"})`);
  // unresolved problems
  for(const e of (v.voices||[]))if(e.status&&e.status!=="ok"&&!e.fix)log.push(`OPEN ${id} voices[${e.i}] ${e.status}: ${e.note||""}`);
  for(const e of (v.logi||[]))if(e.status&&e.status!=="ok"&&!e.fix)log.push(`OPEN ${id} ${e.section}[${e.i}] ${e.status}: ${e.note||""}`);
}
if(!dry){
  fs.writeFileSync(path.join(root,"data/logistics.json"),JSON.stringify(LOGI,null,1)+"\n");
  fs.writeFileSync(path.join(root,"data/climbs.json"),JSON.stringify(CLIMBS,null,1)+"\n");
}
console.log(`dossiers added ${added}, facts ${facts} (${factsUrl} with url), fixes ${fixes}, removed ${removed}, gpx links ${gpx}, dossiers total ${Object.keys(LOGI).length}${dry?" (dry run)":""}`);
log.forEach(l=>console.log(l));

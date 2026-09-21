'use client';

import { useMemo, useState } from 'react';

type Row={race_id:string;race_name:string;sort_order:number;class_id:string;class_name:string;athlete_id:string;athlete_name:string;club_id:string;club_name:string;shooting_hits:number|null;shooting_shots:number|null};
type Kind='athlete'|'club'|'class';
const labels:Record<Kind,string>={athlete:'Åkare',club:'Klubbar',class:'Klasser'};
function pct(h:number,s:number){return s?100*h/s:0}
export default function ShootingAnalysis({rows}:{rows:Row[]}){
 const valid=rows.filter(r=>(r.shooting_shots??0)>0);
 const [kind,setKind]=useState<Kind>('club');
 const [selected,setSelected]=useState<string[]>([]);
 const entities=useMemo(()=>{
  const m=new Map<string,{id:string;name:string;hits:number;shots:number;starts:Set<string>}>();
  for(const r of valid){const id=kind==='athlete'?r.athlete_id:kind==='club'?r.club_id:r.class_id;const name=kind==='athlete'?r.athlete_name:kind==='club'?r.club_name:r.class_name;const x=m.get(id)??{id,name,hits:0,shots:0,starts:new Set<string>()};x.hits+=r.shooting_hits??0;x.shots+=r.shooting_shots??0;x.starts.add(r.race_id);m.set(id,x)}
  return [...m.values()].sort((a,b)=>pct(b.hits,b.shots)-pct(a.hits,a.shots)||b.shots-a.shots);
 },[valid,kind]);
 const totalHits=valid.reduce((s,r)=>s+(r.shooting_hits??0),0), totalShots=valid.reduce((s,r)=>s+(r.shooting_shots??0),0);
 const races=[...new Map(valid.sort((a,b)=>a.sort_order-b.sort_order).map(r=>[r.race_id,{id:r.race_id,name:r.race_name}])).values()];
 const compared=entities.filter(e=>selected.includes(e.id));
 function toggle(id:string){setSelected(v=>v.includes(id)?v.filter(x=>x!==id):v.length<5?[...v,id]:v)}
 return <section className="shooting-analysis">
  <section className="shooting-hero card"><div><p className="eyebrow dark">Skytteanalys</p><h3>{pct(totalHits,totalShots).toFixed(2)} %</h3><p>{totalHits}/{totalShots} träffar · {valid.length} registrerade skytteresultat</p></div><div className="shooting-gauge"><strong>{totalShots}</strong><span>skott</span></div></section>
  <nav className="sub-tabs shooting-tabs">{(['athlete','club','class'] as Kind[]).map(k=><button type="button" key={k} className={kind===k?'active':''} onClick={()=>{setKind(k);setSelected([])}}>{labels[k]}</button>)}</nav>
  <section className="card standings-card"><div className="calendar-heading"><div><h3>{labels[kind]}</h3><p className="muted">Träffprocent baserad på registrerade skott. Välj upp till fem för jämförelse.</p></div><span className="badge">{entities.length}</span></div>
   <div className="table-scroll"><table><thead><tr><th>Jämför</th><th>{kind==='athlete'?'Åkare':kind==='club'?'Klubb':'Klass'}</th><th>Träff</th><th>Träff/skott</th><th>Tävlingar</th></tr></thead><tbody>{entities.map(e=><tr key={e.id}><td><input aria-label={'Jämför '+e.name} type="checkbox" checked={selected.includes(e.id)} disabled={!selected.includes(e.id)&&selected.length>=5} onChange={()=>toggle(e.id)}/></td><td><strong>{e.name}</strong></td><td>{pct(e.hits,e.shots).toFixed(2)} %</td><td>{e.hits}/{e.shots}</td><td>{e.starts.size}</td></tr>)}</tbody></table></div>
  </section>
  {compared.length>0&&<section className="card standings-card"><h3>Jämförelse över deltävlingarna</h3><p className="muted">{compared.map(e=>e.name).join(' · ')}</p><div className="table-scroll"><table><thead><tr><th>Deltävling</th>{compared.map(e=><th key={e.id}>{e.name}</th>)}</tr></thead><tbody>{races.map(race=><tr key={race.id}><td><strong>{race.name}</strong></td>{compared.map(e=>{const rr=valid.filter(x=>x.race_id===race.id&&(kind==='athlete'?x.athlete_id:kind==='club'?x.club_id:x.class_id)===e.id);const h=rr.reduce((s,x)=>s+(x.shooting_hits??0),0),s=rr.reduce((a,x)=>a+(x.shooting_shots??0),0);return <td key={e.id}>{s?`${pct(h,s).toFixed(1)} % (${h}/${s})`:'–'}</td>})}</tr>)}</tbody></table></div></section>}
 </section>
}
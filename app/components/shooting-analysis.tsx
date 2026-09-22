'use client';

import { useMemo, useState } from 'react';

type Row={race_id:string;race_name:string;sort_order:number;class_id:string;class_name:string;athlete_id:string;athlete_name:string;club_id:string;club_name:string;shooting_hits:number|null;shooting_shots:number|null};
type Kind='athlete'|'club'|'class'|'group';
type Group={id:string;name:string;description:string|null;athlete_ids:string[]};
type Series={id:string;name:string;hits:number;shots:number;starts:Set<string>};
const labels:Record<Kind,string>={athlete:'Åkare',club:'Klubbar',class:'Klasser',group:'Grupper'};
function pct(h:number,s:number){return s?100*h/s:0}
function short(name:string){return name.length>24?name.slice(0,22)+'…':name}

export default function ShootingAnalysis({rows,groups=[]}:{rows:Row[];groups?:Group[]}){
 const valid=useMemo(()=>rows.filter(r=>(r.shooting_shots??0)>0),[rows]);
 const [kind,setKind]=useState<Kind>('club');
 const [selected,setSelected]=useState<string[]>([]);
 const [focusClub,setFocusClub]=useState('');
 const [excludedClasses,setExcludedClasses]=useState<string[]>([]);
 const [excludedAthletes,setExcludedAthletes]=useState<string[]>([]);

 const clubs=useMemo(()=>[...new Map(valid.map(r=>[r.club_id,r.club_name])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'sv')),[valid]);
 const classes=useMemo(()=>[...new Map(valid.map(r=>[r.class_id,r.class_name])).entries()],[valid]);
 const clubRows=useMemo(()=>focusClub?valid.filter(r=>r.club_id===focusClub):valid,[valid,focusClub]);
 const clubAthletes=useMemo(()=>[...new Map(clubRows.map(r=>[r.athlete_id,r.athlete_name])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'sv')),[clubRows]);
 const filteredClubRows=useMemo(()=>clubRows.filter(r=>!excludedClasses.includes(r.class_id)&&!excludedAthletes.includes(r.athlete_id)),[clubRows,excludedClasses,excludedAthletes]);
 const baseHits=clubRows.reduce((s,r)=>s+(r.shooting_hits??0),0),baseShots=clubRows.reduce((s,r)=>s+(r.shooting_shots??0),0);
 const mixHits=filteredClubRows.reduce((s,r)=>s+(r.shooting_hits??0),0),mixShots=filteredClubRows.reduce((s,r)=>s+(r.shooting_shots??0),0);
 const seniorIds=classes.filter(([,name])=>/senior/i.test(name)).map(([id])=>id);
 const youthIds=classes.filter(([,name])=>!/(senior|18-21|16-17)/i.test(name)).map(([id])=>id);
 const juniorIds=classes.filter(([,name])=>/(16-17|18-21)/i.test(name)).map(([id])=>id);

 const analysisRows=kind==='club'&&focusClub?filteredClubRows:valid;
 const entities=useMemo(()=>{
  const m=new Map<string,Series>();
  if(kind==='group'){for(const g of groups){const rr=analysisRows.filter(r=>g.athlete_ids.includes(r.athlete_id));const x:Series={id:g.id,name:g.name,hits:0,shots:0,starts:new Set<string>()};for(const r of rr){x.hits+=r.shooting_hits??0;x.shots+=r.shooting_shots??0;x.starts.add(r.race_id)}if(x.shots>0)m.set(g.id,x)}} else for(const r of analysisRows){const id=kind==='athlete'?r.athlete_id:kind==='club'?r.club_id:r.class_id;const name=kind==='athlete'?r.athlete_name:kind==='club'?r.club_name:r.class_name;const x=m.get(id)??{id,name,hits:0,shots:0,starts:new Set<string>()};x.hits+=r.shooting_hits??0;x.shots+=r.shooting_shots??0;x.starts.add(r.race_id);m.set(id,x)}
  return [...m.values()].sort((a,b)=>pct(b.hits,b.shots)-pct(a.hits,a.shots)||b.shots-a.shots);
 },[analysisRows,kind,groups]);
 const totalHits=analysisRows.reduce((s,r)=>s+(r.shooting_hits??0),0),totalShots=analysisRows.reduce((s,r)=>s+(r.shooting_shots??0),0);
 const races=useMemo(()=>[...new Map([...valid].sort((a,b)=>a.sort_order-b.sort_order).map(r=>[r.race_id,{id:r.race_id,name:r.race_name}])).values()],[valid]);
 const compared=entities.filter(e=>selected.includes(e.id));
 function toggle(id:string){setSelected(v=>v.includes(id)?v.filter(x=>x!==id):v.length<5?[...v,id]:v)}
 function resetMix(){setExcludedClasses([]);setExcludedAthletes([])}
 function onlyClassGroup(ids:string[]){setExcludedClasses(classes.map(([id])=>id).filter(id=>!ids.includes(id)));setExcludedAthletes([])}
 const chartSeries=compared.map(e=>({entity:e,points:races.map((race,idx)=>{const rr=analysisRows.filter(x=>x.race_id===race.id&&(kind==='group'?groups.find(g=>g.id===e.id)?.athlete_ids.includes(x.athlete_id):(kind==='athlete'?x.athlete_id:kind==='club'?x.club_id:x.class_id)===e.id));const h=rr.reduce((s,x)=>s+(x.shooting_hits??0),0),shots=rr.reduce((s,x)=>s+(x.shooting_shots??0),0);return {idx,value:shots?pct(h,shots):null,h,shots}})}));
 const activeClubName=clubs.find(([id])=>id===focusClub)?.[1];
 const delta=mixShots&&baseShots?pct(mixHits,mixShots)-pct(baseHits,baseShots):0;
 return <section className="shooting-analysis">
  <section className="shooting-hero card"><div><p className="eyebrow dark">Skytteanalys</p><h3>{pct(totalHits,totalShots).toFixed(2)} %</h3><p>{totalHits}/{totalShots} träffar · {analysisRows.length} registrerade skytteresultat</p></div><div className="shooting-gauge"><strong>{totalShots}</strong><span>skott</span></div></section>
  <nav className="sub-tabs shooting-tabs">{(['athlete','club','class','group'] as Kind[]).map(k=><button type="button" key={k} className={kind===k?'active':''} onClick={()=>{setKind(k);setSelected([])}}>{labels[k]}</button>)}</nav>

  {kind==='club'&&<section className="card shooting-mixer"><div className="calendar-heading"><div><h3>Mixad klubbanalys</h3><p className="muted">Välj en klubb och prova hur skytteresultatet förändras när klasser eller enskilda åkare tas bort. Detta påverkar inte officiell statistik.</p></div>{(excludedClasses.length>0||excludedAthletes.length>0)&&<span className="badge">Filtrerad analys</span>}</div>
   <label>Klubb<select value={focusClub} onChange={e=>{setFocusClub(e.target.value);resetMix();setSelected([])}}><option value="">Alla klubbar</option>{clubs.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
   {focusClub&&<><div className="shooting-mix-stats"><span><small>Officiellt urval</small><strong>{pct(baseHits,baseShots).toFixed(1)} %</strong><em>{baseHits}/{baseShots}</em></span><span><small>Filtrerat urval</small><strong>{pct(mixHits,mixShots).toFixed(1)} %</strong><em>{mixHits}/{mixShots}</em></span><span><small>Förändring</small><strong>{delta>=0?'+':''}{delta.toFixed(1)} pp</strong><em>{new Set(filteredClubRows.map(r=>r.athlete_id)).size} åkare</em></span></div>
    <div className="shooting-quickfilters"><button type="button" onClick={resetMix}>Alla</button><button type="button" onClick={()=>onlyClassGroup(youthIds)}>Ungdom</button><button type="button" onClick={()=>onlyClassGroup(juniorIds)}>Junior</button><button type="button" onClick={()=>setExcludedClasses(seniorIds)}>Utan senior</button></div>
    <details><summary>Finjustera klasser och åkare</summary><div className="shooting-filter-columns"><div><h4>Klasser</h4>{classes.filter(([id])=>clubRows.some(r=>r.class_id===id)).map(([id,name])=><label className="check-row" key={id}><input type="checkbox" checked={!excludedClasses.includes(id)} onChange={()=>setExcludedClasses(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])}/>{name}</label>)}</div><div><h4>Åkare</h4>{clubAthletes.map(([id,name])=><label className="check-row" key={id}><input type="checkbox" checked={!excludedAthletes.includes(id)} onChange={()=>setExcludedAthletes(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])}/>{name}</label>)}</div></div></details>
    <p className="muted shooting-filter-note">{activeClubName} · {excludedClasses.length||excludedAthletes.length?'filtrerat analysurval':'alla registrerade skytteresultat'}</p>
   </>}
  </section>}

  {kind==='group'&&groups.length===0&&<section className="card empty-state"><h3>Inga sparade grupper ännu</h3><p className="muted">Skapa grupper under Admin → Åkare. Gruppen följer åkaridentiteterna även när klass eller klubb ändras.</p></section>}
  <section className="card standings-card"><div className="calendar-heading"><div><h3>{labels[kind]}</h3><p className="muted">Träffprocent baserad på registrerade skott. Välj upp till fem för jämförelse och utvecklingsgraf.</p></div><span className="badge">{entities.length}</span></div>
   <div className="table-scroll"><table><thead><tr><th>Jämför</th><th>{kind==='athlete'?'Åkare':kind==='club'?'Klubb':kind==='class'?'Klass':'Grupp'}</th><th>Träff</th><th>Träff/skott</th><th>Tävlingar</th></tr></thead><tbody>{entities.map(e=><tr key={e.id}><td><input aria-label={'Jämför '+e.name} type="checkbox" checked={selected.includes(e.id)} disabled={!selected.includes(e.id)&&selected.length>=5} onChange={()=>toggle(e.id)}/></td><td><strong>{e.name}</strong></td><td>{pct(e.hits,e.shots).toFixed(2)} %</td><td>{e.hits}/{e.shots}</td><td>{e.starts.size}</td></tr>)}</tbody></table></div>
  </section>

  {compared.length>0&&<section className="card standings-card shooting-development"><h3>Utveckling över deltävlingarna</h3><p className="muted">{compared.map(e=>e.name).join(' · ')}</p>
   <div className="shooting-chart-wrap"><svg className="shooting-chart" viewBox="0 0 760 300" role="img" aria-label="Utveckling av träffprocent över deltävlingarna">
    {[0,25,50,75,100].map(v=>{const y=260-v*2.2;return <g key={v}><line x1="55" x2="735" y1={y} y2={y} className="chart-grid"/><text x="8" y={y+4}>{v}%</text></g>})}
    {chartSeries.map((series,si)=>{const pts=series.points.filter(p=>p.value!==null);const coords=pts.map(p=>({x:70+(races.length<=1?0:p.idx*(650/(races.length-1))),y:260-(p.value??0)*2.2,...p}));return <g key={series.entity.id} className={'chart-series series-'+(si%5)}><polyline points={coords.map(p=>`${p.x},${p.y}`).join(' ')} fill="none"/>{coords.map(p=><g key={p.idx}><circle cx={p.x} cy={p.y} r="5"><title>{series.entity.name}: {(p.value??0).toFixed(1)}% ({p.h}/{p.shots})</title></circle></g>)}</g>})}
    {races.map((r,i)=>{const x=70+(races.length<=1?0:i*(650/(races.length-1)));return <text key={r.id} x={x} y="287" textAnchor="middle">{i+1}</text>})}
   </svg></div><div className="chart-legend">{compared.map((e,i)=><span key={e.id} className={'series-'+(i%5)}><i/>{short(e.name)}</span>)}</div>
   <div className="table-scroll"><table><thead><tr><th>Deltävling</th>{compared.map(e=><th key={e.id}>{e.name}</th>)}</tr></thead><tbody>{races.map(race=><tr key={race.id}><td><strong>{race.name}</strong></td>{compared.map(e=>{const rr=analysisRows.filter(x=>x.race_id===race.id&&(kind==='group'?groups.find(g=>g.id===e.id)?.athlete_ids.includes(x.athlete_id):(kind==='athlete'?x.athlete_id:kind==='club'?x.club_id:x.class_id)===e.id));const h=rr.reduce((s,x)=>s+(x.shooting_hits??0),0),s=rr.reduce((a,x)=>a+(x.shooting_shots??0),0);return <td key={e.id}>{s?`${pct(h,s).toFixed(1)} % (${h}/${s})`:'–'}</td>})}</tr>)}</tbody></table></div>
  </section>}
 </section>
}
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic='force-dynamic';

type Standing={cup_id:string;cup_name:string;season_name:string;class_id:string;class_name:string;athlete_id:string;athlete_name:string;club_name:string;region_name:string;cup_place:number;total_points:number;races_participated:number;races_counted:number;shooting_hits:number|null;shooting_shots:number|null;shooting_percentage:number|null;eligible_for_prize:boolean};
type Detail={cup_id:string;cup_name:string;season_name:string;class_id:string;athlete_id:string;race_id:string;race_name:string;race_date:string|null;region_place:number|null;cup_points:number;shooting_hits:number|null;shooting_shots:number|null;is_counted:boolean};
function pct(v:number|null){return v==null?'–':`${Number(v).toFixed(2)} %`;}
function shoot(r:{shooting_hits:number|null;shooting_shots:number|null}){return r.shooting_shots?`${r.shooting_hits ?? 0}/${r.shooting_shots}`:'–';}

export default async function AthletePage({params}:{params:Promise<{id:string}>}){
 const {id}=await params; const supabase=await createClient();
 const [{data:standing,error},{data:detail}]=await Promise.all([
  supabase.from('cup_standings').select('cup_id,cup_name,season_name,class_id,class_name,athlete_id,athlete_name,club_name,region_name,cup_place,total_points,races_participated,races_counted,shooting_hits,shooting_shots,shooting_percentage,eligible_for_prize').eq('athlete_id',id).order('season_name',{ascending:false}),
  supabase.from('cup_result_breakdown').select('cup_id,cup_name,season_name,class_id,athlete_id,race_id,race_name,race_date,region_place,cup_points,shooting_hits,shooting_shots,is_counted').eq('athlete_id',id).order('race_date',{ascending:false})
 ]);
 if(error||!standing?.length) notFound();
 const rows=standing as Standing[], details=(detail??[]) as Detail[], athlete=rows[0];
 const starts=rows.reduce((s,r)=>s+r.races_participated,0), points=rows.reduce((s,r)=>s+r.total_points,0);
 const hits=details.reduce((s,r)=>s+(r.shooting_hits??0),0), shots=details.reduce((s,r)=>s+(r.shooting_shots??0),0);
 return <>
  <section className="hero compact-hero"><p className="eyebrow">Åkarprofil</p><h1>{athlete.athlete_name}</h1><p>{athlete.club_name} · {athlete.region_name}</p><Link className="source-button" href="/">← Till cupställningen</Link></section>
  <section className="stats-grid">
   <div className="metric-card"><span>Cuper</span><strong>{rows.length}</strong></div>
   <div className="metric-card"><span>Starter</span><strong>{starts}</strong></div>
   <div className="metric-card"><span>Cuppoäng</span><strong>{points}</strong></div>
   <div className="metric-card"><span>Skytte totalt</span><strong>{shots?pct(hits/shots*100):'–'}</strong><small>{shots?`${hits}/${shots}`:'Ingen skyttedata'}</small></div>
  </section>
  {rows.map(row=>{const races=details.filter(d=>d.cup_id===row.cup_id&&d.class_id===row.class_id);return <section className="card standings-card" key={`${row.cup_id}-${row.class_id}`}>
   <div className="athlete-cup-heading"><div><p className="eyebrow dark">{row.season_name}</p><h2>{row.cup_name}</h2><p className="muted">{row.class_name}</p></div><div className="athlete-place"><span>Cupplacering</span><strong>{row.cup_place}</strong></div></div>
   <div className="athlete-summary"><span><strong>{row.total_points}</strong> poäng</span><span>{row.races_counted}/{row.races_participated} starter räknas</span><span>Skytte {pct(row.shooting_percentage)}</span><span>{row.eligible_for_prize?'Kvalificerad för pris':'Ej ännu kvalificerad för pris'}</span></div>
   <div className="table-scroll"><table><thead><tr><th>Deltävling</th><th>Datum</th><th>Regional plac.</th><th>Poäng</th><th>Skytte</th><th>Räknas</th></tr></thead><tbody>
   {races.map(r=><tr key={r.race_id} className={r.is_counted?'':'dropped'}><td><Link className="text-link" href={`/tavlingar/${r.race_id}`}>{r.race_name}</Link></td><td>{r.race_date??'–'}</td><td>{r.region_place??'–'}</td><td><strong>{r.cup_points}</strong></td><td>{shoot(r)}</td><td>{r.is_counted?'✓ Ja':'Struken'}</td></tr>)}
   </tbody></table></div>
  </section>})}
 </>;
}
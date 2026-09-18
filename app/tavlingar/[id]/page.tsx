import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type ResultRow = {
  result_id:string; class_id:string; class_name:string; bib:number|null; athlete_name:string; club_name:string;
  region_name:string|null; is_region_club:boolean; source_place:number|null; region_place:number|null; cup_points:number|null;
  result_status:string; shooting_hits:number|null; shooting_shots:number|null; total_time_ms:number|null;
};
function timeLabel(ms:number|null){
  if(ms==null)return '–';
  const s=Math.floor(ms/1000), m=Math.floor(s/60), sec=s%60, tenth=Math.floor((ms%1000)/100);
  return `${m}:${String(sec).padStart(2,'0')}.${tenth}`;
}
function shooting(row:ResultRow){return row.shooting_shots? `${row.shooting_hits ?? 0}/${row.shooting_shots}`:'–';}

export default async function PublicRacePage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const supabase=await createClient();
  const [{data:race},{data:rows,error}]=await Promise.all([
    supabase.from('races').select('id,name,race_date,status,cup_id,cups(name,region_id,regions(name))').eq('id',id).single(),
    supabase.from('race_result_review').select('result_id,class_id,class_name,bib,athlete_name,club_name,region_name,is_region_club,source_place,region_place,cup_points,result_status,shooting_hits,shooting_shots,total_time_ms').eq('race_id',id).order('class_name').order('source_place',{ascending:true,nullsFirst:false}).order('bib')
  ]);
  if(!race || race.status!=='published') notFound();
  const results=(rows??[]) as ResultRow[];
  const classes=Array.from(new Map(results.map(r=>[r.class_id,r.class_name])).entries());
  const regional=results.filter(r=>r.is_region_club);
  const cup=(race.cups as unknown as {name:string;region_id:string|null;regions:{name:string}|null}|null);
  return <>
    <section className="hero compact-hero">
      <p className="eyebrow">Deltävling</p><h1>{race.name}</h1>
      <p>{race.race_date ?? 'Datum saknas'} · {cup?.name ?? 'Cup'} · {results.length} resultat</p>
      <Link className="source-button" href={`/?cup=${race.cup_id}&view=statistics`}>← Till cupen</Link>
    </section>
    {error && <div className="alert error">Resultaten kunde inte hämtas.</div>}
    <section className="stats-grid">
      <div className="metric-card"><span>Resultat</span><strong>{results.length}</strong></div>
      <div className="metric-card"><span>Regionala åkare</span><strong>{regional.length}</strong></div>
      <div className="metric-card"><span>Klasser</span><strong>{classes.length}</strong></div>
      <div className="metric-card"><span>Region</span><strong>{cup?.regions?.name ?? '–'}</strong></div>
    </section>
    {classes.map(([classId,className])=>{
      const classRows=results.filter(r=>r.class_id===classId);
      return <section className="card standings-card" key={classId}>
        <h2>{className}</h2>
        <div className="table-scroll"><table><thead><tr><th>Plac.</th><th>Åkare</th><th>Klubb</th><th>Regional plac.</th><th>Cuppoäng</th><th>Skytte</th><th>Tid</th><th>Status</th></tr></thead>
        <tbody>{classRows.map(row=><tr key={row.result_id} className={!row.is_region_club?'outside-region':''}>
          <td><strong>{row.source_place ?? '–'}</strong></td><td><strong>{row.athlete_name}</strong></td>
          <td>{row.club_name}{!row.is_region_club&&<small className="points-gap">Utanför cupregion</small>}</td>
          <td>{row.region_place ?? '–'}</td><td><strong>{row.cup_points ?? 0}</strong></td><td>{shooting(row)}</td><td>{timeLabel(row.total_time_ms)}</td><td>{row.result_status}</td>
        </tr>)}</tbody></table></div>
      </section>;
    })}
  </>;
}

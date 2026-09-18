import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic='force-dynamic';
type ClubCup={cup_id:string;cup_name:string;season_name:string;club_id:string;club_name:string;region_name:string;athlete_count:number;total_points:number;total_starts:number;shooting_percentage:number|null;gold:number;silver:number;bronze:number;medals:number;club_place:number;medal_points:number;medal_place:number};
type Athlete={athlete_id:string;athlete_name:string;class_name:string;cup_id:string;cup_name:string;season_name:string;cup_place:number;total_points:number;races_participated:number;shooting_percentage:number|null};
function pct(v:number|null){return v==null?'–':`${Number(v).toFixed(2)} %`;}

export default async function ClubPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params; const supabase=await createClient();
 const [{data:club},{data:cups,error},{data:athletes}]=await Promise.all([
  supabase.from('clubs').select('id,name,short_name,regions(name)').eq('id',id).single(),
  supabase.from('cup_club_standings').select('*').eq('club_id',id).order('season_name',{ascending:false}),
  supabase.from('cup_standings').select('athlete_id,athlete_name,class_name,cup_id,cup_name,season_name,cup_place,total_points,races_participated,shooting_percentage').eq('club_id',id).order('season_name',{ascending:false}).order('class_name').order('cup_place')
 ]);
 if(error||!club) notFound();
 const cupRows=(cups??[]) as ClubCup[], athleteRows=(athletes??[]) as Athlete[];
 const region=(club.regions as unknown as {name:string}|null)?.name;
 const uniqueAthletes=new Set(athleteRows.map(a=>a.athlete_id)).size;
 const totalStarts=cupRows.reduce((s,r)=>s+r.total_starts,0), totalPoints=cupRows.reduce((s,r)=>s+r.total_points,0), totalMedals=cupRows.reduce((s,r)=>s+r.medals,0);
 return <>
  <section className="hero compact-hero"><p className="eyebrow">Klubbprofil</p><h1>{club.name}</h1><p>{region??'Region saknas'}{club.short_name&&club.short_name!==club.name?` · ${club.short_name}`:''}</p><Link className="source-button" href="/?view=club">← Till klubbligan</Link></section>
  <section className="stats-grid">
   <div className="metric-card"><span>Åkare i cuphistoriken</span><strong>{uniqueAthletes}</strong></div>
   <div className="metric-card"><span>Starter</span><strong>{totalStarts}</strong></div>
   <div className="metric-card"><span>Cuppoäng</span><strong>{totalPoints}</strong></div>
   <div className="metric-card"><span>Medaljer</span><strong>{totalMedals}</strong></div>
  </section>
  {cupRows.map(row=>{const members=athleteRows.filter(a=>a.cup_id===row.cup_id);return <section className="card standings-card" key={row.cup_id}>
   <div className="club-cup-heading"><div><p className="eyebrow dark">{row.season_name}</p><h2>{row.cup_name}</h2><p className="muted">{row.total_starts} starter · {row.athlete_count} aktiva · Skytte {pct(row.shooting_percentage)}</p></div><div className="club-ranks"><span>Poängliga <strong>#{row.club_place}</strong></span><span>Medaljliga <strong>#{row.medal_place}</strong></span></div></div>
   <div className="athlete-summary"><span><strong>{row.total_points}</strong> poäng</span><span>🥇 {row.gold} · 🥈 {row.silver} · 🥉 {row.bronze}</span><span>{row.medal_points} medaljpoäng</span></div>
   <div className="table-scroll"><table><thead><tr><th>Åkare</th><th>Klass</th><th>Cupplac.</th><th>Poäng</th><th>Starter</th><th>Skytte</th></tr></thead><tbody>
    {members.map(a=><tr key={`${a.cup_id}-${a.athlete_id}-${a.class_name}`}><td><Link className="text-link" href={`/akare/${a.athlete_id}`}>{a.athlete_name}</Link></td><td>{a.class_name}</td><td><strong>{a.cup_place}</strong></td><td>{a.total_points}</td><td>{a.races_participated}</td><td>{pct(a.shooting_percentage)}</td></tr>)}
   </tbody></table></div>
  </section>})}
  {cupRows.length===0&&<section className="card empty-state"><h2>Ingen cuphistorik ännu</h2><p className="muted">Klubben har ännu inga publicerade regionala cupresultat.</p></section>}
 </>;
}
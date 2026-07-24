import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Standing = {
  cup_id: string; cup_name: string; season_name: string; class_id: string; class_name: string;
  athlete_id: string; athlete_name: string; club_name: string; cup_place: number; total_points: number;
  races_participated: number; races_counted: number; published_race_count: number; dropped_race_count: number;
  shooting_percentage: number | null; eligible_for_prize: boolean;
};
type Breakdown = { cup_id:string; class_id:string; athlete_id:string; race_id:string; race_name:string; region_place:number; cup_points:number; shooting_hits:number|null; shooting_shots:number|null; is_counted:boolean };
type ClassStanding = { cup_id:string; cup_name:string; season_name:string; class_id:string; class_name:string; athlete_count:number; total_points:number; total_starts:number; shooting_percentage:number|null };
type ClubStanding = { cup_id:string; cup_name:string; season_name:string; club_id:string; club_name:string; club_place:number; athlete_count:number; total_points:number; total_starts:number; gold:number; silver:number; bronze:number; medals:number; shooting_hits:number; shooting_shots:number; shooting_percentage:number|null };

function pct(value:number|null){ return value == null ? '–' : `${Number(value).toFixed(2)} %`; }
function shootingLabel(row:{shooting_hits:number|null;shooting_shots:number|null}) { return row.shooting_hits == null || !row.shooting_shots ? '–' : `${row.shooting_hits}/${row.shooting_shots}`; }

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams;
  const view = ['individual','class','club'].includes(params.view ?? '') ? params.view! : 'individual';
  const supabase = await createClient();
  const [{data:standings,error},{data:breakdown},{data:classRows},{data:clubRows}] = await Promise.all([
    supabase.from('cup_standings').select('*').order('cup_name').order('class_name').order('cup_place'),
    supabase.from('cup_result_breakdown').select('cup_id,class_id,athlete_id,race_id,race_name,region_place,cup_points,shooting_hits,shooting_shots,is_counted').order('race_date').order('sort_order'),
    supabase.from('cup_class_standings').select('*').order('cup_name').order('class_name'),
    supabase.from('cup_club_standings').select('*').order('cup_name').order('club_place'),
  ]);
  const individual = (standings ?? []) as Standing[];
  const details = (breakdown ?? []) as Breakdown[];
  const classes = (classRows ?? []) as ClassStanding[];
  const clubs = (clubRows ?? []) as ClubStanding[];
  const cupIds = Array.from(new Set([...individual.map(r=>r.cup_id),...classes.map(r=>r.cup_id),...clubs.map(r=>r.cup_id)]));

  return <>
    <section className="hero"><p className="eyebrow">Region Syd</p><h1>Cupsammanställning</h1><p>Välj om du vill se individuell ställning, sammanställning per klass eller klubbkamp.</p></section>
    <nav className="summary-tabs" aria-label="Sammanställning">
      <Link className={view==='individual'?'active':''} href="/?view=individual">Individuellt</Link>
      <Link className={view==='class'?'active':''} href="/?view=class">Klasser</Link>
      <Link className={view==='club'?'active':''} href="/?view=club">Klubbar</Link>
    </nav>
    {error && <div className="card"><h2>Poängmotorn är inte aktiverad</h2><p className="muted">Kör de senaste SQL-migrationerna i Supabase.</p></div>}
    {!error && cupIds.length===0 && <div className="card"><h2>Inga publicerade resultat ännu</h2></div>}

    {cupIds.map(cupId => {
      const meta = individual.find(r=>r.cup_id===cupId) ?? classes.find(r=>r.cup_id===cupId) ?? clubs.find(r=>r.cup_id===cupId);
      if (!meta) return null;
      return <section key={cupId} className="cup-section">
        <div className="section-heading"><div><p className="eyebrow dark">{meta.season_name}</p><h2>{meta.cup_name}</h2></div></div>

        {view==='individual' && Array.from(new Set(individual.filter(r=>r.cup_id===cupId).map(r=>r.class_name))).map(className => {
          const rows=individual.filter(r=>r.cup_id===cupId&&r.class_name===className);
          return <section key={className} className="card standings-card"><h3>{className}</h3><div className="table-scroll"><table>
            <thead><tr><th>Plats</th><th>Åkare</th><th>Klubb</th><th>Poäng</th><th>Skytte</th><th>Starter</th><th>Pris</th></tr></thead>
            <tbody>{rows.map(row => <tr key={`${row.class_id}-${row.athlete_id}`}><td><strong>{row.cup_place}</strong></td><td><details><summary>{row.athlete_name}</summary><div className="result-detail"><table><thead><tr><th>Deltävling</th><th>Plac.</th><th>Poäng</th><th>Skytte</th><th>Räknas</th></tr></thead><tbody>{details.filter(d=>d.cup_id===row.cup_id&&d.class_id===row.class_id&&d.athlete_id===row.athlete_id).map(result=><tr key={result.race_id} className={result.is_counted?'':'dropped'}><td>{result.race_name}</td><td>{result.region_place}</td><td>{result.cup_points}</td><td>{shootingLabel(result)}</td><td>{result.is_counted?'Ja':'Struken'}</td></tr>)}</tbody></table></div></details></td><td>{row.club_name}</td><td><strong>{row.total_points}</strong></td><td>{pct(row.shooting_percentage)}</td><td>{row.races_participated} ({row.races_counted} räknas)</td><td>{row.eligible_for_prize?<span className="badge success-badge">Kvalificerad</span>:<span className="badge">Minst 3 krävs</span>}</td></tr>)}</tbody>
          </table></div></section>;
        })}

        {view==='class' && <section className="card standings-card"><h3>Sammanställning per klass</h3><div className="table-scroll"><table><thead><tr><th>Klass</th><th>Aktiva</th><th>Starter</th><th>Samlad poäng</th><th>Träffprocent</th></tr></thead><tbody>{classes.filter(r=>r.cup_id===cupId).map(row=><tr key={row.class_id}><td><strong>{row.class_name}</strong></td><td>{row.athlete_count}</td><td>{row.total_starts}</td><td>{row.total_points}</td><td>{pct(row.shooting_percentage)}</td></tr>)}</tbody></table></div></section>}

        {view==='club' && <section className="card standings-card"><h3>Klubbkamp</h3><div className="table-scroll"><table><thead><tr><th>Plats</th><th>Klubb</th><th>Aktiva</th><th>Poäng</th><th>🥇</th><th>🥈</th><th>🥉</th><th>Medaljer</th><th>Skytte</th></tr></thead><tbody>{clubs.filter(r=>r.cup_id===cupId).map(row=><tr key={row.club_id}><td><strong>{row.club_place}</strong></td><td><strong>{row.club_name}</strong></td><td>{row.athlete_count}</td><td><strong>{row.total_points}</strong></td><td>{row.gold}</td><td>{row.silver}</td><td>{row.bronze}</td><td>{row.medals}</td><td>{row.shooting_hits}/{row.shooting_shots} · {pct(row.shooting_percentage)}</td></tr>)}</tbody></table></div></section>}
      </section>;
    })}
  </>;
}

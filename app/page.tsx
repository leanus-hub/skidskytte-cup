import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SummarySelector from './components/summary-selector';

export const dynamic = 'force-dynamic';

type Region = { id:string; name:string; sort_order:number };
type Cup = { id:string; name:string; season_id:string; region_id:string|null };
type Standing = {
  cup_id: string; cup_name: string; season_name: string; class_id: string; class_name: string;
  athlete_id: string; athlete_name: string; club_name: string; cup_place: number; total_points: number;
  races_participated: number; races_counted: number; published_race_count: number; dropped_race_count: number;
  shooting_percentage: number | null; eligible_for_prize: boolean;
};
type Breakdown = { cup_id:string; class_id:string; athlete_id:string; race_id:string; race_name:string; region_place:number; cup_points:number; shooting_hits:number|null; shooting_shots:number|null; is_counted:boolean };
type ClassStanding = { cup_id:string; cup_name:string; season_name:string; class_id:string; class_name:string; athlete_count:number; total_points:number; total_starts:number; shooting_percentage:number|null };
type ClubStanding = { cup_id:string; cup_name:string; season_name:string; club_id:string; club_name:string; club_place:number; athlete_count:number; total_points:number; total_starts:number; gold:number; silver:number; bronze:number; medals:number; shooting_hits:number; shooting_shots:number; shooting_percentage:number|null };
type RaceStatistic = { cup_id:string; cup_name:string; season_name:string; region_id:string; region_name:string; race_id:string; race_name:string; race_date:string|null; sort_order:number; regional_participants:number; all_participants:number; regional_clubs:number; regional_classes:number; shooting_percentage:number|null };

function pct(value:number|null){ return value == null ? '–' : `${Number(value).toFixed(2)} %`; }
function shootingLabel(row:{shooting_hits:number|null;shooting_shots:number|null}) { return row.shooting_hits == null || !row.shooting_shots ? '–' : `${row.shooting_hits}/${row.shooting_shots}`; }
function href(params:Record<string,string|undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key,value]) => value && search.set(key,value));
  return `/?${search.toString()}`;
}

function safeAverage(total:number, count:number) { return count > 0 ? total / count : 0; }
function medalRank(rows:ClubStanding[]) {
  return [...rows].sort((a,b)=>b.gold-a.gold || b.silver-a.silver || b.bronze-a.bronze || a.club_name.localeCompare(b.club_name,'sv'));
}

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams;
  const view = ['individual','class','club','statistics'].includes(params.view ?? '') ? params.view! : 'individual';
  const clubView = params.clubView === 'medals' ? 'medals' : 'points';
  const supabase = await createClient();
  const [{data:regionRows,error:regionsError},{data:cupRows,error:cupsError},{data:standings,error},{data:breakdown},{data:classRows},{data:clubRows},{data:raceStats}] = await Promise.all([
    supabase.from('regions').select('id,name,sort_order').order('sort_order'),
    supabase.from('cups').select('id,name,season_id,region_id').order('created_at'),
    supabase.from('cup_standings').select('*').order('cup_name').order('class_name').order('cup_place'),
    supabase.from('cup_result_breakdown').select('cup_id,class_id,athlete_id,race_id,race_name,region_place,cup_points,shooting_hits,shooting_shots,is_counted').order('race_date').order('sort_order'),
    supabase.from('cup_class_standings').select('*').order('cup_name').order('class_name'),
    supabase.from('cup_club_standings').select('*').order('cup_name').order('club_place'),
    supabase.from('cup_race_statistics').select('*').order('cup_name').order('sort_order').order('race_date'),
  ]);

  const regions = (regionRows ?? []) as Region[];
  const cups = (cupRows ?? []) as unknown as Cup[];
  const individual = (standings ?? []) as Standing[];
  const details = (breakdown ?? []) as Breakdown[];
  const classes = (classRows ?? []) as ClassStanding[];
  const clubs = (clubRows ?? []) as ClubStanding[];
  const statistics = (raceStats ?? []) as RaceStatistic[];
  const regionWithCup = regions.find(region => cups.some(cup => cup.region_id === region.id));
  const selectedRegionId = regions.some(region => region.id === params.region)
    ? params.region!
    : regionWithCup?.id ?? regions[0]?.id;
  const selectedRegion = regions.find(region => region.id === selectedRegionId);
  const regionCups = cups.filter(cup => cup.region_id === selectedRegionId);
  const selectedCupId = regionCups.some(cup => cup.id === params.cup)
    ? params.cup!
    : regionCups[0]?.id;
  const visibleCups = regionCups.filter(cup => cup.id === selectedCupId);
  const cupIds = visibleCups.map(cup => cup.id);

  return <>
    <section className="hero"><p className="eyebrow">Svenskt skidskytte</p><h1>Cupsammanställning</h1><p>Välj region och utforska individuella resultat, klasser, klubbarnas ligor och statistik från cupens deltävlingar.</p></section>

    {regions.length > 0 && <SummarySelector
      regions={regions}
      cups={cups}
      selectedRegionId={selectedRegionId}
      selectedCupId={selectedCupId}
    />}


    <nav className="summary-tabs" aria-label="Sammanställning">
      <Link className={view==='individual'?'active':''} href={href({region:selectedRegionId,cup:selectedCupId,view:'individual'})}>Individuellt</Link>
      <Link className={view==='class'?'active':''} href={href({region:selectedRegionId,cup:selectedCupId,view:'class'})}>Klasser</Link>
      <Link className={view==='club'?'active':''} href={href({region:selectedRegionId,cup:selectedCupId,view:'club',clubView})}>Klubbar</Link>
      <Link className={view==='statistics'?'active':''} href={href({region:selectedRegionId,cup:selectedCupId,view:'statistics'})}>Cupstatistik</Link>
    </nav>

    {(regionsError || cupsError) && <div className="card"><h2>Regioner eller cuper kunde inte hämtas</h2><p className="muted">{regionsError?.message ?? cupsError?.message}</p></div>}
    {error && <div className="card"><h2>Poängmotorn är inte aktiverad</h2><p className="muted">Kör SQL-migreringen för version 6.3 i Supabase.</p></div>}
    {!error && cupIds.length===0 && <div className="card"><h2>Inga cuper för {selectedRegion?.name ?? 'vald region'}</h2></div>}

    {visibleCups.map(cup => {
      const cupId = cup.id;
      const meta = individual.find(r=>r.cup_id===cupId) ?? classes.find(r=>r.cup_id===cupId) ?? clubs.find(r=>r.cup_id===cupId) ?? statistics.find(r=>r.cup_id===cupId);
      const cupStatistics = statistics.filter(r=>r.cup_id===cupId);
      const cupIndividuals = individual.filter(r=>r.cup_id===cupId);
      const cupClasses = classes.filter(r=>r.cup_id===cupId);
      const cupClubs = clubs.filter(r=>r.cup_id===cupId);
      const biggestRace = [...cupStatistics].sort((a,b)=>b.regional_participants-a.regional_participants || a.sort_order-b.sort_order)[0];
      const smallestRace = [...cupStatistics].filter(r=>r.regional_participants>0).sort((a,b)=>a.regional_participants-b.regional_participants || a.sort_order-b.sort_order)[0];
      const pointsLeader = [...cupClubs].sort((a,b)=>b.total_points-a.total_points || a.club_name.localeCompare(b.club_name,'sv'))[0];
      const medalLeader = medalRank(cupClubs)[0];
      const mostActiveClub = [...cupClubs].sort((a,b)=>b.total_starts-a.total_starts || a.club_name.localeCompare(b.club_name,'sv'))[0];
      const mostActiveClass = [...cupClasses].sort((a,b)=>b.total_starts-a.total_starts || a.class_name.localeCompare(b.class_name,'sv'))[0];
      const mostActiveAthlete = [...cupIndividuals].sort((a,b)=>b.races_participated-a.races_participated || b.total_points-a.total_points || a.athlete_name.localeCompare(b.athlete_name,'sv'))[0];
      const bestPointAverage = [...cupIndividuals].filter(r=>r.races_counted>0).sort((a,b)=>safeAverage(b.total_points,b.races_counted)-safeAverage(a.total_points,a.races_counted) || b.total_points-a.total_points)[0];
      const bestClubEfficiency = [...cupClubs].filter(r=>r.total_starts>0).sort((a,b)=>safeAverage(b.total_points,b.total_starts)-safeAverage(a.total_points,a.total_starts) || b.total_points-a.total_points)[0];
      const totalRegionalStarts = cupStatistics.reduce((sum,row)=>sum+row.regional_participants,0);
      if (!meta && view !== 'statistics') return null;
      return <section key={cupId} className="cup-section">
        <div className="section-heading"><div><p className="eyebrow dark">{meta?.season_name ?? selectedRegion?.name}</p><h2>{cup.name}</h2><p className="section-subtitle">{selectedRegion?.name}</p></div></div>

        <section className="cup-dashboard" aria-label={`Översikt för ${cup.name}`}>
          <div className="dashboard-metric"><span>Unika åkare</span><strong>{cupIndividuals.length}</strong></div>
          <div className="dashboard-metric"><span>Deltävlingar</span><strong>{cupStatistics.length}</strong></div>
          <div className="dashboard-metric"><span>Deltagande klubbar</span><strong>{cupClubs.length}</strong></div>
          <div className="dashboard-metric"><span>Regionala starter</span><strong>{totalRegionalStarts}</strong></div>
          <div className="dashboard-leader"><span>Poängligan</span><strong>{pointsLeader?.club_name ?? '–'}</strong><small>{pointsLeader ? `${pointsLeader.total_points} poäng` : 'Inga resultat'}</small></div>
          <div className="dashboard-leader"><span>Medaljligan</span><strong>{medalLeader?.club_name ?? '–'}</strong><small>{medalLeader ? `${medalLeader.gold} guld · ${medalLeader.medals} medaljer` : 'Inga resultat'}</small></div>
        </section>

        {view==='individual' && Array.from(new Set(individual.filter(r=>r.cup_id===cupId).map(r=>r.class_name))).map(className => {
          const rows=individual.filter(r=>r.cup_id===cupId&&r.class_name===className);
          return <section key={className} className="card standings-card"><h3>{className}</h3><div className="table-scroll"><table>
            <thead><tr><th>Plats</th><th>Åkare</th><th>Klubb</th><th>Poäng</th><th>Skytte</th><th>Starter</th><th>Pris</th></tr></thead>
            <tbody>{rows.map(row => <tr key={`${row.class_id}-${row.athlete_id}`}><td><strong>{row.cup_place}</strong></td><td><details><summary>{row.athlete_name}</summary><div className="result-detail"><table><thead><tr><th>Deltävling</th><th>Plac.</th><th>Poäng</th><th>Skytte</th><th>Räknas</th></tr></thead><tbody>{details.filter(d=>d.cup_id===row.cup_id&&d.class_id===row.class_id&&d.athlete_id===row.athlete_id).map(result=><tr key={result.race_id} className={result.is_counted?'':'dropped'}><td>{result.race_name}</td><td>{result.region_place}</td><td>{result.cup_points}</td><td>{shootingLabel(result)}</td><td>{result.is_counted?'Ja':'Struken'}</td></tr>)}</tbody></table></div></details></td><td>{row.club_name}</td><td><strong>{row.total_points}</strong></td><td>{pct(row.shooting_percentage)}</td><td>{row.races_participated} ({row.races_counted} räknas)</td><td>{row.eligible_for_prize?<span className="badge success-badge">Kvalificerad</span>:<span className="badge">Minst 3 krävs</span>}</td></tr>)}</tbody>
          </table></div></section>;
        })}

        {view==='class' && <section className="card standings-card"><h3>Sammanställning per klass</h3><div className="table-scroll"><table><thead><tr><th>Klass</th><th>Aktiva</th><th>Starter</th><th>Samlad poäng</th><th>Träffprocent</th></tr></thead><tbody>{classes.filter(r=>r.cup_id===cupId).map(row=><tr key={row.class_id}><td><strong>{row.class_name}</strong></td><td>{row.athlete_count}</td><td>{row.total_starts}</td><td>{row.total_points}</td><td>{pct(row.shooting_percentage)}</td></tr>)}</tbody></table></div></section>}

        {view==='club' && <>
          <nav className="sub-tabs" aria-label="Klubbliga">
            <Link className={clubView==='points'?'active':''} href={href({region:selectedRegionId,cup:selectedCupId,view:'club',clubView:'points'})}>Poängliga</Link>
            <Link className={clubView==='medals'?'active':''} href={href({region:selectedRegionId,cup:selectedCupId,view:'club',clubView:'medals'})}>Medaljliga</Link>
          </nav>
          {clubView==='points' && <section className="card standings-card"><h3>Klubbarnas poängliga</h3><p className="table-note">Placering efter total cup-poäng. Träffprocent används som skiljekriterium.</p><div className="table-scroll"><table><thead><tr><th>Plats</th><th>Klubb</th><th>Aktiva</th><th>Poäng</th><th>Starter</th><th>Skytte</th></tr></thead><tbody>{clubs.filter(r=>r.cup_id===cupId).sort((a,b)=>a.club_place-b.club_place).map(row=><tr key={row.club_id}><td><strong>{row.club_place}</strong></td><td><strong>{row.club_name}</strong></td><td>{row.athlete_count}</td><td><strong>{row.total_points}</strong></td><td>{row.total_starts}</td><td>{row.shooting_hits}/{row.shooting_shots} · {pct(row.shooting_percentage)}</td></tr>)}</tbody></table></div></section>}
          {clubView==='medals' && <section className="card standings-card"><h3>Klubbarnas medaljliga</h3><p className="table-note">Placering efter flest guld, därefter silver och brons.</p><div className="table-scroll"><table><thead><tr><th>Plats</th><th>Klubb</th><th>🥇 Guld</th><th>🥈 Silver</th><th>🥉 Brons</th><th>Totalt</th></tr></thead><tbody>{clubs.filter(r=>r.cup_id===cupId).sort((a,b)=>b.gold-a.gold || b.silver-a.silver || b.bronze-a.bronze || a.club_name.localeCompare(b.club_name,'sv')).map((row,index)=><tr key={row.club_id}><td><strong>{index+1}</strong></td><td><strong>{row.club_name}</strong></td><td>{row.gold}</td><td>{row.silver}</td><td>{row.bronze}</td><td><strong>{row.medals}</strong></td></tr>)}</tbody></table></div></section>}
        </>}

        {view==='statistics' && <>
          <section className="record-grid">
            <div className="record-card featured"><span>Mest besökta tävlingen</span><strong>{biggestRace?.race_name ?? '–'}</strong><small>{biggestRace ? `${biggestRace.regional_participants} regionala deltagare` : 'Inga publicerade resultat'}</small></div>
            <div className="record-card"><span>Minsta tävlingen</span><strong>{smallestRace?.race_name ?? '–'}</strong><small>{smallestRace ? `${smallestRace.regional_participants} regionala deltagare` : 'Inga publicerade resultat'}</small></div>
            <div className="record-card"><span>Flest starter – klubb</span><strong>{mostActiveClub?.club_name ?? '–'}</strong><small>{mostActiveClub ? `${mostActiveClub.total_starts} starter` : 'Inga resultat'}</small></div>
            <div className="record-card"><span>Flest starter – klass</span><strong>{mostActiveClass?.class_name ?? '–'}</strong><small>{mostActiveClass ? `${mostActiveClass.total_starts} starter` : 'Inga resultat'}</small></div>
            <div className="record-card"><span>Flest deltävlingar – åkare</span><strong>{mostActiveAthlete?.athlete_name ?? '–'}</strong><small>{mostActiveAthlete ? `${mostActiveAthlete.races_participated} starter · ${mostActiveAthlete.club_name}` : 'Inga resultat'}</small></div>
            <div className="record-card"><span>Högst poängsnitt</span><strong>{bestPointAverage?.athlete_name ?? '–'}</strong><small>{bestPointAverage ? `${safeAverage(bestPointAverage.total_points,bestPointAverage.races_counted).toFixed(1)} poäng/räknad start` : 'Inga resultat'}</small></div>
            <div className="record-card"><span>Bäst poäng per start – klubb</span><strong>{bestClubEfficiency?.club_name ?? '–'}</strong><small>{bestClubEfficiency ? `${safeAverage(bestClubEfficiency.total_points,bestClubEfficiency.total_starts).toFixed(1)} poäng/start` : 'Inga resultat'}</small></div>
            <div className="record-card"><span>Flest medaljer</span><strong>{medalLeader?.club_name ?? '–'}</strong><small>{medalLeader ? `${medalLeader.medals} totalt · ${medalLeader.gold} guld` : 'Inga resultat'}</small></div>
          </section>

          <section className="stats-grid">
            <div className="metric-card"><span>Deltävlingar</span><strong>{cupStatistics.length}</strong></div>
            <div className="metric-card"><span>Unika åkare</span><strong>{cupIndividuals.length}</strong></div>
            <div className="metric-card"><span>Regionala starter</span><strong>{totalRegionalStarts}</strong></div>
            <div className="metric-card"><span>Importerade starter</span><strong>{cupStatistics.reduce((sum,row)=>sum+row.all_participants,0)}</strong></div>
            <div className="metric-card"><span>Snitt per tävling</span><strong>{cupStatistics.length ? (totalRegionalStarts/cupStatistics.length).toFixed(1) : '0'}</strong></div>
            <div className="metric-card"><span>Deltagande klubbar</span><strong>{cupClubs.length}</strong></div>
          </section>

          <section className="card standings-card"><h3>Deltagande per tävling</h3><p className="table-note">Regionala deltagare räknas i cupen. Alla importerade inkluderar även deltagare från andra regioner.</p><div className="table-scroll"><table><thead><tr><th>Deltävling</th><th>Datum</th><th>Regionala deltagare</th><th>Alla importerade</th><th>Klubbar</th><th>Klasser</th><th>Skytte</th></tr></thead><tbody>{cupStatistics.map(row=><tr key={row.race_id} className={row.race_id===biggestRace?.race_id?'top-stat-row':''}><td><strong>{row.race_name}</strong></td><td>{row.race_date ?? '–'}</td><td><strong>{row.regional_participants}</strong></td><td>{row.all_participants}</td><td>{row.regional_clubs}</td><td>{row.regional_classes}</td><td>{pct(row.shooting_percentage)}</td></tr>)}</tbody></table></div></section>

          <div className="insight-columns">
            <section className="card standings-card"><h3>Flest starter per klubb</h3><div className="table-scroll"><table><thead><tr><th>Plats</th><th>Klubb</th><th>Starter</th><th>Åkare</th></tr></thead><tbody>{[...cupClubs].sort((a,b)=>b.total_starts-a.total_starts || a.club_name.localeCompare(b.club_name,'sv')).map((row,index)=><tr key={row.club_id}><td>{index+1}</td><td><strong>{row.club_name}</strong></td><td>{row.total_starts}</td><td>{row.athlete_count}</td></tr>)}</tbody></table></div></section>
            <section className="card standings-card"><h3>Flest starter per klass</h3><div className="table-scroll"><table><thead><tr><th>Plats</th><th>Klass</th><th>Starter</th><th>Åkare</th></tr></thead><tbody>{[...cupClasses].sort((a,b)=>b.total_starts-a.total_starts || a.class_name.localeCompare(b.class_name,'sv')).map((row,index)=><tr key={row.class_id}><td>{index+1}</td><td><strong>{row.class_name}</strong></td><td>{row.total_starts}</td><td>{row.athlete_count}</td></tr>)}</tbody></table></div></section>
          </div>
        </>}
      </section>;
    })}
  </>;
}

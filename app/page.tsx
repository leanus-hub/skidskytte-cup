import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SummarySelector from './components/summary-selector';
import AthleteSearch from './components/athlete-search';
import ShootingAnalysis from './components/shooting-analysis';

export const dynamic = 'force-dynamic';

type Region = { id:string; name:string; sort_order:number };
type Cup = { id:string; name:string; season_id:string; region_id:string|null };
type CompetitionClass = { id:string; name:string; sort_order:number };
type Standing = {
  cup_id: string; cup_name: string; season_name: string; class_id: string; class_name: string;
  athlete_id: string; athlete_name: string; club_name: string; cup_place: number; total_points: number;
  races_participated: number; races_counted: number; published_race_count: number; dropped_race_count: number;
  shooting_percentage: number | null; eligible_for_prize: boolean;
};
type Breakdown = { cup_id:string; class_id:string; class_name:string; athlete_id:string; athlete_name:string; club_id:string; club_name:string; race_id:string; race_name:string; sort_order:number; region_place:number; cup_points:number; shooting_hits:number|null; shooting_shots:number|null; is_counted:boolean };
type ClassStanding = { cup_id:string; cup_name:string; season_name:string; class_id:string; class_name:string; athlete_count:number; total_points:number; total_starts:number; shooting_percentage:number|null };
type ClubStanding = { cup_id:string; cup_name:string; season_name:string; club_id:string; club_name:string; club_place:number; athlete_count:number; total_points:number; total_starts:number; gold:number; silver:number; bronze:number; medals:number; shooting_hits:number; shooting_shots:number; shooting_percentage:number|null; medal_points:number; medal_place:number };
type PlannedRace = { id:string; cup_id:string; name:string; race_date:string|null; sort_order:number; status:string; import_status:string; source_url:string|null; location:string|null; organizer_club_id:string|null; clubs:{name:string}|null };
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
  return [...rows].sort((a,b)=>a.medal_place-b.medal_place || a.club_name.localeCompare(b.club_name,'sv'));
}
function medalIcons(row: ClubStanding) {
  return `🥇 ${row.gold} · 🥈 ${row.silver} · 🥉 ${row.bronze}`;
}

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams;
  const view = ['overview','individual','class','club','statistics','shooting'].includes(params.view ?? '') ? params.view! : 'overview';
  const clubView = params.clubView === 'medals' ? 'medals' : 'points';
  const athleteQuery = (params.q ?? '').trim();
  const normalizedAthleteQuery = athleteQuery.toLocaleLowerCase('sv-SE');
  const supabase = await createClient();
  const [{data:regionRows,error:regionsError},{data:cupRows,error:cupsError},{data:competitionClassRows},{data:standings,error},{data:breakdown},{data:classRows},{data:clubRows},{data:raceStats},{data:plannedRaceRows},{data:shootingGroups},{data:shootingGroupMembers}] = await Promise.all([
    supabase.from('regions').select('id,name,sort_order').order('sort_order'),
    supabase.from('cups').select('id,name,season_id,region_id').order('created_at', { ascending: false }),
    supabase.from('classes').select('id,name,sort_order').order('sort_order'),
    supabase.from('cup_standings').select('*').order('cup_name').order('class_name').order('cup_place'),
    supabase.from('cup_result_breakdown').select('cup_id,class_id,class_name,athlete_id,athlete_name,club_id,club_name,race_id,race_name,sort_order,region_place,cup_points,shooting_hits,shooting_shots,is_counted').order('race_date').order('sort_order'),
    supabase.from('cup_class_standings').select('*').order('cup_name').order('class_name'),
    supabase.from('cup_club_standings').select('*').order('cup_name').order('club_place'),
    supabase.from('cup_race_statistics').select('*').order('cup_name').order('sort_order').order('race_date'),
    supabase.from('races').select('id,cup_id,name,race_date,sort_order,status,import_status,source_url,location,organizer_club_id,clubs:organizer_club_id(name)').order('sort_order').order('race_date'),
    supabase.from('shooting_analysis_groups').select('id,name,description').eq('active',true).order('name'),
    supabase.from('shooting_analysis_group_members').select('group_id,athlete_id'),
  ]);

  if (regionsError || cupsError || error) {
    console.error('Failed to load public cup summary', {
      regions: regionsError,
      cups: cupsError,
      standings: error,
    });
  }

  const regions = (regionRows ?? []) as Region[];
  const cups = (cupRows ?? []) as unknown as Cup[];
  const competitionClasses = (competitionClassRows ?? []) as CompetitionClass[];
  const classSortOrder = new Map(competitionClasses.map(row => [row.id,row.sort_order]));
  const individual = (standings ?? []) as Standing[];
  const details = (breakdown ?? []) as Breakdown[];
  const classes = (classRows ?? []) as ClassStanding[];
  const clubs = (clubRows ?? []) as ClubStanding[];
  const statistics = (raceStats ?? []) as RaceStatistic[];
  const plannedRaces = (plannedRaceRows ?? []) as unknown as PlannedRace[];
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
      <Link className={view==='overview'?'active':''} href={href({region:selectedRegionId,cup:selectedCupId,view:'overview'})}>Översikt</Link>
      <Link className={view==='individual'?'active':''} href={href({region:selectedRegionId,cup:selectedCupId,view:'individual'})}>Individuellt</Link>
      <Link className={view==='class'?'active':''} href={href({region:selectedRegionId,cup:selectedCupId,view:'class'})}>Klasser</Link>
      <Link className={view==='club'?'active':''} href={href({region:selectedRegionId,cup:selectedCupId,view:'club',clubView})}>Klubbar</Link>
      <Link className={view==='statistics'?'active':''} href={href({region:selectedRegionId,cup:selectedCupId,view:'statistics'})}>Cupstatistik</Link>
      <Link className={view==='shooting'?'active':''} href={href({region:selectedRegionId,cup:selectedCupId,view:'shooting'})}>Skytteanalys</Link>
    </nav>

    {view==='individual' && <AthleteSearch initialValue={athleteQuery} />}

    {(regionsError || cupsError) && <div className="card"><h2>Regioner eller cuper kunde inte hämtas</h2><p className="muted">Försök igen senare. Om problemet kvarstår, kontakta administratören.</p></div>}
    {error && <div className="card"><h2>Cupresultaten kunde inte hämtas</h2><p className="muted">Försök igen senare. Om problemet kvarstår, kontakta administratören.</p></div>}
    {!error && cupIds.length===0 && <div className="card"><h2>Inga cuper för {selectedRegion?.name ?? 'vald region'}</h2></div>}

    {visibleCups.map(cup => {
      const cupId = cup.id;
      const meta = individual.find(r=>r.cup_id===cupId) ?? classes.find(r=>r.cup_id===cupId) ?? clubs.find(r=>r.cup_id===cupId) ?? statistics.find(r=>r.cup_id===cupId);
      const cupStatistics = statistics.filter(r=>r.cup_id===cupId);
      const cupPlan = plannedRaces.filter(r=>r.cup_id===cupId).sort((a,b)=>a.sort_order-b.sort_order || String(a.race_date??'').localeCompare(String(b.race_date??'')));
      const today = new Date().toISOString().slice(0,10);
      const nextRace = cupPlan.find(r=>r.status!=='cancelled' && r.race_date && r.race_date>=today && r.status!=='published');
      const cupIndividuals = individual.filter(r=>r.cup_id===cupId);
      const filteredCupIndividuals = normalizedAthleteQuery
        ? cupIndividuals.filter(row => row.athlete_name.toLocaleLowerCase('sv-SE').includes(normalizedAthleteQuery))
        : cupIndividuals;
      const cupClasses = classes.filter(r=>r.cup_id===cupId);
      const cupClubs = clubs.filter(r=>r.cup_id===cupId);
      const maxRaceStarts=Math.max(0,...cupStatistics.map(r=>r.regional_participants));
      const biggestRaces=cupStatistics.filter(r=>r.regional_participants===maxRaceStarts);
      const positiveRaces=cupStatistics.filter(r=>r.regional_participants>0);
      const minRaceStarts=positiveRaces.length?Math.min(...positiveRaces.map(r=>r.regional_participants)):0;
      const smallestRaces=positiveRaces.filter(r=>r.regional_participants===minRaceStarts);
      const pointsLeader = [...cupClubs].sort((a,b)=>b.total_points-a.total_points || a.club_name.localeCompare(b.club_name,'sv'))[0];
      const medalLeader = medalRank(cupClubs)[0];
      const maxClubStarts=Math.max(0,...cupClubs.map(r=>r.total_starts));
      const mostActiveClubs=cupClubs.filter(r=>r.total_starts===maxClubStarts).sort((a,b)=>a.club_name.localeCompare(b.club_name,'sv'));
      const maxClassStarts=Math.max(0,...cupClasses.map(r=>r.total_starts));
      const mostActiveClasses=cupClasses.filter(r=>r.total_starts===maxClassStarts).sort((a,b)=>a.class_name.localeCompare(b.class_name,'sv'));
      const maxAthleteStarts = Math.max(0,...cupIndividuals.map(r=>r.races_participated));
      const mostActiveAthletes = cupIndividuals.filter(r=>r.races_participated===maxAthleteStarts).sort((a,b)=>a.athlete_name.localeCompare(b.athlete_name,'sv'));
      const pointAverageRows = cupIndividuals.filter(r=>r.races_participated>=3 && r.races_counted>0);
      const maxPointAverage = Math.max(0,...pointAverageRows.map(r=>safeAverage(r.total_points,r.races_counted)));
      const bestPointAverageAthletes = pointAverageRows.filter(r=>Math.abs(safeAverage(r.total_points,r.races_counted)-maxPointAverage)<0.000001).sort((a,b)=>a.athlete_name.localeCompare(b.athlete_name,'sv'));
      const clubEfficiencyRows = cupClubs.filter(r=>r.total_starts>=10);
      const maxClubEfficiency = Math.max(0,...clubEfficiencyRows.map(r=>safeAverage(r.total_points,r.total_starts)));
      const bestClubEfficiencyClubs = clubEfficiencyRows.filter(r=>Math.abs(safeAverage(r.total_points,r.total_starts)-maxClubEfficiency)<0.000001).sort((a,b)=>a.club_name.localeCompare(b.club_name,'sv'));
      const maxClubAthletes=Math.max(0,...cupClubs.map(r=>r.athlete_count));
      const clubsWithMostAthletes=cupClubs.filter(r=>r.athlete_count===maxClubAthletes).sort((a,b)=>a.club_name.localeCompare(b.club_name,'sv'));
      const shootingRows=cupIndividuals.filter(r=>r.races_participated>=3 && r.shooting_percentage!=null);
      const maxShooting=Math.max(0,...shootingRows.map(r=>Number(r.shooting_percentage)));
      const bestShooters=shootingRows.filter(r=>Math.abs(Number(r.shooting_percentage)-maxShooting)<0.000001).sort((a,b)=>a.athlete_name.localeCompare(b.athlete_name,'sv'));
      const totalRegionalStarts = cupStatistics.reduce((sum,row)=>sum+row.regional_participants,0);
      return <section key={cupId} className="cup-section">
        <div className="section-heading"><div><p className="eyebrow dark">{meta?.season_name ?? selectedRegion?.name}</p><h2>{cup.name}</h2><p className="section-subtitle">{selectedRegion?.name}</p></div></div>

        <section className="cup-dashboard" aria-label={`Översikt för ${cup.name}`}>
          <div className="dashboard-metric"><span>Unika åkare</span><strong>{cupIndividuals.length}</strong></div>
          <div className="dashboard-metric"><span>Deltävlingar</span><strong>{cupStatistics.length}</strong></div>
          <div className="dashboard-metric"><span>Deltagande klubbar</span><strong>{cupClubs.length}</strong></div>
          <div className="dashboard-metric"><span>Regionala starter</span><strong>{totalRegionalStarts}</strong></div>
          <div className="dashboard-leader"><span>Poängligan</span><strong>{pointsLeader?.club_name ?? '–'}</strong><small>{pointsLeader ? `${pointsLeader.total_points} poäng` : 'Inga resultat'}</small></div>
          <div className="dashboard-leader"><span>Medaljligan</span><strong>{medalLeader?.club_name ?? '–'}</strong><small>{medalLeader ? `${medalLeader.medal_points} medaljpoäng · ${medalLeader.gold} guld` : 'Inga resultat'}</small></div>
        </section>

        {view==='overview' && <>
          {nextRace && <section className="card next-race-card"><div><p className="eyebrow dark">Nästa deltävling</p><h3>{nextRace.name}</h3><p className="muted">{nextRace.race_date}{nextRace.location?` · ${nextRace.location}`:''}{nextRace.clubs?.name?` · ${nextRace.clubs.name}`:''}</p></div><span className="next-race-date">{nextRace.race_date?.slice(5).replace('-','/')}</span></section>}
          <section className="card cup-calendar"><div className="calendar-heading"><div><h3>Tävlingskalender</h3><p className="muted">Cupens planerade och genomförda deltävlingar.</p></div><span className="badge">{cupPlan.length} deltävlingar</span></div>
            {cupPlan.length===0?<p className="muted">Ingen tävlingsplan publicerad ännu.</p>:<div className="calendar-list">{cupPlan.map((race,index)=>{
              const published=race.status==='published', cancelled=race.status==='cancelled', upcoming=!cancelled&&!published&&!!race.race_date&&race.race_date>=today;
              const label=cancelled?'Inställd':published?'Resultat publicerade':race.import_status==='imported'?'Resultat importerade':upcoming?'Kommande':'Planerad';
              return <article className={`calendar-race ${published?'completed':''} ${cancelled?'cancelled':''} ${nextRace?.id===race.id?'next':''}`} key={race.id}><span className="calendar-step">{published?'✓':index+1}</span><div className="calendar-race-main"><strong>{race.name}</strong><p>{race.race_date??'Datum ej satt'}{race.location?` · ${race.location}`:''}{race.clubs?.name?` · ${race.clubs.name}`:''}</p></div><span className="badge">{label}</span>{published&&<Link className="calendar-result-link" href={`/tavlingar/${race.id}`}>Visa resultat →</Link>}</article>;
            })}</div>}
          </section>
          <section className="overview-shortcuts">
            <Link href={href({region:selectedRegionId,cup:selectedCupId,view:'individual'})}><strong>Individuellt</strong><span>Ställning & åkare →</span></Link>
            <Link href={href({region:selectedRegionId,cup:selectedCupId,view:'club',clubView:'points'})}><strong>Klubbkamp</strong><span>Poängliga →</span></Link>
            <Link href={href({region:selectedRegionId,cup:selectedCupId,view:'club',clubView:'medals'})}><strong>Medaljliga</strong><span>Medaljer →</span></Link>
            <Link href={href({region:selectedRegionId,cup:selectedCupId,view:'statistics'})}><strong>Statistik</strong><span>Deltävlingar & data →</span></Link>
          </section>
        </>}

        {view==='individual' && cupIndividuals.length === 0 && <div className="card empty-state"><h3>Inga publicerade individuella resultat ännu</h3><p className="muted">Cupen är korrekt kopplad till regionen, men sammanställningen innehåller ännu inga rader. Kontrollera att en tävling är importerad och publicerad.</p></div>}
        {view==='individual' && cupIndividuals.length > 0 && athleteQuery && filteredCupIndividuals.length === 0 && <div className="card empty-state"><h3>Ingen åkare hittades</h3><p className="muted">Ingen åkare i den valda cupen matchar “{athleteQuery}”. Prova ett annat namn eller rensa sökningen.</p></div>}
        {view==='class' && cupClasses.length === 0 && <div className="card empty-state"><h3>Ingen klassammanställning ännu</h3><p className="muted">Publicera minst en importerad deltävling för cupen.</p></div>}
        {view==='club' && cupClubs.length === 0 && <div className="card empty-state"><h3>Ingen klubbsammanställning ännu</h3><p className="muted">Klubbpoäng visas när publicerade resultat finns.</p></div>}

        {view==='shooting' && <ShootingAnalysis rows={details.filter(d=>d.cup_id===cupId)} groups={(shootingGroups??[]).map(g=>({...g,athlete_ids:(shootingGroupMembers??[]).filter(m=>m.group_id===g.id).map(m=>m.athlete_id)}))} />}
        {view==='statistics' && cupStatistics.length === 0 && <div className="card empty-state"><h3>Ingen cupstatistik ännu</h3><p className="muted">Statistik visas när cupens deltävlingar har importerats och publicerats.</p></div>}

        {view==='individual' && Array.from(new Set(filteredCupIndividuals.map(r=>r.class_name))).sort((a,b)=>{
          const aRow=filteredCupIndividuals.find(r=>r.class_name===a), bRow=filteredCupIndividuals.find(r=>r.class_name===b);
          return (classSortOrder.get(aRow?.class_id??'')??9999)-(classSortOrder.get(bRow?.class_id??'')??9999) || a.localeCompare(b,'sv');
        }).map(className => {
          const rows=filteredCupIndividuals.filter(r=>r.class_name===className);
          return <section key={className} className="card standings-card"><h3>{className}</h3><div className="table-scroll"><table>
            <thead><tr><th>Plats</th><th>Åkare</th><th>Klubb</th><th>Poäng</th><th>Skytte</th><th>Starter</th><th>Pris</th></tr></thead>
            <tbody>{rows.map((row,index) => {
              const athleteDetails=details.filter(d=>d.cup_id===row.cup_id&&d.class_id===row.class_id&&d.athlete_id===row.athlete_id);
              const droppedCount=athleteDetails.filter(d=>!d.is_counted).length;
              const nextRow=index>0?rows[index-1]:null;
              const gapToNext=nextRow?Math.max(0,nextRow.total_points-row.total_points):null;
              return <tr key={`${row.class_id}-${row.athlete_id}`} className={row.cup_place<=3?'individual-podium':''}><td><strong>{row.cup_place}</strong></td><td><details><summary>{row.athlete_name}</summary><Link className="athlete-profile-link" href={`/akare/${row.athlete_id}`}>Visa åkarprofil →</Link><div className="athlete-summary"><span><strong>{row.total_points}</strong> poäng</span><span>{row.races_counted}/{row.races_participated} starter räknas</span>{droppedCount>0&&<span>{droppedCount} strukna</span>}{gapToNext!==null&&<span>{gapToNext===0?'Delad poäng med placeringen före':`${gapToNext} p till placeringen före`}</span>}</div><div className="result-detail"><table><thead><tr><th>Deltävling</th><th>Plac.</th><th>Poäng</th><th>Skytte</th><th>Räknas</th></tr></thead><tbody>{athleteDetails.map(result=><tr key={result.race_id} className={result.is_counted?'':'dropped'}><td>{result.race_name}</td><td>{result.region_place}</td><td><strong>{result.cup_points}</strong></td><td>{shootingLabel(result)}</td><td>{result.is_counted?<span className="counted-result">✓ Räknas</span>:<span>Struken</span>}</td></tr>)}</tbody></table></div></details></td><td>{row.club_name}</td><td><strong>{row.total_points}</strong>{gapToNext!==null&&<small className="points-gap">{gapToNext===0?'Delad':`−${gapToNext} p`}</small>}</td><td>{pct(row.shooting_percentage)}</td><td>{row.races_participated}<small className="starts-detail">{row.races_counted} räknas{droppedCount? ` · ${droppedCount} strukna`:''}</small></td><td>{row.eligible_for_prize?<span className="badge success-badge">Kvalificerad</span>:<span className="badge">Minst 3 krävs</span>}</td></tr>;
            })}</tbody>
          </table></div></section>;
        })}

        {view==='class' && <section className="card standings-card"><h3>Sammanställning per klass</h3><div className="table-scroll"><table><thead><tr><th>Klass</th><th>Aktiva</th><th>Starter</th><th>Samlad poäng</th><th>Träffprocent</th></tr></thead><tbody>{classes.filter(r=>r.cup_id===cupId).sort((a,b)=>(classSortOrder.get(a.class_id)??9999)-(classSortOrder.get(b.class_id)??9999) || a.class_name.localeCompare(b.class_name,'sv')).map(row=><tr key={row.class_id}><td><strong>{row.class_name}</strong></td><td>{row.athlete_count}</td><td>{row.total_starts}</td><td>{row.total_points}</td><td>{pct(row.shooting_percentage)}</td></tr>)}</tbody></table></div></section>}

        {view==='club' && <>
          <nav className="sub-tabs" aria-label="Klubbliga">
            <Link className={clubView==='points'?'active':''} href={href({region:selectedRegionId,cup:selectedCupId,view:'club',clubView:'points'})}>Poängliga</Link>
            <Link className={clubView==='medals'?'active':''} href={href({region:selectedRegionId,cup:selectedCupId,view:'club',clubView:'medals'})}>Medaljliga</Link>
          </nav>
          {clubView==='points' && <section className="card standings-card"><h3>Klubbarnas poängliga</h3><p className="table-note">Alla giltiga regionala resultat räknas i klubbkampen. Placering efter total cup-poäng; träffprocent används som skiljekriterium.</p><div className="table-scroll"><table><thead><tr><th>Plats</th><th>Klubb</th><th>Aktiva</th><th>Poäng</th><th>Starter</th><th>Poäng/start</th><th>Skytte</th></tr></thead><tbody>{clubs.filter(r=>r.cup_id===cupId).sort((a,b)=>a.club_place-b.club_place).map((row,index)=><tr key={row.club_id} className={index<3?'league-podium':''}><td><strong>{row.club_place}</strong></td><td><Link className="club-profile-link" href={`/klubbar/${row.club_id}`}><strong>{row.club_name}</strong><small className="club-medal-summary">{medalIcons(row)}</small><span>Visa klubbprofil →</span></Link></td><td>{row.athlete_count}</td><td><strong>{row.total_points}</strong></td><td>{row.total_starts}</td><td>{safeAverage(row.total_points,row.total_starts).toFixed(2)}</td><td>{pct(row.shooting_percentage)}</td></tr>)}</tbody></table></div></section>}
          {clubView==='medals' && <section className="card standings-card"><h3>Klubbarnas medaljliga</h3><p className="table-note">Guld = 3, silver = 2 och brons = 1 medaljpoäng. Vid lika medaljpoäng avgör antal guld och därefter silver. Öppen Klass räknas inte in.</p><div className="table-scroll"><table><thead><tr><th>Plats</th><th>Klubb</th><th>Medaljpoäng</th><th>Guld</th><th>Silver</th><th>Brons</th><th>Medaljer</th></tr></thead><tbody>{medalRank(clubs.filter(r=>r.cup_id===cupId)).map((row,index)=><tr key={row.club_id} className={index<3?'league-podium':''}><td><strong>{row.medal_place}</strong></td><td><strong>{row.club_name}</strong><small className="club-medal-summary">{medalIcons(row)}</small></td><td><strong>{row.medal_points}</strong></td><td>{row.gold}</td><td>{row.silver}</td><td>{row.bronze}</td><td>{row.medals}</td></tr>)}</tbody></table></div></section>}
        </>}

        {view==='statistics' && <>
          <section className="insight-grid">
            <article className="card insight-card"><span>Största deltävling</span><strong>{biggestRaces.length===1?biggestRaces[0].race_name:biggestRaces.length>1?`${biggestRaces.length} deltävlingar`:'–'}</strong><small>{biggestRaces.length?`${maxRaceStarts} regionala starter`:'Ingen statistik'}</small>{biggestRaces.length>1&&<details className="insight-ties"><summary>Visa deltävlingarna</summary><p>{biggestRaces.map(r=>r.race_name).join(' · ')}</p></details>}</article>
            <article className="card insight-card"><span>Minsta deltävling</span><strong>{smallestRaces.length===1?smallestRaces[0].race_name:smallestRaces.length>1?`${smallestRaces.length} deltävlingar`:'–'}</strong><small>{smallestRaces.length?`${minRaceStarts} regionala starter`:'Ingen statistik'}</small>{smallestRaces.length>1&&<details className="insight-ties"><summary>Visa deltävlingarna</summary><p>{smallestRaces.map(r=>r.race_name).join(' · ')}</p></details>}</article>
            <article className="card insight-card"><span>Mest aktiv klubb</span><strong>{mostActiveClubs.length===1?mostActiveClubs[0].club_name:mostActiveClubs.length>1?`${mostActiveClubs.length} klubbar`:'–'}</strong><small>{mostActiveClubs.length?`${maxClubStarts} starter`:'Ingen statistik'}</small>{mostActiveClubs.length>1&&<details className="insight-ties"><summary>Visa klubbarna</summary><p>{mostActiveClubs.map(r=>r.club_name).join(' · ')}</p></details>}</article>
            <article className="card insight-card"><span>Mest aktiv klass</span><strong>{mostActiveClasses.length===1?mostActiveClasses[0].class_name:mostActiveClasses.length>1?`${mostActiveClasses.length} klasser`:'–'}</strong><small>{mostActiveClasses.length?`${maxClassStarts} starter`:'Ingen statistik'}</small>{mostActiveClasses.length>1&&<details className="insight-ties"><summary>Visa klasserna</summary><p>{mostActiveClasses.map(r=>r.class_name).join(' · ')}</p></details>}</article>
            <article className="card insight-card"><span>Flest starter per åkare</span><strong>{mostActiveAthletes.length===1?mostActiveAthletes[0].athlete_name:mostActiveAthletes.length>1?`${mostActiveAthletes.length} åkare`:'–'}</strong><small>{mostActiveAthletes.length?`${maxAthleteStarts} starter`:'Ingen statistik'}</small>{mostActiveAthletes.length>1&&<details className="insight-ties"><summary>Visa åkarna</summary><p>{mostActiveAthletes.map(r=>r.athlete_name).join(' · ')}</p></details>}</article>
            <article className="card insight-card"><span>Högst poängsnitt</span><strong>{bestPointAverageAthletes.length===1?bestPointAverageAthletes[0].athlete_name:bestPointAverageAthletes.length>1?`${bestPointAverageAthletes.length} åkare`:'–'}</strong><small>{bestPointAverageAthletes.length?`${maxPointAverage.toFixed(2)} p/räknad start · minst 3 starter`:'Ingen statistik'}</small>{bestPointAverageAthletes.length>1&&<details className="insight-ties"><summary>Visa åkarna</summary><p>{bestPointAverageAthletes.map(r=>r.athlete_name).join(' · ')}</p></details>}</article>
            <article className="card insight-card"><span>Effektivaste klubb</span><strong>{bestClubEfficiencyClubs.length===1?bestClubEfficiencyClubs[0].club_name:bestClubEfficiencyClubs.length>1?`${bestClubEfficiencyClubs.length} klubbar`:'–'}</strong><small>{bestClubEfficiencyClubs.length?`${maxClubEfficiency.toFixed(2)} p/start · minst 10 starter`:'Ingen statistik'}</small>{bestClubEfficiencyClubs.length>1&&<details className="insight-ties"><summary>Visa klubbarna</summary><p>{bestClubEfficiencyClubs.map(r=>r.club_name).join(' · ')}</p></details>}</article>
            <article className="card insight-card"><span>Flest unika åkare</span><strong>{clubsWithMostAthletes.length===1?clubsWithMostAthletes[0].club_name:clubsWithMostAthletes.length>1?`${clubsWithMostAthletes.length} klubbar`:'–'}</strong><small>{clubsWithMostAthletes.length?`${maxClubAthletes} åkare`:'Ingen statistik'}</small></article>
            <article className="card insight-card"><span>Bäst skytte</span><strong>{bestShooters.length===1?bestShooters[0].athlete_name:bestShooters.length>1?`${bestShooters.length} åkare`:'–'}</strong><small>{bestShooters.length?`${maxShooting.toFixed(2)} % · minst 3 starter`:'Ingen statistik'}</small>{bestShooters.length>1&&<details className="insight-ties"><summary>Visa åkarna</summary><p>{bestShooters.map(r=>r.athlete_name).join(' · ')}</p></details>}</article>
          </section>
          <section className="card stats-summary"><strong>{cupStatistics.length}</strong><span>deltävlingar</span><strong>{totalRegionalStarts}</strong><span>regionala starter</span><strong>{cupIndividuals.length}</strong><span>unika åkare</span><strong>{cupClubs.length}</strong><span>klubbar</span></section><section className="card standings-card"><h3>Deltävlingar</h3><div className="table-scroll"><table><thead><tr><th>Deltävling</th><th>Datum</th><th>Regionala</th><th>Totalt</th><th>Klubbar</th><th>Klasser</th><th>Skytte</th></tr></thead><tbody>{cupStatistics.map(row=><tr key={row.race_id}><td><Link className="race-link" href={`/tavlingar/${row.race_id}`}><strong>{row.race_name}</strong><span>Visa resultat →</span></Link></td><td>{row.race_date ?? '–'}</td><td>{row.regional_participants}</td><td>{row.all_participants}</td><td>{row.regional_clubs}</td><td>{row.regional_classes}</td><td>{pct(row.shooting_percentage)}</td></tr>)}</tbody></table></div></section>
        </>}
      </section>;
    })}
  </>;
}

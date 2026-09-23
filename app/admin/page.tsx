import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { addClassAlias, createCup, createSeason, deletePlannedRace, inviteAdmin, logout, setAdminRole, setRaceStatus, updatePlannedRace, movePlannedRace, updateCupSettings, cloneRuleset, updateRulesetSettings, updateRulesetClassRule, updateFeedbackItem, mergeAthletes, createShootingGroup, deleteShootingGroup } from './admin-actions';
import { importRaceResultsSafe } from './import-actions';
import { previewExternalResults, approveExternalPreview, resolveExternalAthlete, confirmExternalNewAthlete } from './external-import-actions';
import ClubManager from './club-manager';
import CupPlanBuilder from './cup-plan-builder';

export const dynamic = 'force-dynamic';

type Params = Record<string, string | undefined>;
function adminHref(section: string, params: Record<string,string|undefined> = {}) {
  const search = new URLSearchParams({ section });
  Object.entries(params).forEach(([key,value]) => value && search.set(key,value));
  return `/admin?${search.toString()}`;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const section = ['season','cup','rules','plan','import','external','feedback','classes','clubs','athletes','admins'].includes(params.section ?? '') ? params.section! : 'home';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  const { data: profile } = await supabase.from('profiles').select('display_name,is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect('/admin/login?error=not-admin');

  const [{ data: seasons }, { data: cups }, { data: races }, { data: classes }, { data: regions }, { data: rulesets }] = await Promise.all([
    supabase.from('seasons').select('id,name,is_active,starts_on,ends_on').order('starts_on', { ascending: false }),
    supabase.from('cups').select('id,name,cup_type,region_id,season_id,ruleset_id,min_races_for_prize,active,lifecycle_status').order('created_at', { ascending: false }),
    supabase.from('races').select('id,name,race_date,status,cup_id,external_race_id,source_url,location,organizer_club_id,sort_order,import_status,import_error,imported_result_count,imported_at,import_warnings').order('race_date', { ascending: false }),
    supabase.from('classes').select('id,name,aliases,sort_order').eq('is_official', true).order('sort_order').order('name'),
    supabase.from('regions').select('id,name').order('sort_order'),
    supabase.from('cup_rulesets').select('id,name,description,points_by_place,participation_points,drop_schedule,min_races_for_prize,club_points_use_all,club_min_races_per_athlete,medal_league_enabled').eq('active',true).order('name'),
  ]);

  let athletesAdmin: {id:string;full_name:string;club_id:string|null;birth_year:number|null;aliases:string[]|null;merged_into_id:string|null;results?:{count:number}[]}[] = [];
  let athleteResultRows: {athlete_id:string;race_id:string;class_id:string}[] = [];
  let shootingGroupsAdmin: {id:string;name:string;description:string|null;active:boolean}[]=[];
  let shootingGroupMembersAdmin: {group_id:string;athlete_id:string}[]=[];
  if (section === 'athletes') {
    const [{data:a,error:ae},{data:rr,error:re},{data:sg,error:sge},{data:sgm,error:sgme}] = await Promise.all([
      supabase.from('athletes').select('id,full_name,club_id,birth_year,aliases,merged_into_id').order('full_name'),
      supabase.from('results').select('athlete_id,race_id,class_id'),
      supabase.from('shooting_analysis_groups').select('id,name,description,active').order('name'),
      supabase.from('shooting_analysis_group_members').select('group_id,athlete_id'),
    ]);
    if(ae) throw new Error(`Kunde inte läsa åkare: ${ae.message}`);
    if(re) throw new Error(`Kunde inte läsa åkarresultat: ${re.message}`);
    if(sge) throw new Error(`Kunde inte läsa analysgrupper: ${sge.message}`);
    if(sgme) throw new Error(`Kunde inte läsa gruppmedlemmar: ${sgme.message}`);
    athletesAdmin=a??[]; athleteResultRows=rr??[]; shootingGroupsAdmin=sg??[]; shootingGroupMembersAdmin=sgm??[];
  }

  let feedbackItems: {id:string;created_at:string;type:string;status:string;priority:string;message:string;name:string|null;email:string|null;page_url:string|null;admin_note:string|null;roadmap_ref:string|null}[] = [];
  if (section === 'feedback') {
    const { data, error } = await supabase.from('feedback_items').select('*').order('created_at',{ascending:false});
    if (error) throw new Error(`Kunde inte läsa ärenden: ${error.message}`);
    feedbackItems = data ?? [];
  }

  let rulesetClassRules: {ruleset_id:string;class_id:string;scoring_mode:string;fixed_points:number|null;medal_eligible:boolean}[] = [];
  if (section === 'rules') {
    const { data, error } = await supabase.from('cup_ruleset_class_rules').select('ruleset_id,class_id,scoring_mode,fixed_points,medal_eligible');
    if (error) throw new Error(`Kunde inte läsa klassregler: ${error.message}`);
    rulesetClassRules = data ?? [];
  }

  const selectedRegionId = params.region ?? regions?.[0]?.id ?? '';
  let adminProfiles: { id: string; display_name: string | null; is_admin: boolean }[] = [];
  if (section === 'admins') {
    const { data, error } = await supabase.from('profiles').select('id,display_name,is_admin').order('display_name');
    if (error) throw new Error(`Kunde inte läsa användare: ${error.message}`);
    adminProfiles = data ?? [];
  }
  let clubs: {id:string;name:string;short_name:string|null;aliases:string[]|null;region_id:string|null}[] = [];
  if (section === 'clubs' || section === 'plan') {
    const { data, error } = await supabase.from('clubs').select('id,name,short_name,aliases,region_id').order('name');
    if (error) throw new Error(`Kunde inte läsa föreningar: ${error.message}`);
    clubs = data ?? [];
  }

  const reviewSummaryByRace = new Map<string, { info: number; needsReview: number }>();
  if (section === 'import') {
    const { data: reviewRows, error: reviewError } = await supabase
      .from('race_result_review')
      .select('race_id,review_warning');
    if (reviewError) throw new Error(`Kunde inte läsa resultatgranskning: ${reviewError.message}`);

    for (const row of reviewRows ?? []) {
      if (!row.review_warning) continue;
      const current = reviewSummaryByRace.get(row.race_id) ?? { info: 0, needsReview: 0 };
      const warning = String(row.review_warning);
      if (warning === 'Status UNKNOWN') current.needsReview += 1;
      else current.info += 1;
      reviewSummaryByRace.set(row.race_id, current);
    }
  }

  const seasonNameById = new Map((seasons ?? []).map(season => [season.id, season.name]));
  const regionNameById = new Map((regions ?? []).map(region => [region.id, region.name]));
  const clubNameById = new Map(clubs.map(club => [club.id, club.name]));
  const cupNameById = new Map((cups ?? []).map(cup => [cup.id, cup.name]));

  let externalImports: {id:string;source_type:string;source_name:string;event_name:string|null;event_date:string|null;status:string;row_count:number;created_at:string}[]=[];
  let externalRows: {id:string;source_row:number;athlete_name:string;club_name:string|null;class_name:string|null;place:number|null;status:string|null;shooting:number[];match_status:string;match_note:string|null}[]=[];
  if(section==='external'){
    if(!athletesAdmin.length){const {data:a,error:ae}=await supabase.from('athletes').select('id,full_name,club_id,birth_year,aliases,merged_into_id').is('merged_into_id',null).order('full_name');if(ae)throw new Error('Kunde inte läsa åkare: '+ae.message);athletesAdmin=a??[];}
    const {data:ei,error:eie}=await supabase.from('external_result_imports').select('id,source_type,source_name,event_name,event_date,status,row_count,created_at').order('created_at',{ascending:false}).limit(20);
    if(eie) throw new Error('Kunde inte läsa externa importer: '+eie.message); externalImports=ei??[];
    if(params.batch){const {data:er,error:ere}=await supabase.from('external_result_rows').select('id,source_row,athlete_name,club_name,class_name,place,status,shooting,match_status,match_note').eq('import_id',params.batch).order('source_row');if(ere)throw new Error('Kunde inte läsa preview: '+ere.message);externalRows=er??[];}
  }

  const today = new Date().toISOString().slice(0,10);
  const cupDashboard = (cups ?? []).map(cup => {
    const cupRaces = (races ?? []).filter(r => r.cup_id === cup.id);
    const published = cupRaces.filter(r => r.status === 'published').length;
    const cancelled = cupRaces.filter(r => r.status === 'cancelled').length;
    const imported = cupRaces.filter(r => r.status !== 'published' && r.import_status === 'imported').length;
    const ready = cupRaces.filter(r => r.status !== 'published' && r.import_status !== 'imported' && !!r.source_url).length;
    const planned = cupRaces.filter(r => r.status !== 'published' && r.status !== 'cancelled' && r.import_status !== 'imported' && !r.source_url).length;
    const failed = cupRaces.filter(r => r.import_status === 'failed').length;
    const nextRace = [...cupRaces].filter(r => r.status !== 'published' && r.status !== 'cancelled' && r.race_date && r.race_date >= today).sort((a,b)=>String(a.race_date).localeCompare(String(b.race_date)) || (a.sort_order??0)-(b.sort_order??0))[0];
    return { cup, races: cupRaces.length, published, cancelled, imported, ready, planned, failed, nextRace };
  });

  const nav = [
    ['home','Översikt'], ['season','Ny säsong'], ['cup','Ny cup'], ['rules','Regelverk'], ['plan','Tävlingsplan'],
    ['import','Resultatflöde'], ['external','Externresultat'], ['feedback','Ärenden'], ['classes','Klassalias'], ['clubs','Regioner & föreningar'], ['athletes','Åkare'], ['admins','Administratörer'],
  ];

  return <>
    <section className="hero compact-hero admin-hero">
      <div className="hero-row"><div><p className="eyebrow">Administratör</p><h1>Cupadministration</h1><p>Välj en funktion och arbeta med en sak i taget.</p></div><form action={logout}><button className="secondary" type="submit">Logga ut</button></form></div>
    </section>

    <nav className="admin-tools" aria-label="Administrationsfunktioner">
      {nav.map(([key,label]) => <Link key={key} className={section===key?'active':''} href={adminHref(key)}>{label}</Link>)}
    </nav>

    {params.success && <p className="alert success">{params.success === 'import-complete' ? `Import klar: ${params.count ?? '0'} resultat hämtade. Nästa steg är att granska och publicera.` : params.success === 'race-published' ? 'Tävlingen är publicerad och resultaten syns nu i cupen.' : params.success === 'race-unpublished' ? 'Tävlingen är avpublicerad.' : 'Ändringen är sparad.'}</p>}
    {params.error && <div className="alert error">
      <strong>Något behöver åtgärdas:</strong> {params.error === 'cup-completed' ? 'Cupen är avslutad och låst. Ändra cupens status till Pågående om den behöver öppnas för ändringar.' : params.error === 'completed-metadata-only' ? 'Cupen är avslutad. Endast tävlingens namn kan rättas utan att öppna cupen igen.' : params.error === 'completed-ruleset-locked' ? 'Regelverket är låst för en avslutad cup. Öppna cupen igen innan regelverket byts.' : params.error === 'ruleset-locked' ? 'Regelverket används av en avslutad cup och är låst. Skapa en ny version för nästa säsong.' : params.error === 'ruleset-json' ? 'Poängtabellen eller strykningsschemat har fel format.' : params.error}
      {section === 'import' && params.error.startsWith('Okänd klubb:') && <p><Link href={adminHref('clubs')}>Öppna Regioner & föreningar och lägg till klubbnamnet som alias →</Link></p>}
      {section === 'import' && params.error.startsWith('Tvetydig klubb:') && <p><Link href={adminHref('clubs')}>Öppna Regioner & föreningar och kontrollera klubbnamnen →</Link></p>}
      {section === 'import' && params.error.startsWith('Okänd klass:') && <p><Link href={adminHref('classes')}>Öppna Klassalias och koppla namnet till rätt klass →</Link></p>}
      {section === 'import' && params.error.startsWith('Tvetydig klass:') && <p><Link href={adminHref('classes')}>Öppna Klassalias och kontrollera klassnamnen →</Link></p>}
    </div>}

    {section === 'home' && <>
      <section className="admin-cup-overview">
        <div className="admin-overview-heading"><div><p className="eyebrow dark">Aktuellt läge</p><h2>Cuper</h2></div><Link className="source-button" href={adminHref('cup')}>+ Ny cup</Link></div>
        <div className="admin-cup-grid">{cupDashboard.map(({cup,races:raceCount,published,cancelled,imported,ready,planned,failed,nextRace})=><article className="card admin-cup-card" key={cup.id}>
          <div className="admin-cup-title"><div><small>{seasonNameById.get(cup.season_id)??'Säsong saknas'} · {cup.region_id?regionNameById.get(cup.region_id)??'Okänd region':'Region saknas'}</small><h3>{cup.name}</h3></div>{failed>0&&<span className="badge admin-attention">{failed} importfel</span>}</div>
          <div className="admin-cup-metrics"><span><strong>{raceCount}</strong>Deltävlingar</span><span><strong>{published}</strong>Publicerade</span><span><strong>{ready}</strong>Redo för import</span><span><strong>{imported}</strong>Importerade</span><span><strong>{planned}</strong>Planerade</span>{cancelled>0&&<span><strong>{cancelled}</strong>Inställda</span>}</div>
          {nextRace?<div className="admin-next-race"><span>Nästa</span><strong>{nextRace.name}</strong><small>{nextRace.race_date}{nextRace.location?` · ${nextRace.location}`:''}</small></div>:<p className="muted admin-next-race-empty">{raceCount?'Ingen kommande planerad tävling.':'Ingen tävlingsplan ännu.'}</p>}
          <div className="admin-cup-links"><Link href={adminHref('plan',{cup:cup.id})}>Tävlingsplan →</Link>{ready+imported+failed>0&&<Link href={adminHref('import',{cup:cup.id})}>Import & publicering →</Link>}<Link href={`/?region=${cup.region_id??''}&cup=${cup.id}&view=overview`}>Publik vy ↗</Link></div>
        </article>)}</div>
      </section>
      <h2 className="admin-tools-heading">Administration</h2>
      <div className="admin-dashboard">
        <Link href={adminHref('season')} className="admin-action-card"><span>01</span><h2>Skapa säsong</h2><p>Lägg upp vinter- eller sommarsäsong innan du skapar cupen.</p></Link>
        <Link href={adminHref('cup')} className="admin-action-card"><span>02</span><h2>Skapa cup</h2><p>Välj säsong, typ och region för en ny regional cup.</p></Link>
        <Link href={adminHref('plan')} className="admin-action-card"><span>03</span><h2>Planera deltävlingar</h2><p>Lägg upp hela cupens tänkta tävlingskalender samlat.</p></Link>
        <Link href={adminHref('import')} className="admin-action-card"><span>04</span><h2>Importera & publicera</h2><p>Hämta resultat, granska och publicera deltävlingen.</p></Link>
        <Link href={adminHref('classes')} className="admin-action-card"><span>05</span><h2>Klassalias</h2><p>Koppla alternativa klassnamn till dina befintliga klasser.</p></Link>
        <Link href={adminHref('clubs')} className="admin-action-card"><span>06</span><h2>Regioner & föreningar</h2><p>Filtrera per region och redigera en förening i taget.</p></Link>
      </div>
    </>}

    {section === 'season' && <section className="card admin-workspace"><h2>Skapa ny säsong</h2><form action={createSeason}>
      <label htmlFor="season_name">Namn</label><input id="season_name" name="name" required placeholder="Säsong 2026/2027" />
      <div className="form-columns"><div><label htmlFor="starts_on">Startdatum</label><input id="starts_on" name="starts_on" type="date" required /></div><div><label htmlFor="ends_on">Slutdatum</label><input id="ends_on" name="ends_on" type="date" required /></div></div>
      <label className="check-row"><input type="checkbox" name="is_active" value="true" defaultChecked /> Aktiv säsong</label><button type="submit">Skapa säsong</button>
    </form><h3>Befintliga säsonger</h3><div className="table-scroll"><table><thead><tr><th>Säsong</th><th>Period</th><th>Status</th></tr></thead><tbody>{(seasons??[]).map(s=><tr key={s.id}><td><strong>{s.name}</strong></td><td>{s.starts_on} – {s.ends_on}</td><td>{s.is_active?'Aktiv':'Inaktiv'}</td></tr>)}</tbody></table></div></section>}

    {section === 'cup' && <section className="card admin-workspace"><h2>Skapa ny cup</h2><form action={createCup}>
      <label htmlFor="season_id">Säsong</label><select id="season_id" name="season_id" required defaultValue=""><option value="" disabled>Välj säsong</option>{(seasons??[]).map(s=><option key={s.id} value={s.id}>{s.name}{s.is_active?' (aktiv)':''}</option>)}</select>
      <label htmlFor="cup_name">Cupnamn</label><input id="cup_name" name="name" required placeholder="Syd Cup Vinter 2027" />
      <div className="form-columns"><div><label htmlFor="cup_type">Typ</label><select id="cup_type" name="cup_type" defaultValue="vinter"><option value="vinter">Vintercup</option><option value="sommar">Sommarcup</option></select></div><div><label htmlFor="region_id">Region</label><select id="region_id" name="region_id" required defaultValue=""><option value="" disabled>Välj region</option>{(regions??[]).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div></div>
      <label htmlFor="ruleset_id">Regelverk</label><select id="ruleset_id" name="ruleset_id" required defaultValue=""><option value="" disabled>Välj regelverk</option>{(rulesets??[]).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>
      <button type="submit">Skapa cup</button></form><h3>Befintliga cuper</h3><div className="cup-settings-list">{(cups??[]).map(c=>{const rs=(rulesets??[]).find(r=>r.id===c.ruleset_id);return <details className="card cup-settings-card" key={c.id} open={params.edit===c.id}><summary><span><strong>{c.name}</strong><small>{seasonNameById.get(c.season_id)??'Säsong saknas'} · {regionNameById.get(c.region_id)??'Region saknas'} · {rs?.name??'Regelverk saknas'}</small></span><span className="badge">{c.lifecycle_status==='completed'?'Avslutad':c.lifecycle_status==='planned'?'Planerad':c.active?'Pågående':'Inaktiv'}</span></summary><form action={updateCupSettings}><input type="hidden" name="cup_id" value={c.id}/><label>Cupnamn<input name="name" defaultValue={c.name} required/></label><label>Regelverk<select name="ruleset_id" defaultValue={c.ruleset_id??''} required disabled={c.lifecycle_status==='completed'}>{(rulesets??[]).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>{c.lifecycle_status==='completed'&&<><input type="hidden" name="ruleset_id" value={c.ruleset_id??''}/><small>Regelverket är låst eftersom cupen är avslutad.</small></>}</label><label>Minsta antal starter för pris<input name="min_races_for_prize" type="number" min="0" defaultValue={c.min_races_for_prize}/></label><label>Status<select name="lifecycle_status" defaultValue={c.lifecycle_status??'ongoing'}><option value="planned">Planerad</option><option value="ongoing">Pågående</option><option value="completed">Avslutad</option></select></label><label className="check-row"><input type="checkbox" name="active" value="true" defaultChecked={c.active}/> Visas publikt</label><button>Spara cupinställningar</button></form>{rs&&<div className="ruleset-summary"><strong>{rs.name}</strong><p>{rs.description}</p><p><b>Poäng:</b> 1:a {rs.points_by_place?.['1']??'–'} · 2:a {rs.points_by_place?.['2']??'–'} · 3:a {rs.points_by_place?.['3']??'–'} · därefter enligt tabell · deltagarpoäng {rs.participation_points}</p><p><b>Klubbkamp:</b> {rs.club_points_use_all?'alla insamlade poäng':'räknade individuella resultat'} · <b>Medaljliga:</b> {rs.medal_league_enabled?'Ja':'Nej'}</p></div>}</details>})}</div></section>}

    {section === 'plan' && <section className="card admin-workspace">
      <h2>Tävlingsplan</h2>
      <p className="muted">Bygg cupens säsongsplan innan resultatkällor finns. Planerade tävlingar sparas som utkast och påverkar inte cupställningen.</p>
      <form method="get" className="plan-cup-selector"><input type="hidden" name="section" value="plan"/><label htmlFor="plan_cup">Cup</label><select id="plan_cup" name="cup" defaultValue={params.cup ?? ''} required><option value="" disabled>Välj cup</option>{(cups??[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="submit" className="secondary-dark">Öppna</button></form>
      {params.cup && <>
        {(cups??[]).find(c=>c.id===params.cup)?.lifecycle_status==='completed' && <p className="alert">Cupen är avslutad. Resultat och tävlingsstruktur är låsta, men tävlingsnamn kan fortfarande rättas.</p>}
        <div className="season-plan-existing">
          <h3>Nuvarande tävlingsplan</h3>
          {(races??[]).filter(r=>r.cup_id===params.cup).sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)).length===0 && <p className="muted">Inga deltävlingar upplagda ännu.</p>}
          {(races??[]).filter(r=>r.cup_id===params.cup).sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)).map((r,index,arr)=><article className="season-plan-item editable" key={r.id}>
            <span className="plan-number">{index+1}</span>
            <div className="plan-item-main"><div><strong>{r.name}</strong><p>{r.race_date??'Datum ej satt'}{r.location?` · ${r.location}`:''}{r.organizer_club_id?` · ${clubNameById.get(r.organizer_club_id)??'Arrangör'}`:''}</p></div>
            {(cups??[]).find(c=>c.id===params.cup)?.lifecycle_status!=='completed' && <div className="plan-item-actions"><form action={movePlannedRace}><input type="hidden" name="race_id" value={r.id}/><input type="hidden" name="cup_id" value={params.cup}/><input type="hidden" name="direction" value="up"/><button className="icon-button" disabled={index===0} title="Flytta upp">↑</button></form><form action={movePlannedRace}><input type="hidden" name="race_id" value={r.id}/><input type="hidden" name="cup_id" value={params.cup}/><input type="hidden" name="direction" value="down"/><button className="icon-button" disabled={index===arr.length-1} title="Flytta ner">↓</button></form></div>}</div>
            <span className={`badge ${r.status==='published'?'success-badge':''}`}>{r.status==='cancelled'?'Inställd':r.status==='published'?'Publicerad':r.import_status==='imported'?'Importerad':r.source_url?'Redo för import':'Planerad'}</span>
            <details className="plan-edit"><summary>{(cups??[]).find(c=>c.id===params.cup)?.lifecycle_status==='completed'?'Rätta namn':'Redigera'}</summary><form action={updatePlannedRace} className="plan-edit-form"><input type="hidden" name="race_id" value={r.id}/><input type="hidden" name="cup_id" value={params.cup}/>
              <label>Namn<input name="name" defaultValue={r.name} required/></label>{(cups??[]).find(c=>c.id===params.cup)?.lifecycle_status==='completed'?<><input type="hidden" name="race_date" value={r.race_date??''}/><input type="hidden" name="location" value={r.location??''}/><input type="hidden" name="organizer_club_id" value={r.organizer_club_id??''}/><input type="hidden" name="source_url" value={r.source_url??''}/>{r.status==='cancelled'&&<input type="hidden" name="cancelled" value="true"/>}<p className="muted">Endast namnet kan ändras när cupen är avslutad.</p></>:<><label>Datum<input name="race_date" type="date" defaultValue={r.race_date??''}/></label><label>Ort<input name="location" defaultValue={r.location??''}/></label>
              <label>Arrangör<select name="organizer_club_id" defaultValue={r.organizer_club_id??''}><option value="">Välj klubb</option>{clubs.map(club=><option value={club.id} key={club.id}>{club.name}</option>)}</select></label>
              <label className="plan-source">BiathlonTiming-länk<input name="source_url" type="url" defaultValue={r.source_url??''} placeholder="https://results.biathlontiming.se/?raceId=..."/></label>
              <label className="check-row"><input type="checkbox" name="cancelled" value="true" defaultChecked={r.status==='cancelled'}/> Inställd tävling</label></>}<button type="submit">Spara ändringar</button>
            </form></details>
            {(cups??[]).find(c=>c.id===params.cup)?.lifecycle_status!=='completed' && r.status==='draft' && r.import_status==='not_imported' && !r.source_url && !r.external_race_id && <form action={deletePlannedRace} className="delete-planned-race-form"><input type="hidden" name="race_id" value={r.id}/><input type="hidden" name="cup_id" value={params.cup}/><button type="submit" className="danger-link">Ta bort planerad tävling</button></form>}
          </article>)}
        </div>
        {(cups??[]).find(c=>c.id===params.cup)?.lifecycle_status!=='completed' && <CupPlanBuilder cupId={params.cup} existingCount={(races??[]).filter(r=>r.cup_id===params.cup).length} clubs={clubs.map(c=>({id:c.id,name:c.name}))}/>}
      </>}
    </section>}

    {section === 'rules' && <section className="card admin-workspace"><h2>Regelverk</h2><p className="muted">Regelverket styr poäng, strykresultat och vilka klasser som ingår i medaljligan. Avslutade cuper behåller sitt regelverk.</p>
      {(rulesets??[]).map(rs=>{const locked=(cups??[]).some(c=>c.ruleset_id===rs.id&&c.lifecycle_status==='completed');return <details className="card cup-settings-card" key={rs.id} open={params.ruleset===rs.id}><summary><span><strong>{rs.name}</strong><small>{rs.description}</small></span><span className="badge">{locked?'Låst':rs.medal_league_enabled?'Medaljliga':'Ingen medaljliga'}</span></summary>
        <div className="ruleset-summary"><div className="rules-summary-grid"><span><b>🥇 {rs.points_by_place?.['1']??'–'} p</b><small>Vinnare</small></span><span><b>{rs.participation_points} p</b><small>Deltagarpoäng</small></span><span><b>{rs.min_races_for_prize}</b><small>Starter för pris</small></span><span><b>{(rs.club_min_races_per_athlete??0)>0?rs.club_min_races_per_athlete:'–'}</b><small>Starter för klubbpoäng</small></span><span><b>{rs.medal_league_enabled?'Aktiv':'Av'}</b><small>Medaljliga</small></span></div><p><b>Klubbkamp:</b> {rs.club_points_use_all?'alla poäng':'endast räknade resultat'}{(rs.club_min_races_per_athlete??0)>0?` · Åkarens samtliga poäng räknas retroaktivt när ${rs.club_min_races_per_athlete} starter uppnåtts.`:''}</p>{locked&&<p className="muted">Används av en avslutad cup och kan därför inte ändras. Skapa en ny version för nästa säsong.</p>}</div>
        <div className="ruleset-clone"><h4>Ny säsong</h4><p className="muted">Kopiera alla inställningar och klassregler till ett nytt, redigerbart regelverk.</p><form action={cloneRuleset}><input type="hidden" name="source_ruleset_id" value={rs.id}/><div className="form-columns"><label>Nytt namn<input name="name" required placeholder="Syd Cup 2027"/></label><label>Kod<input name="code" required placeholder="syd-cup-2027"/></label></div><button className="secondary-dark">Skapa nytt regelverk från detta</button></form></div>
        {!locked&&<form action={updateRulesetSettings} className="ruleset-editor"><input type="hidden" name="ruleset_id" value={rs.id}/><h4>Grundregler</h4><label>Namn<input name="name" defaultValue={rs.name} required/></label><label>Beskrivning<textarea name="description" rows={2} defaultValue={rs.description??''}/></label><div className="form-columns"><label>Deltagarpoäng<input name="participation_points" type="number" min="0" defaultValue={rs.participation_points}/></label><label>Minsta starter för pris<input name="min_races_for_prize" type="number" min="0" defaultValue={rs.min_races_for_prize}/></label></div><fieldset className="rules-grid-fieldset"><legend>Poäng per placering</legend><p className="muted">Ange cup-poäng för respektive placering. Tomma placeringar ger deltagarpoäng enligt regeln ovan.</p><div className="rules-points-grid">{Array.from({length:20},(_,i)=>i+1).map(place=><label key={place}><span>{place}:a</span><input name={`points_place_${place}`} type="number" min="0" defaultValue={rs.points_by_place?.[String(place)]??''}/></label>)}</div></fieldset><fieldset className="rules-grid-fieldset"><legend>Strykningsregler</legend><p className="muted">Antal planerade deltävlingar → hur många resultat som stryks.</p><div className="rules-drop-grid">{Array.from({length:16},(_,i)=>i).map(raceCount=><label key={raceCount}><span>{raceCount} lopp</span><input name={`drop_races_${raceCount}`} type="number" min="0" max={raceCount} defaultValue={rs.drop_schedule?.[String(raceCount)]??''}/></label>)}</div></fieldset><div className="form-columns"><div><label>Minsta antal tävlingar per åkare för klubbpoäng<select name="club_min_races_per_athlete" defaultValue={String(rs.club_min_races_per_athlete??0)}><option value="0">Inget minimikrav</option><option value="1">Minst 1 tävling</option><option value="2">Minst 2 tävlingar</option><option value="3">Minst 3 tävlingar</option><option value="4">Minst 4 tävlingar</option><option value="5">Minst 5 tävlingar</option></select><small>När kravet uppnås räknas åkarens poäng från samtliga tävlingar i klubbkampen.</small></label></div><label className="check-row"><input type="checkbox" name="club_points_use_all" value="true" defaultChecked={rs.club_points_use_all}/> Alla poäng räknas i klubbkamp</label><label className="check-row"><input type="checkbox" name="medal_league_enabled" value="true" defaultChecked={rs.medal_league_enabled}/> Medaljliga aktiv</label></div><button>Spara grundregler</button></form>}
        <div className="table-scroll"><table><thead><tr><th>Klass</th><th>Poängmodell</th><th>Fast poäng</th><th>Medaljliga</th><th></th></tr></thead><tbody>{(classes??[]).map(cl=>{const rule=rulesetClassRules.find(r=>r.ruleset_id===rs.id&&r.class_id===cl.id);return <tr key={cl.id}><td><strong>{cl.name}</strong></td><td colSpan={4}>{locked?<span>{rule?.scoring_mode==='fixed'?`Fast (${rule.fixed_points})`:rule?.scoring_mode==='none'?'Ingen':'Standard'} · Medaljliga {rule?.medal_eligible===false?'Nej':'Ja'}</span>:<form action={updateRulesetClassRule} className="form-columns"><input type="hidden" name="ruleset_id" value={rs.id}/><input type="hidden" name="class_id" value={cl.id}/><select name="scoring_mode" defaultValue={rule?.scoring_mode??'standard'}><option value="standard">Standard</option><option value="fixed">Fast</option><option value="none">Ingen</option></select><input name="fixed_points" type="number" min="0" defaultValue={rule?.fixed_points??''} placeholder="Fast poäng"/><label className="check-row"><input type="checkbox" name="medal_eligible" value="true" defaultChecked={rule?.medal_eligible!==false}/> Medalj</label><button>Spara</button></form>}</td></tr>})}</tbody></table></div>
      </details>})}
    </section>}

    {section === 'feedback' && <section className="card admin-workspace"><h2>Ärenden & förbättringar</h2><p className="muted">Feedback från besökare. Prioritera här och koppla planerade förbättringar till roadmapen.</p>
      {feedbackItems.length===0?<p>Inga ärenden ännu.</p>:feedbackItems.map(item=><details className="card cup-settings-card" key={item.id}><summary><span><strong>{item.type==='result_error'?'Resultatfel':item.type==='data_error'?'Datafel':item.type==='technical'?'Tekniskt fel':'Förbättring'}</strong><small>{new Date(item.created_at).toLocaleDateString('sv-SE')} · {item.message.slice(0,90)}</small></span><span className="badge">{item.priority} · {item.status}</span></summary>
        <p>{item.message}</p>{item.page_url&&<p className="muted">Sida: {item.page_url}</p>}{(item.name||item.email)&&<p className="muted">Kontakt: {[item.name,item.email].filter(Boolean).join(' · ')}</p>}
        <form action={updateFeedbackItem}><input type="hidden" name="id" value={item.id}/><div className="form-columns"><label>Status<select name="status" defaultValue={item.status}><option value="new">Ny</option><option value="planned">Planerad</option><option value="in_progress">Pågår</option><option value="done">Klar</option><option value="rejected">Avvisad</option></select></label><label>Prioritet<select name="priority" defaultValue={item.priority}><option value="low">Låg</option><option value="normal">Normal</option><option value="high">Hög</option><option value="critical">Kritisk</option></select></label></div><label>Roadmap<input name="roadmap_ref" defaultValue={item.roadmap_ref??''} placeholder="t.ex. v1.6 Statistik"/></label><label>Adminnotering<textarea name="admin_note" rows={3} defaultValue={item.admin_note??''}/></label><button>Spara ärende</button></form>
      </details>)}
    </section>}

    {section === 'classes' && <section className="card admin-workspace"><h2>Klassalias</h2><p className="muted">Klasserna och tidigare alias behålls. Lägg endast till alternativa namn som förekommer i importen.</p><form action={addClassAlias}>
      <label htmlFor="class_id">Officiell klass</label><select id="class_id" name="class_id" required defaultValue=""><option value="" disabled>Välj klass</option>{(classes??[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <label htmlFor="class_alias">Nytt alias</label><input id="class_alias" name="alias" required placeholder="Pojkar 10-11 Massstart" /><button type="submit">Lägg till alias</button></form>
      <div className="table-scroll"><table><thead><tr><th>Klass</th><th>Alias</th></tr></thead><tbody>{(classes??[]).map(c=><tr key={c.id}><td><strong>{c.name}</strong></td><td>{(c.aliases??[]).join(', ')||'–'}</td></tr>)}</tbody></table></div></section>}

    {section === 'clubs' && <ClubManager
      regions={regions ?? []}
      clubs={clubs}
      initialRegionId={selectedRegionId}
      initialClubId={params.club}
    />}

    {section === 'athletes' && <section className="card admin-workspace"><h2>Åkare & identitet</h2><p className="muted">Åkaridentiteten är fristående från klass och kan behållas över flera säsonger. Slå bara ihop poster när du är säker på att de avser samma person.</p>
      <section className="analysis-group-admin"><div className="calendar-heading"><div><h3>Analysgrupper</h3><p className="muted">Skapa en fast grupp av åkare för att följa skytteutvecklingen över cuper och säsonger.</p></div><span className="badge">{shootingGroupsAdmin.length}</span></div>
        <form action={createShootingGroup} className="card group-create-form"><label>Gruppnamn<input name="name" required maxLength={80} placeholder="Ex. Borås 12–15 år"/></label><label>Beskrivning<input name="description" maxLength={200} placeholder="Valfri beskrivning"/></label><fieldset><legend>Välj åkare</legend><div className="group-athlete-picker">{athletesAdmin.filter(a=>!a.merged_into_id).map(a=><label className="check-row" key={a.id}><input type="checkbox" name="athlete_ids" value={a.id}/>{a.full_name}</label>)}</div></fieldset><button type="submit">Skapa analysgrupp</button></form>
        {shootingGroupsAdmin.map(g=>{const ids=shootingGroupMembersAdmin.filter(m=>m.group_id===g.id).map(m=>m.athlete_id);return <article className="card analysis-group-row" key={g.id}><div><strong>{g.name}</strong><p className="muted">{g.description||'Ingen beskrivning'} · {ids.length} åkare</p><small>{ids.map(id=>athletesAdmin.find(a=>a.id===id)?.full_name).filter(Boolean).join(' · ')}</small></div><form action={deleteShootingGroup}><input type="hidden" name="group_id" value={g.id}/><button type="submit" className="secondary-dark">Ta bort</button></form></article>})}
      </section>
      <h3>Åkaridentiteter</h3>
      <div className="athlete-admin-list">{athletesAdmin.filter(a=>!a.merged_into_id).map(a=>{const starts=new Set(athleteResultRows.filter(r=>r.athlete_id===a.id).map(r=>r.race_id)).size;const sameName=athletesAdmin.filter(b=>b.id!==a.id&&!b.merged_into_id&&b.full_name.toLocaleLowerCase('sv-SE')===a.full_name.toLocaleLowerCase('sv-SE'));return <details className="card cup-settings-card" key={a.id} open={params.athlete===a.id}><summary><span><strong>{a.full_name}</strong><small>{starts} starter{a.birth_year?` · född ${a.birth_year}`:''}</small></span>{sameName.length>0&&<span className="badge admin-attention">Möjlig dubblett</span>}</summary>
        {a.aliases?.length?<p><b>Alias:</b> {a.aliases.join(', ')}</p>:null}
        <form action={mergeAthletes}><input type="hidden" name="keep_id" value={a.id}/><label>Slå ihop med<select name="merge_id" required defaultValue=""><option value="" disabled>Välj annan åkare</option>{athletesAdmin.filter(b=>b.id!==a.id&&!b.merged_into_id).map(b=><option key={b.id} value={b.id}>{b.full_name}</option>)}</select><small>Resultaten flyttas till {a.full_name}. Sammanslagningen stoppas automatiskt om båda har resultat i samma tävling och klass.</small></label><button className="secondary-dark">Slå ihop åkare</button></form>
      </details>})}</div>
    </section>}

    {section === 'admins' && <section className="card admin-workspace">
      <h2>Administratörer</h2>
      <p className="muted">Bjud in en ny administratör via e-post eller ändra behörigheten för ett befintligt konto. Du kan inte ta bort din egen behörighet.</p>
      <form action={inviteAdmin}>
        <label htmlFor="admin_email">Bjud in ny administratör</label>
        <input id="admin_email" name="email" type="email" autoComplete="email" required placeholder="namn@exempel.se" />
        <button type="submit">Skicka admininbjudan</button>
      </form>
      <h3>Befintliga användare</h3>
      <div className="table-scroll"><table><thead><tr><th>Användare</th><th>Behörighet</th><th>Åtgärd</th></tr></thead><tbody>
        {adminProfiles.map(p => <tr key={p.id}>
          <td><strong>{p.display_name ?? 'Namnlöst konto'}</strong></td>
          <td>{p.is_admin ? 'Administratör' : 'Användare'}</td>
          <td><form action={setAdminRole}><input type="hidden" name="profile_id" value={p.id}/><input type="hidden" name="make_admin" value={p.is_admin ? 'false' : 'true'}/><button className="secondary-dark" type="submit">{p.is_admin ? 'Ta bort admin' : 'Gör till admin'}</button></form></td>
        </tr>)}
      </tbody></table></div>
    </section>}

    {section === 'import' && <section className="card admin-workspace">
      <h2>Resultatflöde</h2>
      <p className="muted">Följ tävlingen från BiathlonTiming till publicerade cupresultat. 1. Koppla källa → 2. Importera → 3. Granska → 4. Publicera.</p>
      <div className="import-list">{(races??[]).filter(r => !params.cup || r.cup_id === params.cup).sort((a,b)=>(a.sort_order??999)-(b.sort_order??999)).map(r => {
        const review = reviewSummaryByRace.get(r.id) ?? { info: 0, needsReview: 0 };
        const imported = r.import_status === 'imported';
        const failed = r.import_status === 'failed';
        const published = r.status === 'published';
        const cupCompleted = (cups??[]).find(c=>c.id===r.cup_id)?.lifecycle_status === 'completed';
        const canPublish = imported && review.needsReview === 0 && !cupCompleted;
        const step = published ? 4 : imported ? 3 : r.source_url ? 2 : 1;
        return <article className={`import-card workflow-step-${step}`} key={r.id}>
          <div>
            <strong>{r.name}</strong>
            <p className="muted import-meta">{cupNameById.get(r.cup_id) ?? 'Cup saknas'} · {r.race_date ?? 'Datum saknas'}</p>
            <div className="import-workflow" aria-label="Importsteg">
              <span className={step>=1?'done':''}>1 Källa</span><span className={step>=2?'done':''}>2 Import</span><span className={step>=3?'done':''}>3 Granska</span><span className={step>=4?'done':''}>4 Publicera</span>
            </div>
            <span className={`badge ${published?'success-badge':''}`}>{published ? 'Publicerad' : imported ? `${r.imported_result_count ?? 0} resultat importerade` : failed ? 'Importfel' : r.source_url ? 'Redo för import' : 'Källa saknas'}</span>
            {imported && review.needsReview > 0 && <p className="error-text"><strong>{review.needsReview} behöver kontrolleras</strong> före publicering.</p>}
            {imported && review.info > 0 && <p className="muted">{review.info} informationsnoteringar (t.ex. DNS, DNF eller utanför region).</p>}
            {imported && review.needsReview === 0 && !published && <p className="workflow-next"><strong>Nästa steg:</strong> Granska resultat och publicera tävlingen.</p>}
            {published && <p className="workflow-next success-text"><strong>Klart:</strong> Resultaten är publicerade i cupen.</p>}
            {r.import_error && <p className="error-text">{r.import_error}</p>}
          </div>
          <div className="import-actions">
            {cupCompleted && <span className="badge">Avslutad · låst</span>}
            {!cupCompleted && imported && <details>
              <summary className="source-button">Återimportera</summary>
              <div className="card">
                <p><strong>Säker återimport</strong></p>
                <p className="muted">{r.imported_result_count ?? 0} befintliga resultat finns. Matchande resultat uppdateras – de dupliceras inte. Om ett tidigare resultat saknas i källan stoppas importen utan radering.</p>
                <form action={importRaceResultsSafe}><input type="hidden" name="race_id" value={r.id}/><button type="submit">Bekräfta återimport</button></form>
              </div>
            </details>}
            {!cupCompleted && !imported && r.source_url && <form action={importRaceResultsSafe}><input type="hidden" name="race_id" value={r.id}/><button type="submit">2. Importera resultat</button></form>}
            {!cupCompleted && !imported && !r.source_url && <Link className="source-button" href={adminHref('plan',{cup:r.cup_id})}>1. Koppla BiathlonTiming →</Link>}
            {imported && <Link className="source-button" href={`/admin/races/${r.id}`}>{published ? 'Visa granskning' : '3. Granska resultat →'}</Link>}
            {!cupCompleted && <form action={setRaceStatus}>
              <input type="hidden" name="race_id" value={r.id}/>
              <input type="hidden" name="status" value={r.status === 'published' ? 'draft' : 'published'}/>
              <button className="secondary-dark" type="submit" disabled={r.status !== 'published' && !canPublish} title={r.status !== 'published' && !canPublish ? 'Importera resultat och åtgärda blockerande varningar före publicering.' : undefined}>
                {r.status === 'published' ? 'Avpublicera' : '4. Publicera'}
              </button>
            </form>}
          </div>
        </article>;
      })}</div>
    </section>}
    {section === 'external' && <section className="card admin-workspace">
      <h2>Externresultat</h2><p className="muted">Importera resultat från andra tävlingsserier utan att påverka Syd Cup-poäng. All data går först till en separat preview.</p>
      <form action={previewExternalResults} encType="multipart/form-data">
        <div className="form-columns"><label>Källa<select name="source_type" defaultValue="csv"><option value="csv">CSV</option><option value="swecup">SweCup</option><option value="ibu">IBU</option><option value="other">Annan</option></select></label><label>Källnamn<input name="source_name" placeholder="SweCup Östersund"/></label></div>
        <div className="form-columns"><label>Tävling<input name="event_name"/></label><label>Datum<input type="date" name="event_date"/></label></div>
        <label>Resultatfil<input type="file" name="file" accept=".csv,text/csv,text/plain" required/></label><small>Max 2 MB. Ingen rad förs över till officiella cupresultat.</small><button type="submit">Skapa preview</button>
      </form>
      {params.batch && <><h3>Preview</h3><div className="table-scroll"><table><thead><tr><th>Rad</th><th>Åkare</th><th>Klubb</th><th>Klass</th><th>Plac.</th><th>Skytte</th><th>Matchning</th></tr></thead><tbody>{externalRows.map(r=><tr key={r.id}><td>{r.source_row}</td><td><strong>{r.athlete_name}</strong></td><td>{r.club_name??'–'}</td><td>{r.class_name??'–'}</td><td>{r.place??'–'}</td><td>{r.shooting?.length?r.shooting.join(' '):'–'}</td><td><span className={'badge '+(r.match_status==='ambiguous'?'admin-attention':'')}>{r.match_status}</span><small>{r.match_note}</small>{['ambiguous','unmatched'].includes(r.match_status)&&<div><form action={resolveExternalAthlete}><input type="hidden" name="row_id" value={r.id}/><input type="hidden" name="import_id" value={params.batch}/><select name="athlete_id" required defaultValue=""><option value="" disabled>Välj befintlig åkare</option>{athletesAdmin.map(a=><option key={a.id} value={a.id}>{a.full_name}</option>)}</select><button type="submit" className="secondary-dark">Koppla</button></form><form action={confirmExternalNewAthlete}><input type="hidden" name="row_id" value={r.id}/><input type="hidden" name="import_id" value={params.batch}/><button type="submit" className="secondary-dark">Bekräfta som ny extern åkare</button></form></div>}</td></tr>)}</tbody></table></div>
        <form action={approveExternalPreview}><input type="hidden" name="import_id" value={params.batch}/><button type="submit" disabled={externalRows.some(r=>['ambiguous','unmatched'].includes(r.match_status))}>Godkänn preview</button>{externalRows.some(r=>['ambiguous','unmatched'].includes(r.match_status))&&<p className="error-text">Osäkra åkaridentiteter måste lösas innan preview kan godkännas.</p>}</form></>}
      <h3>Senaste externa importer</h3><div className="table-scroll"><table><thead><tr><th>Källa</th><th>Tävling</th><th>Datum</th><th>Rader</th><th>Status</th></tr></thead><tbody>{externalImports.map(i=><tr key={i.id}><td><Link href={adminHref('external',{batch:i.id})}>{i.source_name}</Link></td><td>{i.event_name??'–'}</td><td>{i.event_date??'–'}</td><td>{i.row_count}</td><td><span className="badge">{i.status}</span></td></tr>)}</tbody></table></div>
    </section>}

  </>;
}

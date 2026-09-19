import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { addClassAlias, createCup, createRace, createSeason, inviteAdmin, logout, setAdminRole, setRaceStatus, updatePlannedRace, movePlannedRace } from './admin-actions';
import { importRaceResultsSafe } from './import-actions';
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
  const section = ['season','cup','plan','race','import','classes','clubs','admins'].includes(params.section ?? '') ? params.section! : 'home';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  const { data: profile } = await supabase.from('profiles').select('display_name,is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect('/admin/login?error=not-admin');

  const [{ data: seasons }, { data: cups }, { data: races }, { data: classes }, { data: regions }] = await Promise.all([
    supabase.from('seasons').select('id,name,is_active,starts_on,ends_on').order('starts_on', { ascending: false }),
    supabase.from('cups').select('id,name,cup_type,region_id,season_id').order('created_at', { ascending: false }),
    supabase.from('races').select('id,name,race_date,status,cup_id,source_url,location,organizer_club_id,sort_order,import_status,import_error,imported_result_count,imported_at,import_warnings').order('race_date', { ascending: false }),
    supabase.from('classes').select('id,name,aliases').eq('is_official', true).order('sort_order').order('name'),
    supabase.from('regions').select('id,name').order('sort_order'),
  ]);

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
    ['home','Översikt'], ['season','Ny säsong'], ['cup','Ny cup'], ['plan','Tävlingsplan'], ['race','Koppla resultat'],
    ['import','Import & publicering'], ['classes','Klassalias'], ['clubs','Regioner & föreningar'], ['admins','Administratörer'],
  ];

  return <>
    <section className="hero compact-hero admin-hero">
      <div className="hero-row"><div><p className="eyebrow">Administratör</p><h1>Cupadministration</h1><p>Välj en funktion och arbeta med en sak i taget.</p></div><form action={logout}><button className="secondary" type="submit">Logga ut</button></form></div>
    </section>

    <nav className="admin-tools" aria-label="Administrationsfunktioner">
      {nav.map(([key,label]) => <Link key={key} className={section===key?'active':''} href={adminHref(key)}>{label}</Link>)}
    </nav>

    {params.success && <p className="alert success">Ändringen är sparad.</p>}
    {params.error && <div className="alert error">
      <strong>Något behöver åtgärdas:</strong> {params.error}
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
      <button type="submit">Skapa cup</button></form><h3>Befintliga cuper</h3><div className="table-scroll"><table><thead><tr><th>Cup</th><th>Säsong</th><th>Region</th></tr></thead><tbody>{(cups??[]).map(c=><tr key={c.id}><td><strong>{c.name}</strong></td><td>{seasonNameById.get(c.season_id) ?? 'Säsong saknas'}</td><td>{c.region_id ? (regionNameById.get(c.region_id) ?? `Okänd region (${c.region_id})`) : 'Region saknas'}</td></tr>)}</tbody></table></div></section>}

    {section === 'plan' && <section className="card admin-workspace">
      <h2>Tävlingsplan</h2>
      <p className="muted">Bygg cupens säsongsplan innan resultatkällor finns. Planerade tävlingar sparas som utkast och påverkar inte cupställningen.</p>
      <form method="get" className="plan-cup-selector"><input type="hidden" name="section" value="plan"/><label htmlFor="plan_cup">Cup</label><select id="plan_cup" name="cup" defaultValue={params.cup ?? ''} required><option value="" disabled>Välj cup</option>{(cups??[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="submit" className="secondary-dark">Öppna</button></form>
      {params.cup && <>
        <div className="season-plan-existing">
          <h3>Nuvarande tävlingsplan</h3>
          {(races??[]).filter(r=>r.cup_id===params.cup).sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)).length===0 && <p className="muted">Inga deltävlingar upplagda ännu.</p>}
          {(races??[]).filter(r=>r.cup_id===params.cup).sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)).map((r,index,arr)=><article className="season-plan-item editable" key={r.id}>
            <span className="plan-number">{index+1}</span>
            <div className="plan-item-main"><div><strong>{r.name}</strong><p>{r.race_date??'Datum ej satt'}{r.location?` · ${r.location}`:''}{r.organizer_club_id?` · ${clubNameById.get(r.organizer_club_id)??'Arrangör'}`:''}</p></div>
            <div className="plan-item-actions"><form action={movePlannedRace}><input type="hidden" name="race_id" value={r.id}/><input type="hidden" name="cup_id" value={params.cup}/><input type="hidden" name="direction" value="up"/><button className="icon-button" disabled={index===0} title="Flytta upp">↑</button></form><form action={movePlannedRace}><input type="hidden" name="race_id" value={r.id}/><input type="hidden" name="cup_id" value={params.cup}/><input type="hidden" name="direction" value="down"/><button className="icon-button" disabled={index===arr.length-1} title="Flytta ner">↓</button></form></div></div>
            <span className={`badge ${r.status==='published'?'success-badge':''}`}>{r.status==='cancelled'?'Inställd':r.status==='published'?'Publicerad':r.import_status==='imported'?'Importerad':r.source_url?'Redo för import':'Planerad'}</span>
            <details className="plan-edit"><summary>Redigera</summary><form action={updatePlannedRace} className="plan-edit-form"><input type="hidden" name="race_id" value={r.id}/><input type="hidden" name="cup_id" value={params.cup}/>
              <label>Namn<input name="name" defaultValue={r.name} required/></label><label>Datum<input name="race_date" type="date" defaultValue={r.race_date??''}/></label><label>Ort<input name="location" defaultValue={r.location??''}/></label>
              <label>Arrangör<select name="organizer_club_id" defaultValue={r.organizer_club_id??''}><option value="">Välj klubb</option>{clubs.map(club=><option value={club.id} key={club.id}>{club.name}</option>)}</select></label>
              <label className="plan-source">BiathlonTiming-länk<input name="source_url" type="url" defaultValue={r.source_url??''} placeholder="https://results.biathlontiming.se/?raceId=..."/></label>
              <label className="check-row"><input type="checkbox" name="cancelled" value="true" defaultChecked={r.status==='cancelled'}/> Inställd tävling</label><button type="submit">Spara ändringar</button>
            </form></details>
            {r.status==='draft' && r.import_status==='not_imported' && !r.source_url && !r.external_race_id && <form action={deletePlannedRace} className="delete-planned-race-form"><input type="hidden" name="race_id" value={r.id}/><input type="hidden" name="cup_id" value={params.cup}/><button type="submit" className="danger-link">Ta bort planerad tävling</button></form>}
          </article>)}
        </div>
        <CupPlanBuilder cupId={params.cup} clubs={clubs.map(c=>({id:c.id,name:c.name}))}/>
      </>}
    </section>}

    {section === 'race' && <section className="card admin-workspace"><h2>Koppla tävling till cup</h2><form action={createRace}>
      <label htmlFor="cup_id">Cup</label><select id="cup_id" name="cup_id" required defaultValue=""><option value="" disabled>Välj cup</option>{(cups??[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <label htmlFor="race_name">Tävlingsnamn</label><input id="race_name" name="name" required placeholder="Deltävling 1 – Hestra" />
      <label htmlFor="race_date">Datum</label><input id="race_date" name="race_date" type="date" />
      <label htmlFor="source_url">BiathlonTiming-länk</label><input id="source_url" name="source_url" type="url" required placeholder="https://results.biathlontiming.se/?raceId=..." />
      <button type="submit">Koppla tävlingen</button></form></section>}

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
      <h2>Import & publicering</h2>
      <p className="muted">Importera först, granska därefter resultat och cup-poäng innan tävlingen publiceras. DNS, DNF och resultat utanför cupens region visas som information; UNKNOWN kräver kontroll.</p>
      <div className="import-list">{(races??[]).filter(r => !params.cup || r.cup_id === params.cup).map(r => {
        const review = reviewSummaryByRace.get(r.id) ?? { info: 0, needsReview: 0 };
        const imported = r.import_status === 'imported';
        const failed = r.import_status === 'failed';
        const canPublish = imported && review.needsReview === 0;
        return <article className="import-card" key={r.id}>
          <div>
            <strong>{r.name}</strong>
            <p className="muted import-meta">{cupNameById.get(r.cup_id) ?? 'Cup saknas'} · {r.race_date ?? 'Datum saknas'}</p>
            <span className="badge">{imported ? `${r.imported_result_count ?? 0} importerade` : failed ? 'Importfel' : 'Inte importerad'}</span>
            {imported && review.needsReview > 0 && <p className="error-text"><strong>{review.needsReview} behöver kontrolleras</strong> före publicering.</p>}
            {imported && review.info > 0 && <p className="muted">{review.info} informationsnoteringar (t.ex. DNS, DNF eller utanför region).</p>}
            {imported && review.needsReview === 0 && <p className="muted">Granskningskontroll: inga blockerande varningar.</p>}
            {r.import_error && <p className="error-text">{r.import_error}</p>}
          </div>
          <div className="import-actions">
            {imported && <details>
              <summary className="source-button">Återimportera</summary>
              <div className="card">
                <p><strong>Säker återimport</strong></p>
                <p className="muted">{r.imported_result_count ?? 0} befintliga resultat finns. Matchande resultat uppdateras – de dupliceras inte. Om ett tidigare resultat saknas i källan stoppas importen utan radering.</p>
                <form action={importRaceResultsSafe}><input type="hidden" name="race_id" value={r.id}/><button type="submit">Bekräfta återimport</button></form>
              </div>
            </details>}
            {!imported && r.source_url && <form action={importRaceResultsSafe}><input type="hidden" name="race_id" value={r.id}/><button type="submit">Importera</button></form>}
            {!imported && !r.source_url && <Link className="source-button" href={adminHref('plan',{cup:r.cup_id})}>Koppla BiathlonTiming →</Link>}
            {imported && <Link className="source-button" href={`/admin/races/${r.id}`}>Granska resultat</Link>}
            <form action={setRaceStatus}>
              <input type="hidden" name="race_id" value={r.id}/>
              <input type="hidden" name="status" value={r.status === 'published' ? 'draft' : 'published'}/>
              <button className="secondary-dark" type="submit" disabled={r.status !== 'published' && !canPublish} title={r.status !== 'published' && !canPublish ? 'Importera resultat och åtgärda blockerande varningar före publicering.' : undefined}>
                {r.status === 'published' ? 'Avpublicera' : 'Publicera'}
              </button>
            </form>
          </div>
        </article>;
      })}</div>
    </section>}
  </>;
}

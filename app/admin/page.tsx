import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { addClassAlias, addClubAlias, createCup, createRace, createSeason, importRaceResults, logout, setRaceStatus, updateClubRegion } from './admin-actions';

export const dynamic = 'force-dynamic';

type Params = Record<string, string | undefined>;
type RelatedName = { name?: string } | { name?: string }[] | null;
function relatedName(value: RelatedName) { return Array.isArray(value) ? value[0]?.name : value?.name; }
function adminHref(section: string, params: Record<string,string|undefined> = {}) {
  const search = new URLSearchParams({ section });
  Object.entries(params).forEach(([key,value]) => value && search.set(key,value));
  return `/admin?${search.toString()}`;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const section = ['season','cup','race','import','classes','clubs'].includes(params.section ?? '') ? params.section! : 'home';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  const { data: profile } = await supabase.from('profiles').select('display_name,is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect('/admin/login?error=not-admin');

  const [{ data: seasons }, { data: cups }, { data: races }, { data: classes }, { data: regions }] = await Promise.all([
    supabase.from('seasons').select('id,name,is_active,starts_on,ends_on').order('starts_on', { ascending: false }),
    supabase.from('cups').select('id,name,cup_type,region_id,season_id,seasons(name),regions(name)').order('created_at', { ascending: false }),
    supabase.from('races').select('id,name,race_date,status,cup_id,source_url,import_status,import_error,imported_result_count,imported_at,import_warnings,cups(name)').order('race_date', { ascending: false }),
    supabase.from('classes').select('id,name,aliases').eq('is_official', true).order('sort_order').order('name'),
    supabase.from('regions').select('id,name').eq('active', true).order('sort_order'),
  ]);

  const selectedRegionId = params.region ?? regions?.[0]?.id ?? '';
  let clubs: {id:string;name:string;short_name:string|null;aliases:string[]|null;region_id:string|null;regions:RelatedName}[] = [];
  if (section === 'clubs') {
    let query = supabase.from('clubs').select('id,name,short_name,aliases,region_id,regions(name)').order('name');
    if (selectedRegionId) query = query.eq('region_id', selectedRegionId);
    const { data } = await query;
    clubs = (data ?? []) as typeof clubs;
  }
  const selectedClub = clubs.find(club => club.id === params.club) ?? clubs[0];

  const nav = [
    ['home','Översikt'], ['season','Ny säsong'], ['cup','Ny cup'], ['race','Koppla tävling'],
    ['import','Import & publicering'], ['classes','Klassalias'], ['clubs','Regioner & föreningar'],
  ];

  return <>
    <section className="hero compact-hero admin-hero">
      <div className="hero-row"><div><p className="eyebrow">Administratör</p><h1>Cupadministration</h1><p>Välj en funktion och arbeta med en sak i taget.</p></div><form action={logout}><button className="secondary" type="submit">Logga ut</button></form></div>
    </section>

    <nav className="admin-tools" aria-label="Administrationsfunktioner">
      {nav.map(([key,label]) => <Link key={key} className={section===key?'active':''} href={adminHref(key)}>{label}</Link>)}
    </nav>

    {params.success && <p className="alert success">Ändringen är sparad.</p>}
    {params.error && <p className="alert error">Något gick fel: {params.error}</p>}

    {section === 'home' && <div className="admin-dashboard">
      <Link href={adminHref('season')} className="admin-action-card"><span>01</span><h2>Skapa säsong</h2><p>Lägg upp vinter- eller sommarsäsong innan du skapar cupen.</p></Link>
      <Link href={adminHref('cup')} className="admin-action-card"><span>02</span><h2>Skapa cup</h2><p>Välj säsong, typ och region för en ny regional cup.</p></Link>
      <Link href={adminHref('race')} className="admin-action-card"><span>03</span><h2>Koppla tävling</h2><p>Lägg till en BiathlonTiming-tävling i rätt cup.</p></Link>
      <Link href={adminHref('import')} className="admin-action-card"><span>04</span><h2>Importera resultat</h2><p>Hämta resultat, granska och publicera deltävlingen.</p></Link>
      <Link href={adminHref('classes')} className="admin-action-card"><span>05</span><h2>Klassalias</h2><p>Koppla alternativa klassnamn till dina befintliga klasser.</p></Link>
      <Link href={adminHref('clubs')} className="admin-action-card"><span>06</span><h2>Regioner & föreningar</h2><p>Filtrera per region och redigera en förening i taget.</p></Link>
    </div>}

    {section === 'season' && <section className="card admin-workspace"><h2>Skapa ny säsong</h2><form action={createSeason}>
      <label htmlFor="season_name">Namn</label><input id="season_name" name="name" required placeholder="Säsong 2026/2027" />
      <div className="form-columns"><div><label htmlFor="starts_on">Startdatum</label><input id="starts_on" name="starts_on" type="date" required /></div><div><label htmlFor="ends_on">Slutdatum</label><input id="ends_on" name="ends_on" type="date" required /></div></div>
      <label className="check-row"><input type="checkbox" name="is_active" value="true" defaultChecked /> Aktiv säsong</label><button type="submit">Skapa säsong</button>
    </form><h3>Befintliga säsonger</h3><div className="table-scroll"><table><thead><tr><th>Säsong</th><th>Period</th><th>Status</th></tr></thead><tbody>{(seasons??[]).map(s=><tr key={s.id}><td><strong>{s.name}</strong></td><td>{s.starts_on} – {s.ends_on}</td><td>{s.is_active?'Aktiv':'Inaktiv'}</td></tr>)}</tbody></table></div></section>}

    {section === 'cup' && <section className="card admin-workspace"><h2>Skapa ny cup</h2><form action={createCup}>
      <label htmlFor="season_id">Säsong</label><select id="season_id" name="season_id" required defaultValue=""><option value="" disabled>Välj säsong</option>{(seasons??[]).map(s=><option key={s.id} value={s.id}>{s.name}{s.is_active?' (aktiv)':''}</option>)}</select>
      <label htmlFor="cup_name">Cupnamn</label><input id="cup_name" name="name" required placeholder="Syd Cup Vinter 2027" />
      <div className="form-columns"><div><label htmlFor="cup_type">Typ</label><select id="cup_type" name="cup_type" defaultValue="vinter"><option value="vinter">Vintercup</option><option value="sommar">Sommarcup</option></select></div><div><label htmlFor="region_id">Region</label><select id="region_id" name="region_id" required defaultValue=""><option value="" disabled>Välj region</option>{(regions??[]).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div></div>
      <button type="submit">Skapa cup</button></form><h3>Befintliga cuper</h3><div className="table-scroll"><table><thead><tr><th>Cup</th><th>Säsong</th><th>Region</th></tr></thead><tbody>{(cups??[]).map(c=><tr key={c.id}><td><strong>{c.name}</strong></td><td>{relatedName(c.seasons as RelatedName)}</td><td>{relatedName(c.regions as RelatedName)??'Region saknas'}</td></tr>)}</tbody></table></div></section>}

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

    {section === 'clubs' && <section className="admin-club-layout">
      <aside className="card club-picker"><h2>Regioner & föreningar</h2><form method="get"><input type="hidden" name="section" value="clubs"/><label htmlFor="club_region">Region</label><select id="club_region" name="region" defaultValue={selectedRegionId}>{(regions??[]).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select><button type="submit">Visa föreningar</button></form>
      <div className="club-list">{clubs.map(club=><Link key={club.id} className={club.id===selectedClub?.id?'active':''} href={adminHref('clubs',{region:selectedRegionId,club:club.id})}>{club.name}</Link>)}</div></aside>
      <section className="card admin-workspace">{selectedClub ? <><p className="eyebrow dark">Redigera förening</p><h2>{selectedClub.name}</h2><p className="muted">Nuvarande region: {relatedName(selectedClub.regions)}</p>
        <form action={updateClubRegion}><input type="hidden" name="club_id" value={selectedClub.id}/><input type="hidden" name="return_region" value={selectedRegionId}/><label htmlFor="edit_region">Byt region</label><select id="edit_region" name="region_id" required defaultValue={selectedClub.region_id??''}>{(regions??[]).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select><button type="submit">Spara region</button></form>
        <hr/><h3>Föreningsalias</h3><p className="alias-box">{(selectedClub.aliases??[]).join(', ')||'Inga alias ännu'}</p><form action={addClubAlias}><input type="hidden" name="club_id" value={selectedClub.id}/><input type="hidden" name="return_region" value={selectedRegionId}/><label htmlFor="club_alias">Nytt alias</label><input id="club_alias" name="alias" required placeholder="Alternativt föreningsnamn"/><button type="submit">Lägg till alias</button></form></> : <p>Inga föreningar hittades i regionen.</p>}</section>
    </section>}

    {section === 'import' && <section className="card admin-workspace"><h2>Import & publicering</h2><div className="import-list">{(races??[]).map(r=><article className="import-card" key={r.id}><div><strong>{r.name}</strong><p className="muted import-meta">{relatedName(r.cups as RelatedName)} · {r.race_date??'Datum saknas'}</p><span className="badge">{r.import_status==='imported'?`${r.imported_result_count} importerade`:r.import_status==='failed'?'Importfel':'Inte importerad'}</span>{r.import_error&&<p className="error-text">{r.import_error}</p>}</div><div className="import-actions"><form action={importRaceResults}><input type="hidden" name="race_id" value={r.id}/><button type="submit">Importera</button></form><form action={setRaceStatus}><input type="hidden" name="race_id" value={r.id}/><input type="hidden" name="status" value={r.status==='published'?'draft':'published'}/><button className="secondary-dark" type="submit">{r.status==='published'?'Avpublicera':'Publicera'}</button></form></div></article>)}</div></section>}
  </>;
}

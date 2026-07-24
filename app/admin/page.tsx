import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { createCup, createRace, logout, setRaceStatus } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const { data: profile } = await supabase.from('profiles').select('display_name,is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect('/admin/login?error=not-admin');

  const [{ data: seasons }, { data: cups }, { data: races }] = await Promise.all([
    supabase.from('seasons').select('id,name,is_active').order('starts_on', { ascending: false }),
    supabase.from('cups').select('id,name,cup_type,season_id,seasons(name)').order('created_at', { ascending: false }),
    supabase.from('races').select('id,name,race_date,status,cup_id,source_url,cups(name)').order('race_date', { ascending: false }),
  ]);

  return (
    <>
      <section className="hero compact-hero">
        <div className="hero-row">
          <div><p className="eyebrow">Administratör</p><h1>Cupadministration</h1><p>Skapa cupen och registrera deltävlingarnas BiathlonTiming-länkar.</p></div>
          <form action={logout}><button className="secondary" type="submit">Logga ut</button></form>
        </div>
      </section>

      {params.success === 'cup-created' && <p className="alert success">Cupen är skapad.</p>}
      {params.success === 'race-created' && <p className="alert success">Deltävlingen är tillagd som utkast.</p>}
      {params.success === 'race-published' && <p className="alert success">Deltävlingen är publicerad och ingår nu i cupställningen.</p>}
      {params.success === 'race-unpublished' && <p className="alert success">Deltävlingen är återställd till utkast.</p>}
      {params.error && <p className="alert error">Något gick fel: {params.error}</p>}

      <div className="grid">
        <section className="card">
          <h2>1. Skapa cup</h2>
          <form action={createCup}>
            <label htmlFor="season_id">Säsong</label>
            <select id="season_id" name="season_id" required defaultValue="">
              <option value="" disabled>Välj säsong</option>
              {(seasons ?? []).map(s => <option key={s.id} value={s.id}>{s.name}{s.is_active ? ' (aktiv)' : ''}</option>)}
            </select>
            <label htmlFor="cup_name">Cupnamn</label>
            <input id="cup_name" name="name" required placeholder="Syd Cup Vinter 2026" />
            <label htmlFor="cup_type">Typ</label>
            <select id="cup_type" name="cup_type" defaultValue="vinter"><option value="vinter">Vintercup</option><option value="sommar">Sommarcup</option></select>
            <button type="submit">Skapa cup</button>
          </form>
        </section>

        <section className="card">
          <h2>2. Lägg till deltävling</h2>
          <form action={createRace}>
            <label htmlFor="cup_id">Cup</label>
            <select id="cup_id" name="cup_id" required defaultValue="">
              <option value="" disabled>Välj cup</option>
              {(cups ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label htmlFor="race_name">Tävlingsnamn</label>
            <input id="race_name" name="name" required placeholder="Deltävling 1 – Hestra" />
            <label htmlFor="race_date">Datum</label>
            <input id="race_date" name="race_date" type="date" />
            <label htmlFor="source_url">BiathlonTiming-länk</label>
            <input id="source_url" name="source_url" type="url" required placeholder="https://results.biathlontiming.se/?raceId=..." />
            <button type="submit">Lägg till deltävling</button>
          </form>
        </section>
      </div>

      <section className="card section-gap">
        <h2>Befintliga cuper</h2>
        {(cups ?? []).length === 0 ? <p className="muted">Ingen cup skapad ännu.</p> : <table><thead><tr><th>Cup</th><th>Säsong</th><th>Typ</th></tr></thead><tbody>
          {(cups ?? []).map(c => <tr key={c.id}><td><strong>{c.name}</strong></td><td>{Array.isArray(c.seasons) ? c.seasons[0]?.name : (c.seasons as {name?:string}|null)?.name}</td><td>{c.cup_type === 'sommar' ? 'Sommar' : 'Vinter'}</td></tr>)}
        </tbody></table>}
      </section>

      <section className="card section-gap">
        <h2>Deltävlingar</h2>
        {(races ?? []).length === 0 ? <p className="muted">Ingen deltävling tillagd ännu.</p> : <table><thead><tr><th>Tävling</th><th>Cup</th><th>Datum</th><th>Status</th><th>Källa</th><th>Åtgärd</th></tr></thead><tbody>
          {(races ?? []).map(r => <tr key={r.id}><td><strong>{r.name}</strong></td><td>{Array.isArray(r.cups) ? r.cups[0]?.name : (r.cups as {name?:string}|null)?.name}</td><td>{r.race_date ?? '–'}</td><td><span className="badge">{r.status === 'draft' ? 'Utkast' : r.status === 'published' ? 'Publicerad' : r.status}</span></td><td><a className="text-link" href={r.source_url} target="_blank" rel="noreferrer">Öppna resultat</a></td><td><form action={setRaceStatus}><input type="hidden" name="race_id" value={r.id} /><input type="hidden" name="status" value={r.status === 'published' ? 'draft' : 'published'} /><button className="small-button" type="submit">{r.status === 'published' ? 'Återställ' : 'Publicera'}</button></form></td></tr>)}
        </tbody></table>}
      </section>
    </>
  );
}

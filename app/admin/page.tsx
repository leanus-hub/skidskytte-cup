import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { addClassAlias, createCup, createRace, importRaceResults, logout, setRaceStatus } from './admin-actions';

export const dynamic = 'force-dynamic';

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const { data: profile } = await supabase.from('profiles').select('display_name,is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect('/admin/login?error=not-admin');

  const [{ data: seasons }, { data: cups }, { data: races }, { data: classes }] = await Promise.all([
    supabase.from('seasons').select('id,name,is_active').order('starts_on', { ascending: false }),
    supabase.from('cups').select('id,name,cup_type,season_id,seasons(name)').order('created_at', { ascending: false }),
    supabase.from('races').select('id,name,race_date,status,cup_id,source_url,import_status,import_error,imported_result_count,imported_at,import_warnings,cups(name)').order('race_date', { ascending: false }),
    supabase.from('classes').select('id,name,aliases,cup_id,cups(name)').order('sort_order').order('name'),
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
      {params.success === 'class-alias-added' && <p className="alert success">Klassaliaset är sparat.</p>}
      {params.success === 'results-imported' && <p className="alert success">Importen är klar: {params.count ?? '0'} resultat sparades. {Number(params.outside ?? 0) > 0 ? `${params.outside} resultat tillhör klubbar utanför Region Syd och får inga cuppoäng.` : ''}</p>}
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
        <h2>Klassalias</h2>
        <p className="muted">Koppla alternativa klassnamn till cupens officiella klass. Importen tar även automatiskt bort tävlingsformer som Massstart, Sprint och Distans.</p>
        {(classes ?? []).length === 0 ? (
          <p className="muted">Klasser skapas automatiskt vid den första importen.</p>
        ) : (
          <>
            <form action={addClassAlias} className="inline-form">
              <div>
                <label htmlFor="class_id">Officiell klass</label>
                <select id="class_id" name="class_id" required defaultValue="">
                  <option value="" disabled>Välj klass</option>
                  {(classes ?? []).map(c => <option key={c.id} value={c.id}>{Array.isArray(c.cups) ? c.cups[0]?.name : (c.cups as {name?:string}|null)?.name} · {c.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="class_alias">Nytt alias</label>
                <input id="class_alias" name="alias" required placeholder="Pojkar 10-11 Massstart" />
              </div>
              <button type="submit">Lägg till alias</button>
            </form>
            <table>
              <thead><tr><th>Cup</th><th>Officiell klass</th><th>Alias</th></tr></thead>
              <tbody>{(classes ?? []).map(c => <tr key={`class-${c.id}`}><td>{Array.isArray(c.cups) ? c.cups[0]?.name : (c.cups as {name?:string}|null)?.name}</td><td><strong>{c.name}</strong></td><td>{(c.aliases ?? []).length ? (c.aliases ?? []).join(', ') : '–'}</td></tr>)}</tbody>
            </table>
          </>
        )}
      </section>

      <section className="card section-gap">
        <h2>3. Importera resultat</h2>
        <p className="muted">Välj en deltävling och hämta resultaten från BiathlonTiming. När importen lyckats kan tävlingen publiceras.</p>
        {(races ?? []).length === 0 ? (
          <p className="muted">Lägg först till en deltävling.</p>
        ) : (
          <div className="import-list">
            {(races ?? []).map(r => (
              <article className="import-card" key={`import-${r.id}`}>
                <div>
                  <strong>{r.name}</strong>
                  <p className="muted import-meta">{Array.isArray(r.cups) ? r.cups[0]?.name : (r.cups as {name?:string}|null)?.name} · {r.race_date ?? 'Datum saknas'}</p>
                  <span className="badge">{r.import_status === 'imported' ? `${r.imported_result_count} importerade` : r.import_status === 'failed' ? 'Importfel' : r.import_status === 'processing' ? 'Importerar' : 'Inte importerad'}</span>
                  {r.import_error && <p className="error-text">{r.import_error}</p>}
                </div>
                <div className="import-actions">
                  <a className="source-button" href={r.source_url} target="_blank" rel="noreferrer">Öppna resultat</a>
                  <form action={importRaceResults}>
                    <input type="hidden" name="race_id" value={r.id} />
                    <button type="submit">{r.import_status === 'imported' ? 'Importera igen' : 'Importera resultat'}</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card section-gap">
        <h2>Deltävlingar och publicering</h2>
        {(races ?? []).length === 0 ? <p className="muted">Ingen deltävling tillagd ännu.</p> : <table><thead><tr><th>Tävling</th><th>Cup</th><th>Datum</th><th>Status</th><th>Källa</th><th>Import</th><th>Åtgärd</th></tr></thead><tbody>
          {(races ?? []).map(r => <tr key={r.id}><td><strong>{r.name}</strong></td><td>{Array.isArray(r.cups) ? r.cups[0]?.name : (r.cups as {name?:string}|null)?.name}</td><td>{r.race_date ?? '–'}</td><td><span className="badge">{r.status === 'draft' ? 'Utkast' : r.status === 'published' ? 'Publicerad' : r.status}</span></td><td><a className="text-link" href={r.source_url} target="_blank" rel="noreferrer">Öppna resultat</a></td><td><div className="action-stack"><span className="badge">{r.import_status === 'imported' ? `${r.imported_result_count} importerade` : r.import_status === 'failed' ? 'Importfel' : r.import_status === 'processing' ? 'Importerar' : 'Inte importerad'}</span>{r.import_error && <small className="error-text">{r.import_error}</small>}<form action={importRaceResults}><input type="hidden" name="race_id" value={r.id} /><button className="small-button secondary" type="submit">{r.import_status === 'imported' ? 'Importera igen' : 'Importera resultat'}</button></form></div></td><td><form action={setRaceStatus}><input type="hidden" name="race_id" value={r.id} /><input type="hidden" name="status" value={r.status === 'published' ? 'draft' : 'published'} /><button className="small-button" type="submit" disabled={r.import_status !== 'imported'}>{r.status === 'published' ? 'Återställ' : 'Publicera'}</button></form></td></tr>)}
        </tbody></table>}
      </section>
    </>
  );
}

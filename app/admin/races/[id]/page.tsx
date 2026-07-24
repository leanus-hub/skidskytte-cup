import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type ReviewRow = {
  result_id: string;
  class_name: string;
  bib: number | null;
  athlete_name: string;
  club_name: string;
  is_region_club: boolean;
  source_place: number | null;
  region_place: number | null;
  cup_points: number | null;
  result_status: string;
  shooting_hits: number | null;
  shooting_shots: number | null;
  total_time_ms: number | null;
  review_warning: string | null;
};

function timeLabel(ms: number | null) {
  if (ms == null) return '–';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

export default async function RaceReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect('/admin/login?error=not-admin');

  const [{ data: race }, { data: rows, error }] = await Promise.all([
    supabase.from('races').select('id,name,race_date,status,import_status,imported_result_count,cups(name)').eq('id', id).single(),
    supabase.from('race_result_review').select('*').eq('race_id', id).order('class_name').order('source_place', { ascending: true, nullsFirst: false }).order('bib'),
  ]);
  if (!race) notFound();
  const reviewRows = (rows ?? []) as ReviewRow[];
  const warnings = reviewRows.filter(row => row.review_warning);

  return <>
    <section className="hero compact-hero">
      <p className="eyebrow">Resultatgranskning</p>
      <h1>{race.name}</h1>
      <p>{race.race_date ?? 'Datum saknas'} · {race.status === 'published' ? 'Publicerad' : 'Utkast'} · {reviewRows.length} resultat</p>
      <Link className="source-button" href="/admin">← Tillbaka till admin</Link>
    </section>

    {error && <p className="alert error">Granskningsvyn saknas. Kör migration 005 i Supabase.</p>}
    {warnings.length > 0 && <p className="alert error">{warnings.length} rader behöver kontrolleras. De är markerade i tabellen.</p>}

    <section className="card section-gap">
      <h2>Importerade resultat och poäng</h2>
      <p className="muted">Originalplacering är placeringen från BiathlonTiming. Regionplacering räknas om efter att klubbar utanför Region Syd tagits bort.</p>
      <div className="table-scroll"><table>
        <thead><tr><th>Klass</th><th>Startnr</th><th>Åkare</th><th>Klubb</th><th>Status</th><th>Original</th><th>Region</th><th>Poäng</th><th>Skytte</th><th>Tid</th><th>Kontroll</th></tr></thead>
        <tbody>{reviewRows.map(row => <tr key={row.result_id} className={row.review_warning ? 'review-warning' : ''}>
          <td>{row.class_name}</td><td>{row.bib ?? '–'}</td><td><strong>{row.athlete_name}</strong></td><td>{row.club_name}</td>
          <td>{row.result_status}</td><td>{row.source_place ?? '–'}</td><td>{row.region_place ?? '–'}</td><td><strong>{row.cup_points ?? 0}</strong></td>
          <td>{row.shooting_shots ? `${row.shooting_hits}/${row.shooting_shots}` : '–'}</td><td>{timeLabel(row.total_time_ms)}</td><td>{row.review_warning ?? 'OK'}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
  </>;
}

import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: standings, error } = await supabase
    .from('cup_standings')
    .select('class_name, athlete_name, club_name, total_points, races_counted')
    .order('class_name')
    .order('total_points', { ascending: false });

  const grouped = new Map<string, typeof standings>();
  for (const row of standings ?? []) grouped.set(row.class_name, [...(grouped.get(row.class_name) ?? []), row]);

  return <>
    <section className="hero"><h1>Aktuell cupställning</h1><p>Resultaten räknas samman automatiskt från regionens deltävlingar.</p></section>
    {error && <div className="card">Databasen är inte ansluten ännu. Följ README-filen för att skapa tabellerna.</div>}
    {!error && grouped.size === 0 && <div className="card"><h2>Inga resultat ännu</h2><p className="muted">När första tävlingen importerats visas cupställningen här.</p></div>}
    {[...grouped.entries()].map(([className, rows]) => <section key={className} className="card" style={{marginBottom:16}}>
      <h2>{className}</h2><table><thead><tr><th>Placering</th><th>Åkare</th><th>Klubb</th><th>Poäng</th><th>Tävlingar</th></tr></thead>
      <tbody>{rows?.map((row, i) => <tr key={`${row.athlete_name}-${i}`}><td>{i+1}</td><td>{row.athlete_name}</td><td>{row.club_name}</td><td><strong>{row.total_points}</strong></td><td>{row.races_counted}</td></tr>)}</tbody></table>
    </section>)}
  </>;
}

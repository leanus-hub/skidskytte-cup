import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Standing = {
  cup_id: string;
  cup_name: string;
  season_name: string;
  class_id: string;
  class_name: string;
  athlete_id: string;
  athlete_name: string;
  club_name: string;
  cup_place: number;
  total_points: number;
  races_participated: number;
  races_counted: number;
  published_race_count: number;
  dropped_race_count: number;
  shooting_percentage: number | null;
  eligible_for_prize: boolean;
};

type Breakdown = {
  cup_id: string;
  class_id: string;
  athlete_id: string;
  race_id: string;
  race_name: string;
  race_date: string | null;
  region_place: number;
  cup_points: number;
  shooting_hits: number | null;
  shooting_shots: number | null;
  is_counted: boolean;
};

function shootingLabel(row: { shooting_hits: number | null; shooting_shots: number | null }) {
  if (row.shooting_hits == null || row.shooting_shots == null || row.shooting_shots === 0) return '–';
  return `${row.shooting_hits}/${row.shooting_shots}`;
}

export default async function HomePage() {
  const supabase = await createClient();
  const [{ data: standings, error }, { data: breakdown }] = await Promise.all([
    supabase
      .from('cup_standings')
      .select('*')
      .order('cup_name')
      .order('class_name')
      .order('cup_place'),
    supabase
      .from('cup_result_breakdown')
      .select('cup_id,class_id,athlete_id,race_id,race_name,race_date,region_place,cup_points,shooting_hits,shooting_shots,is_counted')
      .order('race_date')
      .order('sort_order'),
  ]);

  const rows = (standings ?? []) as Standing[];
  const details = (breakdown ?? []) as Breakdown[];
  const cups = new Map<string, { name: string; season: string; classes: Map<string, Standing[]> }>();

  for (const row of rows) {
    if (!cups.has(row.cup_id)) cups.set(row.cup_id, { name: row.cup_name, season: row.season_name, classes: new Map() });
    const cup = cups.get(row.cup_id)!;
    cup.classes.set(row.class_name, [...(cup.classes.get(row.class_name) ?? []), row]);
  }

  return <>
    <section className="hero">
      <p className="eyebrow">Region Syd</p>
      <h1>Aktuell cupställning</h1>
      <p>Placeringar, strykresultat och utslagsgivande skytteprocent räknas automatiskt från publicerade deltävlingar.</p>
    </section>

    {error && <div className="card"><h2>Poängmotorn är inte aktiverad</h2><p className="muted">Kör den senaste SQL-migrationen i Supabase och ladda sedan om sidan.</p></div>}
    {!error && cups.size === 0 && <div className="card"><h2>Inga publicerade resultat ännu</h2><p className="muted">Publicera minst en deltävling med resultat för att visa cupställningen.</p></div>}

    {[...cups.entries()].map(([cupId, cup]) => (
      <section key={cupId} className="cup-section">
        <div className="section-heading">
          <div><p className="eyebrow dark">{cup.season}</p><h2>{cup.name}</h2></div>
        </div>
        {[...cup.classes.entries()].map(([className, classRows]) => (
          <section key={className} className="card standings-card">
            <h3>{className}</h3>
            <table>
              <thead><tr><th>Plats</th><th>Åkare</th><th>Klubb</th><th>Poäng</th><th>Skytte</th><th>Starter</th><th>Pris</th></tr></thead>
              <tbody>{classRows.map(row => {
                const athleteDetails = details.filter(d => d.cup_id === row.cup_id && d.class_id === row.class_id && d.athlete_id === row.athlete_id);
                return <tr key={`${row.class_id}-${row.athlete_id}`}>
                  <td><strong>{row.cup_place}</strong></td>
                  <td>
                    <details>
                      <summary>{row.athlete_name}</summary>
                      <div className="result-detail">
                        <table>
                          <thead><tr><th>Deltävling</th><th>Plac.</th><th>Poäng</th><th>Skytte</th><th>Räknas</th></tr></thead>
                          <tbody>{athleteDetails.map(result => <tr key={result.race_id} className={result.is_counted ? '' : 'dropped'}>
                            <td>{result.race_name}</td><td>{result.region_place}</td><td>{result.cup_points}</td><td>{shootingLabel(result)}</td><td>{result.is_counted ? 'Ja' : 'Struken'}</td>
                          </tr>)}</tbody>
                        </table>
                      </div>
                    </details>
                  </td>
                  <td>{row.club_name}</td>
                  <td><strong>{row.total_points}</strong></td>
                  <td>{row.shooting_percentage == null ? '–' : `${row.shooting_percentage.toFixed(2)} %`}</td>
                  <td>{row.races_participated} ({row.races_counted} räknas)</td>
                  <td>{row.eligible_for_prize ? <span className="badge success-badge">Kvalificerad</span> : <span className="badge">Minst 3 krävs</span>}</td>
                </tr>;
              })}</tbody>
            </table>
            {classRows[0] && <p className="table-note">Cupen har {classRows[0].published_race_count} publicerade deltävlingar. {classRows[0].dropped_race_count} resultat stryks per åkare när tillräckligt många resultat finns.</p>}
          </section>
        ))}
      </section>
    ))}
  </>;
}

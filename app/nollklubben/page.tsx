import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type ZeroRow = {
  id:string; athlete_name:string; club_name:string|null; season_label:string|null; event_name:string;
  event_date:string|null; class_name:string|null; discipline:string|null; medal_level:'gold'|'silver'|'bronze';
  source_type:string; source_result_id:string|null;
};

const levelMeta = {
  gold: { title:'Guld', subtitle:'Junior & senior · liggande och stående', icon:'🥇' },
  silver: { title:'Silver', subtitle:'PF14–15 · liggande med remstöd', icon:'🥈' },
  bronze: { title:'Brons', subtitle:'PF10–13 · liggande med stöd', icon:'🥉' },
} as const;

export default async function NollklubbenPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params=await searchParams;
  const season=(params.season??'').trim();
  const q=(params.q??'').trim().toLocaleLowerCase('sv-SE');
  const supabase = await createClient();
  const { data, error } = await supabase.from('zero_shooting_club')
    .select('id,athlete_name,club_name,season_label,event_name,event_date,class_name,discipline,medal_level,source_type,source_result_id')
    .order('season_label',{ascending:false}).order('athlete_name').order('event_name');
  const allRows=(data??[]) as ZeroRow[];
  const seasons=Array.from(new Set(allRows.map(r=>r.season_label).filter(Boolean) as string[])).sort((a,b)=>b.localeCompare(a,'sv'));
  const rows=allRows.filter(r=>(!season||r.season_label===season)&&(!q||r.athlete_name.toLocaleLowerCase('sv-SE').includes(q)||(r.club_name??'').toLocaleLowerCase('sv-SE').includes(q)));
  const winter2026=rows.filter(r=>r.season_label==='2026 Vinter');
  const uniqueAthletes=new Set(winter2026.map(r=>r.athlete_name)).size;
  const linked=winter2026.filter(r=>r.source_result_id).length;

  return <>
    <section className="hero compact-hero"><p className="eyebrow">Region Syd</p><h1>Nollklubben</h1><p>Här samlar vi registrerade nollskyttar – åkare som skjutit fullt i samtliga skjutningar under en tävling. Registret omfattar både Syd Cup och prestationer i andra tävlingar.</p></section>
    {error && <div className="card"><h2>Nollklubben kunde inte hämtas</h2><p className="muted">Försök igen senare.</p></div>}
    {!error && <>
      <form className="inline-form" method="get"><div><label htmlFor="season">Säsong</label><select id="season" name="season" defaultValue={season}><option value="">Alla säsonger</option>{seasons.map(s=><option key={s} value={s}>{s}</option>)}</select></div><div><label htmlFor="q">Sök åkare eller klubb</label><input id="q" name="q" defaultValue={params.q??''} placeholder="Namn eller klubb" /></div><button type="submit">Filtrera</button></form>
      <section className="stats-grid">
        <article className="metric-card"><span>Prestationer · Vinter 2026</span><strong>{winter2026.length}</strong></article>
        <article className="metric-card"><span>Unika nollskyttar · Vinter 2026</span><strong>{uniqueAthletes}</strong></article>
        <article className="metric-card"><span>Verifierade mot Syd Cup-data</span><strong>{linked}</strong></article>
      </section>
      {(['gold','silver','bronze'] as const).map(level=>{
        const levelRows=rows.filter(r=>r.medal_level===level);
        const grouped=new Map<string,ZeroRow[]>();
        for(const row of levelRows){ const key=`${row.athlete_name}|${row.club_name??''}`; grouped.set(key,[...(grouped.get(key)??[]),row]); }
        return <section className="card standings-card zero-section" key={level}>
          <div className="zero-heading"><span className="zero-medal">{levelMeta[level].icon}</span><div><h2>{levelMeta[level].title}</h2><p className="muted">{levelMeta[level].subtitle}</p></div></div>
          <div className="table-scroll"><table><thead><tr><th>Åkare</th><th>Klubb</th><th>Antal</th><th>Prestationer</th></tr></thead>
          <tbody>{Array.from(grouped.values()).map(athleteRows=><tr key={athleteRows[0].id}><td><strong>{athleteRows[0].athlete_name}</strong></td><td>{athleteRows[0].club_name??'–'}</td><td><strong>{athleteRows.length}</strong></td><td><details><summary>Visa {athleteRows.length===1?'prestation':'prestationer'}</summary><div className="zero-results">{athleteRows.map(row=><div key={row.id}><strong>{row.event_name}</strong><span>{row.season_label??''}{row.class_name?` · ${row.class_name}`:''}{row.discipline?` · ${row.discipline}`:''}</span>{row.source_result_id&&<small>Verifierad mot tävlingsresultat</small>}</div>)}</div></details></td></tr>)}</tbody></table></div>
        </section>;
      })}
    </>}
  </>;
}

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic='force-dynamic';

export default async function AthleteSearchPage({searchParams}:{searchParams:Promise<{q?:string}>}){
 const {q=''}=await searchParams; const query=q.trim(); const supabase=await createClient();
 let rows:{id:string;full_name:string;club_id:string;clubs:{name:string;regions:{name:string}|null}|null}[]=[];
 let error=null;
 if(query.length>=2){
  const response=await supabase.from('athletes').select('id,full_name,club_id,clubs(name,regions(name))').ilike('full_name',`%${query}%`).order('full_name').limit(50);
  rows=(response.data??[]) as unknown as typeof rows; error=response.error;
 }
 return <>
  <section className="hero compact-hero"><p className="eyebrow">Åkarsökning</p><h1>Hitta åkare</h1><p>Sök bland åkare från alla registrerade cuper och säsonger.</p></section>
  <section className="card athlete-global-search">
   <form method="get"><label htmlFor="q">Namn</label><div className="search-row"><input id="q" name="q" type="search" defaultValue={query} placeholder="Skriv minst två tecken…" autoComplete="off"/><button type="submit">Sök</button></div></form>
  </section>
  {error&&<div className="alert error">Sökningen kunde inte genomföras.</div>}
  {query.length>0&&query.length<2&&<div className="card empty-state"><h2>Skriv minst två tecken</h2></div>}
  {query.length>=2&&rows.length===0&&!error&&<div className="card empty-state"><h2>Ingen åkare hittades</h2><p className="muted">Ingen registrerad åkare matchar “{query}”.</p></div>}
  {rows.length>0&&<section className="card standings-card"><div className="section-heading"><div><h2>Sökresultat</h2><p className="muted">{rows.length} träff{rows.length===1?'':'ar'} för “{query}”</p></div></div>
   <div className="athlete-search-results">{rows.map(row=><Link href={`/akare/${row.id}`} className="athlete-result-card" key={row.id}><div><strong>{row.full_name}</strong><span>{row.clubs?.name??'Klubb saknas'}{row.clubs?.regions?.name?` · ${row.clubs.regions.name}`:''}</span></div><b>Visa profil →</b></Link>)}</div>
  </section>}
 </>;
}
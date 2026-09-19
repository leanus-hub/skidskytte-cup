'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function KontaktPage() {
  const [state,setState]=useState<'idle'|'sending'|'sent'|'error'>('idle');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setState('sending');
    const f=new FormData(e.currentTarget);
    const supabase=createClient();
    const { error }=await supabase.from('feedback_items').insert({
      type:String(f.get('type')), message:String(f.get('message')).trim(),
      name:String(f.get('name')||'').trim()||null, email:String(f.get('email')||'').trim()||null,
      page_url:String(f.get('page_url')||'').trim()||window.location.href,
    });
    setState(error?'error':'sent'); if(!error)e.currentTarget.reset();
  }
  if(state==='sent') return <section className="card"><p className="eyebrow">Tack!</p><h1>Din återkoppling är skickad</h1><p>Vi har fått ditt ärende och kan nu ta med det i vår prioritering och utvecklingsplan.</p></section>;
  return <section className="card"><p className="eyebrow">Hjälp oss bli bättre</p><h1>Rapportera fel eller lämna förslag</h1><p className="muted">Har du hittat ett fel i resultat eller uppgifter, ett tekniskt problem eller har en idé? Skicka den här.</p>
    <form onSubmit={submit}><label>Typ<select name="type" required defaultValue="improvement"><option value="result_error">Felaktigt resultat</option><option value="data_error">Felaktiga uppgifter</option><option value="technical">Tekniskt fel</option><option value="improvement">Förbättringsförslag</option></select></label>
    <label>Meddelande<textarea name="message" required minLength={3} maxLength={5000} rows={7} placeholder="Beskriv vad du har upptäckt eller vad du skulle vilja förbättra."/></label>
    <div className="form-columns"><label>Namn (frivilligt)<input name="name"/></label><label>E-post (frivilligt)<input name="email" type="email"/></label></div>
    <input type="hidden" name="page_url" value=""/><button disabled={state==='sending'}>{state==='sending'?'Skickar…':'Skicka återkoppling'}</button>{state==='error'&&<p role="alert">Det gick inte att skicka just nu. Försök igen.</p>}</form>
  </section>;
}
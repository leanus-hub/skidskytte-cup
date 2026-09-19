'use client';
import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function KontaktPage() {
  const [state,setState]=useState<'idle'|'sending'|'sent'|'error'>('idle');
  const [count,setCount]=useState(0);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setState('sending');
    const f=new FormData(e.currentTarget);
    const supabase=createClient();
    const { error }=await supabase.from('feedback_items').insert({
      type:String(f.get('type')), message:String(f.get('message')).trim(),
      name:String(f.get('name')||'').trim()||null, email:String(f.get('email')||'').trim()||null,
      page_url:String(f.get('page_url')||'').trim()||window.location.href,
    });
    setState(error?'error':'sent'); if(!error){e.currentTarget.reset();setCount(0);}
  }

  if(state==='sent') return <section className="card feedback-card feedback-success">
    <p className="eyebrow">Tack!</p><h1>Din återkoppling är skickad</h1>
    <p className="muted">Vi har fått ditt ärende och kan nu ta med det i vår prioritering och utvecklingsplan.</p>
    <button type="button" onClick={()=>setState('idle')}>Skicka mer återkoppling</button>
  </section>;

  return <section className="card feedback-card">
    <p className="eyebrow">Hjälp oss bli bättre</p>
    <h1>Rapportera fel eller lämna förslag</h1>
    <p className="muted feedback-intro">Har du hittat ett fel i resultat eller uppgifter, ett tekniskt problem eller har en idé? Skicka den här så hjälper du oss att göra Biathloncup.se ännu bättre.</p>
    <form onSubmit={submit} className="feedback-form">
      <label><span>Typ av ärende <b>*</b></span>
        <select name="type" required defaultValue="improvement">
          <option value="result_error">Felaktigt resultat</option>
          <option value="data_error">Felaktiga uppgifter</option>
          <option value="technical">Tekniskt fel</option>
          <option value="improvement">Förbättringsförslag</option>
        </select>
        <small>Välj den kategori som passar bäst.</small>
      </label>
      <label><span>Meddelande <b>*</b></span>
        <textarea name="message" required minLength={3} maxLength={5000} rows={6}
          onChange={e=>setCount(e.currentTarget.value.length)}
          placeholder="Beskriv vad du har upptäckt eller vad du skulle vilja förbättra."/>
        <small className="feedback-count">{count}/5000</small>
      </label>
      <div className="feedback-contact">
        <label><span>Namn <em>(frivilligt)</em></span><input name="name" placeholder="Ditt namn"/></label>
        <label><span>E-post <em>(frivilligt)</em></span><input name="email" type="email" inputMode="email" placeholder="din.e-post@exempel.se"/></label>
      </div>
      <input type="hidden" name="page_url" value=""/>
      <button className="feedback-submit" disabled={state==='sending'}>{state==='sending'?'Skickar…':'Skicka återkoppling'}</button>
      {state==='error'&&<p className="feedback-error" role="alert">Det gick inte att skicka just nu. Försök igen.</p>}
      <p className="feedback-privacy">Kontaktuppgifter är frivilliga och används bara för att kunna återkoppla kring ditt ärende.</p>
    </form>
  </section>;

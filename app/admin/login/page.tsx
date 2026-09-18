import { login, requestPasswordReset } from '../admin-actions';

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  return (
    <>
      <section className="hero compact-hero">
        <p className="eyebrow">Administration</p>
        <h1>Logga in</h1>
        <p>Endast utsedda administratörer kan ändra cuper och deltävlingar.</p>
      </section>
      <section className="card narrow-card">
        {params.error === 'login' && <p className="alert error">Fel e-postadress eller lösenord.</p>}
        {params.error === 'not-admin' && <p className="alert error">Kontot finns, men är ännu inte administratör.</p>}
        {params.error === 'reset-failed' && <p className="alert error">Kunde inte skicka återställningslänken. Försök igen.</p>}
        {params.success === 'reset-sent' && <p className="alert success">Om kontot finns har en återställningslänk skickats till e-postadressen.</p>}
        <form action={login}>
          <label htmlFor="email">E-post</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
          <label htmlFor="password">Lösenord</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
          <button type="submit">Logga in</button>
        </form>
        <hr />
        <h2>Glömt lösenord?</h2>
        <p className="muted">Ange e-postadressen för ditt adminkonto så skickas en säker återställningslänk.</p>
        <form action={requestPasswordReset}>
          <label htmlFor="reset_email">E-post</label>
          <input id="reset_email" name="email" type="email" autoComplete="email" required />
          <button className="secondary-dark" type="submit">Skicka återställningslänk</button>
        </form>
      </section>
    </>
  );
}

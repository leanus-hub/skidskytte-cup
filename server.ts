import { login } from '../actions';

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
        <form action={login}>
          <label htmlFor="email">E-post</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
          <label htmlFor="password">Lösenord</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
          <button type="submit">Logga in</button>
        </form>
      </section>
    </>
  );
}

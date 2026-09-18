import { updatePassword } from '../admin-actions';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams;
  return <>
    <section className="hero compact-hero"><p className="eyebrow">Administration</p><h1>Välj nytt lösenord</h1><p>Ange ett nytt lösenord för ditt konto.</p></section>
    <section className="card narrow-card">
      {params.error && <p className="alert error">Lösenorden måste vara lika och minst 8 tecken långa.</p>}
      <form action={updatePassword}>
        <label htmlFor="password">Nytt lösenord</label><input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
        <label htmlFor="confirm_password">Bekräfta lösenord</label><input id="confirm_password" name="confirm_password" type="password" minLength={8} autoComplete="new-password" required />
        <button type="submit">Spara nytt lösenord</button>
      </form>
    </section>
  </>;
}

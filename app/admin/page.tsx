export default function AdminPage() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Administratör</p>
        <h1>Importera tävling</h1>
        <p>Kontrollera en BiathlonTiming-länk och plocka ut tävlingens ID.</p>
      </section>

      <div className="grid">
        <section className="card">
          <h2>Kontrollera länk</h2>
          <form action="/api/import" method="post">
            <label htmlFor="url">Resultatlänk</label>
            <input
              id="url"
              name="url"
              type="url"
              required
              placeholder="https://results.biathlontiming.se/?raceId=..."
            />
            <button type="submit">Analysera länk</button>
          </form>
        </section>

        <section className="card">
          <h2>Status</h2>
          <p className="status"><span /> Säker publik grund klar</p>
          <p className="muted">
            Nästa steg är administratörsinloggning och faktisk hämtning av resultatdata. Ingen hemlig
            Supabase-nyckel behövs för den här första publiceringen.
          </p>
        </section>
      </div>
    </>
  );
}

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">CLAUDMOR</div>
        <h1>Authentication for Claudium.</h1>
        <p>
          HWID and account-bound licensing, short-lived sessions, one-time bootstrap tickets,
          and metered Claudium obfuscation.
        </p>
        <div className="chips">
          <span>HWID locked</span>
          <span>Roblox ID locks</span>
          <span>Discord ID locks</span>
          <span>One-time tickets</span>
        </div>
      </section>

      <section className="panel">
        <div>
          <small>BOOTSTRAP SECURITY</small>
          <strong>No public loader asset</strong>
          <p>Private bootstrap logic stays server-side. Clients receive only signed session capabilities.</p>
        </div>
        <div>
          <small>CLAUDIUM</small>
          <strong>Credit-metered obfuscation</strong>
          <p>A credit is reserved for a run and refunded when the internal obfuscator fails.</p>
        </div>
      </section>
    </main>
  );
}

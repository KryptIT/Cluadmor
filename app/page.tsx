import Link from "next/link";

const steps = [
  ["01 // Create", "Create a Service", "Create your Claudmor service and choose the account locks you want to require."],
  ["02 // Providers", "Connect Providers", "Attach LootLabs, Linkvertise or Boostellar with your own provider credentials."],
  ["03 // Keys", "Configure Key Rules", "Choose HWID, Roblox and Discord locks, expiration, resets and provider checkpoints."],
  ["04 // Ship", "Get Your Lua", "Generate the small Claudmor client integration and keep the sensitive logic server-side."]
];

const features = [
  ["◇", "HWID + Account Locks", "Bind keys to HWID, Roblox UserId, Roblox username and Discord UserId."],
  ["⌁", "Provider Choice", "Use LootLabs, Linkvertise, Boostellar, or combine multiple provider checkpoints."],
  ["⚿", "Key Management", "Issue, revoke, expire and reset keys from one dashboard."],
  ["▦", "Multi-Service", "Run separate key systems for different scripts and projects from one account."],
  ["↗", "Server-Side Bootstrap", "Private bootstrap logic stays off the public website and out of static assets."],
  ["◆", "Claudium Credits", "Use Claudium obfuscation directly through the same dashboard and API."]
];

export default function Home() {
  return (
    <main className="home">
      <nav className="homeNav">
        <Link href="/" className="homeLogo"><span>C</span> CLAUDMOR</Link>
        <div className="homeLinks">
          <a href="#how">How It Works</a>
          <a href="#features">Features</a>
          <a href="https://dsc.gg/oxyenv" target="_blank" rel="noreferrer">Discord</a>
          <a href="https://guns.lol/larpcorrupted" target="_blank" rel="noreferrer">larpcorrupted</a>
          <Link href="/dashboard" className="homeLogin">Dashboard</Link>
        </div>
      </nav>

      <section className="homeHero">
        <div className="heroGlow heroGlowA" />
        <div className="heroGlow heroGlowB" />
        <div className="heroBadge"><i /> AUTHENTICATION + CLAUDIUM</div>
        <h1>Protect Your Scripts<br/><span>Without The Slop.</span></h1>
        <p>
          Claudmor is a Lua key-system and licensing platform for Roblox scripts.
          Create services, lock keys to users and devices, connect your own monetization
          providers, and use Claudium obfuscation from one place.
        </p>
        <div className="heroActions">
          <Link href="/dashboard" className="heroPrimary">⚡ Open Dashboard</Link>
          <a href="#how" className="heroSecondary">▣ See How It Works</a>
        </div>

        <div className="terminalPreview">
          <div className="terminalTop">
            <div className="terminalDots"><i/><i/><i/></div>
            <span>CLAUDMOR // SERVICE OVERVIEW</span>
            <span className="terminalOnline">● ONLINE</span>
          </div>
          <div className="terminalBody">
            <div className="terminalBrand">
              <span className="terminalMark">C</span>
              <div><strong>CLAUDMOR</strong><small>AUTH • LICENSE • OBFUSCATE</small></div>
            </div>
            <div className="terminalStats">
              <div><small>SERVICE</small><strong>Magnify Hub</strong></div>
              <div><small>LOCKS</small><strong>HWID + ROBLOX</strong></div>
              <div><small>PROVIDERS</small><strong>3 AVAILABLE</strong></div>
              <div><small>CLAUDIUM</small><strong>READY</strong></div>
            </div>
            <div className="terminalLine"><span>$</span> auth.verify(key, hwid, userId) <em>→ ACCESS GRANTED</em></div>
          </div>
        </div>
      </section>

      <section className="homeSection" id="how">
        <div className="sectionEyebrow">// HOW IT WORKS</div>
        <h2>From Service To Protected Script</h2>
        <p className="sectionLead">Four steps to get a production-ready Claudmor key system.</p>
        <div className="stepGrid">
          {steps.map(([num,title,body]) => (
            <article className="homeCard" key={num}>
              <span className="cardNum">{num}</span>
              <div className="cardIcon">⌁</div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="homeSection" id="features">
        <div className="sectionEyebrow">// FEATURES</div>
        <h2>Built For Lua Key Systems</h2>
        <p className="sectionLead">Authentication, monetization and Claudium without forcing every service into the same setup.</p>
        <div className="featureGrid">
          {features.map(([icon,title,body]) => (
            <article className="featureCard" key={title}>
              <span className="featureIcon">{icon}</span>
              <div><h3>{title}</h3><p>{body}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="quickSection">
        <div className="quickCopy">
          <div className="sectionEyebrow">// QUICK START</div>
          <h2>Create Your First Service</h2>
          <p>Configure the service, choose providers, set your locks, then generate the integration code from the dashboard.</p>
          <div className="miniList">
            <span>01</span><div><strong>Create service</strong><small>One project, one isolated key system.</small></div>
            <span>02</span><div><strong>Choose providers</strong><small>LootLabs, Linkvertise and Boostellar.</small></div>
            <span>03</span><div><strong>Set locks</strong><small>HWID, Roblox and Discord identity.</small></div>
          </div>
        </div>

        <div className="quickPanel">
          <div className="quickPanelLabel">// SERVICE SETUP</div>
          <label>Service Name<input defaultValue="Magnify Hub" readOnly /></label>
          <label>Protection
            <div className="fakeChecks">
              <span>✓ HWID</span><span>✓ Roblox UserId</span><span>○ Discord UserId</span>
            </div>
          </label>
          <label>Provider
            <div className="fakeChecks">
              <span>LootLabs</span><span>Linkvertise</span><span>Boostellar</span>
            </div>
          </label>
          <Link href="/dashboard/services" className="quickButton">Create In Dashboard →</Link>
        </div>
      </section>

      <section className="communityStrip">
        <div>
          <div className="sectionEyebrow">// COMMUNITY</div>
          <h2>Claudmor by larpcorrupted</h2>
          <p>Join the Discord for updates, setup help and Claudium releases.</p>
        </div>
        <div className="communityActions">
          <a href="https://dsc.gg/oxyenv" target="_blank" rel="noreferrer">Discord ↗</a>
          <a href="https://guns.lol/larpcorrupted" target="_blank" rel="noreferrer">guns.lol ↗</a>
        </div>
      </section>

      <footer className="homeFooter">
        <span>CLAUDMOR</span>
        <span>Authentication for Claudium.</span>
        <div><a href="https://dsc.gg/oxyenv">Discord</a><a href="https://guns.lol/larpcorrupted">larpcorrupted</a></div>
      </footer>
    </main>
  );
}

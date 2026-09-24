import Link from "next/link";
import {
  ArrowRight,
  Code2,
  ExternalLink,
  KeyRound,
  Route,
  ShieldCheck
} from "lucide-react";

const rows = [
  {
    icon: ShieldCheck,
    title: "Access control",
    body: "HWID and account-bound keys with server-side verification."
  },
  {
    icon: Route,
    title: "Loader routing",
    body: "Map PlaceId or UniverseId to the script that service should return."
  },
  {
    icon: Code2,
    title: "Claudium",
    body: "Save source per service and send it through the Claudium backend."
  }
];

export default function Home() {
  return (
    <main className="site">
      <header className="siteHeader">
        <Link href="/" className="siteBrand">
          <img src="/claudmor-mark.svg" alt="" />
          <span>Claudmor</span>
        </Link>

        <nav className="siteNav">
          <a href="#product">Product</a>
          <a href="#routing">Routing</a>
          <a href="https://dsc.gg/oxyenv" target="_blank" rel="noreferrer">Discord</a>
        </nav>

        <div className="siteActions">
          <Link href="/login" className="siteTextLink">Sign in</Link>
          <Link href="/dashboard" className="siteButton">Open dashboard <ArrowRight size={14} /></Link>
        </div>
      </header>

      <section className="siteHero">
        <div className="heroMain">
          <span className="heroKicker">Lua authentication + delivery</span>
          <h1>Control who runs your scripts, and what they receive.</h1>
          <p>
            Claudmor handles keys, identity locks, provider flows, script storage,
            and place/universe routing. Claudium handles the obfuscation.
          </p>

          <div className="heroButtons">
            <Link href="/login" className="siteButton heroButton">Create an account <ArrowRight size={14} /></Link>
            <Link href="/dashboard" className="siteGhostButton">Open dashboard</Link>
          </div>

          <div className="heroStatus">
            <span><i /> Railway Claudium backend</span>
            <span>HWID / Roblox / Discord bindings</span>
            <span>LootLabs / Linkvertise / Boostellar</span>
          </div>
        </div>

        <aside className="heroPanel">
          <div className="heroPanelTop">
            <div>
              <span className="panelLabel">SERVICE</span>
              <strong>Magnify Hub</strong>
            </div>
            <span className="panelState">active</span>
          </div>

          <div className="heroPanelRows">
            <div>
              <span>Key policy</span>
              <strong>HWID + Roblox UserId</strong>
            </div>
            <div>
              <span>Default script</span>
              <strong>main.lua</strong>
            </div>
            <div>
              <span>Universe 286090429</span>
              <strong>prison.lua</strong>
            </div>
            <div>
              <span>Provider</span>
              <strong>LootLabs</strong>
            </div>
          </div>

          <div className="heroPanelCode">
            <span>resolve</span>
            <code>game.PlaceId → script route</code>
            <b>200</b>
          </div>
        </aside>
      </section>

      <section className="productSection" id="product">
        <div className="productIntro">
          <span className="sectionIndex">01</span>
          <div>
            <h2>One workspace per account.</h2>
            <p>
              Every user manages their own services, keys, scripts, providers,
              and loader routes. Your owner key only skips reward gates.
            </p>
          </div>
        </div>

        <div className="productRows">
          {rows.map(({ icon: Icon, title, body }) => (
            <div className="productRow" key={title}>
              <Icon size={18} strokeWidth={1.7} />
              <strong>{title}</strong>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="routingSection" id="routing">
        <div className="routingCopy">
          <span className="sectionIndex">02</span>
          <h2>Route games without shipping multiple loaders.</h2>
          <p>
            One service can return different scripts for different Roblox places or universes.
            Place routes win first, then universe routes, then the default.
          </p>
          <Link href="/dashboard/routes" className="inlineAction">
            Configure loader routes <ArrowRight size={14} />
          </Link>
        </div>

        <div className="routeTable">
          <div className="routeTableHead">
            <span>Match</span>
            <span>ID</span>
            <span>Script</span>
          </div>
          <div className="routeTableRow">
            <span>Place</span>
            <code>155615604</code>
            <strong>prison.lua</strong>
          </div>
          <div className="routeTableRow">
            <span>Universe</span>
            <code>286090429</code>
            <strong>main.lua</strong>
          </div>
          <div className="routeTableRow">
            <span>Default</span>
            <code>—</code>
            <strong>fallback.lua</strong>
          </div>
        </div>
      </section>

      <section className="siteBottom">
        <div>
          <KeyRound size={18} />
          <h3>Keys stay simple.</h3>
          <p>Create, bind, expire, revoke, and reset them from the service that owns them.</p>
        </div>
        <div>
          <Code2 size={18} />
          <h3>Scripts stay private.</h3>
          <p>Source is encrypted at rest and the public loader never needs your service management secret.</p>
        </div>
      </section>

      <footer className="siteFooter">
        <Link href="/" className="siteBrand footerBrand">
          <img src="/claudmor-mark.svg" alt="" />
          <span>Claudmor</span>
        </Link>

        <span>Built by larpcorrupted</span>

        <div>
          <a href="https://dsc.gg/oxyenv" target="_blank" rel="noreferrer">Discord <ExternalLink size={12} /></a>
          <a href="https://guns.lol/larpcorrupted" target="_blank" rel="noreferrer">guns.lol <ExternalLink size={12} /></a>
        </div>
      </footer>
    </main>
  );
}

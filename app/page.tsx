import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Code2,
  Coins,
  ExternalLink,
  KeyRound,
  Link2,
  LockKeyhole,
  MessageCircle,
  PlugZap,
  ServerCog,
  ShieldCheck,
  SquareTerminal,
  Webhook
} from "lucide-react";

const steps = [
  { n: "01", title: "Create a service", body: "Give one script or project its own isolated key system.", icon: Boxes },
  { n: "02", title: "Connect providers", body: "Use your own LootLabs, Linkvertise, or Boostellar configuration.", icon: PlugZap },
  { n: "03", title: "Set key rules", body: "Choose HWID, Roblox, Discord, expiry, and reset requirements.", icon: KeyRound },
  { n: "04", title: "Ship the integration", body: "Generate a small client stub while sensitive logic stays server-side.", icon: Code2 }
];

const features = [
  { title: "Identity locks", body: "HWID, Roblox UserId, Roblox username, and Discord UserId.", icon: LockKeyhole },
  { title: "Provider choice", body: "One provider, several providers, or ordered checkpoints per service.", icon: Link2 },
  { title: "Server-side bootstrap", body: "No public loader asset or static bootstrap endpoint.", icon: ServerCog },
  { title: "Claudium credits", body: "One successful obfuscation consumes one credit; failed runs refund it.", icon: Coins },
  { title: "Webhooks and API", body: "Build your own automation around keys, auth events, and completions.", icon: Webhook },
  { title: "Service isolation", body: "Separate secrets, rules, providers, and keys for every project.", icon: ShieldCheck }
];

const sample = [
  "local response = request({",
  "    Url = CLAUDMOR_URL .. \"/api/v1/auth\",",
  "    Method = \"POST\",",
  "    Headers = { [\"Content-Type\"] = \"application/json\" },",
  "    Body = HttpService:JSONEncode(payload)",
  "})",
  "",
  "-- private decisions remain server-side"
].join("\n");

export default function Home() {
  return (
    <main className="home">
      <header className="homeNav">
        <Link href="/" className="homeLogo">
          <img src="/claudmor-mark.svg" alt="" />
          <span>Claudmor</span>
        </Link>
        <nav className="homeLinks">
          <a href="#workflow">Workflow</a>
          <a href="#features">Features</a>
          <a href="https://dsc.gg/oxyenv" target="_blank" rel="noreferrer">Discord</a>
          <a href="https://guns.lol/larpcorrupted" target="_blank" rel="noreferrer">larpcorrupted</a>
        </nav>
        <Link href="/dashboard" className="navAction">Open dashboard <ArrowRight size={14} /></Link>
      </header>

      <section className="homeHero">
        <div className="heroCopy">
          <div className="eyebrow">CLAUDMOR / AUTH FOR LUA</div>
          <h1>Authentication and obfuscation for Lua scripts.</h1>
          <p>
            Build a key system around your script without exposing the bootstrap logic.
            Lock access to devices and accounts, connect your own monetization provider,
            and send protected code through Claudium.
          </p>
          <div className="heroActions">
            <Link href="/dashboard" className="heroPrimary">Create a service <ArrowRight size={16} /></Link>
            <a href="#workflow" className="heroSecondary">See the workflow</a>
          </div>
          <div className="heroMeta">
            <span><CheckCircle2 size={14} /> HWID</span>
            <span><CheckCircle2 size={14} /> Roblox</span>
            <span><CheckCircle2 size={14} /> Discord</span>
            <span><CheckCircle2 size={14} /> BYO providers</span>
          </div>
        </div>

        <aside className="servicePreview">
          <div className="previewHead">
            <div className="previewBrand">
              <img src="/claudmor-mark.svg" alt="" />
              <div><strong>Magnify Hub</strong><span>example service</span></div>
            </div>
            <span className="liveDot">live</span>
          </div>
          <dl className="previewRows">
            <div><dt>Authentication</dt><dd>HWID + Roblox UserId</dd></div>
            <div><dt>Provider flow</dt><dd>LootLabs → Linkvertise</dd></div>
            <div><dt>Key duration</dt><dd>24 hours</dd></div>
            <div><dt>Obfuscator</dt><dd>Claudium / ready</dd></div>
          </dl>
          <div className="previewCode">
            <SquareTerminal size={16} />
            <code>auth.verify(key, hwid, userId)</code>
            <span>200</span>
          </div>
        </aside>
      </section>

      <section className="homeSection workflowSection" id="workflow">
        <div className="sectionIntro">
          <div className="eyebrow">WORKFLOW</div>
          <h2>Four decisions, then ship.</h2>
          <p>No wizard maze. Each step maps directly to something you control in the dashboard.</p>
        </div>
        <div className="stepList">
          {steps.map(step => {
            const Icon = step.icon;
            return (
              <div className="stepRow" key={step.n}>
                <span className="stepNum">{step.n}</span>
                <Icon size={19} strokeWidth={1.7} />
                <div><strong>{step.title}</strong><p>{step.body}</p></div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="homeSection" id="features">
        <div className="sectionIntro">
          <div className="eyebrow">FEATURES</div>
          <h2>Useful controls, not dashboard filler.</h2>
          <p>Claudmor keeps the things you actually change close to the service they affect.</p>
        </div>
        <div className="featureList">
          {features.map(feature => {
            const Icon = feature.icon;
            return (
              <div className="featureRow" key={feature.title}>
                <Icon size={18} strokeWidth={1.7} />
                <div><strong>{feature.title}</strong><p>{feature.body}</p></div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="homeSection quickStart">
        <div className="quickCopy">
          <div className="eyebrow">INTEGRATION</div>
          <h2>The client stays small.</h2>
          <p>
            Treat anything delivered to the executor as public. Claudmor keeps secrets,
            provider verification, account checks, and bootstrap decisions on the server.
          </p>
          <Link href="/dashboard/scripts" className="inlineLink">Generate an integration <ArrowRight size={14} /></Link>
        </div>
        <div className="codePanel">
          <div className="codePanelHead"><Code2 size={15} /> client.lua</div>
          <pre>{sample}</pre>
        </div>
      </section>

      <section className="communityStrip">
        <div>
          <div className="eyebrow">COMMUNITY</div>
          <h2>Built by larpcorrupted.</h2>
          <p>Project updates, support, and Claudium releases live in the Discord.</p>
        </div>
        <div className="communityActions">
          <a href="https://dsc.gg/oxyenv" target="_blank" rel="noreferrer"><MessageCircle size={16} /> Discord <ExternalLink size={13} /></a>
          <a href="https://guns.lol/larpcorrupted" target="_blank" rel="noreferrer">guns.lol <ExternalLink size={13} /></a>
        </div>
      </section>

      <footer className="homeFooter">
        <Link href="/" className="footerBrand"><img src="/claudmor-mark.svg" alt="" /> Claudmor</Link>
        <span>Authentication for Claudium.</span>
        <Link href="/dashboard">Dashboard <ArrowRight size={13} /></Link>
      </footer>
    </main>
  );
}

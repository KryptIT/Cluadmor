import { Code2, Copy, WandSparkles } from "lucide-react";

export default function ScriptsPage() {
  return (
    <>
      <div className="pageHead"><div><span className="muted">Key system</span><h1>Lua scripts</h1><p>Generate the small public client integration for a service. Sensitive bootstrap logic stays server-side.</p></div></div>
      <section className="panelCard">
        <div className="panelTitle"><div><span className="iconBox"><Code2 size={15}/></span><strong>Client integration</strong></div></div>
        <div className="formGrid" style={{marginTop:16}}>
          <label>Service<select className="input"><option>Select service...</option></select></label>
          <label>Key variable<input className="input" defaultValue="getgenv().Key" /></label>
        </div>
        <div className="codeBlock">-- Select a service to generate the Claudmor client integration.</div>
        <div className="row"><button className="primaryBtn"><WandSparkles size={14}/> Generate</button><button className="secondaryBtn"><Copy size={14}/> Copy</button></div>
      </section>
    </>
  );
}

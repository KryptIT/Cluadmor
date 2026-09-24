export default function ScriptsPage() {
  return (
    <>
      <div className="pageHead"><div><span className="muted">KEY SYSTEM</span><h1>Lua Scripts</h1><p>Generate the small public client stub for a service. Sensitive bootstrap logic stays server-side.</p></div></div>
      <section className="panelCard">
        <div className="formGrid">
          <label>Service<select className="input"><option>Select service...</option></select></label>
          <label>Key variable<input className="input" defaultValue="getgenv().Key" /></label>
        </div>
        <div className="codeBlock">-- Select a service to generate the Claudmor client integration.</div>
        <div className="row"><button className="primaryBtn">Generate Script</button><button className="secondaryBtn">Copy</button></div>
      </section>
    </>
  );
}

import { Coins, Plus } from "lucide-react";

export default function Credits() {
  return (
    <>
      <div className="pageHead"><div><span className="muted">Claudium</span><h1>Obfuscation credits</h1><p>One successful Claudium obfuscation consumes one credit.</p></div><button className="primaryBtn"><Plus size={14}/> Get 1 credit</button></div>
      <div className="statGrid">
        <div className="statCard"><span>Available</span><strong>0</strong><small>Ready to use</small></div>
        <div className="statCard"><span>Used</span><strong>0</strong><small>Lifetime</small></div>
        <div className="statCard"><span>Status</span><strong><Coins size={21}/></strong><small>Claudium connected</small></div>
        <div className="statCard"><span>Cost</span><strong>1</strong><small>credit per success</small></div>
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Ban,
  Coins,
  FileCode2,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  Trash2
} from "lucide-react";

type Entry = {
  id: string;
  kind: string;
  value_hint: string;
  reason?: string | null;
  created_at: string;
};

type Block = {
  reason: string;
  created_at: string;
  service_name: string;
  hwid_hash?: string | null;
};

type CreditUser = {
  id: string;
  email?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  obfuscation_credits: number;
  unlimited_obfuscation_credits: boolean;
};

export default function OwnerToolsPage() {
  const [owner, setOwner] = useState<boolean | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [users, setUsers] = useState<CreditUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [kind, setKind] = useState("IP");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const ownerRes = await fetch("/api/owner/session", { cache: "no-store" });
    const ownerData = ownerRes.ok ? await ownerRes.json() : null;
    const active = !!ownerData?.owner;

    setOwner(active);
    if (!active) return;

    const [blacklistRes, usersRes] = await Promise.all([
      fetch("/api/owner/blacklist", { cache: "no-store" }),
      fetch("/api/owner/users", { cache: "no-store" })
    ]);

    if (blacklistRes.ok) {
      const data = await blacklistRes.json();
      setEntries(data.entries || []);
      setBlocks(data.recentBlocks || []);
    }

    if (usersRes.ok) {
      const data = await usersRes.json();
      setUsers(data.users || []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function runAction(action: string) {
    setBusy(action);
    setMessage("");

    try {
      const res = await fetch("/api/owner/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Owner action failed.");
        return;
      }

      const failed = Array.isArray(data.failed) ? data.failed.length : 0;

      setMessage(
        `${data.succeeded || 0}/${data.total || 0} completed${
          failed ? `; ${failed} failed` : "."
        }`
      );
    } finally {
      setBusy("");
    }
  }

  async function setUnlimited(userId: string, enabled: boolean) {
    setBusy("credit-" + userId);
    setMessage("");

    try {
      const res = await fetch("/api/owner/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, unlimitedObfuscation: enabled })
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Could not update user credit access.");
        return;
      }

      setMessage(enabled ? "Unlimited credits enabled." : "Unlimited credits removed.");
      await load();
    } finally {
      setBusy("");
    }
  }

  async function addBlacklist() {
    if (!value.trim()) return;

    setBusy("blacklist");
    setMessage("");

    try {
      const res = await fetch("/api/owner/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, value, reason })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Could not add blacklist entry.");
        return;
      }

      setValue("");
      setReason("");
      setMessage("Blacklist entry added.");
      await load();
    } finally {
      setBusy("");
    }
  }

  async function removeEntry(id: string) {
    setBusy(id);

    try {
      const res = await fetch("/api/owner/blacklist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });

      if (res.ok) await load();
    } finally {
      setBusy("");
    }
  }

  if (owner === false) {
    return (
      <>
        <div className="pageHead">
          <div>
            <span className="muted">Owner</span>
            <h1>Owner tools</h1>
            <p>Bulk protection and global access controls.</p>
          </div>
        </div>

        <div className="notice ownerNotice">
          <div>
            <strong>Owner access required</strong>
            <span>Enable owner bypass before opening these tools.</span>
          </div>
          <Link className="secondaryBtn" href="/dashboard/settings">
            Open settings
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="pageHead">
        <div>
          <span className="muted">Owner</span>
          <h1>Owner tools</h1>
          <p>
            Bulk re-obfuscation, loader republishing, blacklists, and blocked
            attempt diagnostics.
          </p>
        </div>
      </div>

      <div className="splitGrid">
        <section className="panelCard">
          <div className="panelTitle">
            <div>
              <span className="iconBox"><FileCode2 size={15}/></span>
              <strong>Scripts</strong>
            </div>
          </div>

          <div className="settingsBody">
            <p>
              Rebuild saved scripts with the current Claudium backend and
              anti-tamper enabled.
            </p>

            <div className="row">
              <button
                className="secondaryBtn"
                disabled={busy !== ""}
                onClick={() => runAction("reobfuscate_all_scripts")}
              >
                {busy === "reobfuscate_all_scripts"
                  ? <Loader2 size={14} className="spin"/>
                  : <RefreshCcw size={14}/>}
                My scripts
              </button>

              <button
                className="primaryBtn"
                disabled={busy !== ""}
                onClick={() => runAction("reobfuscate_all_users_scripts")}
              >
                {busy === "reobfuscate_all_users_scripts"
                  ? <Loader2 size={14} className="spin"/>
                  : <RefreshCcw size={14}/>}
                All users' scripts
              </button>
            </div>

            <small className="muted">
              System-wide rebuild affects every saved Claudmor script.
            </small>
          </div>
        </section>

        <section className="panelCard">
          <div className="panelTitle">
            <div>
              <span className="iconBox"><ShieldAlert size={15}/></span>
              <strong>Loaders</strong>
            </div>
          </div>

          <div className="settingsBody">
            <p>
              Regenerate published loaders and public bootstraps with the latest
              Claudium build.
            </p>

            <div className="row">
              <button
                className="secondaryBtn"
                disabled={busy !== ""}
                onClick={() => runAction("republish_all_loaders")}
              >
                {busy === "republish_all_loaders"
                  ? <Loader2 size={14} className="spin"/>
                  : <RefreshCcw size={14}/>}
                My loaders
              </button>

              <button
                className="primaryBtn"
                disabled={busy !== ""}
                onClick={() => runAction("republish_all_users_loaders")}
              >
                {busy === "republish_all_users_loaders"
                  ? <Loader2 size={14} className="spin"/>
                  : <RefreshCcw size={14}/>}
                All users' loaders
              </button>
            </div>

            <small className="muted">
              System-wide rebuild affects every currently published Claudmor loader.
            </small>
          </div>
        </section>
      </div>

      {message && <div className="settingsMessage">{message}</div>}

      <section className="panelCard outputPanel">
        <div className="panelTitle">
          <div>
            <span className="iconBox"><Coins size={15}/></span>
            <strong>User credit access</strong>
          </div>
        </div>

        <div className="settingsBody">
          <p>Select Claudmor accounts that should have permanent unlimited Claudium obfuscation credits.</p>
          <input
            className="input"
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            placeholder="Search by email, username, or display name"
          />
        </div>

        <div className="overviewList">
          {users
            .filter(user => {
              const q = userSearch.trim().toLowerCase();
              if (!q) return true;
              return [user.email, user.username, user.display_name]
                .filter(Boolean)
                .some(value => String(value).toLowerCase().includes(q));
            })
            .map(user => (
              <div className="overviewRow" key={user.id}>
                <Coins size={15}/>
                <div>
                  <strong>{user.display_name || user.username || user.email || "Claudmor user"}</strong>
                  <small>
                    {user.email || user.id} - credits: {user.unlimited_obfuscation_credits ? "∞" : user.obfuscation_credits}
                  </small>
                </div>

                <button
                  className={user.unlimited_obfuscation_credits ? "secondaryBtn" : "primaryBtn"}
                  disabled={busy !== ""}
                  onClick={() => setUnlimited(user.id, !user.unlimited_obfuscation_credits)}
                >
                  {busy === "credit-" + user.id
                    ? <Loader2 size={13} className="spin"/>
                    : <Coins size={14}/>}
                  {user.unlimited_obfuscation_credits ? "Remove unlimited" : "Give unlimited"}
                </button>
              </div>
            ))}
        </div>
      </section>

      <section className="panelCard outputPanel">
        <div className="panelTitle">
          <div>
            <span className="iconBox"><Ban size={15}/></span>
            <strong>Add blacklist entry</strong>
          </div>
        </div>

        <div className="formGrid" style={{ paddingTop: 16 }}>
          <label>
            Block
            <select
              className="input"
              value={kind}
              onChange={e => setKind(e.target.value)}
            >
              <option value="IP">IP address</option>
              <option value="HWID">HWID</option>
              <option value="ROBLOX_USER_ID">Roblox UserId</option>
              <option value="DISCORD_USER_ID">Discord UserId</option>
              <option value="ACCOUNT_EMAIL">Claudmor account email</option>
              <option value="ACCOUNT_USER_ID">Claudmor account ID</option>
            </select>
          </label>

          <label>
            Value
            <input
              className="input"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={
                kind === "IP"
                  ? "203.0.113.10"
                  : kind === "ACCOUNT_EMAIL"
                    ? "user@example.com"
                    : "ID / value"
              }
            />
          </label>

          <label>
            Reason
            <input
              className="input"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="optional reason"
            />
          </label>

          <div className="row">
            <button
              className="primaryBtn"
              disabled={busy !== "" || !value.trim()}
              onClick={addBlacklist}
            >
              {busy === "blacklist"
                ? <Loader2 size={14} className="spin"/>
                : <Ban size={14}/>}
              Blacklist
            </button>
          </div>
        </div>
      </section>

      <section className="panelCard outputPanel">
        <div className="panelTitle">
          <div>
            <span className="iconBox"><ShieldAlert size={15}/></span>
            <strong>Active blacklist</strong>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="emptyState">
            <strong>No blacklist entries</strong>
            <p>Blocked identities will appear here.</p>
          </div>
        ) : (
          <div className="overviewList">
            {entries.map(entry => (
              <div className="overviewRow" key={entry.id}>
                <Ban size={15}/>
                <div>
                  <strong>{entry.kind} - {entry.value_hint}</strong>
                  <small>
                    {entry.reason || "No reason"} -{" "}
                    {new Date(entry.created_at).toLocaleString()}
                  </small>
                </div>

                <button
                  className="iconButton"
                  disabled={busy === entry.id}
                  onClick={() => removeEntry(entry.id)}
                  aria-label="Remove blacklist entry"
                >
                  {busy === entry.id
                    ? <Loader2 size={13} className="spin"/>
                    : <Trash2 size={14}/>}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panelCard outputPanel">
        <div className="panelTitle">
          <div>
            <span className="iconBox"><ShieldAlert size={15}/></span>
            <strong>Recent blocked attempts</strong>
          </div>
        </div>

        {blocks.length === 0 ? (
          <div className="emptyState">
            <strong>No recent blocked attempts</strong>
            <p>Blacklist hits from your services will appear here.</p>
          </div>
        ) : (
          <div className="overviewList">
            {blocks.map((item, index) => (
              <div className="overviewRow" key={item.created_at + index}>
                <ShieldAlert size={15}/>
                <div>
                  <strong>{item.reason} - {item.service_name}</strong>
                  <small>
                    {item.hwid_hash
                      ? "HWID " + item.hwid_hash.slice(0, 10) + "... - "
                      : ""}
                    {new Date(item.created_at).toLocaleString()}
                  </small>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

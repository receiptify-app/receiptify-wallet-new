import { useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, BarChart3, FilePlus2,
  MoreHorizontal, Receipt, Search, Settings2, Share2, Sparkles, UsersRound, X,
} from "lucide-react";
import "./_group.css";

type ReceiptItem = {
  merchant: string; date: string; amount: string; category: string;
  color: string; initials: string; shared?: string; note?: string;
};

const receipts: ReceiptItem[] = [
  { merchant: "Sainsbury's", date: "18 Mar 2025 · 18:42", amount: "£38.60", category: "Groceries", color: "#6e8b78", initials: "S", shared: "Your share £22.40", note: "Weekly shop" },
  { merchant: "The Green Room", date: "16 Mar 2025 · 20:15", amount: "£48.00", category: "Dining", color: "#c77b61", initials: "G", shared: "Split with 3 friends", note: "Dinner with the usuals" },
  { merchant: "TfL Contactless", date: "14 Mar 2025 · 08:03", amount: "£12.80", category: "Transport", color: "#9b8865", initials: "T", note: "London travel" },
  { merchant: "Paper & Grain", date: "11 Mar 2025 · 13:26", amount: "£16.50", category: "Dining", color: "#c77b61", initials: "P", note: "Lunch" },
];

const categories = [
  { name: "Groceries", amount: "£126.40", percent: 42, count: 4, color: "#6e8b78" },
  { name: "Dining", amount: "£78.50", percent: 26, count: 3, color: "#c77b61" },
  { name: "Transport", amount: "£43.20", percent: 14, count: 4, color: "#9b8865" },
  { name: "Shopping", amount: "£31.90", percent: 11, count: 2, color: "#758b9a" },
  { name: "Entertainment", amount: "£18.60", percent: 6, count: 1, color: "#ad8192" },
];

export function Dashboard() {
  const [selected, setSelected] = useState<string | null>(null);
  const [month, setMonth] = useState("March 2025");
  const [showAdd, setShowAdd] = useState(false);
  const [notice, setNotice] = useState("");
  const filtered = selected ? receipts.filter((r) => r.category === selected) : receipts;

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  return (
    <div className="receiptify-upgraded">
      <header className="topbar" style={{ borderBottom: "1px solid var(--line)", background: "rgba(255,253,249,.72)", padding: "22px 42px" }}>
        <div style={{ maxWidth: 1196, margin: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: "var(--ink)", color: "var(--paper)", display: "grid", placeItems: "center", transform: "rotate(-4deg)" }}><Receipt size={20} strokeWidth={1.8} /></div>
            <div><div className="display" style={{ fontSize: 22, lineHeight: 1 }}>Receiptify</div><div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4, letterSpacing: ".08em", textTransform: "uppercase" }}>A calmer money space</div></div>
          </div>
          <nav className="desktop-only" style={{ display: "flex", gap: 7, alignItems: "center" }}>
            {["Overview", "Receipts", "Shared"].map((item) => <button key={item} onClick={() => notify(`${item} view selected`)} style={{ border: 0, background: item === "Overview" ? "var(--sage-soft)" : "transparent", borderRadius: 9, padding: "9px 14px", color: item === "Overview" ? "var(--ink)" : "var(--muted)", fontSize: 13, fontWeight: 600 }}>{item}</button>)}
          </nav>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => notify("Search is ready for your receipts")} aria-label="Search receipts" style={{ border: "1px solid var(--line)", width: 36, height: 36, borderRadius: 10, color: "var(--muted)", background: "var(--card)", display: "grid", placeItems: "center" }}><Search size={16} /></button>
            <button onClick={() => notify("Account settings opened")} aria-label="Settings" style={{ border: 0, width: 36, height: 36, borderRadius: 10, color: "var(--muted)", background: "transparent", display: "grid", placeItems: "center" }}><Settings2 size={18} /></button>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--coral-soft)", color: "var(--coral)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12 }}>AM</div>
          </div>
        </div>
      </header>

      <main className="content" style={{ maxWidth: 1196, margin: "auto", padding: "38px 42px 60px" }}>
        <section className="rise" style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 31, gap: 20, flexWrap: "wrap" }}>
          <div><p style={{ color: "var(--coral)", fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", margin: "0 0 10px" }}>Tuesday, 25 March</p><h1 className="display" style={{ fontSize: "clamp(30px, 4vw, 44px)", fontWeight: 500, margin: 0, letterSpacing: "-.04em" }}>Good morning, Alex<span style={{ color: "var(--coral)" }}>.</span></h1><p style={{ color: "var(--muted)", fontSize: 14, margin: "9px 0 0" }}>Here’s the shape of your spending this month.</p></div>
          <button onClick={() => setShowAdd(true)} style={{ display: "flex", gap: 9, alignItems: "center", background: "var(--ink)", color: "var(--paper)", border: 0, padding: "12px 16px", borderRadius: 11, fontWeight: 600, fontSize: 13, boxShadow: "0 5px 16px rgba(30,44,43,.12)" }}><FilePlus2 size={16} /> Add receipt</button>
        </section>

        <div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.08fr) minmax(370px, .92fr)", gap: 22 }}>
          <section className="rise d1" style={{ background: "var(--ink)", color: "var(--paper)", borderRadius: 18, padding: "26px 28px 25px", minHeight: 270, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: -42, top: -57, width: 200, height: 200, borderRadius: "50%", border: "1px solid rgba(247,244,238,.14)" }} /><div style={{ position: "absolute", right: 28, top: 28, width: 108, height: 108, borderRadius: "50%", border: "1px solid rgba(247,244,238,.1)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}><span style={{ color: "#c1cec5", fontSize: 13 }}>Total spent</span><select value={month} onChange={(e) => setMonth(e.target.value)} style={{ color: "#dfe9e0", border: "1px solid rgba(223,233,224,.22)", background: "rgba(255,255,255,.08)", borderRadius: 7, padding: "6px 8px", fontSize: 12, outline: 0 }}><option>March 2025</option><option>February 2025</option><option>January 2025</option></select></div>
            <div className="display" style={{ fontSize: 56, marginTop: 28, letterSpacing: "-.06em" }}>£298<span style={{ color: "#c1cec5", fontSize: 35 }}>.60</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 16, fontSize: 12, color: "#b9c8be" }}><span style={{ color: "#a8d0ae", display: "flex", gap: 4, alignItems: "center" }}><ArrowDownLeft size={14} /> 8.4%</span> from February <span style={{ marginLeft: 4, color: "#7f958b" }}>·</span> 14 receipts</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30, borderTop: "1px solid rgba(247,244,238,.15)", paddingTop: 14, color: "#abbcb2", fontSize: 12 }}><span>Still comfortable</span><span className="mono" style={{ color: "#dfe9e0" }}>£201.40 left in plan</span></div>
          </section>

          <section className="rise d2" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 18, padding: "23px 24px", minHeight: 270 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><h2 className="display" style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>Where it went</h2><p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>A gentle look at your habits</p></div><BarChart3 size={19} color="var(--sage)" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "145px 1fr", alignItems: "center", gap: 19, marginTop: 18 }}>
              <div style={{ width: 137, height: 137, borderRadius: "50%", background: "conic-gradient(#6e8b78 0 42%, #c77b61 42% 68%, #9b8865 68% 82%, #758b9a 82% 93%, #ad8192 93% 100%)", display: "grid", placeItems: "center" }}><div style={{ width: 91, height: 91, borderRadius: "50%", background: "var(--card)", display: "grid", placeItems: "center", textAlign: "center" }}><span style={{ color: "var(--muted)", fontSize: 10 }}>this month</span><strong className="mono" style={{ fontSize: 14 }}>£298.60</strong></div></div>
              <div style={{ display: "grid", gap: 8 }}>{categories.map((cat) => <button key={cat.name} onClick={() => setSelected(selected === cat.name ? null : cat.name)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: 0, borderRadius: 7, padding: "4px 5px", background: selected === cat.name ? "var(--paper-deep)" : "transparent", color: "var(--ink)", textAlign: "left" }}><span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11 }}><i style={{ width: 7, height: 7, borderRadius: "50%", background: cat.color }} />{cat.name}</span><span className="mono" style={{ color: "var(--muted)", fontSize: 10 }}>{cat.percent}%</span></button>)}</div>
            </div>
          </section>
        </div>

        <section className="rise d3" style={{ marginTop: 35 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 14 }}><div><h2 className="display" style={{ fontSize: 26, fontWeight: 500, margin: 0 }}>Recent receipts</h2><p style={{ fontSize: 12, color: "var(--muted)", margin: "5px 0 0" }}>{selected ? `Showing your ${selected.toLowerCase()} receipts` : "The little record of where life happened"}</p></div><button onClick={() => notify("All receipts view selected")} style={{ border: 0, background: "transparent", color: "var(--sage)", fontSize: 12, fontWeight: 700 }}>See all <ArrowUpRight size={13} style={{ verticalAlign: "middle" }} /></button></div>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 15, overflow: "hidden" }}>{filtered.map((receipt, index) => <ReceiptRow key={receipt.merchant} receipt={receipt} last={index === filtered.length - 1} onClick={() => notify(`${receipt.merchant} receipt opened`)} />)}</div>
        </section>

        <section className="rise d3" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, background: "var(--coral-soft)", borderRadius: 15, marginTop: 22, padding: "17px 20px", flexWrap: "wrap" }}><div style={{ display: "flex", gap: 12, alignItems: "center" }}><div style={{ width: 34, height: 34, display: "grid", placeItems: "center", background: "rgba(255,253,249,.65)", borderRadius: 10, color: "var(--coral)" }}><UsersRound size={17} /></div><div><strong style={{ fontSize: 13 }}>The Green Room is shared</strong><p style={{ margin: "3px 0 0", fontSize: 11, color: "#8d655b" }}>£24.00 is waiting for you from 3 friends.</p></div></div><button onClick={() => notify("Shared receipts opened")} style={{ border: "1px solid rgba(206,114,93,.35)", borderRadius: 8, background: "rgba(255,253,249,.55)", color: "#9d594a", padding: "8px 11px", fontSize: 11, fontWeight: 700 }}>View shared receipts <Share2 size={12} style={{ verticalAlign: "middle", marginLeft: 4 }} /></button></section>
      </main>
      {showAdd && <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(30,44,43,.28)", display: "grid", placeItems: "center", padding: 20, zIndex: 5 }}><div style={{ width: "min(420px, 100%)", background: "var(--card)", borderRadius: 18, padding: 25, boxShadow: "0 20px 60px rgba(30,44,43,.2)" }}><div style={{ display: "flex", justifyContent: "space-between" }}><h2 className="display" style={{ margin: 0, fontSize: 24 }}>Add a receipt</h2><button onClick={() => setShowAdd(false)} aria-label="Close" style={{ border: 0, background: "transparent", color: "var(--muted)" }}><X size={18} /></button></div><p style={{ color: "var(--muted)", fontSize: 13, margin: "8px 0 20px" }}>Your next little piece of clarity.</p><div style={{ display: "grid", gap: 12 }}>{["Merchant", "Amount", "Category"].map((label) => <label key={label} style={{ display: "grid", gap: 6, fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}><span>{label}</span><input placeholder={label === "Amount" ? "£0.00" : `Enter ${label.toLowerCase()}`} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: "11px 12px", background: "var(--paper)", outline: 0, color: "var(--ink)" }} /></label>)}</div><button onClick={() => { setShowAdd(false); notify("Receipt saved to your wallet"); }} style={{ width: "100%", marginTop: 20, border: 0, borderRadius: 10, padding: 12, background: "var(--ink)", color: "var(--paper)", fontWeight: 700 }}>Save receipt</button></div></div>}
      {notice && <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "var(--ink)", color: "var(--paper)", borderRadius: 10, padding: "11px 16px", fontSize: 12, zIndex: 8, boxShadow: "0 8px 22px rgba(30,44,43,.2)" }}><Sparkles size={13} style={{ verticalAlign: "middle", marginRight: 7, color: "#dfe9e0" }} />{notice}</div>}
    </div>
  );
}

function ReceiptRow({ receipt, last, onClick }: { receipt: ReceiptItem; last: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", border: 0, borderBottom: last ? 0 : "1px solid var(--line)", background: "transparent", textAlign: "left", transition: "background .18s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--paper)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
    <div style={{ width: 40, height: 40, borderRadius: 11, background: `${receipt.color}1c`, color: receipt.color, display: "grid", placeItems: "center", fontWeight: 700, fontSize: 16 }}>{receipt.initials}</div><div style={{ minWidth: 0, flex: 1 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><strong style={{ fontSize: 13 }}>{receipt.merchant}</strong><strong className="mono" style={{ fontSize: 12 }}>{receipt.amount}</strong></div><div style={{ display: "flex", gap: 8, marginTop: 5, alignItems: "center", color: "var(--muted)", fontSize: 11 }}><span>{receipt.date}</span><span style={{ width: 3, height: 3, borderRadius: "50%", background: receipt.color }} /><span>{receipt.note}</span></div></div><div className="desktop-only" style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: receipt.color, background: `${receipt.color}18`, border: `1px solid ${receipt.color}30`, borderRadius: 6, padding: "4px 7px", fontSize: 10, fontWeight: 700 }}>{receipt.category}</span>{receipt.shared && <span style={{ color: "var(--coral)", fontSize: 10, fontWeight: 700 }}>{receipt.shared}</span>}<MoreHorizontal size={16} color="var(--muted)" /></div>
  </button>;
}
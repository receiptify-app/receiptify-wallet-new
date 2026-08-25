import { useState } from "react";
import { BarChart3, CreditCard, MoreVertical, QrCode, ReceiptText, UserRound, Users } from "lucide-react";
import "./_group.css";

const receipts = [
  { merchant: "Sainsbury's", date: "Mar 18, 2025", amount: "£38.60", category: "Groceries", color: "#4CAF50", share: "My share £22.40" },
  { merchant: "The Green Room", date: "Mar 16, 2025", amount: "£48.00", category: "Dining", color: "#FF9800", share: "My share £24.00" },
  { merchant: "TfL Contactless", date: "Mar 14, 2025", amount: "£12.80", category: "Transport", color: "#9C27B0", share: "" },
];

export function Dashboard() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const categories = [
    { name: "Groceries", amount: "£126.40", percent: 42, count: 4, color: "#4CAF50" },
    { name: "Dining", amount: "£78.50", percent: 26, count: 3, color: "#FF9800" },
    { name: "Transport", amount: "£43.20", percent: 14, count: 4, color: "#9C27B0" },
    { name: "Shopping", amount: "£31.90", percent: 11, count: 2, color: "#2196F3" },
    { name: "Entertainment", amount: "£18.60", percent: 6, count: 1, color: "#E91E63" },
  ];
  const filtered = selectedCategory ? receipts.filter((receipt) => receipt.category === selectedCategory) : receipts;

  return (
    <div className="receiptify-current min-h-screen bg-[#f7fbf5] pb-24">
      <AppHeader />
      <main className="mx-auto max-w-xl space-y-6 px-6 py-4">
        <section className="flex items-center justify-between">
          <select className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 shadow-sm">
            <option>March 2025</option>
            <option>February 2025</option>
            <option>January 2025</option>
          </select>
          <div className="text-right">
            <p className="text-sm text-gray-600">Total Spent</p>
            <h2 className="text-4xl font-bold text-gray-900">£298.60</h2>
          </div>
        </section>

        <section className="rounded-[1.3rem] bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Categories</h3>
          <div className="flex flex-col items-center">
            <div className="relative my-2 h-44 w-44 rounded-full" style={{ background: "conic-gradient(#4CAF50 0 42%, #FF9800 42% 68%, #9C27B0 68% 82%, #2196F3 82% 93%, #E91E63 93% 100%)" }}>
              <div className="absolute inset-[30px] flex flex-col items-center justify-center rounded-full bg-white">
                <span className="text-xs text-gray-500">March</span>
                <strong className="text-lg text-gray-900">£298.60</strong>
              </div>
            </div>
            <div className="mt-5 w-full space-y-1">
              {categories.map((category) => (
                <button key={category.name} onClick={() => setSelectedCategory(selectedCategory === category.name ? null : category.name)}
                  className={`flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors ${selectedCategory === category.name ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                  <span className="flex items-center gap-3"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} /><span className="text-sm font-medium text-gray-900">{category.name}</span><span className="text-xs text-gray-500">({category.count})</span></span>
                  <span><span className="text-sm font-semibold text-gray-900">{category.amount}</span><span className="ml-2 text-xs text-gray-500">{category.percent}%</span></span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">Recent Activity {selectedCategory && <span className="ml-1 text-sm font-normal text-gray-600">({selectedCategory})</span>}</h3>
            {selectedCategory && <button onClick={() => setSelectedCategory(null)} className="text-sm font-medium text-green-800">Clear filter</button>}
          </div>
          <div className="space-y-3">
            {filtered.map((receipt) => <ReceiptCard key={receipt.merchant} {...receipt} />)}
          </div>
        </section>
      </main>
      <BottomNavigation active="analytics" />
    </div>
  );
}

function AppHeader() {
  return <header className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4"><div className="w-9" /><div className="text-center"><h1 className="text-2xl font-bold text-green-800">Receiptify</h1><p className="text-xs text-gray-600">Your Digital Wallet</p></div><div className="w-9" /></header>;
}
function ReceiptCard({ merchant, date, amount, category, color, share }: typeof receipts[number]) {
  return <article className="flex items-center gap-3 rounded-[1.3rem] bg-white p-4 shadow-sm"><div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100"><ReceiptText className="h-6 w-6" style={{ color }} /></div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><div><h4 className="font-semibold text-gray-900">{merchant}</h4><p className="text-sm text-gray-600">{date}</p></div><strong className="whitespace-nowrap text-gray-900">{amount}</strong></div><div className="mt-2 flex items-center justify-between"><span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ color, backgroundColor: `${color}20`, border: `1px solid ${color}40` }}>{category}</span>{share && <span className="text-xs text-gray-500">{share}</span>}</div></div><MoreVertical className="h-4 w-4 text-gray-500" /></article>;
}
function BottomNavigation({ active }: { active: string }) {
  const items = [[QrCode, "Scan"], [BarChart3, "Analytics"], [ReceiptText, "Receipts"], [Users, "Split"], [UserRound, "Account"]] as const;
  return <nav className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white"><div className="mx-auto flex max-w-xl justify-around py-2">{items.map(([Icon, label]) => <button key={label} className={`flex flex-col items-center gap-1 px-3 py-1 text-xs font-medium ${active === label.toLowerCase() ? "text-green-800" : "text-gray-400"}`}><Icon className="h-5 w-5" />{label}</button>)}</div></nav>;
}
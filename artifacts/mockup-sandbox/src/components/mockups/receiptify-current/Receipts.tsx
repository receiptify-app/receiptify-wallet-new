import { useMemo, useState } from "react";
import { CheckSquare, ChevronDown, ChevronRight, Filter, ReceiptText, Search, Trash2, X } from "lucide-react";
import "./_group.css";

type Receipt = { id: string; merchant: string; date: string; meta: string; total: string; category: string; categoryClass: string; payment: string; shared?: boolean; share?: string };
const receiptGroups: { month: string; total: string; receipts: Receipt[] }[] = [
  { month: "March 2025", total: "£298.60", receipts: [
    { id: "sainsburys", merchant: "Sainsbury's", date: "Mar 18, 3:42 PM", meta: "#SBR-1842", total: "£38.60", category: "Groceries", categoryClass: "bg-green-100 text-green-800", payment: "Visa ending 4242", share: "My share £22.40" },
    { id: "green-room", merchant: "The Green Room", date: "Mar 16, 7:18 PM", meta: "#GR-871", total: "£48.00", category: "Dining", categoryClass: "bg-orange-100 text-orange-800", payment: "Mastercard", share: "My share £24.00" },
    { id: "tfl", merchant: "TfL Contactless", date: "Mar 14, 8:10 AM", meta: "", total: "£12.80", category: "Transport", categoryClass: "bg-purple-100 text-purple-800", payment: "Apple Pay" },
    { id: "netflix", merchant: "Netflix", date: "Mar 8, 9:00 AM", meta: "", total: "£10.99", category: "Entertainment", categoryClass: "bg-pink-100 text-pink-800", payment: "Visa ending 4242" },
  ]},
  { month: "February 2025", total: "£184.25", receipts: [
    { id: "waitrose", merchant: "Waitrose", date: "Feb 27, 5:32 PM", meta: "#WTR-702", total: "£64.25", category: "Groceries", categoryClass: "bg-green-100 text-green-800", payment: "Visa ending 4242", shared: true, share: "Shared receipt" },
    { id: "bookshop", merchant: "Foyles", date: "Feb 22, 1:20 PM", meta: "", total: "£24.00", category: "Shopping", categoryClass: "bg-blue-100 text-blue-800", payment: "Mastercard" },
  ]},
];

export function Receipts() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>(["March 2025"]);
  const visible = useMemo(() => receiptGroups.map(group => ({ ...group, receipts: group.receipts.filter(receipt => receipt.merchant.toLowerCase().includes(query.toLowerCase()) || receipt.category.toLowerCase().includes(query.toLowerCase())) })).filter(group => group.receipts.length), [query]);
  const selectionMode = selected.length > 0;
  const toggle = (id: string) => setSelected(items => items.includes(id) ? items.filter(item => item !== id) : [...items, id]);

  return <div className="receiptify-current min-h-screen bg-gray-50 pb-20">
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white"><div className="mx-auto max-w-sm p-4"><div className="flex items-center justify-between"><h1 className="text-xl font-semibold text-gray-900">{selectionMode ? `${selected.length} selected` : "My Receipts"}</h1><div className="flex gap-1"><button onClick={() => { setSearchOpen(!searchOpen); setQuery(""); }} className={`rounded-md p-2 ${searchOpen ? "bg-gray-100" : ""}`}>{searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}</button><button className="rounded-md p-2"><Filter className="h-4 w-4" /></button><button onClick={() => setSelected(selectionMode ? [] : ["sainsburys"])} className={`rounded-md p-2 ${selectionMode ? "bg-green-800 text-white" : ""}`}><CheckSquare className="h-4 w-4" /></button></div></div>
    {searchOpen && <div className="relative mt-3"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search merchant, category, amount..." className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-8 text-sm outline-none" />{query && <button onClick={() => setQuery("")} className="absolute right-2 top-2 text-gray-400"><X className="h-4 w-4" /></button>}</div>}</div></header>
    <main className="mx-auto max-w-sm space-y-4 p-4">{visible.map(group => { const open = query ? true : expanded.includes(group.month); return <section key={group.month}><button onClick={() => setExpanded(values => values.includes(group.month) ? values.filter(value => value !== group.month) : [...values, group.month])} className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white p-3 text-left"><span className="flex items-center gap-3"><ChevronDown className={`h-5 w-5 text-gray-500 transition-transform ${open ? "" : "-rotate-90"}`} /><span><b className="block text-sm text-gray-900">{group.month}</b><small className="text-xs text-gray-500">{group.receipts.length} receipts</small></span></span><b className="text-sm text-gray-900">{group.total}</b></button>
    {open && <div className="mt-2 space-y-2 pl-2">{group.receipts.map(receipt => <article onClick={() => !receipt.shared && toggle(receipt.id)} key={receipt.id} className={`flex cursor-pointer items-center gap-3 rounded-[1.3rem] bg-white p-4 shadow-sm ${selected.includes(receipt.id) ? "ring-2 ring-green-800" : ""}`}><div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">{selected.includes(receipt.id) ? <CheckSquare className="h-5 w-5 text-green-800" /> : <ReceiptText className="h-5 w-5 text-gray-500" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-900">{receipt.merchant}{receipt.shared && <span className="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">shared</span>}</p><p className="mt-1 text-xs text-gray-500">{receipt.date}{receipt.meta && ` • ${receipt.meta}`}</p>{receipt.share && <p className="mt-1 text-xs text-gray-500">{receipt.share}</p>}</div><div className="text-right"><div className="flex items-center gap-1"><span className={`rounded-full px-2 py-0.5 text-xs ${receipt.categoryClass}`}>{receipt.category}</span><b className="text-sm text-gray-900">{receipt.total}</b></div><p className="mt-1 text-xs text-gray-500">{receipt.payment}</p></div>{!selectionMode && !receipt.shared && <Trash2 className="h-4 w-4 text-red-500" />}{!selectionMode && <ChevronRight className="h-4 w-4 text-gray-400" />}</article>)}</div>}</section>})}</main>
    {selectionMode && <div className="fixed bottom-4 left-4 right-4 mx-auto flex max-w-sm items-center justify-between rounded-xl bg-gray-900 px-4 py-3 text-white shadow-lg"><span className="text-sm">{selected.length} selected</span><div className="flex gap-3"><button className="text-sm font-medium">Move</button><button onClick={() => setSelected([])} className="text-sm">Cancel</button></div></div>}
  </div>;
}
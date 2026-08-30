import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, FolderOpen, Receipt as ReceiptIcon, Plus, ArrowUpRight, WalletCards, X } from "lucide-react";
import AppHeader from "@/components/app-header";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type FolderSummary = {
  id: string;
  name: string;
  description: string | null;
  totalAmount: number;
  totalSpent: number;
  allocatedAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  personalAmount: number;
  memberCount: number;
  receiptCount: number;
  members: Array<{ id: string; displayName: string | null; userId: string | null; profileImageUrl?: string | null }>;
  status: "settled" | "pending";
  ownerContactName?: string | null;
  workspaceType?: "ongoing" | "one_off";
};
type OneOffBill = { id:string; folderId:string; title:string; amount:string|number; status:string; splitMode:string };
type Friend = { key: string; name: string; email: string };
type BillItem = { key: string; label: string; amount: string; participantKeys: string[] };

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || name[0].toUpperCase();
}

export default function SplitPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [folderPeople, setFolderPeople] = useState<Friend[]>([{ key: "folder-person-1", name: "", email: "" }]);
  const [billOpen, setBillOpen] = useState(false);
  const [billStep, setBillStep] = useState<1 | 2 | 3>(1);
  const [createdBillFolderId, setCreatedBillFolderId] = useState<string | null>(null);
  const [bill, setBill] = useState({title:"", description:"", amount:"", splitMode:"equal" as "equal" | "custom" | "items"});
  const [friends, setFriends] = useState<Friend[]>([{key:"friend-1",name:"",email:""}]);
  const [customShares, setCustomShares] = useState<Record<string, string>>({ creator: "" });
  const [items, setItems] = useState<BillItem[]>([{ key: "item-1", label: "", amount: "", participantKeys: ["creator"] }]);

  const { data: folders, isLoading } = useQuery<FolderSummary[]>({
    queryKey: ["/api/split-folders"],
  });
  const { data: oneOffBills = [] } = useQuery<OneOffBill[]>({ queryKey:["/api/split-bills"] });
  const participants = useMemo(() => [
    { key: "creator", name: "You", isCreator: true },
    ...friends.filter((friend) => friend.name.trim()).map((friend) => ({ ...friend, name: friend.name.trim(), email: friend.email.trim() || undefined, isCreator: false })),
  ], [friends]);
  const amount = Number(bill.amount) || 0;
  const customAllocated = participants.reduce((sum, participant) => sum + (Number(customShares[participant.key]) || 0), 0);
  const itemsAllocated = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const allocation = bill.splitMode === "custom" ? customAllocated : bill.splitMode === "items" ? itemsAllocated : amount;
  const allocationDelta = amount - allocation;
  const participantShares = useMemo(() => {
    const shares: Record<string, number> = Object.fromEntries(participants.map((participant) => [participant.key, 0]));
    if (bill.splitMode === "custom") {
      participants.forEach((participant) => { shares[participant.key] = Number(customShares[participant.key]) || 0; });
      return shares;
    }
    if (bill.splitMode === "items") {
      items.forEach((item) => {
        const selected = item.participantKeys.filter((key) => key in shares);
        if (selected.length === 0) return;
        const itemPence = Math.round((Number(item.amount) || 0) * 100);
        const basePence = Math.floor(itemPence / selected.length);
        selected.forEach((key, index) => {
          shares[key] += (basePence + (index < itemPence % selected.length ? 1 : 0)) / 100;
        });
      });
      return shares;
    }
    const debtors = participants.filter((participant) => !participant.isCreator);
    const totalPence = Math.round(amount * 100);
    const basePence = debtors.length ? Math.floor(totalPence / debtors.length) : 0;
    debtors.forEach((participant, index) => {
      shares[participant.key] = (basePence + (index < totalPence % debtors.length ? 1 : 0)) / 100;
    });
    return shares;
  }, [amount, bill.splitMode, customShares, items, participants]);
  const validBill = !!bill.title.trim() && amount > 0 && participants.length > 1 &&
    (bill.splitMode === "equal" || Math.abs(allocationDelta) < 0.01) &&
    (bill.splitMode !== "items" || items.length > 0 && items.every((item) => item.label.trim() && Number(item.amount) >= 0 && item.participantKeys.length > 0));
  const resetBill = () => {
    setBillStep(1);
    setBill({ title:"", description:"", amount:"", splitMode:"equal" });
    setFriends([{ key:"friend-1", name:"", email:"" }]);
    setCustomShares({ creator:"" });
    setItems([{ key:"item-1", label:"", amount:"", participantKeys:["creator"] }]);
  };
  const billMutation = useMutation({
    mutationFn: async () => {
      const payloadParticipants = participants.map((participant) => ({
        ...participant,
        ...(bill.splitMode === "custom" ? { shareAmount: participantShares[participant.key].toFixed(2) } : {}),
      }));
      const res = await apiRequest("POST","/api/split-bills",{
        title: bill.title.trim(), description: bill.description.trim() || undefined, amount,
        splitMode: bill.splitMode, participants: payloadParticipants,
        ...(bill.splitMode === "items" ? { items: items.map((item) => ({ ...item, label: item.label.trim(), amount: Number(item.amount) })) } : {}),
      });
      return res.json();
    },
    onSuccess:(created:any)=>{ queryClient.invalidateQueries({queryKey:["/api/split-bills"]}); queryClient.invalidateQueries({queryKey:["/api/split-folders"]}); setCreatedBillFolderId(created.folderId); setBillStep(3); },
    onError:(e:any)=>toast({title:"Couldn't create bill",description:e.message,variant:"destructive"}),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/split-folders", {
        name: name.trim(),
        description: description.trim() || null,
      });
      const folder = await res.json();
      return folder.id as string;
    },
    onSuccess: async (folderId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders"] });
      const inviteErrors: string[] = [];
      for (const person of folderPeople.filter((candidate) => candidate.name.trim() && candidate.email.trim())) {
        try {
          await apiRequest("POST", `/api/split-folders/${folderId}/members`, { displayName: person.name.trim(), email: person.email.trim() });
        } catch { inviteErrors.push(person.email.trim()); }
      }
      setName("");
      setDescription("");
      setFolderPeople([{ key: `folder-person-${Date.now()}`, name: "", email: "" }]);
      setCreateOpen(false);
      navigate(`/split/${folderId}`);
      if (inviteErrors.length) toast({ title: "Folder created, invite needs attention", description: `We couldn't invite ${inviteErrors.join(", ")}. You can retry from the folder.`, variant: "destructive" });
    },
    onError: (err: any) =>
      toast({
        title: "Couldn't create folder",
        description: err.message,
        variant: "destructive",
      }),
  });

  return (
    <div className="receiptify-page pb-24">
      <AppHeader visualSystem />
      <main className="receiptify-content">
        <div className="receiptify-hero">
          <div>
            <p className="receiptify-eyebrow">Shared spending</p>
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-green-600" />
              <h1>Split folders<em>.</em></h1>
            </div>
            <p className="receiptify-subtitle">The easy way to keep a shared tab honest.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={() => setCreateOpen(true)} className="receiptify-primary-action flex-1 sm:flex-none" data-testid="button-new-folder">
              <Plus className="w-4 h-4 mr-1" /> New folder
            </Button>
            <Button variant="outline" onClick={() => setBillOpen(true)} className="flex-1 sm:flex-none">
              <WalletCards className="w-4 h-4 mr-1" /> One-off bill
            </Button>
          </div>
        </div>

        <section className="receiptify-split-choices receiptify-fade-in" aria-label="Choose how to split">
          <Card className="receiptify-choice-card">
            <CardContent className="p-5">
              <div className="receiptify-choice-icon"><FolderOpen className="w-6 h-6" /></div>
              <div className="min-w-0 flex-1"><p className="receiptify-eyebrow">ONGOING</p><h2>New shared folder</h2><p>Track receipts and expenses with someone over time.</p></div>
              <Button className="receiptify-primary-action shrink-0" onClick={() => setCreateOpen(true)}>Create folder</Button>
            </CardContent>
          </Card>
          <Card className="receiptify-choice-card">
            <CardContent className="p-5">
              <div className="receiptify-choice-icon is-coral"><WalletCards className="w-6 h-6" /></div>
              <div className="min-w-0 flex-1"><p className="receiptify-eyebrow">ONE-OFF</p><h2>Split a bill</h2><p>Upload one bill and choose how much each person pays.</p></div>
              <Button className="receiptify-primary-action shrink-0" onClick={() => setBillOpen(true)}>Start split</Button>
            </CardContent>
          </Card>
        </section>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && folders && folders.length === 0 && (
          <Card className="receiptify-empty border-dashed border-2 border-gray-200">
            <CardContent className="p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <FolderOpen className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">No split folders yet</h2>
              <p className="text-sm text-gray-600">
                Create a folder to start grouping receipts and inviting friends,
                or open any receipt and tap <span className="font-medium">Split</span>.
              </p>
              <Button
                onClick={() => setCreateOpen(true)}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-empty-new-folder"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create your first folder
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && folders && folders.length > 0 && (
          <div className="receiptify-section-heading">
            <div><h2>Your shared folders</h2><p>Everything you’re keeping track of together.</p></div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {folders?.filter(f=>f.workspaceType !== "one_off").map((f) => (
            <Link key={f.id} href={`/split/${f.id}`}>
              <Card className="receiptify-panel cursor-pointer hover:shadow-md transition" data-testid={`folder-card-${f.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 truncate">{f.name}</h3>
                        <Badge
                          variant={f.status === "settled" ? "default" : "secondary"}
                          className={
                            f.status === "settled"
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : "bg-amber-100 text-amber-800 hover:bg-amber-100"
                          }
                        >
                          {f.status === "settled" ? "Settled" : "Pending"}
                        </Badge>
                      </div>
                      {f.description && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">{f.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><ReceiptIcon className="w-3 h-3" />{f.receiptCount}</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{f.memberCount}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-gray-900">£{f.totalSpent.toFixed(2)}</div>
                      <div className="text-[11px] text-gray-500">£{f.outstandingAmount.toFixed(2)} outstanding</div>
                      <ArrowUpRight className="w-4 h-4 ml-auto mt-1 text-gray-400" />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 mt-3">
                    {f.members.slice(0, 5).map((m, idx) => (
                      <div
                        key={m.id}
                        className="w-7 h-7 rounded-full bg-green-100 border-2 border-white text-xs font-semibold text-green-700 flex items-center justify-center"
                        style={{ marginLeft: idx === 0 ? 0 : -8 }}
                      >
                        {initials(m.displayName)}
                      </div>
                    ))}
                    {f.members.length > 5 && (
                      <span className="text-xs text-gray-500 ml-1">+{f.members.length - 5}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        {!isLoading && folders && folders.length > 0 && (
          <section className="receiptify-recent-strip">
            <div><p className="receiptify-eyebrow">Recent shared spending</p><h2>A quick look back</h2></div>
            <div className="receiptify-recent-items">
              {folders.filter(f=>f.workspaceType !== "one_off").slice(0, 3).map((f) => <Link key={f.id} href={`/split/${f.id}`} className="receiptify-recent-item"><span>{f.name}</span><strong>£{f.totalSpent.toFixed(2)}</strong><ArrowUpRight className="w-4 h-4" /></Link>)}
              {oneOffBills.slice(0,3).map(b=><Link key={b.id} href={`/split/${b.folderId}`} className="receiptify-recent-item"><span>{b.title} <small>One-off</small></span><strong>£{Number(b.amount).toFixed(2)}</strong><ArrowUpRight className="w-4 h-4" /></Link>)}
            </div>
          </section>
        )}
      </main>

      <Dialog open={billOpen} onOpenChange={setBillOpen}>
        <DialogContent className="receiptify-dialog max-w-md">
           <DialogHeader>
             <DialogTitle>{billStep === 1 ? "Split a bill" : billStep === 2 ? "Review split" : "Split created"}</DialogTitle>
             <DialogDescription>{billStep === 1 ? "Choose who was there and how to divide the total." : billStep === 2 ? "Check the amounts before creating this split." : "Your split is ready to share."}</DialogDescription>
           </DialogHeader>
           <div className="receiptify-flow-steps" aria-label={`Step ${billStep} of 3`}>
             {["Details", "Review", "Done"].map((label, index) => <span key={label} className={index + 1 <= billStep ? "is-active" : ""}><i>{index + 1}</i>{label}</span>)}
           </div>
           {billStep === 3 ? (
             <div className="receiptify-created-summary">
               <div className="receiptify-success-mark">✓</div><h2>Split created</h2><p className="text-sm">Your split is ready to share.</p>
               <dl><div><dt>Bill name</dt><dd>{bill.title}</dd></div><div><dt>Total amount</dt><dd>£{amount.toFixed(2)}</dd></div></dl>
               <div className="receiptify-summary-people">{participants.filter(p => !p.isCreator).map(p => <span key={p.key}>{p.name} · £{participantShares[p.key].toFixed(2)}</span>)}</div>
               <div className="mt-5 space-y-2">
                 <Button className="w-full receiptify-primary-action" onClick={() => { if (createdBillFolderId) navigate(`/split/${createdBillFolderId}`); setBillOpen(false); resetBill(); }}>Request payment</Button>
                 <Button variant="outline" className="w-full" onClick={() => { if (createdBillFolderId) navigate(`/split/${createdBillFolderId}`); setBillOpen(false); resetBill(); }}>View split</Button>
                 <Button variant="ghost" className="w-full" onClick={() => { setBillOpen(false); resetBill(); }}>Done</Button>
               </div>
             </div>
           ) : billStep === 2 ? (
             <div className="space-y-4">
               <div className="rounded-xl border p-4 space-y-3 text-sm">
                 <p><span className="text-gray-500">Bill</span><br/><strong>{bill.title}</strong>{bill.description ? ` · ${bill.description}` : ""}</p>
                 <p><span className="text-gray-500">Total</span><br/><strong className="receiptify-mono">£{amount.toFixed(2)}</strong></p>
                 <div><span className="text-gray-500">Who owes what</span><div className="mt-2 space-y-1">{participants.map((participant) => <p key={participant.key} className="flex justify-between gap-3"><span>{participant.name}</span><strong className="receiptify-mono">£{participantShares[participant.key].toFixed(2)}</strong></p>)}</div></div>
               </div>
               <Button className="w-full receiptify-primary-action" disabled={billMutation.isPending} onClick={() => billMutation.mutate()}>{billMutation.isPending ? "Creating…" : "Create split"}</Button>
               <Button variant="ghost" className="w-full" onClick={() => setBillStep(1)}>Back to details</Button>
             </div>
           ) : (
           <div className="space-y-3">
            <div><Label>Title</Label><Input value={bill.title} onChange={e=>setBill({...bill,title:e.target.value})} placeholder="Dinner at Mallow" /></div>
            <div><Label>Description (optional)</Label><Input value={bill.description} onChange={e=>setBill({...bill,description:e.target.value})} placeholder="Friday night" /></div>
            <div><Label>Total amount</Label><Input inputMode="decimal" value={bill.amount} onChange={e=>setBill({...bill,amount:e.target.value})} placeholder="0.00" /></div>
            <div className="flex gap-2"><Button type="button" size="sm" variant={bill.splitMode==="equal"?"default":"outline"} onClick={()=>setBill({...bill,splitMode:"equal"})}>Equal</Button><Button type="button" size="sm" variant={bill.splitMode==="custom"?"default":"outline"} onClick={()=>setBill({...bill,splitMode:"custom"})}>Custom</Button><Button type="button" size="sm" variant={bill.splitMode==="items"?"default":"outline"} onClick={()=>setBill({...bill,splitMode:"items"})}>By item</Button></div>
            <div className="rounded-xl border border-dashed p-3 space-y-2"><div className="flex justify-between"><p className="text-sm font-semibold">People</p><span className="text-xs text-gray-500">You are included</span></div><div className="flex items-center gap-2 rounded-lg bg-[#dfe9e0] px-3 py-2 text-sm"><span className="flex-1">You</span><span className="text-xs">Creator</span>{bill.splitMode==="custom" && <Input className="w-20 h-8" inputMode="decimal" value={customShares.creator || ""} onChange={e=>setCustomShares({...customShares,creator:e.target.value})} placeholder="0.00" />}</div>{friends.map((f,i)=><div key={f.key} className="flex flex-wrap gap-2"><Input className="min-w-[120px] flex-1" placeholder="Friend's name" value={f.name} onChange={e=>setFriends(friends.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/><Input className="min-w-[130px] flex-1" placeholder="Email (optional)" value={f.email} onChange={e=>setFriends(friends.map((x,j)=>j===i?{...x,email:e.target.value}:x))}/>{bill.splitMode==="custom" && f.name.trim() && <Input className="w-20 h-9" inputMode="decimal" value={customShares[f.key] || ""} onChange={e=>setCustomShares({...customShares,[f.key]:e.target.value})} placeholder="0.00" />}<Button type="button" size="icon" variant="ghost" aria-label="Remove friend" onClick={()=>setFriends(friends.filter((_,j)=>j!==i))}><X /></Button></div>)}<Button type="button" variant="ghost" className="text-[#60786d]" onClick={()=>setFriends([...friends,{key:`friend-${Date.now()}`,name:"",email:""}])}><Plus className="w-4 h-4 mr-1"/>Add friend</Button></div>
            {bill.splitMode==="items" && <div className="space-y-2 border rounded-xl p-3"><p className="text-sm font-semibold">Items</p>{items.map((item,index)=><div key={item.key} className="space-y-2 border-b pb-3 last:border-0"><div className="flex gap-2"><Input className="flex-1" placeholder="Item label" value={item.label} onChange={e=>setItems(items.map((x,i)=>i===index?{...x,label:e.target.value}:x))}/><Input className="w-24" inputMode="decimal" placeholder="0.00" value={item.amount} onChange={e=>setItems(items.map((x,i)=>i===index?{...x,amount:e.target.value}:x))}/><Button type="button" size="icon" variant="ghost" aria-label="Remove item" onClick={()=>setItems(items.filter((_,i)=>i!==index))}><X /></Button></div><div className="flex flex-wrap gap-1">{participants.map(p=><button type="button" key={p.key} onClick={()=>setItems(items.map((x,i)=>i===index?{...x,participantKeys:x.participantKeys.includes(p.key)?x.participantKeys.filter(k=>k!==p.key):[...x.participantKeys,p.key]}:x))} className={`rounded-full border px-2 py-1 text-xs ${item.participantKeys.includes(p.key)?"bg-green-600 text-white":"bg-white"}`}>{p.name}</button>)}</div></div>)}<Button type="button" variant="ghost" onClick={()=>setItems([...items,{key:`item-${Date.now()}`,label:"",amount:"",participantKeys:["creator"]}])}><Plus className="w-4 h-4 mr-1"/>Add item</Button></div>}
             <div className={`rounded-lg px-3 py-2 text-xs ${Math.abs(allocationDelta)<.01 ? "bg-green-50 text-green-700" : allocationDelta<0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}><strong>Allocated £{allocation.toFixed(2)}</strong> of £{amount.toFixed(2)} · {Math.abs(allocationDelta)<.01 ? "Fully allocated" : allocationDelta>0 ? `£${allocationDelta.toFixed(2)} remaining` : `£${Math.abs(allocationDelta).toFixed(2)} over`}{bill.splitMode==="equal" && participants.length > 1 && amount>0 ? ` · £${(amount/(participants.length - 1)).toFixed(2)} per friend` : ""}</div>
             <Button className="w-full receiptify-primary-action" disabled={!validBill} onClick={() => setBillStep(2)}>Continue</Button>
          </div>
           )}
        </DialogContent>
      </Dialog>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              New split folder
            </DialogTitle>
            <DialogDescription>
              Give your folder a name. You can add receipts and invite friends to it next.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="folder-name">Folder name</Label>
              <Input
                id="folder-name"
                placeholder="e.g. Weekend in Brighton"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                data-testid="input-new-folder-name"
              />
            </div>
            <div>
              <Label htmlFor="folder-desc">Description (optional)</Label>
              <Input
                id="folder-desc"
                placeholder="Anything to remember about this trip"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="input-new-folder-desc"
              />
            </div>
            <div className="space-y-2 rounded-xl border border-dashed p-3">
              <div><Label>Shared with (optional)</Label><p className="text-xs text-gray-500">You can add people later from the folder.</p></div>
              {folderPeople.map((person, index) => <div key={person.key} className="flex flex-wrap gap-2"><Input className="min-w-[120px] flex-1" placeholder="Name" value={person.name} onChange={(e) => setFolderPeople((current) => current.map((candidate, i) => i === index ? { ...candidate, name: e.target.value } : candidate))} /><Input className="min-w-[150px] flex-1" type="email" placeholder="Email" value={person.email} onChange={(e) => setFolderPeople((current) => current.map((candidate, i) => i === index ? { ...candidate, email: e.target.value } : candidate))} />{folderPeople.length > 1 && <Button type="button" size="icon" variant="ghost" onClick={() => setFolderPeople((current) => current.filter((_, i) => i !== index))}><X /></Button>}</div>)}
              <Button type="button" variant="ghost" className="text-[#60786d]" onClick={() => setFolderPeople((current) => [...current, { key: `folder-person-${Date.now()}`, name: "", email: "" }])}><Plus className="w-4 h-4 mr-1" />Add another person</Button>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!name.trim() || createMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
                data-testid="button-create-new-folder"
              >
                {createMutation.isPending ? "Creating…" : "Create folder"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

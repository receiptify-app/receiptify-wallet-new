import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Plus, WalletCards, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Member = {
  id: string;
  displayName: string | null;
  inviteEmail: string | null;
  status: string;
  role: string;
};

type Subfolder = { id: string; name: string };

type BillParticipant = {
  id: string;
  memberId: string;
  itemId: string | null;
  shareAmount: string | number;
  status: "pending" | "paid" | "declined";
};

type Bill = {
  id: string;
  title: string;
  description?: string | null;
  amount: string | number;
  splitMode: "equal" | "custom" | "items";
  status: string;
  subfolderId?: string | null;
  participants: BillParticipant[];
  items: Array<{ id: string; itemKey?: string | null; label: string; amount: string | number }>;
};

type DraftItem = { key: string; label: string; amount: string; memberIds: string[] };

export default function FolderBillsPanel({
  folderId,
  members,
  subfolders,
  canEdit,
  canManage,
}: {
  folderId: string;
  members: Member[];
  subfolders: Subfolder[];
  canEdit: boolean;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const allocatableMembers = useMemo(
    () => members.filter((member) => member.status !== "removed"),
    [members],
  );
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"equal" | "custom" | "items">("equal");
  const [subfolderId, setSubfolderId] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [items, setItems] = useState<DraftItem[]>([
    { key: "item-1", label: "", amount: "", memberIds: [] },
  ]);

  const { data: bills = [] } = useQuery<Bill[]>({
    queryKey: ["/api/split-folders", folderId, "bills"],
  });

  const total = Number(amount) || 0;
  const allocated =
    mode === "equal"
      ? selectedMemberIds.length > 0
        ? total
        : 0
      : mode === "custom"
        ? selectedMemberIds.reduce((sum, memberId) => sum + (Number(customShares[memberId]) || 0), 0)
        : items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const remaining = total - allocated;
  const itemModeValid =
    items.length > 0 &&
    items.every(
      (item) =>
        item.label.trim().length > 0 &&
        Number(item.amount) >= 0 &&
        item.memberIds.length > 0,
    );
  const valid =
    title.trim().length > 0 &&
    total > 0 &&
    Math.abs(remaining) < 0.01 &&
    (mode === "items" ? itemModeValid : selectedMemberIds.length > 0);

  const reset = () => {
    setTitle("");
    setDescription("");
    setAmount("");
    setMode("equal");
    setSubfolderId("");
    setSelectedMemberIds([]);
    setCustomShares({});
    setItems([{ key: `item-${Date.now()}`, label: "", amount: "", memberIds: [] }]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const body =
        mode === "items"
          ? {
              title: title.trim(),
              description: description.trim() || undefined,
              amount: total,
              splitMode: mode,
              subfolderId: subfolderId || null,
              participants: [],
              items: items.map((item) => ({
                key: item.key,
                label: item.label.trim(),
                amount: Number(item.amount),
                memberIds: item.memberIds,
              })),
            }
          : {
              title: title.trim(),
              description: description.trim() || undefined,
              amount: total,
              splitMode: mode,
              subfolderId: subfolderId || null,
              participants: selectedMemberIds.map((memberId) => ({
                memberId,
                ...(mode === "custom" ? { shareAmount: Number(customShares[memberId]) || 0 } : {}),
              })),
            };
      const response = await apiRequest("POST", `/api/split-folders/${folderId}/bills`, body);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId, "bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders"] });
      toast({ title: "Bill created" });
      reset();
      setOpen(false);
    },
    onError: (error: any) =>
      toast({ title: "Couldn't create bill", description: error.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ billId, participantId, status }: { billId: string; participantId: string; status: string }) =>
      apiRequest(
        "PATCH",
        `/api/split-folders/${folderId}/bills/${billId}/participants/${participantId}`,
        { status },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId, "bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders"] });
      toast({ title: "Payment status updated" });
    },
    onError: (error: any) =>
      toast({ title: "Couldn't update status", description: error.message, variant: "destructive" }),
  });

  const toggleSelectedMember = (memberId: string) => {
    setSelectedMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  };

  const memberName = (memberId: string) => {
    const member = members.find((candidate) => candidate.id === memberId);
    return member?.displayName || member?.inviteEmail || "Member";
  };

  return (
    <>
      <Card className="receiptify-panel">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-semibold">
              <WalletCards className="h-4 w-4 text-[#60786d]" />
              Split bills
            </h3>
            <Button size="sm" variant="outline" disabled={!canEdit} onClick={() => setOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              New bill
            </Button>
          </div>

          {bills.length === 0 ? (
            <p className="text-sm text-gray-500">Create a one-off bill without changing any source receipt.</p>
          ) : (
            <div className="space-y-3">
              {bills.map((bill) => (
                <div key={bill.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{bill.title}</p>
                      <p className="text-xs text-gray-500">
                        {bill.splitMode === "items" ? `${bill.items.length} items` : `${bill.participants.length} shares`}
                      </p>
                    </div>
                    <div className="text-right">
                      <strong className="receiptify-mono block text-sm">£{Number(bill.amount).toFixed(2)}</strong>
                      <Badge variant="outline">{bill.status.replace("_", " ")}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {bill.participants.map((participant) => (
                      <div key={participant.id} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate">
                          {memberName(participant.memberId)} · £{Number(participant.shareAmount).toFixed(2)}
                        </span>
                        <Badge variant="secondary">{participant.status}</Badge>
                        {canManage && participant.status !== "paid" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ billId: bill.id, participantId: participant.id, status: "paid" })}
                          >
                            <Check className="mr-1 h-3 w-3" />
                            Paid
                          </Button>
                        )}
                        {canManage && participant.status === "paid" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ billId: bill.id, participantId: participant.id, status: "pending" })}
                          >
                            Undo
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
        <DialogContent className="receiptify-dialog max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New split bill</DialogTitle>
            <DialogDescription>Allocate the complete bill equally, with custom amounts, or by item.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Bill name</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Dinner or hotel" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Total amount</Label>
                <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label>Subfolder</Label>
                <select className="h-10 w-full rounded-md border bg-transparent px-3 text-sm" value={subfolderId} onChange={(event) => setSubfolderId(event.target.value)}>
                  <option value="">None</option>
                  {subfolders.map((subfolder) => <option key={subfolder.id} value={subfolder.id}>{subfolder.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["equal", "custom", "items"] as const).map((value) => (
                <Button key={value} type="button" size="sm" variant={mode === value ? "default" : "outline"} onClick={() => setMode(value)}>
                  {value === "items" ? "By item" : value[0].toUpperCase() + value.slice(1)}
                </Button>
              ))}
            </div>

            {mode !== "items" ? (
              <div className="space-y-2 rounded-xl border p-3">
                <Label>Participants</Label>
                {allocatableMembers.map((member) => {
                  const selected = selectedMemberIds.includes(member.id);
                  return (
                    <div key={member.id} className="flex items-center gap-2">
                      <Checkbox checked={selected} onCheckedChange={() => toggleSelectedMember(member.id)} />
                      <span className="min-w-0 flex-1 truncate text-sm">{memberName(member.id)}</span>
                      {mode === "custom" && selected && (
                        <Input
                          className="w-24"
                          inputMode="decimal"
                          value={customShares[member.id] || ""}
                          onChange={(event) => setCustomShares((current) => ({ ...current, [member.id]: event.target.value }))}
                          placeholder="0.00"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border p-3">
                <Label>Bill items</Label>
                {items.map((item, itemIndex) => (
                  <div key={item.key} className="space-y-2 border-b pb-3 last:border-0">
                    <div className="flex gap-2">
                      <Input
                        className="min-w-0 flex-1"
                        value={item.label}
                        onChange={(event) => setItems((current) => current.map((candidate, index) => index === itemIndex ? { ...candidate, label: event.target.value } : candidate))}
                        placeholder="Item"
                      />
                      <Input
                        className="w-24"
                        inputMode="decimal"
                        value={item.amount}
                        onChange={(event) => setItems((current) => current.map((candidate, index) => index === itemIndex ? { ...candidate, amount: event.target.value } : candidate))}
                        placeholder="0.00"
                      />
                      <Button size="icon" variant="ghost" onClick={() => setItems((current) => current.filter((_, index) => index !== itemIndex))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {allocatableMembers.map((member) => {
                        const selected = item.memberIds.includes(member.id);
                        return (
                          <button
                            key={member.id}
                            type="button"
                            className={`rounded-full border px-2 py-1 text-xs ${selected ? "border-green-600 bg-green-600 text-white" : "bg-white"}`}
                            onClick={() => setItems((current) => current.map((candidate, index) => index === itemIndex ? {
                              ...candidate,
                              memberIds: selected
                                ? candidate.memberIds.filter((id) => id !== member.id)
                                : [...candidate.memberIds, member.id],
                            } : candidate))}
                          >
                            {memberName(member.id)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <Button type="button" variant="ghost" onClick={() => setItems((current) => [...current, { key: `item-${Date.now()}`, label: "", amount: "", memberIds: [] }])}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add item
                </Button>
              </div>
            )}

            <div className={`rounded-lg px-3 py-2 text-xs ${Math.abs(remaining) < 0.01 ? "bg-green-50 text-green-700" : remaining < 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
              Allocated £{allocated.toFixed(2)} of £{total.toFixed(2)} · {remaining < -0.01 ? `£${Math.abs(remaining).toFixed(2)} over` : `£${Math.max(0, remaining).toFixed(2)} remaining`}
            </div>
            <Button className="w-full receiptify-primary-action" disabled={!valid || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "Creating…" : "Create bill"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
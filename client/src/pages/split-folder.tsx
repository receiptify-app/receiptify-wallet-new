import { useMemo, useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  UserPlus,
  Users,
  Check,
  X as XIcon,
  Receipt as ReceiptIcon,
  ChevronDown,
  ChevronUp,
  Send,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import SplitInviteDialog from "@/components/split-invite-dialog";

type Member = {
  id: string;
  folderId: string;
  userId: string | null;
  inviteEmail: string | null;
  displayName: string | null;
  status: string;
  role: string;
};

type Assignment = {
  id: string;
  memberId: string;
  itemId: string | null;
  shareAmount: string;
  status: "pending" | "paid";
};

type FolderReceipt = {
  id: string;
  merchantName: string;
  total: string;
  date: string;
  items: Array<{ id: string; name: string; price: string; quantity: string | null }>;
  assignments: Assignment[];
};

type FolderDetail = {
  folder: { id: string; name: string; description: string | null; ownerId: string };
  members: Member[];
  receipts: FolderReceipt[];
  settlement: Array<{ memberId: string; displayName: string | null; userId: string | null; inviteEmail: string | null; owed: number; paid: number; total: number; status: string; role: string }>;
  totalAmount: number;
  isOwner: boolean;
};

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || name[0].toUpperCase();
}

function computeShares(amount: number, memberIds: string[]): { memberId: string; share: string }[] {
  if (memberIds.length === 0) return [];
  const share = amount / memberIds.length;
  let runningSum = 0;
  return memberIds.map((memberId, idx) => {
    const raw =
      idx === memberIds.length - 1
        ? (amount - runningSum).toFixed(2)
        : share.toFixed(2);
    runningSum += parseFloat(raw);
    return { memberId, share: raw };
  });
}

// Per-receipt editor — handles both split modes and persists via the mutation.
function ReceiptSplitter({
  receipt,
  members,
  folderId,
}: {
  receipt: FolderReceipt;
  members: Member[];
  folderId: string;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const total = parseFloat(receipt.total);

  // Infer the prior mode from saved assignments so re-opening the editor preserves intent.
  const initialMode: "whole" | "items" = receipt.assignments.some((a) => a.itemId) ? "items" : "whole";
  const [mode, setMode] = useState<"whole" | "items">(initialMode);

  // whole-bill state: list of member IDs + how to split (equal or custom amounts)
  const initialWholeAssignments = receipt.assignments.filter((a) => !a.itemId);
  const initialWholeMembers = initialWholeAssignments.map((a) => a.memberId);
  const [wholeMembers, setWholeMembers] = useState<string[]>(initialWholeMembers);

  // If any saved share differs from a strict equal split, restore "custom" mode.
  const equalShare = initialWholeMembers.length > 0 ? total / initialWholeMembers.length : 0;
  const initialWholeMode: "equal" | "custom" =
    initialWholeAssignments.length > 0 &&
    initialWholeAssignments.some((a) => Math.abs(parseFloat(a.shareAmount) - equalShare) > 0.02)
      ? "custom"
      : "equal";
  const [wholeMode, setWholeMode] = useState<"equal" | "custom">(initialWholeMode);

  // Per-member custom amount strings (kept as strings so the input is fully controlled).
  const initialCustomAmounts: Record<string, string> = {};
  initialWholeAssignments.forEach((a) => {
    initialCustomAmounts[a.memberId] = parseFloat(a.shareAmount).toFixed(2);
  });
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(initialCustomAmounts);

  // per-item state: itemId -> memberId[]
  const initialItemMap: Record<string, string[]> = {};
  const initialAdditionalMembers: string[] = [];
  receipt.assignments.forEach((a) => {
    if (a.itemId) {
      (initialItemMap[a.itemId] ||= []).push(a.memberId);
    } else if (initialMode === "items") {
      // null-itemId in items mode = additional charges assignment
      if (!initialAdditionalMembers.includes(a.memberId)) initialAdditionalMembers.push(a.memberId);
    }
  });
  const [itemMap, setItemMap] = useState<Record<string, string[]>>(initialItemMap);
  // additional charges split (virtual row for gap between sum-of-items and receipt total)
  const [additionalMembers, setAdditionalMembers] = useState<string[]>(initialAdditionalMembers);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const assignments: Array<{ memberId: string; itemId: string | null; shareAmount: string }> = [];
      if (mode === "whole") {
        if (wholeMembers.length === 0) {
          // no-op: clears assignments
        } else if (wholeMode === "equal") {
          // Distribute equally with a final-row adjustment so the sum lands exactly on total.
          const share = total / wholeMembers.length;
          let runningSum = 0;
          wholeMembers.forEach((memberId, idx) => {
            const raw =
              idx === wholeMembers.length - 1
                ? (total - runningSum).toFixed(2)
                : share.toFixed(2);
            runningSum += parseFloat(raw);
            assignments.push({ memberId, itemId: null, shareAmount: raw });
          });
        } else {
          // Custom amounts — validate against receipt total before sending.
          const sum = wholeMembers.reduce(
            (s, id) => s + (parseFloat(customAmounts[id] || "0") || 0),
            0,
          );
          if (Math.abs(sum - total) > 0.01) {
            throw new Error(`Custom amounts add up to £${sum.toFixed(2)}, but the bill is £${total.toFixed(2)}.`);
          }
          wholeMembers.forEach((memberId) => {
            const raw = parseFloat(customAmounts[memberId] || "0") || 0;
            assignments.push({ memberId, itemId: null, shareAmount: raw.toFixed(2) });
          });
        }
      } else {
        receipt.items.forEach((item) => {
          const assigned = itemMap[item.id] || [];
          if (assigned.length === 0) return;
          const itemTotal = parseFloat(item.price);
          const share = itemTotal / assigned.length;
          let runningSum = 0;
          assigned.forEach((memberId, idx) => {
            const raw =
              idx === assigned.length - 1
                ? (itemTotal - runningSum).toFixed(2)
                : share.toFixed(2);
            runningSum += parseFloat(raw);
            assignments.push({ memberId, itemId: item.id, shareAmount: raw });
          });
        });
        // Additional charges (gap between item prices and receipt total)
        const additionalAmount = parseFloat((total - receipt.items.reduce((s, i) => s + parseFloat(i.price), 0)).toFixed(2));
        if (additionalAmount > 0.01 && additionalMembers.length > 0) {
          const share = additionalAmount / additionalMembers.length;
          let runningSum = 0;
          additionalMembers.forEach((memberId, idx) => {
            const raw =
              idx === additionalMembers.length - 1
                ? (additionalAmount - runningSum).toFixed(2)
                : share.toFixed(2);
            runningSum += parseFloat(raw);
            assignments.push({ memberId, itemId: null, shareAmount: raw });
          });
        }
      }
      const res = await apiRequest(
        "PUT",
        `/api/split-folders/${folderId}/receipts/${receipt.id}/assignments`,
        { mode, assignments },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId] });
      toast({ title: "Split saved" });
      setExpanded(false);
    },
    onError: (err: any) => toast({ title: "Couldn't save split", description: err.message, variant: "destructive" }),
  });

  const detachMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/split-folders/${folderId}/receipts/${receipt.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders"] });
      toast({ title: "Receipt removed from folder" });
    },
  });

  const [confirmRemove, setConfirmRemove] = useState(false);

  const toggleWhole = (memberId: string) => {
    setWholeMembers((cur) => {
      const next = cur.includes(memberId) ? cur.filter((m) => m !== memberId) : [...cur, memberId];
      // Seed a default custom amount for newly added members so the input isn't blank.
      if (!cur.includes(memberId) && wholeMode === "custom") {
        setCustomAmounts((c) => ({
          ...c,
          [memberId]: c[memberId] || (total / Math.max(next.length, 1)).toFixed(2),
        }));
      }
      return next;
    });
  };

  const setCustomAmount = (memberId: string, value: string) => {
    // Allow empty / partial input while the user types; we'll validate on save.
    setCustomAmounts((c) => ({ ...c, [memberId]: value.replace(/[^0-9.]/g, "") }));
  };

  const switchWholeMode = (next: "equal" | "custom") => {
    setWholeMode(next);
    if (next === "custom") {
      // Pre-fill blank inputs with an even share so the form is immediately usable.
      const baseShare = wholeMembers.length > 0 ? total / wholeMembers.length : 0;
      setCustomAmounts((c) => {
        const out = { ...c };
        wholeMembers.forEach((id) => {
          if (!out[id]) out[id] = baseShare.toFixed(2);
        });
        return out;
      });
    }
  };

  const toggleItem = (itemId: string, memberId: string) => {
    setItemMap((cur) => {
      const next = { ...cur };
      const arr = next[itemId] || [];
      next[itemId] = arr.includes(memberId) ? arr.filter((m) => m !== memberId) : [...arr, memberId];
      return next;
    });
  };

  const activeMembers = members.filter((m) => m.status === "active");

  // The gap between the sum of all item prices and the receipt total (covers unitemised charges)
  const itemsSubtotal = receipt.items.reduce((s, i) => s + parseFloat(i.price), 0);
  const additionalAmount = parseFloat((total - itemsSubtotal).toFixed(2));
  const hasAdditional = additionalAmount > 0.01;

  const toggleAdditional = (memberId: string) => {
    setAdditionalMembers((cur) =>
      cur.includes(memberId) ? cur.filter((m) => m !== memberId) : [...cur, memberId],
    );
  };

  const assignedTotal = useMemo(() => {
    if (mode === "whole") {
      if (wholeMembers.length === 0) return 0;
      if (wholeMode === "equal") return total;
      return wholeMembers.reduce(
        (s, id) => s + (parseFloat(customAmounts[id] || "0") || 0),
        0,
      );
    }
    const itemsAssigned = Object.entries(itemMap).reduce((s, [itemId, ids]) => {
      if (ids.length === 0) return s;
      const item = receipt.items.find((i) => i.id === itemId);
      return s + (item ? parseFloat(item.price) : 0);
    }, 0);
    const addAssigned = hasAdditional && additionalMembers.length > 0 ? additionalAmount : 0;
    return itemsAssigned + addAssigned;
  }, [mode, wholeMembers, wholeMode, customAmounts, itemMap, receipt.items, total, additionalMembers, additionalAmount, hasAdditional]);

  const wholeCustomOff =
    mode === "whole" && wholeMode === "custom" && Math.abs(assignedTotal - total) > 0.01;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-gray-900 truncate">{receipt.merchantName}</div>
            <div className="text-xs text-gray-500">{new Date(receipt.date).toLocaleDateString()} · £{total.toFixed(2)}</div>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs">
              {receipt.assignments.length === 0
                ? "No split"
                : receipt.assignments.every((a) => a.status === "paid")
                ? "Paid"
                : "Pending"}
            </Badge>
            <Button size="sm" variant="ghost" onClick={() => setExpanded((e) => !e)} data-testid={`toggle-receipt-${receipt.id}`}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant={mode === "whole" ? "default" : "outline"} className={mode === "whole" ? "bg-green-600 hover:bg-green-700" : ""} onClick={() => setMode("whole")}>
                Entire bill
              </Button>
              <Button size="sm" variant={mode === "items" ? "default" : "outline"} className={mode === "items" ? "bg-green-600 hover:bg-green-700" : ""} onClick={() => setMode("items")}>
                Individual items
              </Button>
            </div>

            {mode === "whole" && (
              <div className="space-y-2">
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => switchWholeMode("equal")}
                    className={`px-3 py-1 rounded-full border ${wholeMode === "equal" ? "bg-green-50 border-green-600 text-green-700" : "border-gray-200 text-gray-600"}`}
                    data-testid={`whole-mode-equal-${receipt.id}`}
                  >
                    Equal split
                  </button>
                  <button
                    type="button"
                    onClick={() => switchWholeMode("custom")}
                    className={`px-3 py-1 rounded-full border ${wholeMode === "custom" ? "bg-green-50 border-green-600 text-green-700" : "border-gray-200 text-gray-600"}`}
                    data-testid={`whole-mode-custom-${receipt.id}`}
                  >
                    Custom amounts
                  </button>
                </div>
                {activeMembers.map((m) => {
                  const selected = wholeMembers.includes(m.id);
                  return (
                    <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                      <Checkbox checked={selected} onCheckedChange={() => toggleWhole(m.id)} />
                      <span className="flex-1 text-sm">{m.displayName}</span>
                      {selected && wholeMode === "equal" && (
                        <span className="text-sm font-medium text-gray-700">£{(total / wholeMembers.length).toFixed(2)}</span>
                      )}
                      {selected && wholeMode === "custom" && (
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-500">£</span>
                          <Input
                            inputMode="decimal"
                            value={customAmounts[m.id] ?? ""}
                            onChange={(e) => setCustomAmount(m.id, e.target.value)}
                            className="w-20 h-8 text-sm"
                            data-testid={`custom-amount-${receipt.id}-${m.id}`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                {wholeCustomOff && (
                  <div className="text-xs text-amber-600">
                    Custom amounts need to add up to £{total.toFixed(2)} before you can save.
                  </div>
                )}
              </div>
            )}

            {mode === "items" && (
              <div className="space-y-3">
                {receipt.items.length === 0 && !hasAdditional && (
                  <div className="text-sm text-gray-500 italic">This receipt has no line items captured.</div>
                )}
                {receipt.items.map((item) => {
                  const assigned = itemMap[item.id] || [];
                  const itemPrice = parseFloat(item.price);
                  const shares = computeShares(itemPrice, assigned);
                  return (
                    <div key={item.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-sm font-semibold">£{itemPrice.toFixed(2)}</div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {activeMembers.map((m) => {
                          const on = assigned.includes(m.id);
                          const shareEntry = shares.find((s) => s.memberId === m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => toggleItem(item.id, m.id)}
                              className={`text-xs px-2 py-1 rounded-full border ${on ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-700 border-gray-300"}`}
                              data-testid={`item-${item.id}-member-${m.id}`}
                            >
                              {initials(m.displayName)}
                              {on && shareEntry && (
                                <span className="ml-1">£{shareEntry.share}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {hasAdditional && (
                  <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-amber-800">Additional Charges</div>
                      <div className="text-sm font-semibold text-amber-800">£{additionalAmount.toFixed(2)}</div>
                    </div>
                    <div className="text-xs text-amber-600 mb-1">
                      Covers service charge, tax, or other charges not listed as items
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {activeMembers.map((m) => {
                        const on = additionalMembers.includes(m.id);
                        const addShares = computeShares(additionalAmount, additionalMembers);
                        const shareEntry = addShares.find((s) => s.memberId === m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => toggleAdditional(m.id)}
                            className={`text-xs px-2 py-1 rounded-full border ${on ? "bg-amber-600 text-white border-amber-600" : "bg-white text-amber-700 border-amber-300"}`}
                            data-testid={`additional-member-${m.id}`}
                          >
                            {initials(m.displayName)}
                            {on && shareEntry && (
                              <span className="ml-1">£{shareEntry.share}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Assigned</span>
              <span className={Math.abs(assignedTotal - total) < 0.01 ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                £{assignedTotal.toFixed(2)} / £{total.toFixed(2)}
              </span>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || wholeCustomOff}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {saveMutation.isPending ? "Saving…" : "Save split"}
              </Button>
              <Button variant="outline" onClick={() => setConfirmRemove(true)}>
                Remove
              </Button>
            </div>
          </div>
        )}

        <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this receipt from the folder?</AlertDialogTitle>
              <AlertDialogDescription>
                The receipt stays in your wallet, but it'll be detached from this folder and all its split assignments will be cleared.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => detachMutation.mutate()}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

export default function SplitFolderPage() {
  const params = useParams();
  const folderId = params.folderId as string;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const { data, isLoading } = useQuery<FolderDetail>({
    queryKey: ["/api/split-folders", folderId],
  });

  const settleMutation = useMutation({
    mutationFn: async (memberId: string) =>
      apiRequest("POST", `/api/split-folders/${folderId}/members/${memberId}/settle`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders"] });
      toast({ title: "Marked as settled" });
    },
    onError: (err: any) => toast({ title: "Couldn't mark settled", description: err.message, variant: "destructive" }),
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/split-folders/${folderId}/members/${memberId}/resend-invite`,
        {},
      );
      return res.json();
    },
    onSuccess: (data: any, memberId: string) => {
      const member = data?.inviteEmail
        ? data
        : (queryClient.getQueryData<FolderDetail>(["/api/split-folders", folderId])?.members.find((m) => m.id === memberId));
      toast({
        title: "Invite resent",
        description: member?.inviteEmail
          ? `We re-sent the invite to ${member.inviteEmail}.`
          : "Invite email re-sent.",
      });
    },
    onError: (err: any) => {
      let description = err?.message || "Couldn't resend invite";
      try {
        const parsed = JSON.parse(description.split(": ").slice(1).join(": "));
        if (parsed?.emailError || parsed?.error) {
          description = parsed.emailError || parsed.error;
        }
      } catch {}
      toast({ title: "Couldn't resend invite", description, variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) =>
      apiRequest("DELETE", `/api/split-folders/${folderId}/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId] });
      setConfirmRemove(null);
      toast({ title: "Member removed" });
    },
    onError: (err: any) => toast({ title: "Couldn't remove member", description: err.message, variant: "destructive" }),
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const { folder, members, receipts: folderReceipts, settlement, totalAmount, isOwner } = data;
  const activeMembers = members.filter((m) => m.status !== "removed");

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="px-6 pt-6 pb-2 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/split")} data-testid="back-to-split">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm text-gray-500">Split folders</span>
      </div>

      <div className="px-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{folder.name}</h1>
          {folder.description && <p className="text-sm text-gray-600 mt-1">{folder.description}</p>}
          <div className="mt-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Total</div>
              <div className="text-2xl font-bold text-gray-900">£{totalAmount.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide text-right">Receipts</div>
              <div className="text-2xl font-bold text-gray-900 text-right">{folderReceipts.length}</div>
            </div>
          </div>
        </div>

        {/* Members */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-green-600" />
                <h3 className="font-semibold">Members ({activeMembers.length})</h3>
              </div>
              <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)} data-testid="button-invite">
                <UserPlus className="w-4 h-4 mr-1" /> Invite
              </Button>
            </div>
            <div className="space-y-1">
              {activeMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-2 py-1.5">
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 text-xs font-semibold flex items-center justify-center">
                    {initials(m.displayName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.displayName}</div>
                    <div className="text-xs text-gray-500">
                      {m.role === "owner" ? "Owner" : m.status === "invited" ? "Invited" : "Member"}
                      {m.inviteEmail && ` · ${m.inviteEmail}`}
                    </div>
                  </div>
                  {isOwner && m.role !== "owner" && m.status === "invited" && m.inviteEmail && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => resendInviteMutation.mutate(m.id)}
                      disabled={resendInviteMutation.isPending}
                      className="text-gray-500 hover:text-green-700"
                      data-testid={`resend-invite-${m.id}`}
                      title="Resend invite email"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  )}
                  {isOwner && m.role !== "owner" && (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(m.id)} className="text-gray-400 hover:text-red-600">
                      <XIcon className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Receipts */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <ReceiptIcon className="w-4 h-4 text-green-600" /> Receipts in this folder
          </h3>
          {folderReceipts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center text-sm text-gray-500">
                Open a receipt from <Link href="/receipts" className="text-green-600 underline">My Receipts</Link> and tap Split to add it here.
              </CardContent>
            </Card>
          ) : (
            folderReceipts.map((r) => (
              <ReceiptSplitter key={r.id} receipt={r} members={members} folderId={folderId} />
            ))
          )}
        </div>

        {/* Settlement */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Settlement</h3>
            {settlement.length === 0 || settlement.every((s) => s.total === 0) ? (
              <p className="text-sm text-gray-500">Once you've split a receipt, who-owes-who appears here.</p>
            ) : (
              <div className="space-y-2">
                {settlement.map((s) => (
                  <div key={s.memberId} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 text-xs font-semibold flex items-center justify-center">
                        {initials(s.displayName)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{s.displayName}</div>
                        <div className="text-xs text-gray-500">
                          {s.role === "owner"
                            ? `paid for £${s.total.toFixed(2)}`
                            : s.owed > 0
                            ? `owes you £${s.owed.toFixed(2)} · ${s.status}`
                            : s.total > 0
                            ? `settled · £${s.paid.toFixed(2)}`
                            : "no share yet"}
                        </div>
                      </div>
                    </div>
                    {s.role !== "owner" && s.owed > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => settleMutation.mutate(s.memberId)}
                        disabled={settleMutation.isPending}
                        data-testid={`settle-${s.memberId}`}
                      >
                        <Check className="w-4 h-4 mr-1" /> Mark settled
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SplitInviteDialog folderId={folderId} open={inviteOpen} onOpenChange={setInviteOpen} />

      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this member?</AlertDialogTitle>
            <AlertDialogDescription>
              All of their assignments in this folder will be cleared. They can be re-invited later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => confirmRemove && removeMemberMutation.mutate(confirmRemove)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

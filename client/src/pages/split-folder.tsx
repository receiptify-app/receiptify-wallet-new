import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Trash2,
  Undo2,
  Plus,
  WalletCards,
  HandCoins,
  Settings2,
  Activity,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import SplitInviteDialog from "@/components/split-invite-dialog";
import FolderBillsPanel from "@/components/split/folder-bills-panel";

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
  imageUrl: string | null;
  items: Array<{ id: string; name: string; price: string; quantity: string | null }>;
  assignments: Assignment[];
  splitMetadata?: { subfolderId?: string | null; displayName?: string | null } | null;
};

type FolderDetail = {
  folder: { id: string; name: string; description: string | null; ownerId: string; ownerContactName?: string | null; ownerContactEmail?: string | null; ownerContactPhone?: string | null; parentFolderId?: string | null };
  members: Member[];
  receipts: FolderReceipt[];
  settlement: Array<{ memberId: string; displayName: string | null; userId: string | null; inviteEmail: string | null; owed: number; paid: number; total: number; status: string; role: string }>;
  totalAmount: number;
  isOwner: boolean;
  permissions?: { read: boolean; add: boolean; edit: boolean; manage: boolean };
  currentRole?: string;
  manualExpenses?: Array<{ id: string; description: string; amount: string | number; expenseDate: string; notes?: string | null; createdBy: string; payerMemberId?: string | null; subfolderId?: string | null; allocations?: Array<{ memberId: string; shareAmount: string | number }> }>;
  outstandingAmount?: number;
  subfolders?: Array<{ id: string; name: string; monthlyKey?: string | null }>;
  currentMemberId?: string | null;
};

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || name[0].toUpperCase();
}

function ReceiptImageOverlay({
  imageUrl,
  merchantName,
  receiptId,
  onClose,
}: {
  imageUrl: string;
  merchantName: string;
  receiptId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${merchantName} receipt image`}
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
      onClick={onClose}
      data-testid={`receipt-image-overlay-${receiptId}`}
    >
      <div
        className="flex items-center justify-between px-4 py-3 text-white flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-medium truncate">{merchantName}</span>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label="Close image"
          autoFocus
        >
          <XIcon className="w-6 h-6" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-auto p-4">
        <img
          src={imageUrl}
          alt={`${merchantName} receipt`}
          className="max-w-full max-h-full object-contain rounded"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
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
  canEdit,
  subfolders,
}: {
  receipt: FolderReceipt;
  members: Member[];
  folderId: string;
  canEdit: boolean;
  subfolders: Array<{ id: string; name: string }>;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [displayName, setDisplayName] = useState(receipt.splitMetadata?.displayName || "");
  const [subfolderId, setSubfolderId] = useState(receipt.splitMetadata?.subfolderId || "");
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

  const metadataMutation = useMutation({
    mutationFn: async () =>
      apiRequest(
        "PATCH",
        `/api/split-folders/${folderId}/receipts/${receipt.id}/metadata`,
        { displayName: displayName.trim() || null, subfolderId: subfolderId || null },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId] });
      setMetadataOpen(false);
      toast({ title: "Receipt details saved" });
    },
    onError: (error: any) =>
      toast({ title: "Couldn't organize receipt", description: error.message, variant: "destructive" }),
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
    <Card className="receiptify-panel overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          {receipt.imageUrl && (
            <button
              onClick={() => setImageOpen(true)}
              className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
              data-testid={`receipt-thumb-${receipt.id}`}
              title="View receipt image"
            >
              <img src={receipt.imageUrl} alt={`${receipt.merchantName} receipt`} className="w-full h-full object-cover" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-gray-900 truncate">{receipt.splitMetadata?.displayName || receipt.merchantName}</div>
            <div className="text-xs text-gray-500">{new Date(receipt.date).toLocaleDateString('en-GB', { timeZone: 'UTC' })} · £{total.toFixed(2)}</div>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs">
              {receipt.assignments.length === 0
                ? "No split"
                : receipt.assignments.every((a) => a.status === "paid")
                ? "Paid"
                : "Pending"}
            </Badge>
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={() => setMetadataOpen(true)} aria-label="Organize receipt">
                <Settings2 className="w-4 h-4" />
              </Button>
            )}
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

        <Dialog open={metadataOpen} onOpenChange={setMetadataOpen}>
          <DialogContent className="receiptify-dialog max-w-md">
            <DialogHeader>
              <DialogTitle>Organize receipt</DialogTitle>
              <DialogDescription>
                Give this receipt a folder-only name or move it into a subfolder. The original receipt stays unchanged.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Folder display name</Label>
                <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={receipt.merchantName} />
              </div>
              <div>
                <Label>Subfolder</Label>
                <select className="h-10 w-full rounded-md border bg-transparent px-3 text-sm" value={subfolderId} onChange={(event) => setSubfolderId(event.target.value)}>
                  <option value="">None</option>
                  {subfolders.map((subfolder) => <option key={subfolder.id} value={subfolder.id}>{subfolder.name}</option>)}
                </select>
              </div>
              <Button className="w-full receiptify-primary-action" disabled={metadataMutation.isPending} onClick={() => metadataMutation.mutate()}>
                {metadataMutation.isPending ? "Saving…" : "Save receipt details"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {imageOpen && receipt.imageUrl && (
          <ReceiptImageOverlay
            imageUrl={receipt.imageUrl}
            merchantName={receipt.merchantName}
            receiptId={receipt.id}
            onClose={() => setImageOpen(false)}
          />
        )}
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
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [expense, setExpense] = useState({ description: "", amount: "", notes: "", expenseDate: new Date().toISOString().slice(0, 10), payerMemberId: "", subfolderId: "", allocations: {} as Record<string, string> });
  const [payment, setPayment] = useState({ memberId: "", amount: "" });
  const [folderDraft, setFolderDraft] = useState({ name: "", description: "", ownerContactName: "", ownerContactEmail: "", ownerContactPhone: "" });
  const [subfolderName, setSubfolderName] = useState("");
  const [subfolderMonth, setSubfolderMonth] = useState("");

  const { data, isLoading, isError } = useQuery<FolderDetail>({
    queryKey: ["/api/split-folders", folderId],
  });
  const canAdd = !!data?.permissions?.add || !!data?.isOwner;
  const canEdit = !!data?.permissions?.edit || !!data?.isOwner;
  const canManage = !!data?.permissions?.manage || !!data?.isOwner;
  const expenseMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...expense, amount: Number(expense.amount), payerMemberId: expense.payerMemberId || undefined, subfolderId: expense.subfolderId || null, allocations: Object.entries(expense.allocations).filter(([, shareAmount]) => Number(shareAmount) > 0).map(([memberId, shareAmount]) => ({ memberId, shareAmount: Number(shareAmount) })) };
      return apiRequest(editingExpenseId ? "PATCH" : "POST", editingExpenseId ? `/api/split-folders/${folderId}/expenses/${editingExpenseId}` : `/api/split-folders/${folderId}/expenses`, payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId] }); queryClient.invalidateQueries({ queryKey: ["/api/split-folders"] }); setExpenseOpen(false); setEditingExpenseId(null); setExpense({ description:"", amount:"", notes:"", expenseDate:new Date().toISOString().slice(0,10), payerMemberId:"", subfolderId:"", allocations:{} }); toast({ title:"Expense saved" }); },
    onError: (e:any) => toast({ title:"Couldn't add expense", description:e.message, variant:"destructive" }),
  });
  const paymentMutation = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", `/api/split-folders/${folderId}/payment-requests`, { memberId: payment.memberId, amount: Number(payment.amount), currency:"GBP" }); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId, "payment-requests"] }); setPaymentOpen(false); setPayment({memberId:"",amount:""}); toast({ title:"Payment request drafted", description:"It is ready to send when Stripe Connect is available." }); },
    onError: (e:any) => toast({ title:"Couldn't draft request", description:e.message, variant:"destructive" }),
  });
  const paymentActionMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: "send" | "cancel" | "decline" }) =>
      apiRequest("POST", `/api/split-folders/${folderId}/payment-requests/${requestId}/${action}`, {}),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId, "payment-requests"] });
      toast({ title: variables.action === "cancel" ? "Request cancelled" : variables.action === "decline" ? "Request declined" : "Request sent" });
    },
    onError: (error: any, variables) =>
      toast({
        title: variables.action === "send" ? "Sending isn't available yet" : `Couldn't ${variables.action} request`,
        description: error.message,
        variant: "destructive",
      }),
  });
  const folderMutation = useMutation({
    mutationFn: async () => apiRequest("PATCH", `/api/split-folders/${folderId}`, { ...folderDraft, description: folderDraft.description || null, ownerContactName: folderDraft.ownerContactName || null, ownerContactEmail: folderDraft.ownerContactEmail || null, ownerContactPhone: folderDraft.ownerContactPhone || null }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId] }); queryClient.invalidateQueries({ queryKey: ["/api/split-folders"] }); setSettingsOpen(false); toast({title:"Folder details saved"}); },
    onError: (e:any) => toast({title:"Couldn't save details",description:e.message,variant:"destructive"}),
  });
  const { data: activity = [] } = useQuery<any[]>({ queryKey: ["/api/split-folders", folderId, "activity"], enabled: activityOpen });
  const { data: paymentRequests = [] } = useQuery<any[]>({ queryKey: ["/api/split-folders", folderId, "payment-requests"], enabled: paymentOpen });
  const subfolderMutation = useMutation({
    mutationFn: async (body: { name?: string; monthlyKey?: string }) =>
      apiRequest("POST", `/api/split-folders/${folderId}/subfolders`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId] });
      setSubfolderName("");
      setSubfolderMonth("");
      toast({ title: "Subfolder added" });
    },
    onError: (e: any) => toast({ title: "Couldn't add subfolder", description: e.message, variant: "destructive" }),
  });
  const updateSubfolderMutation = useMutation({
    mutationFn: async ({ id, method, name }: { id: string; method: "PATCH" | "DELETE"; name?: string }) =>
      apiRequest(method, `/api/split-folders/${folderId}/subfolders/${id}`, name ? { name } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId] });
      toast({ title: "Subfolder updated" });
    },
    onError: (error: any) =>
      toast({ title: "Couldn't update subfolder", description: error.message, variant: "destructive" }),
  });
  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) =>
      apiRequest("DELETE", `/api/split-folders/${folderId}/expenses/${expenseId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders"] });
      toast({ title: "Expense deleted" });
    },
    onError: (error: any) =>
      toast({ title: "Couldn't delete expense", description: error.message, variant: "destructive" }),
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

  const unsettleMutation = useMutation({
    mutationFn: async (memberId: string) =>
      apiRequest("POST", `/api/split-folders/${folderId}/members/${memberId}/unsettle`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders"] });
      toast({ title: "Marked as unpaid", description: "Their share is back to pending." });
    },
    onError: (err: any) => toast({ title: "Couldn't revert settlement", description: err.message, variant: "destructive" }),
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

  const deleteFolderMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/split-folders/${folderId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders"] });
      toast({
        title: "Folder deleted",
        description: "Members have been notified by email. Receipts are back in their owners' wallets.",
      });
      navigate("/split");
    },
    onError: (err: any) =>
      toast({ title: "Couldn't delete folder", description: err.message, variant: "destructive" }),
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

  if (isLoading) {
    return (
      <div className="receiptify-page min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="receiptify-page min-h-screen flex items-center justify-center px-6">
        <Card className="receiptify-panel w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h1 className="text-xl font-bold text-gray-900">Split workspace not found</h1>
            <p className="mt-2 text-sm text-gray-500">It may have been deleted, or you may no longer have access.</p>
            <Button className="mt-4 receiptify-primary-action" onClick={() => navigate("/split")}>
              Back to Split
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { folder, members, receipts: folderReceipts, settlement, totalAmount, isOwner, manualExpenses = [], outstandingAmount = totalAmount, subfolders = [], currentMemberId = null } = data;
  const activeMembers = members.filter((m) => m.status !== "removed");

  return (
    <div className="receiptify-page pb-24">
      <div className="receiptify-detail-header px-6 pt-6 pb-2 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/split")} data-testid="back-to-split">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm text-gray-500 flex-1">Split folders</span>
        {isOwner && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDeleteFolder(true)}
            className="text-gray-400 hover:text-red-600"
            data-testid="button-delete-folder"
            title="Delete folder"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="receiptify-detail-content px-6 space-y-5">
        <div className="receiptify-folder-hero">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{folder.name}</h1>
          {folder.description && <p className="text-sm text-gray-600 mt-1">{folder.description}</p>}
            </div>
            <Badge className="bg-[#dfe9e0] text-[#1e2c2b] hover:bg-[#dfe9e0] shrink-0">{data.currentRole || (isOwner ? "Owner" : "Member")}</Badge>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Total</div>
              <div className="text-2xl font-bold text-gray-900">£{totalAmount.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-2">Outstanding <strong className="text-[#f4ddd4]">£{Number(outstandingAmount).toFixed(2)}</strong></div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide text-right">Receipts</div>
              <div className="text-2xl font-bold text-gray-900 text-right">{folderReceipts.length}</div>
            </div>
          </div>
        </div>

        <div className="receiptify-workspace-actions">
          <Button disabled={!canAdd} onClick={() => navigate("/scan")}><Plus className="w-4 h-4" /> Add receipt</Button>
          <Button disabled={!canAdd} onClick={() => setExpenseOpen(true)}><HandCoins className="w-4 h-4" /> Add expense</Button>
          <Button disabled={!canManage} onClick={() => setInviteOpen(true)}><UserPlus className="w-4 h-4" /> Invite person</Button>
          <Button disabled={!canManage} onClick={() => setPaymentOpen(true)}><WalletCards className="w-4 h-4" /> Request payment</Button>
        </div>

        {/* Members */}
        <Card className="receiptify-panel">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-green-600" />
                <h3 className="font-semibold">Members ({activeMembers.length})</h3>
              </div>
              <Button size="sm" variant="outline" disabled={!canManage} onClick={() => setInviteOpen(true)} data-testid="button-invite">
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
                    </div>
                  </div>
                  {canManage && m.role !== "owner" && <select aria-label={`Role for ${m.displayName || "member"}`} value={m.role === "member" ? "viewer" : m.role} onChange={async e=>{try { await apiRequest("PATCH", `/api/split-folders/${folderId}/members/${m.id}/role`, {role:e.target.value}); queryClient.invalidateQueries({queryKey:["/api/split-folders",folderId]}); toast({title:"Role updated"}); } catch(err:any){toast({title:"Couldn't update role",description:err.message,variant:"destructive"})}}} className="h-8 max-w-[100px] rounded-md border bg-transparent px-2 text-xs"><option value="viewer">Viewer</option><option value="contributor">Contributor</option><option value="editor">Editor</option></select>}
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

        <FolderBillsPanel
          folderId={folderId}
          members={members}
          subfolders={subfolders}
          canEdit={canEdit}
          canManage={canManage}
        />

        <Card className="receiptify-panel">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Subfolders</h3><span className="text-xs text-gray-500">Trips and months</span></div>
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex gap-2">
                <Input value={subfolderName} onChange={e=>setSubfolderName(e.target.value)} placeholder="e.g. Saturday" />
                <Button aria-label="Add custom subfolder" disabled={!canManage || !subfolderName.trim() || subfolderMutation.isPending} onClick={()=>subfolderMutation.mutate({ name: subfolderName.trim() })}><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="flex gap-2">
                <Input type="month" value={subfolderMonth} onChange={e=>setSubfolderMonth(e.target.value)} />
                <Button aria-label="Add monthly subfolder" disabled={!canManage || !subfolderMonth || subfolderMutation.isPending} onClick={()=>subfolderMutation.mutate({ monthlyKey: subfolderMonth })}>Add month</Button>
              </div>
            </div>
            <div className="space-y-2">
              {subfolders.length === 0 && <p className="text-sm text-gray-500">No subfolders yet.</p>}
              {subfolders.map(s=>(
                <div key={s.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{s.name}{s.monthlyKey ? ` · ${s.monthlyKey}` : ""}</span>
                  {canManage && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => {
                        const name = window.prompt("Rename subfolder", s.name)?.trim();
                        if (name && name !== s.name) updateSubfolderMutation.mutate({ id: s.id, method: "PATCH", name });
                      }}>Rename</Button>
                      <Button size="icon" variant="ghost" aria-label={`Delete ${s.name}`} className="text-red-600" onClick={() => {
                        if (window.confirm(`Delete “${s.name}”? Its entries will move back to the main folder.`)) {
                          updateSubfolderMutation.mutate({ id: s.id, method: "DELETE" });
                        }
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="receiptify-panel">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3"><h3 className="font-semibold flex items-center gap-2"><HandCoins className="w-4 h-4 text-[#60786d]" /> Manual expenses</h3><Button size="sm" variant="ghost" disabled={!canAdd} onClick={() => setExpenseOpen(true)}><Plus className="w-4 h-4" /></Button></div>
            {manualExpenses.length === 0 ? <p className="text-sm text-gray-500">Add a tip, taxi, or anything that never came with a receipt.</p> : <div className="space-y-2">{manualExpenses.map((e) => { const allocated = (e.allocations || []).reduce((sum, allocation) => sum + Number(allocation.shareAmount), 0); const subfolder = subfolders.find((candidate) => candidate.id === e.subfolderId); return <div key={e.id} className="flex flex-wrap items-center gap-3 border-b last:border-0 pb-2 last:pb-0"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{e.description}</p><p className="text-xs text-gray-500">{e.expenseDate ? new Date(e.expenseDate).toLocaleDateString("en-GB") : "No date"}{subfolder ? ` · ${subfolder.name}` : ""} · Allocated £{allocated.toFixed(2)} · Personal £{Math.max(0, Number(e.amount) - allocated).toFixed(2)}</p></div><strong className="receiptify-mono text-sm">£{Number(e.amount).toFixed(2)}</strong>{canEdit && <Button size="sm" variant="ghost" onClick={() => { setEditingExpenseId(e.id); setExpense({ description:e.description, amount:String(e.amount), notes:e.notes || "", expenseDate:e.expenseDate ? new Date(e.expenseDate).toISOString().slice(0,10) : new Date().toISOString().slice(0,10), payerMemberId:e.payerMemberId || "", subfolderId:e.subfolderId || "", allocations:Object.fromEntries((e.allocations || []).map(a=>[a.memberId,String(a.shareAmount)])) }); setExpenseOpen(true); }}>Edit</Button>}{canEdit && <Button size="icon" variant="ghost" className="text-red-600" aria-label={`Delete ${e.description}`} onClick={() => { if (window.confirm(`Delete “${e.description}”?`)) deleteExpenseMutation.mutate(e.id); }}><Trash2 className="h-4 w-4" /></Button>}</div>})}</div>}
          </CardContent>
        </Card>

        {/* Receipts */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <ReceiptIcon className="w-4 h-4 text-green-600" /> Receipts in this folder
          </h3>
          {folderReceipts.length === 0 ? (
            <Card className="receiptify-empty border-dashed">
              <CardContent className="p-6 text-center text-sm text-gray-500">
                Open a receipt from <Link href="/receipts" className="text-green-600 underline">My Receipts</Link> and tap Split to add it here.
              </CardContent>
            </Card>
          ) : (
            folderReceipts.map((r) => (
              <ReceiptSplitter key={r.id} receipt={r} members={members} folderId={folderId} canEdit={canEdit} subfolders={subfolders} />
            ))
          )}
        </div>

        {/* Settlement */}
        <Card className="receiptify-panel">
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
                    {isOwner && s.role !== "owner" && s.owed > 0 && (
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
                    {isOwner && s.role !== "owner" && s.owed === 0 && s.paid > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-500"
                        onClick={() => unsettleMutation.mutate(s.memberId)}
                        disabled={unsettleMutation.isPending}
                        data-testid={`unsettle-${s.memberId}`}
                      >
                        <Undo2 className="w-4 h-4 mr-1" /> Mark unpaid
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <div className="receiptify-secondary-actions">
          <Button variant="outline" onClick={() => setActivityOpen(true)}><Activity className="w-4 h-4 mr-2" /> Activity</Button>
          <Button variant="outline" disabled={!canManage} onClick={() => setSettingsOpen(true)}><Settings2 className="w-4 h-4 mr-2" /> Folder details</Button>
        </div>
      </div>

      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent className="receiptify-dialog max-w-md">
          <DialogHeader><DialogTitle>{editingExpenseId ? "Edit manual expense" : "Add a manual expense"}</DialogTitle><DialogDescription>Allocate only the shared portion; any remaining amount stays personal.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>Description</Label><Input value={expense.description} onChange={e=>setExpense({...expense,description:e.target.value})} placeholder="Taxi to dinner" /></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Amount</Label><Input inputMode="decimal" value={expense.amount} onChange={e=>setExpense({...expense,amount:e.target.value})} placeholder="0.00" /></div><div><Label>Date</Label><Input type="date" value={expense.expenseDate} onChange={e=>setExpense({...expense,expenseDate:e.target.value})} /></div></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Paid by</Label><select className="w-full h-10 rounded-md border bg-transparent px-2 text-sm" value={expense.payerMemberId} onChange={e=>setExpense({...expense,payerMemberId:e.target.value})}><option value="">Not specified</option>{activeMembers.filter(m=>m.status==="active").map(m=><option key={m.id} value={m.id}>{m.displayName || m.inviteEmail}</option>)}</select></div><div><Label>Subfolder</Label><select className="w-full h-10 rounded-md border bg-transparent px-2 text-sm" value={expense.subfolderId} onChange={e=>setExpense({...expense,subfolderId:e.target.value})}><option value="">None</option>{subfolders.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div></div>
            <div className="space-y-2 border rounded-xl p-3"><Label>Allocate to members</Label>{activeMembers.filter(m=>m.status==="active").map(m=><div key={m.id} className="flex items-center gap-2"><span className="flex-1 text-sm truncate">{m.displayName || m.inviteEmail}</span><Input className="w-24" inputMode="decimal" value={expense.allocations[m.id] || ""} onChange={e=>setExpense({...expense,allocations:{...expense.allocations,[m.id]:e.target.value}})} placeholder="0.00" /></div>)}{(() => { const allocated=Object.values(expense.allocations).reduce((sum, value)=>sum+(Number(value)||0),0); const remainder=(Number(expense.amount)||0)-allocated; return <p className={remainder < -0.01 ? "text-xs text-red-600" : "text-xs text-gray-500"}>Allocated £{allocated.toFixed(2)} · {remainder < 0 ? `£${Math.abs(remainder).toFixed(2)} over` : `£${remainder.toFixed(2)} personal remainder`}</p>; })()}</div>
            <div><Label>Note (optional)</Label><Textarea value={expense.notes} onChange={e=>setExpense({...expense,notes:e.target.value})} placeholder="Who paid, or any useful context" /></div>
            <Button className="w-full receiptify-primary-action" disabled={!expense.description.trim() || !Number(expense.amount) || Object.values(expense.allocations).reduce((sum, value)=>sum+(Number(value)||0),0) > Number(expense.amount) + .01 || expenseMutation.isPending} onClick={()=>expenseMutation.mutate()}>{expenseMutation.isPending ? "Saving…" : editingExpenseId ? "Save expense" : "Add expense"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="receiptify-dialog max-w-md">
          <DialogHeader><DialogTitle>Request a payment</DialogTitle><DialogDescription>Draft a clear request for one person’s outstanding share.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>From</Label><select className="w-full h-10 rounded-md border bg-transparent px-3 text-sm" value={payment.memberId} onChange={e=>setPayment({...payment,memberId:e.target.value})}><option value="">Choose a member</option>{activeMembers.filter(m=>m.role!=="owner").map(m=><option key={m.id} value={m.id}>{m.displayName || m.inviteEmail || "Member"}</option>)}</select></div>
            <div><Label>Amount</Label><Input inputMode="decimal" value={payment.amount} onChange={e=>setPayment({...payment,amount:e.target.value})} placeholder="0.00" /></div>
            <Button className="w-full receiptify-primary-action" disabled={!payment.memberId || !Number(payment.amount) || paymentMutation.isPending} onClick={()=>paymentMutation.mutate()}>{paymentMutation.isPending ? "Drafting…" : "Create draft request"}</Button>
            {paymentRequests.length > 0 && <div className="border-t pt-3 space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Existing requests</p>{paymentRequests.map((r:any)=><div key={r.id} className="rounded-lg border p-2"><div className="flex justify-between gap-2 text-sm"><span className="capitalize">{r.status}</span><strong>£{Number(r.amount).toFixed(2)}</strong></div><div className="mt-2 flex flex-wrap gap-2">{canManage && r.status === "draft" && <Button size="sm" variant="outline" disabled={paymentActionMutation.isPending} onClick={()=>paymentActionMutation.mutate({requestId:r.id,action:"send"})}><Send className="mr-1 h-3 w-3" />Send</Button>}{canManage && !["cancelled","paid","declined"].includes(r.status) && <Button size="sm" variant="ghost" disabled={paymentActionMutation.isPending} onClick={()=>paymentActionMutation.mutate({requestId:r.id,action:"cancel"})}>Cancel</Button>}{currentMemberId === r.memberId && r.status === "pending" && <Button size="sm" variant="ghost" disabled={paymentActionMutation.isPending} onClick={()=>paymentActionMutation.mutate({requestId:r.id,action:"decline"})}>Decline</Button>}</div></div>)}</div>}
            <p className="text-xs text-gray-500">Sending is unavailable until Stripe Connect is configured. Receiptify will never pretend a payment was sent.</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent className="receiptify-dialog max-w-md"><DialogHeader><DialogTitle>Folder activity</DialogTitle><DialogDescription>A quiet record of changes and shared moments.</DialogDescription></DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-3">{activity.length === 0 ? <p className="text-sm text-gray-500">No activity yet.</p> : activity.map((a:any)=><div key={a.id} className="flex gap-3 border-b pb-3"><div className="w-2 h-2 mt-2 rounded-full bg-[#ce725d]" /><div><p className="text-sm">{String(a.eventType).replaceAll(".", " ")}</p><p className="text-xs text-gray-500">{a.createdAt ? new Date(a.createdAt).toLocaleString("en-GB") : ""}</p></div></div>)}</div>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={(open)=>{setSettingsOpen(open); if(open) setFolderDraft({name:folder.name,description:folder.description||"",ownerContactName:folder.ownerContactName||"",ownerContactEmail:folder.ownerContactEmail||"",ownerContactPhone:folder.ownerContactPhone||""})}}>
        <DialogContent className="receiptify-dialog max-w-md"><DialogHeader><DialogTitle>Folder details</DialogTitle><DialogDescription>Keep the shared context and a reliable contact close by.</DialogDescription></DialogHeader>
          <div className="space-y-3"><div><Label>Folder name</Label><Input value={folderDraft.name} onChange={e=>setFolderDraft({...folderDraft,name:e.target.value})}/></div><div><Label>Description</Label><Textarea value={folderDraft.description} onChange={e=>setFolderDraft({...folderDraft,description:e.target.value})}/></div><div className="border-t pt-3"><p className="text-sm font-semibold mb-2">Owner contact details</p><div className="space-y-2"><Input placeholder="Name" value={folderDraft.ownerContactName} onChange={e=>setFolderDraft({...folderDraft,ownerContactName:e.target.value})}/><Input placeholder="Email" type="email" value={folderDraft.ownerContactEmail} onChange={e=>setFolderDraft({...folderDraft,ownerContactEmail:e.target.value})}/><Input placeholder="Phone" value={folderDraft.ownerContactPhone} onChange={e=>setFolderDraft({...folderDraft,ownerContactPhone:e.target.value})}/></div></div><Button className="w-full receiptify-primary-action" disabled={folderMutation.isPending || !folderDraft.name.trim()} onClick={()=>folderMutation.mutate()}>{folderMutation.isPending ? "Saving…" : "Save details"}</Button></div>
        </DialogContent>
      </Dialog>

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

      <AlertDialog open={confirmDeleteFolder} onOpenChange={setConfirmDeleteFolder}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{folder.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the folder and all its split assignments. Receipts stay in
              their owners' wallets. Everyone in the folder will be notified by email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteFolderMutation.mutate()}
              data-testid="confirm-delete-folder"
            >
              {deleteFolderMutation.isPending ? "Deleting…" : "Delete folder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Download,
  Utensils,
  Shield,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  Edit2,
  Users,
  ArrowRight,
} from "lucide-react";
import SplitFolderPicker from "@/components/split-folder-picker";
import AppHeader from "@/components/app-header";
import ImageViewer from "@/components/image-viewer";
import type { Receipt, ReceiptItem, Warranty } from "@shared/schema";
import { CATEGORIES, getCategoryByName, getCategoryById } from "@shared/categories";
import { useCurrency } from "@/hooks/use-currency";
import { useToast } from "@/hooks/use-toast";
import { effectiveReceiptTotal } from "@shared/receipt-share";

import { apiRequest, queryClient } from "@/lib/queryClient";
import { getExchangeRate, getRatesFromBase, formatWithCurrencyCode } from "@/lib/currency-conversion";

const normCat = (raw?: string | null) =>
  (getCategoryByName(raw ?? '') || getCategoryById(raw ?? ''))?.name ?? raw ?? 'Other';

export default function ReceiptDetailPage() {
  const [, navigate] = useLocation();
  const params = useParams();
  const receiptId = params.id;
  const { format: formatCurrency, currency: userCurrency } = useCurrency();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [showWarrantyForm, setShowWarrantyForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [receiptEditing, setReceiptEditing] = useState(false);
  const [receiptForm, setReceiptForm] = useState({
    merchantName: "",
    location: "",
    date: "",
    total: "",
    subtotal: "",
    tax: "",
    serviceCharge: "",
    receiptNumber: "",
    paymentMethod: "",
    category: "other",
  });
  const [splitPickerOpen, setSplitPickerOpen] = useState(false);
  const [warrantyForm, setWarrantyForm] = useState({
    productName: "",
    durationMonths: 12,
    warrantyType: "manufacturer",
    notes: "",
  });

  const { data: receipt, isLoading } = useQuery<
    Receipt & { items?: ReceiptItem[]; splitSuggestedShare?: number | null; isShared?: boolean }
  >({
    queryKey: ["/api/receipts", receiptId],
  });

  const { data: warranty, isLoading: warrantyLoading } =
    useQuery<Warranty | null>({
      queryKey: ["/api/warranties/receipt", receiptId],
      enabled: !!receiptId,
    });

  const receiptCurrency = (receipt?.currency || 'GBP').toUpperCase();
  const isForeignCurrency = receiptCurrency !== userCurrency.toUpperCase();

  // Use rate snapshotted at purchase time when available (locked, never changes).
  // Fall back to a live query only for older receipts that predate this feature.
  const storedRateToGBP = receipt?.exchangeRateToGBP ? parseFloat(receipt.exchangeRateToGBP as string) : null;

  const { data: fxRatesFromGBP } = useQuery<Record<string, number>>({
    queryKey: ['fxRates', 'GBP'],
    queryFn: () => getRatesFromBase('GBP'),
    enabled: isForeignCurrency && !!storedRateToGBP && userCurrency !== 'GBP',
    staleTime: 60 * 60 * 1000,
  });

  const { data: liveExchangeRate } = useQuery<number>({
    queryKey: ["exchangeRate", receiptCurrency, userCurrency],
    queryFn: () => getExchangeRate(receiptCurrency, userCurrency),
    enabled: isForeignCurrency && !!receipt && storedRateToGBP === null,
    staleTime: 60 * 60 * 1000,
  });

  // Effective rate: receipt currency → user currency
  const exchangeRate: number | null = (() => {
    if (!isForeignCurrency) return null;
    if (storedRateToGBP !== null) {
      if (userCurrency === 'GBP') return storedRateToGBP;
      const gbpToUser = fxRatesFromGBP?.[userCurrency];
      if (gbpToUser) return storedRateToGBP * gbpToUser;
      return null;
    }
    return liveExchangeRate ?? null;
  })();

  const [shareEditing, setShareEditing] = useState(false);
  const [shareType, setShareType] = useState<"amount" | "percent">("percent");
  const [shareValue, setShareValue] = useState("");

  const hasShare = !!(receipt?.myShareType && receipt?.myShareValue != null);
  // Receipt shared with this user via a split folder they're a member of —
  // share comes from the split, so it's read-only here.
  const isSharedReceipt = !!(receipt as any)?.isShared;
  const effectiveTotal = receipt ? effectiveReceiptTotal(receipt) : 0;
  // Suggested share derived from the split folder's assignments (total minus
  // what's assigned to others). Offered when it differs from the current share.
  const splitSuggested =
    receipt?.splitSuggestedShare != null && Number.isFinite(receipt.splitSuggestedShare)
      ? receipt.splitSuggestedShare
      : null;
  const suggestionMatchesCurrentShare =
    splitSuggested != null &&
    hasShare &&
    receipt?.myShareType === "amount" &&
    Math.abs(parseFloat(String(receipt.myShareValue)) - splitSuggested) < 0.005;
  const showSplitSuggestion = splitSuggested != null && !suggestionMatchesCurrentShare && !(receipt as any)?.isShared;
  const previewShare = (() => {
    const v = parseFloat(shareValue);
    if (!receipt || !Number.isFinite(v)) return 0;
    return effectiveReceiptTotal({ total: receipt.total, myShareType: shareType, myShareValue: v });
  })();

  const shareMutation = useMutation({
    mutationFn: async (body: { myShareType: string; myShareValue: number } | null) =>
      apiRequest("PATCH", `/api/receipts/${receiptId}/share`, body ?? { myShareType: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      setShareEditing(false);
      toast({ title: "My share updated" });
    },
    onError: async (err: any) => {
      toast({ title: "Couldn't update share", description: err.message, variant: "destructive" });
    },
  });

  const receiptMutation = useMutation({
    mutationFn: async () => {
      const body = {
        ...receiptForm,
        subtotal: receiptForm.subtotal || null,
        tax: receiptForm.tax || null,
        serviceCharge: receiptForm.serviceCharge || null,
        receiptNumber: receiptForm.receiptNumber || null,
        paymentMethod: receiptForm.paymentMethod || null,
        location: receiptForm.location || null,
      };
      return apiRequest("PATCH", `/api/receipts/${receiptId}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      setReceiptEditing(false);
      toast({ title: "Receipt details updated" });
    },
    onError: async (err: any) => {
      toast({
        title: "Couldn't update receipt",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const createWarrantyMutation = useMutation({
    mutationFn: async (data: typeof warrantyForm) => {
      return apiRequest("POST", "/api/warranties", {
        receiptId,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/warranties/receipt", receiptId],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/warranties"] });
      setShowWarrantyForm(false);
      setWarrantyForm({
        productName: "",
        durationMonths: 12,
        warrantyType: "manufacturer",
        notes: "",
      });
    },
  });

  const updateWarrantyMutation = useMutation({
    mutationFn: async (data: typeof warrantyForm) => {
      return apiRequest("PATCH", `/api/warranties/${warranty?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/warranties/receipt", receiptId],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/warranties"] });
      setIsEditing(false);
    },
  });

  const deleteWarrantyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/warranties/${warranty?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/warranties/receipt", receiptId],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/warranties"] });
    },
  });

  const downloadReceipt = async () => {
    if (!receipt?.imageUrl) return;
    try {
      const { imageToPdfBlob } = await import("@/lib/image-to-pdf");
      const safeName = (receipt.merchantName || "receipt").replace(/[^\w-_]/g, "_");
      const pdfBlob = await imageToPdfBlob(receipt.imageUrl, safeName);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}_${receipt.id || ""}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  const handleWarrantySubmit = () => {
    if (!warrantyForm.productName) return;
    if (isEditing) {
      updateWarrantyMutation.mutate(warrantyForm);
    } else {
      createWarrantyMutation.mutate(warrantyForm);
    }
  };

  const startEdit = () => {
    if (warranty) {
      setWarrantyForm({
        productName: warranty.productName,
        durationMonths: warranty.warrantyPeriodMonths || 12,
        warrantyType: warranty.warrantyType || "manufacturer",
        notes: warranty.warrantyTerms || "",
      });
      setIsEditing(true);
    }
  };

  const startReceiptEdit = () => {
    if (!receipt || isSharedReceipt) return;
    const category = getCategoryByName(receipt.category || "") || getCategoryById(receipt.category || "");
    setReceiptForm({
      merchantName: receipt.merchantName || "",
      location: receipt.location || "",
      date: new Date(receipt.date).toISOString().slice(0, 10),
      total: String(receipt.total || ""),
      subtotal: receipt.subtotal ? String(receipt.subtotal) : "",
      tax: receipt.tax ? String(receipt.tax) : "",
      serviceCharge: receipt.serviceCharge ? String(receipt.serviceCharge) : "",
      receiptNumber: receipt.receiptNumber || "",
      paymentMethod: receipt.paymentMethod || "",
      category: category?.id || "other",
    });
    setReceiptEditing(true);
  };

  const getWarrantyStatus = (endDate: Date) => {
    const now = new Date();
    const daysRemaining = Math.ceil(
      (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysRemaining < 0) {
      return {
        status: "expired",
        color: "text-red-600",
        bg: "bg-red-100",
        icon: AlertTriangle,
      };
    } else if (daysRemaining <= 30) {
      return {
        status: "expiring",
        color: "text-yellow-600",
        bg: "bg-yellow-100",
        icon: AlertTriangle,
      };
    }
    return {
      status: "active",
      color: "text-green-600",
      bg: "bg-green-100",
      icon: CheckCircle,
    };
  };

  if (isLoading || !receipt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const items = receipt.items || [];
  const receiptDate = new Date(receipt.date).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AppHeader
        showBackButton={true}
        onBackClick={() => window.history.back()}
      />

      <div className="px-6 py-4 space-y-6">
        {/* Store Info */}
        {receiptEditing ? (
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-900">Edit receipt details</h1>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setReceiptEditing(false)}
                  disabled={receiptMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="receipt-merchant">Merchant</Label>
                  <Input
                    id="receipt-merchant"
                    value={receiptForm.merchantName}
                    onChange={(e) => setReceiptForm((f) => ({ ...f, merchantName: e.target.value }))}
                    data-testid="input-receipt-merchant"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="receipt-date">Date</Label>
                  <Input
                    id="receipt-date"
                    type="date"
                    value={receiptForm.date}
                    onChange={(e) => setReceiptForm((f) => ({ ...f, date: e.target.value }))}
                    data-testid="input-receipt-date"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="receipt-location">Location</Label>
                  <Input
                    id="receipt-location"
                    value={receiptForm.location}
                    onChange={(e) => setReceiptForm((f) => ({ ...f, location: e.target.value }))}
                    data-testid="input-receipt-location"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="receipt-total">Total ({receiptCurrency})</Label>
                  <Input
                    id="receipt-total"
                    type="number"
                    min="0"
                    step="0.01"
                    value={receiptForm.total}
                    onChange={(e) => setReceiptForm((f) => ({ ...f, total: e.target.value }))}
                    data-testid="input-receipt-total"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="receipt-subtotal">Subtotal ({receiptCurrency})</Label>
                  <Input
                    id="receipt-subtotal"
                    type="number"
                    min="0"
                    step="0.01"
                    value={receiptForm.subtotal}
                    onChange={(e) => setReceiptForm((f) => ({ ...f, subtotal: e.target.value }))}
                    data-testid="input-receipt-subtotal"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="receipt-tax">Tax ({receiptCurrency})</Label>
                  <Input
                    id="receipt-tax"
                    type="number"
                    min="0"
                    step="0.01"
                    value={receiptForm.tax}
                    onChange={(e) => setReceiptForm((f) => ({ ...f, tax: e.target.value }))}
                    data-testid="input-receipt-tax"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="receipt-service-charge">Service charge ({receiptCurrency})</Label>
                  <Input
                    id="receipt-service-charge"
                    type="number"
                    min="0"
                    step="0.01"
                    value={receiptForm.serviceCharge}
                    onChange={(e) => setReceiptForm((f) => ({ ...f, serviceCharge: e.target.value }))}
                    data-testid="input-receipt-service-charge"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="receipt-number">Receipt number</Label>
                  <Input
                    id="receipt-number"
                    value={receiptForm.receiptNumber}
                    onChange={(e) => setReceiptForm((f) => ({ ...f, receiptNumber: e.target.value }))}
                    data-testid="input-receipt-number"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="receipt-payment">Payment method</Label>
                  <Input
                    id="receipt-payment"
                    value={receiptForm.paymentMethod}
                    onChange={(e) => setReceiptForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                    data-testid="input-receipt-payment"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="receipt-category">Category</Label>
                  <Select
                    value={receiptForm.category}
                    onValueChange={(value) => setReceiptForm((f) => ({ ...f, category: value }))}
                  >
                    <SelectTrigger id="receipt-category" data-testid="select-receipt-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.icon} {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => receiptMutation.mutate()}
                  disabled={
                    receiptMutation.isPending ||
                    !receiptForm.merchantName.trim() ||
                    !receiptForm.date ||
                    !receiptForm.total
                  }
                  data-testid="button-save-receipt"
                >
                  <CheckCircle className="w-4 h-4 mr-1" /> Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {!receipt.merchantName || receipt.merchantName === "null" || receipt.merchantName.trim() === ""
                  ? "Unspecified Merchant"
                  : receipt.merchantName}
              </h1>
              <p className="text-gray-600">
                {receiptDate} • {receipt.location}
              </p>
            </div>
            {!isSharedReceipt && (
              <Button
                size="sm"
                variant="outline"
                onClick={startReceiptEdit}
                data-testid="button-edit-receipt"
              >
                <Edit2 className="w-4 h-4 mr-1" /> Edit
              </Button>
            )}
          </div>
        )}

        {/* Receipt Image with Zoom, Rotate, Crop */}
        {receipt.imageUrl && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              {t("receiptDetail.receiptImage")}
            </h3>
            <ImageViewer imageUrl={receipt.imageUrl} alt="Receipt" />
          </div>
        )}

        {/* Items List */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-6 space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="text-gray-900 font-medium">
                  {item.quantity && parseInt(item.quantity) > 1
                    ? `${item.quantity}x `
                    : ""}
                  {item.name}
                </span>
                <span className="text-gray-900 font-semibold">
                  {isForeignCurrency
                    ? formatWithCurrencyCode(parseFloat(item.price), receiptCurrency)
                    : formatCurrency(parseFloat(item.price))}
                </span>
              </div>
            ))}

            {receipt.tax && (
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex items-center justify-between text-gray-900">
                  <span>{t("receiptDetail.tax")}</span>
                  <span>
                    {isForeignCurrency
                      ? formatWithCurrencyCode(parseFloat(receipt.tax), receiptCurrency)
                      : formatCurrency(parseFloat(receipt.tax))}
                  </span>
                </div>
              </div>
            )}

            <div
              className={`${receipt.tax ? "pt-2" : "border-t border-gray-200 pt-4 mt-4"}`}
            >
              <div className="flex items-center justify-between text-lg font-bold text-gray-900">
                <span>{t("receiptDetail.total")}</span>
                <div className="text-right">
                  {isForeignCurrency ? (
                    <>
                      <div>{formatWithCurrencyCode(parseFloat(receipt.total), receiptCurrency)}</div>
                      {exchangeRate && (
                        <div className="text-sm font-normal text-emerald-600 mt-0.5">
                          ≈ {formatCurrency(parseFloat(receipt.total) * exchangeRate)}
                          <span className="text-xs text-gray-400 ml-1">
                            (1 {receiptCurrency} = {exchangeRate.toFixed(4)} {userCurrency})
                          </span>
                        </div>
                      )}
                      {!exchangeRate && (
                        <div className="text-xs text-gray-400 font-normal mt-0.5">fetching rate…</div>
                      )}
                    </>
                  ) : (
                    <span>{formatCurrency(parseFloat(receipt.total))}</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* My share of this receipt */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold text-gray-900">My share</div>
              {!isSharedReceipt && hasShare && !shareEditing && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-500"
                  onClick={() => shareMutation.mutate(null)}
                  disabled={shareMutation.isPending}
                  data-testid="button-clear-share"
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Clear
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-3">
              {isSharedReceipt
                ? "This receipt was shared with you via a split folder — your share comes from the split."
                : "If you didn't pay the full amount, set your portion — totals in My Receipts and Analytics will use it instead of the full total."}
            </p>
            {showSplitSuggestion && !shareEditing && (
              <div
                className="flex items-center justify-between gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3"
                data-testid="banner-split-suggestion"
              >
                <div className="text-xs text-green-800">
                  From this receipt's split:{" "}
                  <span className="font-semibold">
                    {isForeignCurrency
                      ? formatWithCurrencyCode(splitSuggested!, receiptCurrency)
                      : formatCurrency(splitSuggested!)}
                  </span>{" "}
                  is your portion after friends' assignments.
                </div>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 shrink-0"
                  onClick={() =>
                    shareMutation.mutate({ myShareType: "amount", myShareValue: splitSuggested! })
                  }
                  disabled={shareMutation.isPending}
                  data-testid="button-use-split-amount"
                >
                  Use split amount
                </Button>
              </div>
            )}
            {!shareEditing ? (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-900" data-testid="text-my-share">
                  {hasShare ? (
                    <>
                      <span className="font-semibold">
                        {isForeignCurrency
                          ? formatWithCurrencyCode(effectiveTotal, receiptCurrency)
                          : formatCurrency(effectiveTotal)}
                      </span>
                      <span className="text-gray-500 ml-1">
                        {receipt.myShareType === "percent"
                          ? `(${parseFloat(String(receipt.myShareValue))}% of total)`
                          : "(fixed amount)"}
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-500">Full amount — no share set</span>
                  )}
                </div>
                {!isSharedReceipt && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShareType((receipt.myShareType as "amount" | "percent") || "percent");
                      setShareValue(receipt.myShareValue ? String(parseFloat(String(receipt.myShareValue))) : "");
                      setShareEditing(true);
                    }}
                    data-testid="button-edit-share"
                  >
                    <Edit2 className="w-4 h-4 mr-1" /> {hasShare ? "Edit" : "Set my share"}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Select value={shareType} onValueChange={(v) => setShareType(v as "amount" | "percent")}>
                    <SelectTrigger className="w-36" data-testid="select-share-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percentage</SelectItem>
                      <SelectItem value="amount">Amount ({receiptCurrency})</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={shareType === "percent" ? 100 : parseFloat(receipt.total)}
                    step={shareType === "percent" ? 1 : 0.01}
                    placeholder={shareType === "percent" ? "e.g. 50" : "e.g. 12.50"}
                    value={shareValue}
                    onChange={(e) => setShareValue(e.target.value)}
                    data-testid="input-share-value"
                  />
                </div>
                {shareValue && Number.isFinite(parseFloat(shareValue)) && (
                  <p className="text-xs text-gray-500">
                    Your share:{" "}
                    {isForeignCurrency
                      ? formatWithCurrencyCode(previewShare, receiptCurrency)
                      : formatCurrency(previewShare)}
                  </p>
                )}
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setShareEditing(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => shareMutation.mutate({ myShareType: shareType, myShareValue: parseFloat(shareValue) })}
                    disabled={shareMutation.isPending || !shareValue || !Number.isFinite(parseFloat(shareValue))}
                    data-testid="button-save-share"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" /> Save
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Split with friends */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">
                    {receipt.splitFolderId ? "In a split folder" : "Split with friends"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {receipt.splitFolderId
                      ? "Open the folder to edit who pays what"
                      : "Group this receipt with friends and settle up"}
                  </div>
                </div>
              </div>
              {receipt.splitFolderId ? (
                <div className="flex items-center gap-1">
                  {!isSharedReceipt && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSplitPickerOpen(true)}
                      data-testid="button-move-split-folder"
                    >
                      Move
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => navigate(`/split/${receipt.splitFolderId}`)}
                    data-testid="button-open-split-folder"
                  >
                    Open <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              ) : !isSharedReceipt ? (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setSplitPickerOpen(true)}
                  data-testid="button-split-receipt"
                >
                  Split
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {receiptId && (
          <SplitFolderPicker
            open={splitPickerOpen}
            onOpenChange={setSplitPickerOpen}
            receiptId={receiptId}
          />
        )}

        {/* Warranty Section */}
        {/* <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-gray-900">Warranty</h3>
              </div>
              {!warranty && !showWarrantyForm && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowWarrantyForm(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              )}
            </div>

            {warrantyLoading && (
              <div className="py-4 text-center text-gray-500">Loading...</div>
            )}

            {warranty && !isEditing && (
              <div className="space-y-3">
                {(() => {
                  const endDate = new Date(warranty.warrantyEndDate);
                  const statusInfo = getWarrantyStatus(endDate);
                  const StatusIcon = statusInfo.icon;
                  const daysRemaining = Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  
                  return (
                    <>
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${statusInfo.bg}`}>
                        <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                        <span className={`text-sm font-medium ${statusInfo.color}`}>
                          {daysRemaining < 0 
                            ? `Expired ${Math.abs(daysRemaining)} days ago`
                            : daysRemaining === 0 
                              ? "Expires today"
                              : `${daysRemaining} days remaining`}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Product</span>
                          <p className="font-medium text-gray-900">{warranty.productName}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Type</span>
                          <p className="font-medium text-gray-900 capitalize">{warranty.warrantyType}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Start Date</span>
                          <p className="font-medium text-gray-900">
                            {new Date(warranty.warrantyStartDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">End Date</span>
                          <p className="font-medium text-gray-900">
                            {endDate.toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      {warranty.warrantyTerms && (
                        <div className="text-sm">
                          <span className="text-gray-500">Notes</span>
                          <p className="text-gray-700">{warranty.warrantyTerms}</p>
                        </div>
                      )}
                      
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" onClick={startEdit}>
                          <Edit2 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-red-600 hover:text-red-700"
                          onClick={() => deleteWarrantyMutation.mutate()}
                          disabled={deleteWarrantyMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {(showWarrantyForm || isEditing) && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="productName">Product Name</Label>
                  <Input
                    id="productName"
                    placeholder="e.g. Samsung TV, Apple iPhone"
                    value={warrantyForm.productName}
                    onChange={(e) => setWarrantyForm(prev => ({ ...prev, productName: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="duration">Warranty Duration (months)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={1}
                    max={120}
                    value={warrantyForm.durationMonths}
                    onChange={(e) => setWarrantyForm(prev => ({ ...prev, durationMonths: parseInt(e.target.value) || 12 }))}
                  />
                  {receipt.date && (
                    <p className="text-xs text-gray-500 mt-1">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      Starts from receipt date: {new Date(receipt.date).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
                    </p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="warrantyType">Type</Label>
                  <Select 
                    value={warrantyForm.warrantyType}
                    onValueChange={(value) => setWarrantyForm(prev => ({ ...prev, warrantyType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manufacturer">Manufacturer</SelectItem>
                      <SelectItem value="extended">Extended</SelectItem>
                      <SelectItem value="retailer">Retailer</SelectItem>
                      <SelectItem value="insurance">Insurance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional warranty details..."
                    value={warrantyForm.notes}
                    onChange={(e) => setWarrantyForm(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleWarrantySubmit}
                    disabled={!warrantyForm.productName || createWarrantyMutation.isPending || updateWarrantyMutation.isPending}
                  >
                    {(createWarrantyMutation.isPending || updateWarrantyMutation.isPending) 
                      ? "Saving..." 
                      : isEditing ? "Update Warranty" : "Add Warranty"}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setShowWarrantyForm(false);
                      setIsEditing(false);
                      setWarrantyForm({ productName: "", durationMonths: 12, warrantyType: "manufacturer", notes: "" });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {!warranty && !showWarrantyForm && !warrantyLoading && (
              <p className="text-gray-500 text-sm">No warranty added for this purchase.</p>
            )}
          </CardContent>
        </Card> */}

        {/* Download Receipt */}
        {receipt.imageUrl && (
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Download</div>
                  <div className="text-gray-900 font-medium">Receipt Image</div>
                </div>
                <Button onClick={downloadReceipt} size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Utensils className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-gray-900 font-medium">
                {normCat(receipt.category)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

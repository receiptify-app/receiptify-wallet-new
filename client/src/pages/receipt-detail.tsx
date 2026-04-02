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
} from "lucide-react";
import AppHeader from "@/components/app-header";
import ImageViewer from "@/components/image-viewer";
import type { Receipt, ReceiptItem, Warranty } from "@shared/schema";
import { getCategoryByName, getCategoryById } from "@shared/categories";
import { useCurrency } from "@/hooks/use-currency";

import { apiRequest, queryClient } from "@/lib/queryClient";
import { getExchangeRate, formatWithCurrencyCode } from "@/lib/currency-conversion";

const normCat = (raw?: string | null) =>
  (getCategoryByName(raw ?? '') || getCategoryById(raw ?? ''))?.name ?? raw ?? 'Other';

export default function ReceiptDetailPage() {
  const [, navigate] = useLocation();
  const params = useParams();
  const receiptId = params.id;
  const { format: formatCurrency, currency: userCurrency } = useCurrency();
  const { t } = useTranslation();

  const [showWarrantyForm, setShowWarrantyForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [warrantyForm, setWarrantyForm] = useState({
    productName: "",
    durationMonths: 12,
    warrantyType: "manufacturer",
    notes: "",
  });

  const { data: receipt, isLoading } = useQuery<
    Receipt & { items?: ReceiptItem[] }
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
    queryFn: () => import('@/lib/currency-conversion').then(m => m.getRatesFromBase('GBP')),
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
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AppHeader
        showBackButton={true}
        onBackClick={() => window.history.back()}
      />

      <div className="px-6 py-4 space-y-6">
        {/* Store Info */}
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
                      Starts from receipt date: {new Date(receipt.date).toLocaleDateString()}
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

import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownLeft, BarChart3, ChevronDown, FilePlus2 } from "lucide-react";
import { useLocation } from "wouter";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import AppHeader from "@/components/app-header";
import AnalyticsReceiptCard from "@/components/analytics-receipt-card";
import CategoryPickerModal from "@/components/category-picker-modal";
import BulkSelectToolbar from "@/components/bulk-select-toolbar";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CATEGORIES, getCategoryColor } from "@shared/categories";
import { computeAnalytics, getAvailableMonthRanges, getMonthBoundsFromKey } from "@/utils/analytics";
import type { Receipt } from "@shared/schema";
import { useCurrency } from "@/hooks/use-currency";
import { getRatesFromBase } from "@/lib/currency-conversion";
import { effectiveReceiptTotal } from "@shared/receipt-share";

type DateRange = 'week' | 'month' | 'custom';

export default function Home() {
  const [selectedPeriod, setSelectedPeriod] = useState<DateRange>("month");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { format: formatCurrency, currency: userCurrency } = useCurrency();
  const { t } = useTranslation();

  // Fetch all receipts
  const { data: receipts = [], isLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts"],
  });

  // Fetch exchange rates for currency conversion (single call, cached 1hr)
  const { data: fxRates } = useQuery<Record<string, number>>({
    queryKey: ['fxRates', userCurrency],
    queryFn: () => getRatesFromBase(userCurrency),
    staleTime: 60 * 60 * 1000,
  });

  // Return receipts with totals converted to the user's currency.
  // Prefers the rate snapshotted at purchase time (exchangeRateToGBP) so the
  // converted amount never changes after the receipt is saved.
  const convertedReceipts = useMemo(() => {
    return receipts.map(r => {
      // Use the user's personal share (if set) as the spend for this receipt
      const myTotal = effectiveReceiptTotal(r as any);
      const rCur = ((r as any).currency || userCurrency).toUpperCase();
      if (rCur === userCurrency.toUpperCase() || !fxRates) {
        return { ...r, total: myTotal.toFixed(2) };
      }
      const storedRate = (r as any).exchangeRateToGBP ? parseFloat((r as any).exchangeRateToGBP) : null;
      if (storedRate !== null && fxRates['GBP']) {
        return { ...r, total: (myTotal * storedRate / fxRates['GBP']).toFixed(2) };
      }
      const rate = fxRates[rCur];
      if (!rate) return { ...r, total: myTotal.toFixed(2) };
      return { ...r, total: (myTotal / rate).toFixed(2) };
    });
  }, [receipts, fxRates, userCurrency]);

  // default to current/latest month — only once, after receipts first load
  const monthInitialisedRef = useRef(false);
  useEffect(() => {
    if (monthInitialisedRef.current) return;
    const options = getAvailableMonthRanges(receipts);
    if (options.length > 0) {
      monthInitialisedRef.current = true;
      setSelectedMonthKey(options[0].key);
      setSelectedPeriod('custom');
    }
  }, [receipts]);

  // Create category color map
  const categoryColorMap = useMemo(() => {
    const map = new Map<string, string>();
    CATEGORIES.forEach(cat => {
      map.set(cat.id, cat.color);
      map.set(cat.name.toLowerCase(), cat.color);
    });
    return map;
  }, []);

  // Compute analytics — pure derivation, no setState needed
  const analytics = useMemo(() => {
    if (selectedMonthKey === 'thisMonth') {
      return computeAnalytics(convertedReceipts, selectedPeriod, categoryColorMap);
    }
    const bounds = getMonthBoundsFromKey(selectedMonthKey ?? '');
    if (bounds) {
      return computeAnalytics(convertedReceipts, 'custom', categoryColorMap, bounds.start, bounds.end);
    }
    return computeAnalytics(convertedReceipts, selectedPeriod, categoryColorMap);
  }, [convertedReceipts, selectedPeriod, categoryColorMap, selectedMonthKey]);

  // Filter receipts by selected category
  const filteredReceipts = useMemo(() => {
    // prefer analytics.receipts (period filtered) but fall back to raw receipts so Recent Activity shows uploads
    const source = (analytics?.receipts && analytics.receipts.length > 0) ? analytics.receipts : convertedReceipts;
    if (!selectedCategory) return source;
    return source.filter(r =>
      r.category?.toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [analytics.receipts, selectedCategory, convertedReceipts]);

  // Move receipt mutation
  const moveMutation = useMutation({
    mutationFn: async ({ receiptId, categoryId }: { receiptId: string; categoryId: string }) => {
      const response = await apiRequest('POST', `/api/receipts/${receiptId}/move`, { categoryId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      toast({
        title: "Receipt moved",
        description: "The receipt has been moved to the new category.",
      });
    },
    onError: () => {
      toast({
        title: "Move failed",
        description: "Failed to move the receipt. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Bulk move mutation
  const bulkMoveMutation = useMutation({
    mutationFn: async ({ receiptIds, categoryId }: { receiptIds: string[]; categoryId: string }) => {
      const response = await apiRequest('POST', '/api/receipts/bulk-move', { receiptIds, categoryId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      setSelectionMode(false);
      setSelectedReceipts(new Set());
      toast({
        title: "Receipts moved",
        description: `Successfully moved ${selectedReceipts.size} receipt(s).`,
      });
    },
    onError: () => {
      toast({
        title: "Bulk move failed",
        description: "Failed to move receipts. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleReceiptSelect = (id: string) => {
    // Shared receipts are read-only — exclude them from bulk selection
    if ((receipts.find(r => r.id === id) as any)?.isShared) return;
    const newSelection = new Set(selectedReceipts);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedReceipts(newSelection);

    if (newSelection.size === 0) {
      setSelectionMode(false);
    }
  };

  const handleReceiptLongPress = (id: string) => {
    if ((receipts.find(r => r.id === id) as any)?.isShared) return;
    setSelectionMode(true);
    setSelectedReceipts(new Set([id]));
  };

  const handleMoveReceipt = (receiptId: string) => {
    setActiveReceiptId(receiptId);
    setCategoryPickerOpen(true);
  };

  const handleBulkMove = () => {
    if (selectedReceipts.size === 0) return;
    setActiveReceiptId(null);
    setCategoryPickerOpen(true);
  };

  const handleCategorySelect = (categoryId: string) => {
    if (activeReceiptId) {
      moveMutation.mutate({ receiptId: activeReceiptId, categoryId });
    } else if (selectedReceipts.size > 0) {
      bulkMoveMutation.mutate({ receiptIds: Array.from(selectedReceipts), categoryId });
    }
    setActiveReceiptId(null);
  };

  const handleChartClick = (data: any) => {
    if (data && data.category) {
      setSelectedCategory(selectedCategory === data.category ? null : data.category);
    }
  };

  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedReceipts(new Set());
  };

  const monthOptions = useMemo(() => getAvailableMonthRanges(receipts), [receipts]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const chartData = analytics.categories.map(cat => ({
    name: cat.category,
    value: cat.amount,
    category: cat.category,
    color: cat.color,
    percentage: cat.percentage
  }));

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="receiptify-page pb-24">
      <AppHeader visualSystem />

      <main className="receiptify-content">
        <section className="receiptify-hero receiptify-fade-in">
          <div>
            <p className="receiptify-eyebrow">{dateLabel}</p>
            <h1>Good morning<span><em>.</em></span></h1>
            <p className="receiptify-subtitle">Here’s the shape of your spending this month.</p>
          </div>
          <Button
            className="receiptify-primary-action"
            onClick={() => navigate("/scan")}
            data-testid="button-add-receipt"
          >
            <FilePlus2 className="h-4 w-4" /> Add receipt
          </Button>
        </section>

        <div className="receiptify-dashboard-grid">
          <section className="receiptify-total-card receiptify-fade-in" data-testid="card-total-spending">
            <div className="receiptify-card-content">
              <div className="flex items-center justify-between gap-3">
                <span className="receiptify-total-label">{t('analytics.totalSpent')}</span>
                <Select
                  value={selectedMonthKey ?? ''}
                  onValueChange={(value) => {
                    setSelectedPeriod('custom');
                    setSelectedMonthKey(value);
                  }}
                >
                  <SelectTrigger className="receiptify-total-select w-[148px] h-8 text-xs" data-testid="select-date-range">
                    <SelectValue placeholder="This month" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(m => (
                      <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="receiptify-total-value receiptify-mono" data-testid="text-total-spending">
                {formatCurrency(analytics.total)}
              </div>
              <div className="receiptify-total-meta">
                <ArrowDownLeft className="h-3.5 w-3.5" />
                <span>Spending overview</span>
                <span className="opacity-60">·</span>
                <span>{analytics.receipts.length} receipt{analytics.receipts.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="receiptify-total-footer">
                <span>{selectedCategory ? `Filtered to ${selectedCategory}` : "A calm view of your wallet"}</span>
                <strong>{formatCurrency(analytics.total)}</strong>
              </div>
            </div>
          </section>

          <section className="receiptify-category-card receiptify-fade-in" style={{ animationDelay: "80ms" }}>
            <div className="receiptify-card-heading">
              <div>
                <h2>{t('analytics.categories')}</h2>
                <p>A gentle look at your habits</p>
              </div>
              <BarChart3 className="h-5 w-5" />
            </div>

            {chartData.length > 0 ? (
              <div className="receiptify-category-layout">
                <div
                  className="receiptify-donut"
                  style={{
                    background: `conic-gradient(${chartData.map((item, index) => {
                      const start = chartData.slice(0, index).reduce((sum, current) => sum + current.percentage, 0);
                      return `${item.color} ${start}% ${start + item.percentage}%`;
                    }).join(", ")})`,
                  }}
                  aria-label="Spending by category"
                >
                  <div className="receiptify-donut-center">
                    <span>This month</span>
                    <strong>{formatCurrency(analytics.total)}</strong>
                  </div>
                </div>
                <div className="grid gap-2">
                  {analytics.categories.map((item) => (
                    <button
                      key={item.category}
                      type="button"
                      className={`receiptify-category-row ${selectedCategory === item.category ? "is-selected" : ""}`}
                      onClick={() => setSelectedCategory(selectedCategory === item.category ? null : item.category)}
                      data-testid={`category-filter-${item.category.toLowerCase()}`}
                    >
                      <span className="receiptify-category-name">
                        <i style={{ background: item.color }} />{item.category}
                      </span>
                      <span className="receiptify-category-percent">{item.percentage.toFixed(0)}%</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="receiptify-empty mt-6 p-8 text-center text-sm">
                <p>{t('analytics.noData')}</p>
              </div>
            )}
          </section>
        </div>

        {/* Recent Activity */}
        <section className="receiptify-fade-in" style={{ animationDelay: "150ms" }}>
          <div className="receiptify-section-heading">
            <div>
              <h2>
                {t('analytics.recentActivity')}
              </h2>
              <p>{selectedCategory ? `Showing your ${selectedCategory.toLowerCase()} receipts` : "The little record of where life happened"}</p>
            </div>
            {selectedCategory && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className="text-[var(--receiptify-sage)]"
                data-testid="button-clear-filter"
              >
                Clear filter
              </Button>
            )}
          </div>
          {filteredReceipts.length > 0 ? (
            <div className="receiptify-receipt-list">
              {filteredReceipts.map((receipt) => (
                <AnalyticsReceiptCard
                  key={receipt.id}
                  receipt={receipt}
                  isSelected={selectedReceipts.has(receipt.id)}
                  selectionMode={selectionMode}
                  onSelect={handleReceiptSelect}
                  onMove={(receipt as any).isShared ? undefined : handleMoveReceipt}
                  onClick={(id) => navigate(`/receipts/${id}`)}
                />
              ))}
            </div>
          ) : (
            <Card className="receiptify-empty border-0 shadow-none">
              <CardContent className="p-8 text-center text-sm">
                <p>{t('analytics.noData')}</p>
              </CardContent>
            </Card>
          )}
        </section>
      </main>

      {/* Category Picker Modal */}
      <CategoryPickerModal
        open={categoryPickerOpen}
        onClose={() => {
          setCategoryPickerOpen(false);
          setActiveReceiptId(null);
        }}
        onSelect={handleCategorySelect}
        title={selectedReceipts.size > 1 ? `Move ${selectedReceipts.size} receipts` : "Move receipt to category"}
      />

      {/* Bulk Selection Toolbar */}
      <BulkSelectToolbar
        selectedCount={selectedReceipts.size}
        onMove={handleBulkMove}
        onCancel={handleCancelSelection}
      />
    </div>
  );
}

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown } from "lucide-react";
import { useLocation } from "wouter";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import AppHeader from "@/components/app-header";
import AnalyticsReceiptCard from "@/components/analytics-receipt-card";
import CategoryPickerModal from "@/components/category-picker-modal";
import BulkSelectToolbar from "@/components/bulk-select-toolbar";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { CATEGORIES, getCategoryColor } from "@shared/categories";
import { computeAnalytics, DateRange } from "@/utils/analytics";
import type { Receipt } from "@shared/schema";

export default function Home() {
  const [selectedPeriod, setSelectedPeriod] = useState<DateRange>("month");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Fetch all receipts
  const { data: receipts = [], isLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts"],
  });

  // Create category color map
  const categoryColorMap = useMemo(() => {
    const map = new Map<string, string>();
    CATEGORIES.forEach(cat => {
      map.set(cat.id, cat.color);
      map.set(cat.name.toLowerCase(), cat.color);
    });
    return map;
  }, []);

  // Compute analytics data
  const analytics = useMemo(() => {
    return computeAnalytics(receipts, selectedPeriod, categoryColorMap);
  }, [receipts, selectedPeriod, categoryColorMap]);

  // Filter receipts by selected category
  const filteredReceipts = useMemo(() => {
    if (!selectedCategory) return analytics.receipts;
    return analytics.receipts.filter(r => 
      r.category?.toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [analytics.receipts, selectedCategory]);

  // Move receipt mutation
  const moveMutation = useMutation({
    mutationFn: async ({ receiptId, categoryId }: { receiptId: string; categoryId: string }) => {
      const response = await fetch(`/api/receipts/${receiptId}/move`, {
        method: 'POST',
        body: JSON.stringify({ categoryId }),
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to move receipt');
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
      const response = await fetch('/api/receipts/bulk-move', {
        method: 'POST',
        body: JSON.stringify({ receiptIds, categoryId }),
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to bulk move receipts');
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AppHeader />

      <div className="px-6 py-4 space-y-6">
        {/* Header with period selector and total */}
        <div className="flex items-center justify-between">
          <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as DateRange)}>
            <SelectTrigger className="w-[140px]" data-testid="select-date-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>

          <div className="text-right">
            <p className="text-sm text-gray-600">Total Spending</p>
            <h2 className="text-4xl font-bold text-gray-900" data-testid="text-total-spending">
              £{analytics.total.toFixed(2)}
            </h2>
          </div>
        </div>

        {/* Category Breakdown with Donut Chart */}
        <Card className="bg-white shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Breakdown</h3>
            
            {chartData.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      onClick={handleChartClick}
                      className="cursor-pointer"
                    >
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          stroke={selectedCategory === entry.category ? '#000' : 'none'}
                          strokeWidth={selectedCategory === entry.category ? 3 : 0}
                          opacity={selectedCategory && selectedCategory !== entry.category ? 0.3 : 1}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => `£${value.toFixed(2)}`}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Category legend */}
                <div className="w-full mt-4 space-y-2">
                  {analytics.categories.slice(0, 5).map((item) => (
                    <div 
                      key={item.category} 
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedCategory === item.category ? 'bg-gray-100' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedCategory(selectedCategory === item.category ? null : item.category)}
                      data-testid={`category-filter-${item.category.toLowerCase()}`}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-gray-900 font-medium text-sm">{item.category}</span>
                        <span className="text-xs text-gray-500">({item.count})</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-gray-900 text-sm">£{item.amount.toFixed(2)}</span>
                        <span className="text-xs text-gray-500 ml-2">{item.percentage.toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No data for this period</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">
              Recent Activity
              {selectedCategory && (
                <span className="text-sm font-normal text-gray-600 ml-2">
                  ({selectedCategory})
                </span>
              )}
            </h3>
            {selectedCategory && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedCategory(null)}
                data-testid="button-clear-filter"
              >
                Clear Filter
              </Button>
            )}
          </div>

          {filteredReceipts.length > 0 ? (
            <div className="space-y-3">
              {filteredReceipts.map((receipt) => (
                <AnalyticsReceiptCard
                  key={receipt.id}
                  receipt={receipt}
                  isSelected={selectedReceipts.has(receipt.id)}
                  selectionMode={selectionMode}
                  onSelect={handleReceiptSelect}
                  onMove={handleMoveReceipt}
                  onClick={(id) => navigate(`/receipt/${id}`)}
                />
              ))}
            </div>
          ) : (
            <Card className="bg-white shadow-sm">
              <CardContent className="p-8 text-center text-gray-500">
                <p>No receipts found {selectedCategory ? 'in this category' : 'for this period'}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

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

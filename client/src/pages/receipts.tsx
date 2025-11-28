import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight, Search, Filter, Calendar, Receipt, ShoppingBag, CheckSquare, Trash } from "lucide-react";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import BulkSelectToolbar from "@/components/bulk-select-toolbar";
import CategoryPickerModal from "@/components/category-picker-modal";
import { useCurrency } from "@/hooks/use-currency";

interface Receipt {
  id: string;
  merchantName: string;
  total: string;
  date: string;
  category: string;
  receiptNumber?: string;
  paymentMethod?: string;
}

export default function ReceiptsPage() {
  const [, setLocation] = useLocation();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const { toast } = useToast();
  const { format: formatCurrency } = useCurrency();

  const { data: receipts = [], isLoading } = useQuery<Receipt[]>({
    queryKey: ['/api/receipts'],
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
        title: "Move failed",
        description: "Failed to move receipts. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Delete receipt mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/receipts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete receipt");
      return true;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      setSelectedReceipts(prev => {
        const copy = new Set(prev);
        copy.delete(id);
        return copy;
      });
      toast({ title: "Receipt deleted", description: "Receipt removed successfully" });
    },
    onError: (err: any) => {
      toast({
        title: "Delete failed",
        description: err?.message || "Failed to delete receipt",
        variant: "destructive",
      });
    }
  });

  const handleToggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedReceipts(new Set());
  };

  const handleReceiptSelect = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
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

  const handleBulkMove = () => {
    if (selectedReceipts.size === 0) return;
    setCategoryPickerOpen(true);
  };

  const handleCategorySelect = (categoryId: string) => {
    if (selectedReceipts.size > 0) {
      bulkMoveMutation.mutate({ receiptIds: Array.from(selectedReceipts), categoryId });
    }
  };

  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedReceipts(new Set());
  };

  const handleSelectAll = () => {
    if (selectedReceipts.size === receipts.length) {
      setSelectedReceipts(new Set());
    } else {
      setSelectedReceipts(new Set(receipts.map(r => r.id)));
    }
  };

  const handleDeleteReceipt = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!confirm("Delete this receipt? This cannot be undone.")) return;
    deleteMutation.mutate(id);
  };

  // Group receipts by date
  const groupedReceipts = receipts.reduce((groups: Record<string, Receipt[]>, receipt: Receipt) => {
    const receiptDate = new Date(receipt.date);
    let groupKey = '';
    
    if (isToday(receiptDate)) {
      groupKey = 'Today';
    } else if (isYesterday(receiptDate)) {
      groupKey = 'Yesterday';
    } else {
      groupKey = format(receiptDate, 'EEEE, MMMM d');
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(receipt);
    return groups;
  }, {});

  const getMerchantIcon = (merchantName: string) => {
    const name = merchantName.toLowerCase();
    if (name.includes('zara')) return '🏷️';
    if (name.includes('target')) return '🎯';
    if (name.includes('nike')) return '👟';
    if (name.includes('apple')) return '🍎';
    if (name.includes('tesco')) return '🛒';
    if (name.includes('waitrose')) return '🛍️';
    if (name.includes('shell')) return '⛽';
    if (name.includes('square')) return '💳';
    return '🏪';
  };

  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'groceries': return 'bg-green-100 text-green-800';
      case 'fashion': return 'bg-purple-100 text-purple-800';
      case 'electronics': return 'bg-blue-100 text-blue-800';
      case 'fuel': return 'bg-orange-100 text-orange-800';
      case 'online': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-sm mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-sm mx-auto p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">
              {selectionMode ? `${selectedReceipts.size} selected` : 'My Receipts'}
            </h1>
            <div className="flex items-center space-x-2">
              {selectionMode && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleSelectAll}
                  data-testid="button-select-all"
                >
                  {selectedReceipts.size === receipts.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
              {!selectionMode && (
                <>
                  <Button variant="ghost" size="sm">
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Filter className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button 
                variant={selectionMode ? "default" : "ghost"} 
                size="sm"
                onClick={handleToggleSelectionMode}
                data-testid="button-toggle-selection"
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-sm mx-auto p-4 pb-20">
        {receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Receipt className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No receipts yet</h3>
            <p className="text-gray-500 mb-6">Add your first receipt</p>
            <Link href="/scan">
              <Button>
                <ShoppingBag className="h-4 w-4 mr-2" />
                Scan Your First Receipt
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedReceipts).map(([dateGroup, groupReceipts]) => (
              <div key={dateGroup}>
                <h2 className="text-sm font-medium text-gray-500 mb-3 px-1">
                  {dateGroup}
                </h2>
                <div className="space-y-2">
                  {groupReceipts.map((receipt: Receipt) => (
                    <Card 
                      key={receipt.id} 
                      className={`hover:shadow-md transition-shadow cursor-pointer ${
                        selectedReceipts.has(receipt.id) ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={(e) => {
                        if (selectionMode) {
                          handleReceiptSelect(receipt.id, e);
                          return;
                        }
                        // navigate to receipt detail
                        setLocation(`/receipts/${receipt.id}`);
                      }}
                      data-testid={`card-receipt-${receipt.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            {selectionMode && (
                              <div onClick={(e) => handleReceiptSelect(receipt.id, e)}>
                                <Checkbox 
                                  checked={selectedReceipts.has(receipt.id)}
                                  data-testid={`checkbox-receipt-${receipt.id}`}
                                />
                              </div>
                            )}
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg">
                              {getMerchantIcon(receipt.merchantName)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="relative w-full overflow-hidden">
                                {/* merchant name will truncate and leave room for badge on the right */}
                                <div className="relative">
                                  <p
                                    className="text-sm font-medium text-gray-900 truncate pr-20"
                                    title={receipt.merchantName}
                                  >
                                    {receipt.merchantName}
                                  </p>
                                  {receipt.category && (
                                    <div className="absolute top-0 right-0 pointer-events-none">
                                      <Badge
                                        variant="secondary"
                                        className={`text-xs ${getCategoryColor(receipt.category)}`}
                                      >
                                        {receipt.category}
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 truncate mt-1">
                                  {format(new Date(receipt.date), 'h:mm a')}
                                  {receipt.receiptNumber && ` • #${receipt.receiptNumber}`}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                            <div className="text-right min-w-[10px] flex-shrink-0">
                              <p className="text-sm font-semibold text-gray-900">
                                {formatCurrency(receipt.total)}
                              </p>
                              {receipt.paymentMethod && (
                                <p className="text-xs text-gray-500">
                                  {receipt.paymentMethod}
                                </p>
                              )}
                            </div>
                            {!selectionMode && (
                              <div className="flex items-center gap-1">
                                 <ChevronRight className="h-4 w-4 text-gray-400" />
                               </div>
                             )}
                            {/* Delete action */}
                            {!selectionMode && (
                              <button
                                onClick={(e) => handleDeleteReceipt(receipt.id, e)}
                                className="text-red-500 hover:text-red-700 p-1 ml-2"
                                aria-label="Delete receipt"
                                title="Delete receipt"
                              >
                                <Trash className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category Picker Modal */}
      <CategoryPickerModal
        open={categoryPickerOpen}
        onClose={() => setCategoryPickerOpen(false)}
        onSelect={handleCategorySelect}
        title={`Move ${selectedReceipts.size} receipt(s) to category`}
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
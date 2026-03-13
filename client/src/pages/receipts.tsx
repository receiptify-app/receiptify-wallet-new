import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, ChevronDown, Search, Filter, Calendar, Receipt, ShoppingBag, CheckSquare, Trash, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();
  const { format: formatCurrency, currency: userCurrency } = useCurrency();
  const { t } = useTranslation();

  const { data: receipts = [], isLoading } = useQuery<Receipt[]>({
    queryKey: ['/api/receipts'],
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
        title: t('receipts.moved'),
        description: t('receipts.movedDesc'),
      });
    },
    onError: () => {
      toast({
        title: t('receipts.moveFailed'),
        description: t('receipts.moveFailedDesc'),
        variant: "destructive",
      });
    }
  });

  // Delete receipt mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/receipts/${id}`);
      return true;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      setSelectedReceipts(prev => {
        const copy = new Set(prev);
        copy.delete(id);
        return copy;
      });
      toast({ title: t('receipts.deleted'), description: t('receipts.deletedDesc') });
    },
    onError: (err: any) => {
      toast({
        title: t('receipts.deleteFailed'),
        description: t('receipts.deleteFailedDesc'),
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  const handleToggleSearch = () => {
    setSearchOpen(prev => {
      if (prev) setSearchQuery("");
      return !prev;
    });
  };

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

  const handleDeleteReceipt = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    const confirmed = await confirm({
      title: t('receipts.deleteConfirmTitle'),
      description: t('receipts.deleteConfirmDesc'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      variant: "destructive",
    });
    
    if (confirmed) {
      deleteMutation.mutate(id);
    }
  };

  // Toggle month expansion
  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  // Group receipts by month and sort by date descending
  const groupedReceipts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? receipts.filter((r: Receipt) => {
          const merchant = (r.merchantName || "").toLowerCase();
          const category = (r.category || "").toLowerCase();
          const payment = (r.paymentMethod || "").toLowerCase();
          const receiptNum = (r.receiptNumber || "").toLowerCase();
          const total = (r.total || "").toLowerCase();
          return (
            merchant.includes(q) ||
            category.includes(q) ||
            payment.includes(q) ||
            receiptNum.includes(q) ||
            total.includes(q)
          );
        })
      : receipts;

    const groups: Record<string, { receipts: Receipt[]; sortKey: number }> = {};

    filtered.forEach((receipt: Receipt) => {
      const receiptDate = new Date(receipt.date);
      const monthKey = format(receiptDate, 'MMMM yyyy');
      const sortKey = receiptDate.getFullYear() * 100 + receiptDate.getMonth();
      
      if (!groups[monthKey]) {
        groups[monthKey] = { receipts: [], sortKey };
      }
      groups[monthKey].receipts.push(receipt);
    });

    // Sort receipts within each month by date descending
    Object.values(groups).forEach(group => {
      group.receipts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    // Convert to array sorted by month descending (newest first)
    return Object.entries(groups)
      .sort(([, a], [, b]) => b.sortKey - a.sortKey)
      .map(([monthKey, { receipts }]) => ({ monthKey, receipts }));
  }, [receipts, searchQuery]);

  const displayMerchant = (name: string | null | undefined) =>
    !name || name === "null" || name.trim() === "" ? "Unspecified Merchant" : name;

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
              {selectionMode ? `${selectedReceipts.size} ${t('common.selected').toLowerCase()}` : t('receipts.title')}
            </h1>
            <div className="flex items-center space-x-2">
              {selectionMode && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleSelectAll}
                  data-testid="button-select-all"
                >
                  {selectedReceipts.size === receipts.length ? t('receipts.deselectAll') : t('receipts.selectAll')}
                </Button>
              )}
              {!selectionMode && (
                <>
                  <Button
                    variant={searchOpen ? "secondary" : "ghost"}
                    size="sm"
                    onClick={handleToggleSearch}
                    aria-label="Toggle search"
                  >
                    {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
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
          {searchOpen && (
            <div className="mt-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search merchant, category, amount..."
                className="pl-9 pr-9 h-9 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-sm mx-auto p-4 pb-20">
        {receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Receipt className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('receipts.noReceipts')}</h3>
            <p className="text-gray-500 mb-6">{t('receipts.noReceiptsDesc')}</p>
            <Link href="/scan">
              <Button>
                <ShoppingBag className="h-4 w-4 mr-2" />
                {t('scan.title')}
              </Button>
            </Link>
          </div>
        ) : groupedReceipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-500">Try a different search term</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedReceipts.map(({ monthKey, receipts: monthReceipts }) => {
              const isExpanded = searchQuery.trim() ? true : expandedMonths.has(monthKey);
              const monthTotal = monthReceipts.reduce((sum, r) => sum + parseFloat(r.total || '0'), 0);
              
              return (
                <Collapsible
                  key={monthKey}
                  open={isExpanded}
                  onOpenChange={() => toggleMonth(monthKey)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <ChevronDown 
                          className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`} 
                        />
                        <div>
                          <h2 className="text-sm font-semibold text-gray-900">{monthKey}</h2>
                          <p className="text-xs text-gray-500">{monthReceipts.length} receipt{monthReceipts.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(monthTotal.toString())}</p>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 mt-2 pl-2">
                      {monthReceipts.map((receipt: Receipt) => (
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
                                  {getMerchantIcon(displayMerchant(receipt.merchantName))}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p
                                    className="text-sm font-medium text-gray-900 truncate"
                                    title={displayMerchant(receipt.merchantName)}
                                  >
                                    {displayMerchant(receipt.merchantName)}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate mt-1">
                                    {format(new Date(receipt.date), 'MMM d, h:mm a')}
                                    {receipt.receiptNumber && ` • #${receipt.receiptNumber}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                                <div className="text-right flex-shrink-0 max-w-[100px]">
                                  <div className="flex items-center justify-end gap-1 mb-0.5">
                                    {receipt.category && (
                                      <Badge
                                        variant="secondary"
                                        className={`text-xs flex-shrink-0 ${getCategoryColor(receipt.category)}`}
                                      >
                                        {receipt.category}
                                      </Badge>
                                    )}
                                    <div className="text-right">
                                      <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                                        {formatCurrency(receipt.total)}
                                      </p>
                                      {receipt.currency && receipt.currency.toUpperCase() !== userCurrency.toUpperCase() && (
                                        <p className="text-xs text-amber-600 font-medium">
                                          {receipt.currency.toUpperCase()}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  {receipt.paymentMethod && receipt.paymentMethod !== "null" && (
                                    <p className="text-xs text-gray-500 truncate">
                                      {receipt.paymentMethod}
                                    </p>
                                  )}
                                </div>
                                {!selectionMode && (
                                  <div className="flex items-center gap-1">
                                    <ChevronRight className="h-4 w-4 text-gray-400" />
                                  </div>
                                )}
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
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
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
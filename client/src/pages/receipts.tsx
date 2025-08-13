import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronRight, Search, Filter, Calendar, Receipt, ShoppingBag } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

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
  const { data: receipts = [], isLoading } = useQuery<Receipt[]>({
    queryKey: ['/api/receipts'],
  });

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
            <h1 className="text-xl font-semibold text-gray-900">My Receipts</h1>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <Search className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Filter className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Calendar className="h-4 w-4" />
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
            <p className="text-gray-500 mb-6">Start scanning QR codes to add your first receipt</p>
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
                    <Link key={receipt.id} href={`/receipt/${receipt.id}`}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg">
                                {getMerchantIcon(receipt.merchantName)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {receipt.merchantName}
                                  </p>
                                  {receipt.category && (
                                    <Badge 
                                      variant="secondary" 
                                      className={`text-xs ${getCategoryColor(receipt.category)}`}
                                    >
                                      {receipt.category}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">
                                  {format(new Date(receipt.date), 'h:mm a')}
                                  {receipt.receiptNumber && ` • #${receipt.receiptNumber}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="text-right">
                                <p className="text-sm font-semibold text-gray-900">
                                  £{receipt.total}
                                </p>
                                {receipt.paymentMethod && (
                                  <p className="text-xs text-gray-500">
                                    {receipt.paymentMethod}
                                  </p>
                                )}
                              </div>
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, MapPin, Calendar, CreditCard, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReceiptSplit from "@/components/receipt-split";
import ReceiptComments from "@/components/receipt-comments";
import type { Receipt, ReceiptItem } from "@shared/schema";

export default function ReceiptDetailPage() {
  const [location] = useLocation();
  const receiptId = location.split('/').pop();
  const [, navigate] = useLocation();

  const { data: receipt, isLoading: receiptLoading } = useQuery<Receipt>({
    queryKey: [`/api/receipts/${receiptId}`],
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery<ReceiptItem[]>({
    queryKey: [`/api/receipts/${receiptId}/items`],
    enabled: !!receiptId,
  });

  if (receiptLoading || itemsLoading) {
    return (
      <div className="p-6 pb-24">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="p-6 pb-24">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Receipt not found</h2>
          <p className="text-gray-600 mb-4">The receipt you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/')}>Back to Home</Button>
        </div>
      </div>
    );
  }

  const total = items.reduce((sum, item) => sum + parseFloat(item.price), 0);

  return (
    <div className="p-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 p-0"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </Button>
        <div className="flex gap-2">
          <ReceiptSplit receipt={receipt} items={items} />
          <Button variant="outline" size="sm">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      {/* Receipt Header */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {receipt.merchantName}
            </h1>
            <div className="flex items-center justify-center gap-2 text-gray-600 mb-4">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">{receipt.location}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span>{new Date(receipt.date).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-500" />
                <span>{receipt.paymentMethod || 'Card'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            {items.map((item, index) => (
              <div
                key={item.id}
                className={`flex justify-between items-center p-4 ${
                  index !== items.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{item.name}</div>
                  {item.category && (
                    <div className="text-sm text-gray-500">{item.category}</div>
                  )}
                  {item.quantity && item.quantity !== "1" && (
                    <div className="text-sm text-gray-500">Qty: {item.quantity}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">£{item.price}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Total */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">Total</span>
            <span className="text-2xl font-bold text-primary">
              £{receipt.total}
            </span>
          </div>
          {Math.abs(total - parseFloat(receipt.total)) > 0.01 && (
            <div className="text-sm text-gray-500 mt-1">
              Items total: £{total.toFixed(2)} • Difference may include tax/fees
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comments Section */}
      <div className="mb-6">
        <ReceiptComments receiptId={receipt.id} />
      </div>

      {/* Eco Impact */}
      <Card>
        <CardContent className="p-4">
          <div className="text-center">
            <div className="text-sm font-medium text-primary mb-2">Eco Impact</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-lg font-bold text-accent">1</div>
                <div className="text-xs text-gray-600">Paper Saved</div>
              </div>
              <div>
                <div className="text-lg font-bold text-accent">0.05kg</div>
                <div className="text-xs text-gray-600">CO₂ Reduced</div>
              </div>
              <div>
                <div className="text-lg font-bold text-accent">0.001</div>
                <div className="text-xs text-gray-600">Trees Saved</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

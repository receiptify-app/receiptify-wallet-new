import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  CreditCard, 
  Share2, 
  MessageSquare,
  Split,
  Download
} from "lucide-react";
import { useLocation } from "wouter";
import type { Receipt, ReceiptItem } from "@shared/schema";

export default function ReceiptDetail() {
  const [, params] = useRoute("/receipt/:id");
  const [, setLocation] = useLocation();
  const receiptId = params?.id;

  const { data: receiptData, isLoading, error } = useQuery<Receipt & { items: ReceiptItem[] }>({
    queryKey: ["/api/receipts", receiptId],
    enabled: !!receiptId,
  });

  if (isLoading) {
    return (
      <div className="px-6 py-4 pb-24">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded-xl"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !receiptData) {
    return (
      <div className="px-6 py-4 pb-24">
        <div className="text-center py-12">
          <div className="text-red-500 mb-4">Receipt not found</div>
          <Button onClick={() => setLocation("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const { items = [], ...receipt } = receiptData;

  const getMerchantLogo = (merchantName: string) => {
    const name = merchantName.toLowerCase();
    if (name.includes('tesco')) return { logo: 'T', color: '#00539C' };
    if (name.includes('waitrose')) return { logo: 'W', color: '#2C5F41' };
    if (name.includes('shell')) return { logo: '⛽', color: '#DC143C' };
    if (name.includes('sainsbury')) return { logo: 'S', color: '#FF8200' };
    if (name.includes('argos')) return { logo: 'A', color: '#DC143C' };
    if (name.includes('boots')) return { logo: 'B', color: '#0054A6' };
    return { logo: receipt.merchantName.charAt(0), color: '#6B7280' };
  };

  const merchantInfo = getMerchantLogo(receipt.merchantName);

  return (
    <div className="px-6 py-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex space-x-2">
          <Button size="sm" variant="outline">
            <Share2 className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Receipt Header */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: merchantInfo.color }}
              >
                {merchantInfo.logo}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{receipt.merchantName}</h1>
                {receipt.location && (
                  <div className="flex items-center text-gray-600 text-sm">
                    <MapPin className="w-4 h-4 mr-1" />
                    {receipt.location}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                £{parseFloat(receipt.total).toFixed(2)}
              </div>
              {receipt.category && (
                <Badge variant="secondary" className="mt-1">
                  {receipt.category}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center text-gray-600">
              <Calendar className="w-4 h-4 mr-2" />
              {new Date(receipt.date).toLocaleDateString('en-UK')}
            </div>
            <div className="flex items-center text-gray-600">
              <CreditCard className="w-4 h-4 mr-2" />
              {receipt.paymentMethod || 'Card'}
            </div>
          </div>

          {receipt.receiptNumber && (
            <div className="mt-4 text-xs text-gray-500">
              Receipt #{receipt.receiptNumber}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            {items.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No items available for this receipt
              </div>
            ) : (
              items.map((item, index) => (
                <div key={item.id}>
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      {item.category && (
                        <div className="text-sm text-gray-500">{item.category}</div>
                      )}
                      {item.quantity && parseFloat(item.quantity) !== 1 && (
                        <div className="text-sm text-gray-500">
                          Qty: {parseFloat(item.quantity)}
                        </div>
                      )}
                      {item.notes && (
                        <div className="text-sm text-gray-600 mt-1 flex items-center">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          {item.notes}
                        </div>
                      )}
                    </div>
                    <div className="font-semibold text-gray-900">
                      £{parseFloat(item.price).toFixed(2)}
                    </div>
                  </div>
                  {index < items.length - 1 && <Separator />}
                </div>
              ))
            )}
          </div>

          {items.length > 0 && (
            <>
              <Separator />
              <div className="px-6 py-4 bg-gray-50">
                <div className="flex items-center justify-between font-semibold">
                  <span>Total ({items.length} items)</span>
                  <span>£{parseFloat(receipt.total).toFixed(2)}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Button variant="outline" className="flex items-center justify-center">
          <Split className="w-4 h-4 mr-2" />
          Split Bill
        </Button>
        <Button variant="outline" className="flex items-center justify-center">
          <MessageSquare className="w-4 h-4 mr-2" />
          Add Note
        </Button>
      </div>

      {/* Eco Impact */}
      <Card className="mt-6 bg-light-green border-accent/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                <span className="text-white text-xs">♻</span>
              </div>
              <span className="text-sm font-medium text-gray-900">Eco Impact</span>
            </div>
            <div className="text-sm text-gray-600">
              +{receipt.ecoPoints} eco points • 1 paper saved
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

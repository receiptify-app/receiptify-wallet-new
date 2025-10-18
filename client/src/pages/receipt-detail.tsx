import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Download, 
  Utensils
} from "lucide-react";
import AppHeader from "@/components/app-header";
import type { Receipt, ReceiptItem } from "@shared/schema";

export default function ReceiptDetailPage() {
  const [, navigate] = useLocation();
  const params = useParams();
  const receiptId = params.id;

  const { data: receipt, isLoading } = useQuery<Receipt & { items?: ReceiptItem[] }>({
    queryKey: ["/api/receipts", receiptId],
  });

  if (isLoading || !receipt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const items = receipt.items || [];
  const receiptDate = new Date(receipt.date).toLocaleDateString('en-US', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AppHeader 
        showBackButton={true}
        onBackClick={() => navigate('/')}
      />

      <div className="px-6 py-4 space-y-6">
        {/* Store Info */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {receipt.merchantName}
          </h1>
          <p className="text-gray-600">
            {receiptDate} • {receipt.location}
          </p>
        </div>

        {/* Receipt Image */}
        {receipt.imageUrl && (
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Receipt Image
                </h3>
                <div className="relative rounded-lg overflow-hidden bg-gray-100">
                  <img 
                    src={receipt.imageUrl} 
                    alt="Receipt" 
                    className="w-full h-auto max-h-[600px] object-contain"
                    data-testid="img-receipt"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}


        {/* Items List */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-6 space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="text-gray-900 font-medium">
                  {item.quantity && parseInt(item.quantity) > 1 ? `${item.quantity}x ` : ''}{item.name}
                </span>
                <span className="text-gray-900 font-semibold">
                  £{parseFloat(item.price).toFixed(2)}
                </span>
              </div>
            ))}
            
            {receipt.tax && (
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex items-center justify-between text-gray-900">
                  <span>Tax</span>
                  <span>£{parseFloat(receipt.tax).toFixed(2)}</span>
                </div>
              </div>
            )}
            
            <div className={`${receipt.tax ? 'pt-2' : 'border-t border-gray-200 pt-4 mt-4'}`}>
              <div className="flex items-center justify-between text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>£{parseFloat(receipt.total).toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method */}
        {receipt.paymentMethod && (
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-gray-900 font-medium">{receipt.paymentMethod}</span>
                </div>
                <Button variant="ghost" size="sm">
                  <Download className="h-4 w-4" />
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
              <span className="text-gray-900 font-medium">{receipt.category || 'Other'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Split Receipt Button */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-4">
            <Button 
              className="w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg font-semibold rounded-2xl"
              size="lg"
              onClick={() => navigate('/split-receipt')}
            >
              Split Receipt
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
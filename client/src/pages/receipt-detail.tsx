import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Download, 
  MapPin,
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

        {/* Map Card */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-4">
            <div className="relative h-48 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
              {/* Simple map representation */}
              <div className="absolute inset-0 rounded-lg">
                <svg 
                  viewBox="0 0 300 200" 
                  className="w-full h-full opacity-20"
                  fill="none"
                >
                  {/* Road lines */}
                  <line x1="0" y1="80" x2="300" y2="120" stroke="white" strokeWidth="2" />
                  <line x1="100" y1="0" x2="150" y2="200" stroke="white" strokeWidth="2" />
                  <line x1="200" y1="0" x2="250" y2="200" stroke="white" strokeWidth="2" />
                  <line x1="0" y1="150" x2="300" y2="150" stroke="white" strokeWidth="2" />
                </svg>
              </div>
              
              {/* Location pin */}
              <div className="relative z-10">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center shadow-lg">
                  <MapPin className="w-6 h-6 text-white fill-white" />
                </div>
                <div className="mt-2 text-center">
                  <p className="text-sm font-semibold text-gray-900">{receipt.location}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items List */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-6 space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="text-gray-900 font-medium">
                  {item.quantity && parseInt(item.quantity) > 1 ? `${item.quantity}x ` : ''}{item.name}
                </span>
                <span className="text-gray-900 font-semibold">
                  ${parseFloat(item.price).toFixed(2)}
                </span>
              </div>
            ))}
            
            {receipt.tax && (
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="flex items-center justify-between text-gray-900">
                  <span>Tax</span>
                  <span>${parseFloat(receipt.tax).toFixed(2)}</span>
                </div>
              </div>
            )}
            
            <div className={`${receipt.tax ? 'pt-2' : 'border-t border-gray-200 pt-4 mt-4'}`}>
              <div className="flex items-center justify-between text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>${parseFloat(receipt.total).toFixed(2)}</span>
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
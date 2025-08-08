import { useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, 
  Download, 
  MapPin,
  Utensils
} from "lucide-react";
import AppHeader from "@/components/app-header";

// Sample receipt data to match the Waitrose design
const sampleReceipt = {
  id: "1",
  merchantName: "Waitrose & Partners",
  date: "12 Jul 2025, 16:34",
  location: "Harrow Weald, London",
  items: [
    { name: "Baguette", price: 2.00 },
    { name: "Mozzarella", price: 1.70 },
    { name: "Mozzarella", price: 1.70 },
    { name: "Smoked Salmon", price: 4.87 }
  ],
  total: 12.02,
  paymentMethod: "VISA Debit",
  cashback: 0.09,
  category: "Food",
  ecoPoints: 1
};

export default function ReceiptDetailPage() {
  const [, navigate] = useLocation();
  const [includeInAnalytics, setIncludeInAnalytics] = useState(true);

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
            {sampleReceipt.merchantName}
          </h1>
          <p className="text-gray-600">
            {sampleReceipt.date}  {sampleReceipt.location}
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
                  <p className="text-sm font-semibold text-gray-900">Harrow Weald</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items List */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-6 space-y-4">
            {sampleReceipt.items.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-gray-900 font-medium">{item.name}</span>
                <span className="text-gray-900 font-semibold">
                  ${item.price.toFixed(2)}
                </span>
              </div>
            ))}
            
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center justify-between text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>£{sampleReceipt.total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-900 text-white px-2 py-1 rounded text-sm font-bold">
                  VISA
                </div>
                <span className="text-gray-900 font-medium">Debit</span>
              </div>
              <Button variant="ghost" size="sm">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cashback */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-900 font-medium">Cashback</span>
              <span className="text-gray-900 font-semibold">£{sampleReceipt.cashback.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Category & Eco Points */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <Utensils className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-gray-900 font-medium">{sampleReceipt.category}</span>
              </div>
              <span className="text-sm text-gray-600">+{sampleReceipt.ecoPoints} Eco Points Saved</span>
            </div>
          </CardContent>
        </Card>

        {/* Analytics Toggle */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-900 font-medium">Include in Monthly Analytics</span>
              <Switch 
                checked={includeInAnalytics}
                onCheckedChange={setIncludeInAnalytics}
                className="data-[state=checked]:bg-green-600"
              />
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
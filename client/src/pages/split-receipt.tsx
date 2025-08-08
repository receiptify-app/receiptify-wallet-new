import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Receipt, Check } from "lucide-react";
import receiptifyLogo from "@assets/Screenshot 2025-08-08 at 05.45.22_1754621466675.png";

// Different views based on URL parameters or state
type SplitView = 'shared' | 'confirmation' | 'received' | 'original';

// Sample data for different scenarios
const sharedReceiptData = {
  merchantName: "Grocery Shop",
  sharedWith: "Sarah",
  items: [
    { name: "WR SGDH BGITE", price: 2.00, assignedTo: "Sarah" },
    { name: "WR SDQGH BACUE 400G", price: 1.75, assignedTo: "Sarah" },
    { name: "WR ITAL MOZZARELLA", price: 1.70, assignedTo: "Sarah" },
    { name: "N01 CW0D0 SMK SALMON", price: 4.87, assignedTo: "Sarah" }
  ],
  total: 12.32,
  userAmount: 6.16
};

const originalReceiptData = {
  merchantName: "Tesco Express",
  location: "Camden, London",
  date: "26 Apr 2024 • 11:28",
  items: [
    { name: "Plain Bagels 4pk", price: 1.50 },
    { name: "Whole Milk 4 Pints", price: 1.65 },
    { name: "Cheddar Cheese", price: 3.25 },
    { name: "Fairtrade Bananas", price: 1.58 }
  ],
  total: 24.18
};

export default function SplitReceipt() {
  const [, navigate] = useLocation();
  const [comment, setComment] = useState("");
  const [view, setView] = useState<SplitView>('shared'); // This would be determined by routing

  // Shared receipt view (first image)
  const SharedReceiptView = () => (
    <div className="min-h-screen bg-green-50 pb-24">
      {/* Header with logo */}
      <div className="bg-green-50 px-6 py-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <img src={receiptifyLogo} alt="Receiptify" className="w-10 h-10" />
          <h1 className="text-2xl font-bold text-green-800">Receiptify</h1>
        </div>
        <h2 className="text-xl text-green-700">Shared with {sharedReceiptData.sharedWith}</h2>
      </div>

      <div className="px-6">
        {/* Receipt Card */}
        <Card className="bg-white shadow-lg border-0 rounded-2xl">
          <CardContent className="p-6">
            <h3 className="text-2xl font-bold text-green-800 text-center mb-6">
              {sharedReceiptData.merchantName}
            </h3>
            
            <div className="border-t border-b border-gray-300 border-dashed py-4 space-y-3">
              {sharedReceiptData.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="flex-1 text-gray-900">{item.name}</span>
                  <span className="w-12 text-right text-gray-900">£{item.price.toFixed(2)}</span>
                  <span className="w-16 text-right text-gray-600">{item.assignedTo}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between py-4 text-lg font-bold">
              <span>Total</span>
              <span>£{sharedReceiptData.total.toFixed(2)}</span>
            </div>

            <div className="space-y-4 mt-6">
              <Input
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="border-green-200 focus:border-green-500"
              />
              
              <Button 
                className="w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg font-semibold rounded-2xl"
                size="lg"
              >
                Pay £{sharedReceiptData.userAmount.toFixed(2)}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // Payment confirmation view (second image)
  const ConfirmationView = () => (
    <div className="min-h-screen bg-green-50 pb-24">
      <div className="px-6 py-12">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <img src={receiptifyLogo} alt="Receiptify" className="w-12 h-12" />
            <h1 className="text-2xl font-bold text-green-800">Receiptify</h1>
          </div>
        </div>

        <div className="text-center space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Claire has paid you back<br />
            £11,90 for the shared receipt
          </h2>

          <div className="flex justify-center">
            <div className="w-32 h-32 bg-green-200 rounded-3xl flex items-center justify-center">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center relative">
                <Receipt className="w-8 h-8 text-green-600" />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          </div>

          <p className="text-gray-600">Today, 2:05 PM</p>

          <Button 
            className="w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg font-semibold rounded-2xl"
            size="lg"
          >
            View Receipt
          </Button>
        </div>
      </div>
    </div>
  );

  // Original receipt with split button (third image)
  const OriginalReceiptView = () => (
    <div className="min-h-screen bg-green-50 pb-24">
      <div className="px-6 py-6">
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src={receiptifyLogo} alt="Receiptify" className="w-10 h-10" />
          <h1 className="text-2xl font-bold text-green-800">Receiptify</h1>
        </div>

        {/* Map placeholder */}
        <Card className="bg-white shadow-sm border-0 rounded-2xl mb-4">
          <CardContent className="p-4">
            <div className="h-32 bg-blue-100 rounded-xl flex items-center justify-center relative">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-white rounded-full"></div>
              </div>
              <span className="absolute bottom-2 left-2 text-xs text-gray-600">Apple</span>
            </div>
          </CardContent>
        </Card>

        {/* Receipt details */}
        <Card className="bg-white shadow-sm border-0 rounded-2xl">
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{originalReceiptData.merchantName}</h3>
              <p className="text-gray-600">{originalReceiptData.location}</p>
              <p className="text-gray-600">{originalReceiptData.date}</p>
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2">
              {originalReceiptData.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-gray-900">{item.name}</span>
                  <span className="font-semibold">£{item.price.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span>{originalReceiptData.total.toFixed(2)}</span>
              </div>
            </div>

            <Button 
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg font-semibold rounded-2xl mt-6"
              size="lg"
            >
              Split Receipt
            </Button>

            {/* Eco message */}
            <div className="flex items-center gap-2 bg-green-50 p-3 rounded-xl">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">nectar</span>
              </div>
              <span className="text-green-800 font-medium">Saved 1 paper receipt</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // Received receipt notification (fourth image)
  const ReceivedView = () => (
    <div className="min-h-screen bg-green-50 pb-24">
      <div className="px-6 py-20">
        <div className="space-y-8">
          <Card className="bg-white shadow-sm border-0 rounded-3xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                    <Receipt className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      Receipt received from<br />
                      <span className="text-2xl font-bold">Waitrose</span>
                    </p>
                  </div>
                </div>
                <span className="text-xl font-bold text-gray-900">£12.02</span>
              </div>
            </CardContent>
          </Card>

          <Button 
            className="w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg font-semibold rounded-3xl"
            size="lg"
          >
            View Receipt
          </Button>
        </div>
      </div>
    </div>
  );

  // Render based on view state
  const renderView = () => {
    switch (view) {
      case 'shared':
        return <SharedReceiptView />;
      case 'confirmation':
        return <ConfirmationView />;
      case 'original':
        return <OriginalReceiptView />;
      case 'received':
        return <ReceivedView />;
      default:
        return <SharedReceiptView />;
    }
  };

  return (
    <div>
      {/* Dev controls - remove in production */}
      <div className="fixed top-4 right-4 z-50 bg-white p-2 rounded-lg shadow-lg">
        <select 
          value={view} 
          onChange={(e) => setView(e.target.value as SplitView)}
          className="text-xs"
        >
          <option value="shared">Shared Receipt</option>
          <option value="confirmation">Payment Confirmation</option>
          <option value="original">Original with Split</option>
          <option value="received">Received Receipt</option>
        </select>
      </div>

      {renderView()}
    </div>
  );
}
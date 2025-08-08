import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Shield, Wifi, Check } from "lucide-react";
import { useLocation } from "wouter";

// Sample warranty data to match the TP-Link Router design
const sampleWarranty = {
  id: "1",
  productName: "TP-Link Router",
  retailer: "Argos",
  purchaseDate: "25 Jun 2025",
  price: "59.99",
  warrantyPeriod: "12 months",
  warrantyEndDate: "25 Jun 2026",
  isActive: true,
  category: "Electronics"
};

export default function Warranties() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-6 py-4 flex items-center gap-4 border-b border-gray-100">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="p-2"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Button>
        <h1 className="text-xl font-semibold text-gray-900">Warranty Tracker</h1>
      </div>

      <div className="px-6 py-8 space-y-8">
        {/* Warranty Status Card */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-8 text-center">
            <div className="flex items-center justify-center mb-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <Shield className="w-10 h-10 text-green-600" />
                <Check className="w-6 h-6 text-green-600 absolute ml-6 -mt-2" />
              </div>
            </div>
            
            <h2 className="text-4xl font-bold text-gray-900 mb-2">
              {sampleWarranty.warrantyPeriod}
            </h2>
            <p className="text-gray-600 text-lg">
              Warranty ends {sampleWarranty.warrantyEndDate}
            </p>
          </CardContent>
        </Card>

        {/* Product Details Card */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-6 space-y-6">
            {/* Product Header */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                <Wifi className="w-8 h-8 text-gray-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-1">
                  {sampleWarranty.productName}
                </h3>
                <p className="text-gray-600">
                  Purchased {sampleWarranty.purchaseDate} • {sampleWarranty.retailer}
                </p>
              </div>
            </div>

            {/* Price */}
            <div className="pt-4 border-t border-gray-100">
              <p className="text-3xl font-bold text-gray-900">
                £{sampleWarranty.price}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Action Button */}
        <div className="pt-8">
          <Button 
            className="w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg font-semibold rounded-2xl"
            size="lg"
          >
            Start Claim
          </Button>
        </div>
      </div>
    </div>
  );
}
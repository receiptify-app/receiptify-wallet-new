import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Receipt, Leaf, Shield, MapPin, RefreshCw, QrCode, ArrowRight } from "lucide-react";
import logoSrc from "@assets/2C508BEA-D169-4FDB-A1F9-0F6E333C1A18_1754620280792.png";

export default function Landing() {
  const features = [
    {
      icon: QrCode,
      title: "Instant Scanning",
      description: "QR codes, camera capture, and automated receipt detection"
    },
    {
      icon: Leaf,
      title: "Eco Impact",
      description: "Track your environmental savings and reduce paper waste"
    },
    {
      icon: RefreshCw,
      title: "Smart Subscriptions",
      description: "Auto-detect and manage recurring purchases"
    },
    {
      icon: Shield,
      title: "Warranty Tracking",
      description: "Never miss warranty expiry dates or claims"
    },
    {
      icon: MapPin,
      title: "Location Mapping",
      description: "Geo-tagged receipts with interactive maps"
    },
    {
      icon: Receipt,
      title: "Bill Splitting",
      description: "Share costs and collaborate on group purchases"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Hero Section */}
      <div className="px-6 py-12 text-center">
        <div className="mb-8 flex justify-center">
          <div className="w-24 h-24 bg-white rounded-3xl shadow-2xl flex items-center justify-center p-4">
            <img 
              src={logoSrc} 
              alt="Receiptify Logo" 
              className="w-full h-full object-contain"
            />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Receiptify
        </h1>
        <p className="text-xl text-gray-700 font-medium mb-2">
          OneTap Receipts. Zero Paper.
        </p>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          The UK's leading eco-friendly digital receipt management platform. 
          Consolidate, track, and collaborate on all your purchases.
        </p>

        <div className="space-y-4">
          <Button 
            size="lg" 
            className="w-full max-w-sm bg-primary hover:bg-primary/90 text-white font-semibold py-3"
          >
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="text-sm text-gray-500">
            Free to use • No credit card required
          </p>
        </div>
      </div>

      {/* Features Grid */}
      <div className="px-6 pb-12">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
          Everything you need for digital receipts
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="bg-white/70 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                      <p className="text-sm text-gray-600">{feature.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Environmental Impact CTA */}
      <div className="px-6 pb-12">
        <Card className="bg-gradient-to-r from-green-600 to-emerald-600 border-0 text-white max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <Leaf className="h-12 w-12 mx-auto mb-4 text-green-100" />
            <h3 className="text-xl font-bold mb-2">Make an Impact</h3>
            <p className="text-green-100 mb-4">
              Our users have saved over 50,000 sheets of paper and reduced CO₂ emissions by 127kg
            </p>
            <Button 
              variant="secondary" 
              className="bg-white text-green-700 hover:bg-green-50"
            >
              Start Saving Today
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="px-6 py-8 text-center border-t border-green-200/50">
        <p className="text-sm text-gray-600 mb-2">
          Trusted by eco-conscious shoppers across the UK
        </p>
        <p className="text-xs text-gray-500">
          © 2025 Receiptify. Digitizing receipts for a greener future.
        </p>
      </div>
    </div>
  );
}
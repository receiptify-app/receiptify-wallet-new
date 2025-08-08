import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  CreditCard, 
  Apple, 
  Smartphone,
  Check,
  ArrowLeft
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/app-header";

interface PaymentMethod {
  id: string;
  type: 'credit_card' | 'apple_pay' | 'google_pay';
  last4?: string;
  brand?: string;
  isDefault: boolean;
  nickname?: string;
}

// Sample payment methods
const samplePaymentMethods: PaymentMethod[] = [
  {
    id: "1",
    type: "apple_pay",
    isDefault: true,
    nickname: "Apple Pay"
  },
  {
    id: "2", 
    type: "credit_card",
    last4: "4242",
    brand: "Visa",
    isDefault: false,
    nickname: "Personal Visa"
  },
  {
    id: "3",
    type: "google_pay", 
    isDefault: false,
    nickname: "Google Pay"
  }
];

export default function Payment() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("1");
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: paymentMethods = samplePaymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/payment-methods"],
  });

  // Sample payment details - in real app this would come from route params or context
  const paymentDetails = {
    amount: 6.16,
    description: "Shared receipt from Tesco Express",
    recipient: "Sarah"
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    
    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false);
      toast({
        title: "Payment Successful",
        description: `£${paymentDetails.amount.toFixed(2)} sent to ${paymentDetails.recipient}`,
      });
      navigate('/split-receipt?view=confirmation');
    }, 2000);
  };

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    switch (method.type) {
      case 'apple_pay':
        return <Apple className="w-6 h-6" />;
      case 'google_pay':
        return <Smartphone className="w-6 h-6" />;
      case 'credit_card':
        return <CreditCard className="w-6 h-6" />;
      default:
        return <CreditCard className="w-6 h-6" />;
    }
  };

  const getPaymentMethodDisplay = (method: PaymentMethod) => {
    switch (method.type) {
      case 'apple_pay':
        return "Apple Pay";
      case 'google_pay':
        return "Google Pay";
      case 'credit_card':
        return `${method.brand} •••• ${method.last4}`;
      default:
        return method.nickname || "Payment Method";
    }
  };

  const getPaymentMethodSubtext = (method: PaymentMethod) => {
    if (method.isDefault) return "Default payment method";
    if (method.type === 'apple_pay') return "Touch ID or Face ID";
    if (method.type === 'google_pay') return "Fingerprint or PIN";
    return "";
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AppHeader 
        showBackButton={true}
        onBackClick={() => navigate('/split-receipt')}
        title="Payment"
      />

      <div className="px-6 py-6 space-y-6">
        {/* Payment Summary */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              £{paymentDetails.amount.toFixed(2)}
            </h2>
            <p className="text-gray-600">{paymentDetails.description}</p>
            <p className="text-sm text-gray-500 mt-1">To: {paymentDetails.recipient}</p>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Payment Method</h3>
          <RadioGroup value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div key={method.id}>
                  <RadioGroupItem value={method.id} id={method.id} className="sr-only" />
                  <Label
                    htmlFor={method.id}
                    className="cursor-pointer"
                  >
                    <Card className={`bg-white shadow-sm border-2 transition-colors ${
                      selectedPaymentMethod === method.id 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${
                              selectedPaymentMethod === method.id ? 'bg-green-100' : 'bg-gray-100'
                            }`}>
                              {getPaymentMethodIcon(method)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  {getPaymentMethodDisplay(method)}
                                </span>
                                {method.isDefault && (
                                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                    Default
                                  </span>
                                )}
                              </div>
                              {getPaymentMethodSubtext(method) && (
                                <p className="text-sm text-gray-600">
                                  {getPaymentMethodSubtext(method)}
                                </p>
                              )}
                            </div>
                          </div>
                          {selectedPaymentMethod === method.id && (
                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>

        {/* Add New Payment Method */}
        <Card className="bg-white border-2 border-dashed border-gray-300 hover:border-green-500 transition-colors cursor-pointer">
          <CardContent className="p-4" onClick={() => navigate('/linked-cards')}>
            <div className="flex items-center justify-center gap-3 text-gray-600">
              <CreditCard className="w-5 h-5" />
              <span className="font-medium">Add New Payment Method</span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Button */}
        <div className="pt-6">
          <Button 
            onClick={handlePayment}
            disabled={isProcessing}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg font-semibold rounded-2xl"
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                Processing...
              </div>
            ) : (
              `Pay £${paymentDetails.amount.toFixed(2)}`
            )}
          </Button>
          
          <p className="text-xs text-gray-500 text-center mt-3">
            Your payment is secured and encrypted. You will be charged £{paymentDetails.amount.toFixed(2)} from your selected payment method.
          </p>
        </div>
      </div>
    </div>
  );
}
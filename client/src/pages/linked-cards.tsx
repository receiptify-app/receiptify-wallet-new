import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  CreditCard, 
  Plus, 
  Trash2,
  Apple,
  Smartphone
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/app-header";

interface PaymentMethod {
  id: string;
  type: 'credit_card' | 'apple_pay' | 'google_pay';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
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
    expiryMonth: 12,
    expiryYear: 2025,
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

export default function LinkedCards() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [cardForm, setCardForm] = useState({
    number: "",
    expiry: "",
    cvv: "",
    name: "",
    nickname: ""
  });

  const { data: paymentMethods = samplePaymentMethods, isLoading } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/payment-methods"],
  });

  const addCardMutation = useMutation({
    mutationFn: (cardData: any) => apiRequest("POST", "/api/payment-methods", cardData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      setIsAddingCard(false);
      setCardForm({ number: "", expiry: "", cvv: "", name: "", nickname: "" });
      toast({
        title: "Card Added",
        description: "Your payment method has been added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add payment method. Please try again.",
        variant: "destructive",
      });
    }
  });

  const removeCardMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/payment-methods/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      toast({
        title: "Card Removed",
        description: "Payment method has been removed",
      });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/payment-methods/${id}/set-default`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      toast({
        title: "Default Updated",
        description: "Default payment method has been updated",
      });
    },
  });

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    addCardMutation.mutate(cardForm);
  };

  const linkApplePay = () => {
    // In a real app, this would integrate with Apple Pay API
    const applePayMethod = {
      type: "apple_pay",
      nickname: "Apple Pay",
      isDefault: false
    };
    addCardMutation.mutate(applePayMethod);
  };

  const linkGooglePay = () => {
    // In a real app, this would integrate with Google Pay API
    const googlePayMethod = {
      type: "google_pay", 
      nickname: "Google Pay",
      isDefault: false
    };
    addCardMutation.mutate(googlePayMethod);
  };

  const getCardIcon = (method: PaymentMethod) => {
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

  const getCardDisplay = (method: PaymentMethod) => {
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AppHeader 
        showBackButton={true}
        onBackClick={() => navigate('/profile')}
        title="Linked Cards"
      />

      <div className="px-6 py-6 space-y-6">
        {/* Quick Link Options */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Quick Link</h3>
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={linkApplePay}
              disabled={addCardMutation.isPending}
              className="flex items-center gap-3 h-16 bg-black text-white hover:bg-gray-800"
            >
              <Apple className="w-6 h-6" />
              Apple Pay
            </Button>
            <Button
              onClick={linkGooglePay}
              disabled={addCardMutation.isPending}
              className="flex items-center gap-3 h-16 bg-blue-600 text-white hover:bg-blue-700"
            >
              <Smartphone className="w-6 h-6" />
              Google Pay
            </Button>
          </div>
        </div>

        {/* Existing Payment Methods */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Payment Methods</h3>
            <Dialog open={isAddingCard} onOpenChange={setIsAddingCard}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Card
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Credit Card</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddCard} className="space-y-4">
                  <div>
                    <Input
                      placeholder="Card Number"
                      value={cardForm.number}
                      onChange={(e) => setCardForm({ ...cardForm, number: e.target.value })}
                      maxLength={19}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      placeholder="MM/YY"
                      value={cardForm.expiry}
                      onChange={(e) => setCardForm({ ...cardForm, expiry: e.target.value })}
                      maxLength={5}
                      required
                    />
                    <Input
                      placeholder="CVV"
                      value={cardForm.cvv}
                      onChange={(e) => setCardForm({ ...cardForm, cvv: e.target.value })}
                      maxLength={4}
                      required
                    />
                  </div>
                  <Input
                    placeholder="Cardholder Name"
                    value={cardForm.name}
                    onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })}
                    required
                  />
                  <Input
                    placeholder="Nickname (optional)"
                    value={cardForm.nickname}
                    onChange={(e) => setCardForm({ ...cardForm, nickname: e.target.value })}
                  />
                  <Button 
                    type="submit" 
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={addCardMutation.isPending}
                  >
                    {addCardMutation.isPending ? "Adding..." : "Add Card"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <Card key={method.id} className="bg-white shadow-sm border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          {getCardIcon(method)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {getCardDisplay(method)}
                            </span>
                            {method.isDefault && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                Default
                              </span>
                            )}
                          </div>
                          {method.type === 'credit_card' && method.expiryMonth && method.expiryYear && (
                            <p className="text-sm text-gray-600">
                              Expires {method.expiryMonth.toString().padStart(2, '0')}/{method.expiryYear}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!method.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDefaultMutation.mutate(method.id)}
                            disabled={setDefaultMutation.isPending}
                            className="text-green-600 hover:text-green-700"
                          >
                            Set Default
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCardMutation.mutate(method.id)}
                          disabled={removeCardMutation.isPending}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
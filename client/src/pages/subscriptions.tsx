import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import AppHeader from "@/components/app-header";
import logoSrc from "@assets/2C508BEA-D169-4FDB-A1F9-0F6E333C1A18_1754620280792.png";

interface Subscription {
  id: string;
  serviceName: string;
  merchantName: string;
  amount: string;
  frequency: string;
  nextDate: string;
  lastChargedDate: string;
  status: string;
  isPaused: boolean;
  isActive: boolean;
  category: string;
  cancellationUrl?: string;
  manageUrl?: string;
  autoDetected: boolean;
}

// Sample subscription data to match the design
const sampleSubscriptions = [
  {
    id: "1",
    serviceName: "Netflix",
    logo: "N", 
    amount: "10.99",
    frequency: "month",
    status: "active",
    isActive: true,
    color: "#E50914",
    bgColor: "#E5091420"
  },
  {
    id: "2", 
    serviceName: "Spotify",
    logo: "♪", 
    amount: "10.99", 
    frequency: "month",
    status: "active",
    isActive: true,
    color: "#1DB954",
    bgColor: "#1DB95420"
  },
  {
    id: "3",
    serviceName: "Lloyds Gym",
    logo: "🏋️", 
    amount: "30.00",
    frequency: "month", 
    status: "active",
    isActive: true,
    color: "#006A4D",
    bgColor: "#006A4D20"
  }
];

export default function Subscriptions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data: subscriptions = sampleSubscriptions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/subscriptions"],
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/subscriptions/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription has been cancelled",
      });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AppHeader 
        showBackButton={true}
        onBackClick={() => navigate('/')}
        title="Subscription Tracker"
      />
      
      <div className="px-6 py-6">
        {/* Subscriptions List */}
        <div className="space-y-4">
          {subscriptions.map((subscription: any) => (
            <Card key={subscription.id} className="bg-white shadow-sm border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  {/* Left side - Logo and details */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white" style={{ backgroundColor: subscription.color }}>
                      {subscription.logo}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {subscription.serviceName}
                      </h3>
                      <p className="text-gray-600 font-medium">
                        £{subscription.amount} / {subscription.frequency}
                      </p>
                    </div>
                  </div>
                  
                  {/* Right side - Cancel button */}
                  <Button
                    onClick={() => cancelMutation.mutate(subscription.id)}
                    disabled={cancelMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-medium"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Add subscription button */}
          <Card className="bg-white border-2 border-dashed border-green-300 hover:border-green-500 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-center gap-3 text-green-700">
                <Plus className="h-6 w-6" />
                <span className="font-semibold">Add New Subscription</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
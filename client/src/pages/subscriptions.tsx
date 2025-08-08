import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, X, Search, Calendar, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export default function Subscriptions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDetecting, setIsDetecting] = useState(false);

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ["/api/subscriptions"],
  });

  const detectMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/subscriptions/detect"),
    onSuccess: (detectedSubs) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({
        title: "Subscriptions Detected",
        description: `Found ${detectedSubs.length} potential subscriptions`,
      });
      setIsDetecting(false);
    },
    onError: () => {
      toast({
        title: "Detection Failed",
        description: "Could not analyze receipts for subscriptions",
        variant: "destructive",
      });
      setIsDetecting(false);
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/subscriptions/${id}/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({
        title: "Subscription Paused",
        description: "You can resume it anytime",
      });
    },
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

  const handleDetectSubscriptions = () => {
    setIsDetecting(true);
    detectMutation.mutate();
  };

  const getStatusColor = (subscription: Subscription) => {
    if (!subscription.isActive) return "bg-gray-500";
    if (subscription.isPaused) return "bg-yellow-500";
    if (subscription.status === "active") return "bg-green-500";
    return "bg-blue-500";
  };

  const getStatusText = (subscription: Subscription) => {
    if (!subscription.isActive) return "Cancelled";
    if (subscription.isPaused) return "Paused";
    return subscription.status;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const totalMonthlySpend = subscriptions
    .filter((sub: Subscription) => sub.isActive && !sub.isPaused)
    .reduce((sum: number, sub: Subscription) => sum + parseFloat(sub.amount), 0);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-gray-600">Track and manage your recurring payments</p>
        </div>
        <Button 
          onClick={handleDetectSubscriptions}
          disabled={isDetecting}
          className="bg-green-600 hover:bg-green-700"
        >
          <Search className="h-4 w-4 mr-2" />
          {isDetecting ? "Detecting..." : "Detect New"}
        </Button>
      </div>

      {/* Monthly Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Monthly Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Active Subscriptions</p>
              <p className="text-2xl font-bold">{subscriptions.filter((s: Subscription) => s.isActive && !s.isPaused).length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Monthly Spend</p>
              <p className="text-2xl font-bold">£{totalMonthlySpend.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Paused/Cancelled</p>
              <p className="text-2xl font-bold">{subscriptions.filter((s: Subscription) => !s.isActive || s.isPaused).length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions List */}
      <div className="space-y-4">
        {subscriptions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Subscriptions Found</h3>
              <p className="text-gray-600 text-center mb-6">
                We'll automatically detect recurring payments from your receipts
              </p>
              <Button onClick={handleDetectSubscriptions} disabled={isDetecting}>
                <Search className="h-4 w-4 mr-2" />
                Scan Receipts for Subscriptions
              </Button>
            </CardContent>
          </Card>
        ) : (
          subscriptions.map((subscription: Subscription) => (
            <Card key={subscription.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                      <span className="text-green-700 font-bold text-lg">
                        {subscription.serviceName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <CardTitle className="text-lg">{subscription.serviceName}</CardTitle>
                      <CardDescription>{subscription.merchantName}</CardDescription>
                    </div>
                  </div>
                  <Badge 
                    className={`${getStatusColor(subscription)} text-white`}
                  >
                    {getStatusText(subscription)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Amount</p>
                    <p className="font-semibold">£{subscription.amount}/{subscription.frequency}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Next Payment</p>
                    <p className="font-semibold">{formatDate(subscription.nextDate)}</p>
                  </div>
                </div>

                {subscription.autoDetected && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Search className="h-4 w-4" />
                    Auto-detected from receipts
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  {subscription.isActive && !subscription.isPaused && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pauseMutation.mutate(subscription.id)}
                      disabled={pauseMutation.isPending}
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </Button>
                  )}
                  
                  {subscription.isPaused && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pauseMutation.mutate(subscription.id)}
                      disabled={pauseMutation.isPending}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                  )}

                  {subscription.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cancelMutation.mutate(subscription.id)}
                      disabled={cancelMutation.isPending}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  )}

                  {subscription.manageUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(subscription.manageUrl, '_blank')}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Manage
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
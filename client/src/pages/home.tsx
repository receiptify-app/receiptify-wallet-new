import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight, Menu, Leaf, CreditCard } from "lucide-react";
import { useLocation } from "wouter";
import AppHeader from "@/components/app-header";

// Category colors
const categoryColors: { [key: string]: string } = {
  "Food": "#4CAF50",
  "Tech": "#FFC107",
  "Transport": "#9C27B0",
  "Shopping": "#2196F3",
  "Other": "#757575",
};

// Merchant logo letters/icons
const merchantLogos: { [key: string]: string } = {
  "Waitrose": "W",
  "Argos": "A",
  "Shell": "🛢️",
  "Tesco": "T",
  "BP": "BP",
};

const merchantColors: { [key: string]: string } = {
  "Waitrose": "#1B5E20",
  "Argos": "#D32F2F",
  "Shell": "#FF9800",
  "Tesco": "#0050AA",
  "BP": "#00843D",
};

interface AnalyticsData {
  period: string;
  total: number;
  categories: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  receipts: Array<{
    id: string;
    merchant: string;
    amount: string;
    date: string;
    category: string;
  }>;
}

export default function Home() {
  const [selectedPeriod, setSelectedPeriod] = useState("This month");
  const [, navigate] = useLocation();

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics/spending"],
  });

  if (isLoading || !analytics) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const spendingData = analytics.categories.map(cat => ({
    category: cat.category,
    amount: cat.amount,
    color: categoryColors[cat.category] || categoryColors["Other"],
  }));

  const recentActivity = analytics.receipts
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3)
    .map(receipt => ({
      id: receipt.id,
      merchant: receipt.merchant,
      logo: merchantLogos[receipt.merchant] || receipt.merchant[0],
      amount: receipt.amount,
      date: new Date(receipt.date).toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      }),
      color: merchantColors[receipt.merchant] || categoryColors[receipt.category || "Other"],
    }));

  const totalSpending = analytics.total;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AppHeader />

      <div className="px-6 py-4 space-y-6">
        {/* Spending Summary */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" className="flex items-center gap-2 text-gray-700">
              {selectedPeriod}
              <ChevronDown className="h-4 w-4" />
            </Button>
            <h2 className="text-4xl font-bold text-gray-900">£{totalSpending.toFixed(0)}</h2>
          </div>
        </div>

        {/* Spending Chart Card */}
        <Card className="bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-center mb-6">
              {/* Simple donut chart representation */}
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="10"
                  />
                  {/* Food segment - largest */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#4CAF50"
                    strokeWidth="10"
                    strokeDasharray={`${(17.20/122.19) * 251.33} 251.33`}
                    strokeDashoffset="0"
                  />
                  {/* Transport segment */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#9C27B0"
                    strokeWidth="10"
                    strokeDasharray={`${(103.00/122.19) * 251.33} 251.33`}
                    strokeDashoffset={`-${(17.20/122.19) * 251.33}`}
                  />
                  {/* Tech segment - smallest */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#FFC107"
                    strokeWidth="10"
                    strokeDasharray={`${(1.99/122.19) * 251.33} 251.33`}
                    strokeDashoffset={`-${((17.20+103.00)/122.19) * 251.33}`}
                  />
                </svg>
              </div>
            </div>
            
            {/* Category breakdown */}
            <div className="space-y-3">
              {spendingData.map((item) => (
                <div key={item.category} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-gray-900 font-medium">{item.category}</span>
                  </div>
                  <span className="font-semibold text-gray-900">£{item.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="space-y-3">
          <Card className="bg-white shadow-sm cursor-pointer" onClick={() => navigate('/eco')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <Leaf className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="text-gray-900 font-medium">Eco Points</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">40</span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm cursor-pointer" onClick={() => navigate('/cards')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-gray-900 font-medium">Loyalty usage</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">6x uses</span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <Card key={activity.id} className="bg-white shadow-sm cursor-pointer" onClick={() => navigate(`/receipt/${activity.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: activity.color }}
                      >
                        {activity.logo}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{activity.merchant}</h4>
                        <p className="text-sm text-gray-600">{activity.date}</p>
                      </div>
                    </div>
                    <span className="font-bold text-gray-900">£{activity.amount}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
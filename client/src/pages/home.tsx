import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight, Menu, Leaf, CreditCard } from "lucide-react";

// Sample data to match the design
const spendingData = [
  { category: "Food", amount: 17.20, color: "#4CAF50" },
  { category: "Tech", amount: 1.99, color: "#FFC107" },
  { category: "Transport", amount: 103.00, color: "#9C27B0" }
];

const recentActivity = [
  {
    id: "1",
    merchant: "Waitrose",
    logo: "W", // Placeholder for Waitrose logo
    amount: "12.02",
    date: "12 July 2025",
    color: "#1B5E20"
  },
  {
    id: "2", 
    merchant: "Argos",
    logo: "A", // Placeholder for Argos logo
    amount: "59.99",
    date: "25 June 2025", 
    color: "#D32F2F"
  },
  {
    id: "3",
    merchant: "Shell", 
    logo: "🛢️", // Shell icon
    amount: "23.80",
    date: "22 June 2025",
    color: "#FF9800"
  }
];

export default function Home() {
  const [selectedPeriod, setSelectedPeriod] = useState("This month");

  const totalSpending = spendingData.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">OneTap</h1>
        <Button variant="ghost" size="sm">
          <Menu className="h-5 w-5 text-gray-600" />
        </Button>
      </div>

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
          <Card className="bg-white shadow-sm">
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

          <Card className="bg-white shadow-sm">
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
              <Card key={activity.id} className="bg-white shadow-sm">
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
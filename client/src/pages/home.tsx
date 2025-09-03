import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight, Menu, Leaf, CreditCard, Scan, BarChart3, Shield, Smartphone } from "lucide-react";
import { useLocation } from "wouter";
import AppHeader from "@/components/app-header";

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
  const [, navigate] = useLocation();

  const totalSpending = spendingData.reduce((sum, item) => sum + item.amount, 0);

  return (
    <>
      <div className="min-h-screen tech-bg subtle-grid pb-24 relative">
        <AppHeader />

        <div className="px-6 py-4 space-y-6">
          {/* Spending Summary */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" className="flex items-center gap-2 text-gray-300 hover:text-accent-text">
                {selectedPeriod}
                <ChevronDown className="h-4 w-4" />
              </Button>
              <h2 className="text-4xl font-bold accent-text glow-text mono-text">£{totalSpending.toFixed(0)}</h2>
            </div>
          </div>

          {/* Spending Chart Card */}
          <Card className="tech-card shadow-lg border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-center mb-6">
                {/* Simple donut chart */}
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
                      <span className="text-gray-300 font-medium">{item.category}</span>
                    </div>
                    <span className="font-semibold accent-text">£{item.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="space-y-3">
            <Card className="tech-card shadow-sm cursor-pointer" onClick={() => navigate('/eco')}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg" style={{boxShadow: '0 0 20px rgba(34,197,94,0.4)'}}>
                      <Leaf className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-gray-300 font-medium">Eco Points</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold accent-text">40</span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="tech-card shadow-sm cursor-pointer" onClick={() => navigate('/cards')}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center shadow-lg" style={{boxShadow: '0 0 20px rgba(0,229,255,0.4)'}}>
                      <CreditCard className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-gray-300 font-medium">Loyalty usage</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold accent-text">6x uses</span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div>
            <h3 className="text-xl font-bold text-gray-300 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <Card key={activity.id} className="tech-card shadow-sm cursor-pointer" onClick={() => navigate('/receipt/1')}>
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
                          <h4 className="font-semibold text-gray-300">{activity.merchant}</h4>
                          <p className="text-sm text-gray-400">{activity.date}</p>
                        </div>
                      </div>
                      <span className="font-bold accent-text">£{activity.amount}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* App Features Section */}
          <div className="mt-8">
            <h3 className="text-xl font-bold text-gray-300 mb-4">App Features</h3>
            <div className="feature-grid">
              <Card className="tech-card shadow-sm cursor-pointer" onClick={() => navigate('/scan')}>
                <CardContent className="p-4 text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Scan className="h-6 w-6 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-300 mb-2">QR Scanner</h4>
                  <p className="text-sm text-gray-400">Instantly capture receipts with QR codes</p>
                </CardContent>
              </Card>

              <Card className="tech-card shadow-sm cursor-pointer" onClick={() => navigate('/analytics')}>
                <CardContent className="p-4 text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-300 mb-2">Analytics</h4>
                  <p className="text-sm text-gray-400">Track spending patterns and insights</p>
                </CardContent>
              </Card>

              <Card className="tech-card shadow-sm cursor-pointer" onClick={() => navigate('/eco')}>
                <CardContent className="p-4 text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Leaf className="h-6 w-6 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-300 mb-2">Eco Impact</h4>
                  <p className="text-sm text-gray-400">Track your environmental savings</p>
                </CardContent>
              </Card>

              <Card className="tech-card shadow-sm cursor-pointer" onClick={() => navigate('/warranties')}>
                <CardContent className="p-4 text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-300 mb-2">Warranties</h4>
                  <p className="text-sm text-gray-400">Never miss warranty expiration dates</p>
                </CardContent>
              </Card>

              <Card className="tech-card shadow-sm cursor-pointer" onClick={() => navigate('/cards')}>
                <CardContent className="p-4 text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CreditCard className="h-6 w-6 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-300 mb-2">Loyalty Cards</h4>
                  <p className="text-sm text-gray-400">Store all your loyalty cards digitally</p>
                </CardContent>
              </Card>

              <Card className="tech-card shadow-sm cursor-pointer" onClick={() => navigate('/manual')}>
                <CardContent className="p-4 text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Smartphone className="h-6 w-6 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-300 mb-2">Manual Entry</h4>
                  <p className="text-sm text-gray-400">Add receipts manually with camera</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
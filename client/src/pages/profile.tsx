import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { 
  CreditCard, 
  Star, 
  Bell, 
  Euro, 
  ChevronRight,
  RefreshCw,
  Download
} from "lucide-react";
import { useLocation } from "wouter";
import AppHeader from "@/components/app-header";

// Sample user data matching the mockup
const sampleUser = {
  name: "Alex Green",
  email: "alex.green@email.com",
  avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
};

export default function Profile() {
  const [, navigate] = useLocation();
  const [darkMode, setDarkMode] = useState(false);
  const [gbpCurrency, setGbpCurrency] = useState(true);

  const { data: user = sampleUser } = useQuery<typeof sampleUser>({
    queryKey: ["/api/user"],
    retry: false,
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AppHeader 
        showBackButton={true}
        onBackClick={() => navigate('/')}
        title="Settings"
      />

      <div className="px-6 py-6 space-y-8">
        {/* User Profile Section */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200">
                  <img 
                    src={user.avatar} 
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
                  <p className="text-gray-600">{user.email}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        {/* Dark Mode */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Dark Mode</h3>
              <Switch 
                checked={darkMode}
                onCheckedChange={setDarkMode}
                className="data-[state=checked]:bg-green-600"
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment & Loyalty Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Payment & Loyalty</h3>
          <div className="space-y-3">
            <Card className="bg-white shadow-sm border-0 cursor-pointer" onClick={() => navigate('/linked-cards')}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CreditCard className="w-6 h-6 text-gray-700" />
                    <span className="text-lg font-medium text-gray-900">Linked Cards</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-sm border-0 cursor-pointer" onClick={() => navigate('/cards')}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Star className="w-6 h-6 text-gray-700" />
                    <span className="text-lg font-medium text-gray-900">Linked Loyalty Cards</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* App Preferences Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4">App Preferences</h3>
          <div className="space-y-3">
            <Card className="bg-white shadow-sm border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Bell className="w-6 h-6 text-gray-700" />
                    <span className="text-lg font-medium text-gray-900">Notifications</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-sm border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Euro className="w-6 h-6 text-gray-700" />
                    <div>
                      <span className="text-lg font-medium text-gray-900">Currency</span>
                      <p className="text-sm text-gray-600">£ GBP</p>
                    </div>
                  </div>
                  <Switch 
                    checked={gbpCurrency}
                    onCheckedChange={setGbpCurrency}
                    className="data-[state=checked]:bg-green-600"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-sm border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <RefreshCw className="w-6 h-6 text-gray-700" />
                    <span className="text-lg font-medium text-gray-900">Auto-Categorise</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">ON</span>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Receipts Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Receipts</h3>
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Download className="w-6 h-6 text-gray-700" />
                  <span className="text-lg font-medium text-gray-900">Export Receipts</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Settings, 
  Bell, 
  Download, 
  Share2, 
  Shield, 
  HelpCircle,
  ChevronRight,
  Calendar,
  Receipt,
  Clock
} from "lucide-react";
import type { Subscription, Warranty } from "@shared/schema";

export default function Profile() {
  const [notifications, setNotifications] = useState({
    receipts: true,
    eco: true,
    warranties: false,
    subscriptions: true,
  });

  const { data: subscriptions = [] } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
  });

  const { data: warranties = [] } = useQuery<Warranty[]>({
    queryKey: ["/api/warranties"],
  });

  const activeSubscriptions = subscriptions.filter(sub => sub.isActive);
  const activeWarranties = warranties.filter(warranty => warranty.isActive);

  return (
    <div className="px-6 py-4 pb-24">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary mb-2">Profile</h1>
        <p className="text-gray-600">Manage your account and preferences</p>
      </div>

      {/* User Info */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Demo User</h2>
              <p className="text-gray-600">demo@receiptify.com</p>
              <Badge variant="secondary" className="mt-1 bg-accent/10 text-accent">
                Premium Member
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <Receipt className="w-6 h-6 text-primary mx-auto mb-2" />
            <div className="text-lg font-bold text-gray-900">47</div>
            <div className="text-xs text-gray-600">Total Receipts</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 text-accent mx-auto mb-2" />
            <div className="text-lg font-bold text-gray-900">{activeSubscriptions.length}</div>
            <div className="text-xs text-gray-600">Subscriptions</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
            <div className="text-lg font-bold text-gray-900">{activeWarranties.length}</div>
            <div className="text-xs text-gray-600">Warranties</div>
          </CardContent>
        </Card>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Bell className="w-5 h-5 mr-2" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">New Receipts</div>
                <div className="text-sm text-gray-600">Get notified when receipts are shared</div>
              </div>
              <Switch 
                checked={notifications.receipts}
                onCheckedChange={(checked) => 
                  setNotifications(prev => ({ ...prev, receipts: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Eco Milestones</div>
                <div className="text-sm text-gray-600">Celebrate your environmental achievements</div>
              </div>
              <Switch 
                checked={notifications.eco}
                onCheckedChange={(checked) => 
                  setNotifications(prev => ({ ...prev, eco: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Warranty Expiry</div>
                <div className="text-sm text-gray-600">Reminders before warranties expire</div>
              </div>
              <Switch 
                checked={notifications.warranties}
                onCheckedChange={(checked) => 
                  setNotifications(prev => ({ ...prev, warranties: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Subscription Alerts</div>
                <div className="text-sm text-gray-600">Upcoming subscription renewals</div>
              </div>
              <Switch 
                checked={notifications.subscriptions}
                onCheckedChange={(checked) => 
                  setNotifications(prev => ({ ...prev, subscriptions: checked }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Data & Privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Data & Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-between">
              <div className="flex items-center">
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </div>
              <ChevronRight className="w-4 h-4" />
            </Button>

            <Button variant="outline" className="w-full justify-between">
              <div className="flex items-center">
                <Share2 className="w-4 h-4 mr-2" />
                Data Sharing Settings
              </div>
              <ChevronRight className="w-4 h-4" />
            </Button>

            <Button variant="outline" className="w-full justify-between">
              <div className="flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                Privacy Settings
              </div>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Support */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <HelpCircle className="w-5 h-5 mr-2" />
              Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-between">
              <span>Help Center</span>
              <ChevronRight className="w-4 h-4" />
            </Button>

            <Button variant="outline" className="w-full justify-between">
              <span>Contact Support</span>
              <ChevronRight className="w-4 h-4" />
            </Button>

            <Button variant="outline" className="w-full justify-between">
              <span>Privacy Policy</span>
              <ChevronRight className="w-4 h-4" />
            </Button>

            <Button variant="outline" className="w-full justify-between">
              <span>Terms of Service</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

        {/* App Info */}
        <Card className="bg-light-green border-accent/20">
          <CardContent className="p-4 text-center">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-3">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-primary mb-1">Receiptify</h3>
            <p className="text-sm text-gray-600 mb-3">One Scan. Zero Paper.</p>
            <p className="text-xs text-gray-500">Version 1.0.0</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

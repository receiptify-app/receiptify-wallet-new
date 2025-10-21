import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useTranslation } from 'react-i18next';
import { 
  Home, 
  QrCode, 
  CreditCard, 
  Leaf, 
  MapPin,
  User,
  RefreshCw,
  Shield,
  Receipt,
  BarChart3
} from "lucide-react";

export default function BottomNavigation() {
  const [location] = useLocation();
  const { t } = useTranslation();
  
  const navItems = [
    { path: "/", icon: QrCode, label: t('nav.scan') },
    { path: "/analytics", icon: BarChart3, label: t('nav.analytics') },
    { path: "/receipts", icon: Receipt, label: t('nav.receipts') },
    { path: "/profile", icon: User, label: t('nav.account') },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
      <div className="max-w-sm mx-auto">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const IconComponent = item.icon;
            
            return (
              <Link key={item.path} href={item.path}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex flex-col items-center py-2 px-4 h-auto ${
                    isActive 
                      ? "text-primary" 
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <IconComponent className={`w-5 h-5 mb-1 ${isActive ? "text-primary" : "text-gray-400"}`} />
                  <span className={`text-xs font-medium ${isActive ? "text-primary" : "text-gray-400"}`}>
                    {item.label}
                  </span>
                </Button>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

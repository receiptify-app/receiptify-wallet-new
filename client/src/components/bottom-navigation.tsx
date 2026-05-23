import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useTranslation } from 'react-i18next';
import {
  QrCode,
  User,
  Receipt,
  BarChart3,
  Users,
} from "lucide-react";

export default function BottomNavigation() {
  const [location] = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { path: "/", icon: QrCode, label: t('nav.scan') },
    { path: "/analytics", icon: BarChart3, label: t('nav.analytics') },
    { path: "/receipts", icon: Receipt, label: t('nav.receipts') },
    { path: "/split", icon: Users, label: t('nav.split') },
    { path: "/profile", icon: User, label: t('nav.account') },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
      <div className="max-w-sm mx-auto">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const isActive =
              item.path === "/"
                ? location === "/" || location === "/scan"
                : location === item.path || location.startsWith(item.path + "/");
            const IconComponent = item.icon;

            return (
              <Link key={item.path} href={item.path}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex flex-col items-center py-2 px-3 h-auto ${
                    isActive
                      ? "text-primary"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                  data-testid={`nav-${item.path.replace(/\//g, '') || 'scan'}`}
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

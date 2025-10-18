import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from 'react-i18next';
import { 
  Bell, 
  Euro, 
  ChevronRight,
  RefreshCw,
  Download,
  Receipt,
  LogOut,
  Languages
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/app-header";

// Sample user data matching the mockup
const sampleUser = {
  name: "Alex Green",
  email: "alex.green@email.com",
  avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
};

export default function Profile() {
  const [, navigate] = useLocation();
  const [gbpCurrency, setGbpCurrency] = useState(true);
  const { currentUser, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
  
  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const { data: user = sampleUser } = useQuery<typeof sampleUser>({
    queryKey: ["/api/user"],
    retry: false,
  });

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Use Firebase user data if available, fallback to sample data
  const displayUser = currentUser ? {
    name: currentUser.displayName || currentUser.email?.split('@')[0] || "User",
    email: currentUser.email || "user@example.com",
    avatar: currentUser.photoURL || sampleUser.avatar
  } : user;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AppHeader 
        showBackButton={true}
        onBackClick={() => navigate('/')}
        title={t('app.title').toUpperCase()}
      />

      <div className="px-6 py-6 space-y-8">
        {/* User Profile Section */}
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200">
                  <img 
                    src={displayUser.avatar} 
                    alt={displayUser.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{displayUser.name}</h2>
                  <p className="text-gray-600">{displayUser.email}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        {/* My Data Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4">{t('profile.myData')}</h3>
          <div className="space-y-3">
            <Card className="bg-white shadow-sm border-0 cursor-pointer" onClick={() => navigate('/receipts')}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Receipt className="w-6 h-6 text-gray-700" />
                    <span className="text-lg font-medium text-gray-900">{t('profile.receiptsOrders')}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* App Preferences Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4">{t('profile.appPreferences')}</h3>
          <div className="space-y-3">
            <Card className="bg-white shadow-sm border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Bell className="w-6 h-6 text-gray-700" />
                    <span className="text-lg font-medium text-gray-900">{t('profile.notifications')}</span>
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
                      <span className="text-lg font-medium text-gray-900">{t('profile.currency')}</span>
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
                    <Languages className="w-6 h-6 text-gray-700" />
                    <div className="flex-1">
                      <span className="text-lg font-medium text-gray-900 block mb-2">{t('profile.language')}</span>
                      <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                        <SelectTrigger className="w-full" data-testid="select-language">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Español (Spanish)</SelectItem>
                          <SelectItem value="fr">Français (French)</SelectItem>
                          <SelectItem value="de">Deutsch (German)</SelectItem>
                          <SelectItem value="it">Italiano (Italian)</SelectItem>
                          <SelectItem value="pt">Português (Portuguese)</SelectItem>
                          <SelectItem value="nl">Nederlands (Dutch)</SelectItem>
                          <SelectItem value="pl">Polski (Polish)</SelectItem>
                          <SelectItem value="ru">Русский (Russian)</SelectItem>
                          <SelectItem value="ja">日本語 (Japanese)</SelectItem>
                          <SelectItem value="zh">中文 (Chinese)</SelectItem>
                          <SelectItem value="ko">한국어 (Korean)</SelectItem>
                          <SelectItem value="ar">العربية (Arabic)</SelectItem>
                          <SelectItem value="hi">हिन्दी (Hindi)</SelectItem>
                          <SelectItem value="tr">Türkçe (Turkish)</SelectItem>
                          <SelectItem value="sv">Svenska (Swedish)</SelectItem>
                          <SelectItem value="no">Norsk (Norwegian)</SelectItem>
                          <SelectItem value="da">Dansk (Danish)</SelectItem>
                          <SelectItem value="fi">Suomi (Finnish)</SelectItem>
                          <SelectItem value="el">Ελληνικά (Greek)</SelectItem>
                          <SelectItem value="cs">Čeština (Czech)</SelectItem>
                          <SelectItem value="hu">Magyar (Hungarian)</SelectItem>
                          <SelectItem value="ro">Română (Romanian)</SelectItem>
                          <SelectItem value="th">ไทย (Thai)</SelectItem>
                          <SelectItem value="vi">Tiếng Việt (Vietnamese)</SelectItem>
                          <SelectItem value="id">Bahasa Indonesia (Indonesian)</SelectItem>
                          <SelectItem value="ms">Bahasa Melayu (Malay)</SelectItem>
                          <SelectItem value="uk">Українська (Ukrainian)</SelectItem>
                          <SelectItem value="he">עברית (Hebrew)</SelectItem>
                          <SelectItem value="bn">বাংলা (Bengali)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-sm border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <RefreshCw className="w-6 h-6 text-gray-700" />
                    <span className="text-lg font-medium text-gray-900">{t('profile.autoCategorize')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{t('common.on')}</span>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Export Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4">{t('profile.data')}</h3>
          <div className="space-y-3">
            <Card className="bg-white shadow-sm border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Download className="w-6 h-6 text-gray-700" />
                    <span className="text-lg font-medium text-gray-900">{t('profile.exportReceipts')}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Logout Section */}
        <div>
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-6">
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full h-12 text-red-600 border-red-200 hover:bg-red-50"
              >
                <LogOut className="w-5 h-5 mr-3" />
                {t('profile.signOut')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
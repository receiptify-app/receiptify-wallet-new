import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Languages,
  Shield,
  Pencil
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/app-header";
import { useCurrency } from "@/hooks/use-currency";
import { CURRENCIES } from "@/lib/currency";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";


export default function Profile() {
  const [, navigate] = useLocation();
  const { currentUser, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
  const { currency, symbol, updateCurrency } = useCurrency();
  const [showEditName, setShowEditName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const { toast } = useToast();
  
  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const handleCurrencyChange = (currencyCode: string) => {
    updateCurrency(currencyCode);
  };

  const updateDisplayNameMutation = useMutation({
    mutationFn: async (displayName: string) => {
      const res = await apiRequest("PATCH", "/api/user/display-name", { displayName });
      return res.json();
    },
    onSuccess: (_, displayName) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.refetchQueries({ queryKey: ["/api/user"] });
      setShowEditName(false);
      toast({ title: "Display name updated", description: "Your display name has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update display name.", variant: "destructive" });
    },
  });

  const { data: apiUser } = useQuery<{ id: string; email: string; name: string; username: string | null; authProvider: string | null; avatar: string | null }>({
    queryKey: ["/api/user"],
    retry: false,
  });
  const [receiptsList, setReceiptsList] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/receipts");
        const data = await res.json();
        if (mounted) setReceiptsList(data || []);
      } catch (e) {
        console.error("Failed to load receipts for export:", e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadReceipt = async (r: any) => {
    if (!r?.imageUrl) return;
    try {
      const { imageToPdfBlob } = await import("@/lib/image-to-pdf");
      const safeName = (r.merchantName || "receipt").replace(/[^\w-_]/g, "_");
      const pdfBlob = await imageToPdfBlob(r.imageUrl, safeName);
      downloadBlob(pdfBlob, `${safeName}_${r.id || ""}.pdf`);
    } catch (e) {
      console.error("Download receipt failed:", e);
    }
  };

  const downloadAllAsZip = async () => {
    if (!receiptsList.length) return;
    try {
      const { imageToPdfBlob } = await import("@/lib/image-to-pdf");
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const r of receiptsList) {
        if (!r.imageUrl) continue;
        try {
          const safeName = (r.merchantName || "receipt").replace(/[^\w-_]/g, "_");
          const pdfBlob = await imageToPdfBlob(r.imageUrl, safeName);
          zip.file(`${safeName}_${r.id || ""}.pdf`, pdfBlob);
        } catch (e) {
          console.warn("Skipping receipt in ZIP due to error:", r.id, e);
        }
      }
      const content = await zip.generateAsync({ type: "blob" });
      downloadBlob(content, `receipts_${new Date().toISOString().slice(0,10)}.zip`);
    } catch (e) {
      console.error("Failed to create ZIP:", e);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Use API user data (from our database) with Firebase fallback
  const displayUser = {
    name: apiUser?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || "User",
    email: apiUser?.email || currentUser?.email || "user@example.com",
    username: apiUser?.authProvider === 'local' ? (apiUser?.username || null) : null,
  };

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
            <div className="flex items-center gap-3">
              {/* Name + email */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className={`font-bold text-gray-900 truncate ${
                    displayUser.name.length > 20 ? 'text-sm' :
                    displayUser.name.length > 14 ? 'text-base' : 'text-xl'
                  }`}>{displayUser.name}</h2>
                  <button
                    onClick={() => { setEditNameValue(displayUser.name); setShowEditName(true); }}
                    className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </div>
                <p className="text-gray-600 text-sm truncate">{displayUser.email}</p>
                {displayUser.username && (
                  <p className="text-gray-400 text-xs mt-0.5">@{displayUser.username}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Display Name Dialog */}
        <Dialog open={showEditName} onOpenChange={setShowEditName}>
          <DialogContent className="mx-4 rounded-2xl">
            <DialogHeader>
              <DialogTitle>Edit Display Name</DialogTitle>
              <DialogDescription>Enter the name you want to show on your profile.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Input
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                placeholder="Your display name"
                maxLength={40}
                onKeyDown={(e) => { if (e.key === 'Enter' && editNameValue.trim()) updateDisplayNameMutation.mutate(editNameValue); }}
              />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowEditName(false)}>Cancel</Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  disabled={!editNameValue.trim() || updateDisplayNameMutation.isPending}
                  onClick={() => updateDisplayNameMutation.mutate(editNameValue)}
                >
                  {updateDisplayNameMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
                    <div className="flex-1">
                      <span className="text-lg font-medium text-gray-900 block mb-2">{t('profile.currency')}</span>
                      <Select value={currency} onValueChange={handleCurrencyChange}>
                        <SelectTrigger className="w-full" data-testid="select-currency">
                          <SelectValue placeholder={t('profile.selectCurrency')} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {CURRENCIES.map((curr) => (
                            <SelectItem key={curr.code} value={curr.code}>
                              {curr.symbol} {curr.code} - {curr.name}
                            </SelectItem>
                          ))}
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
                    <Languages className="w-6 h-6 text-gray-700" />
                    <div className="flex-1">
                      <span className="text-lg font-medium text-gray-900 block mb-2">{t('profile.language')}</span>
                      <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                        <SelectTrigger className="w-full" data-testid="select-language">
                          <SelectValue placeholder={t('profile.selectLanguage')} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Español (Spanish)</SelectItem>
                          <SelectItem value="fr">Français (French)</SelectItem>
                          <SelectItem value="de">Deutsch (German)</SelectItem>
                          {/* <SelectItem value="it">Italiano (Italian)</SelectItem>
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
                          <SelectItem value="bn">বাংলা (Bengali)</SelectItem> */}
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

        {/* Warranties - commented out for now
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4">{t('profile.warranties') || 'Warranties'}</h3>
          <div className="space-y-3">
            <Card className="bg-white shadow-sm border-0 cursor-pointer" onClick={() => navigate('/warranties')}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Shield className="w-6 h-6 text-emerald-600" />
                    <div>
                      <div className="text-lg font-medium text-gray-900">{t('profile.manageWarranties') || 'Manage Warranties'}</div>
                      <div className="text-sm text-gray-500">{t('profile.manageWarrantiesDesc') || 'Track and manage your product warranties'}</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        */}

        {/* Export (link to dedicated Export page) */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4">{t('profile.data')}</h3>
          <div className="space-y-3">
            <Card className="bg-white shadow-sm border-0 cursor-pointer" onClick={() => navigate('/exports')}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Download className="w-6 h-6 text-gray-700" />
                    <div>
                      <div className="text-lg font-medium text-gray-900">{t('profile.exportReceipts')}</div>
                      <div className="text-sm text-gray-500">{t('profile.exportReceiptsDesc')}</div>
                    </div>
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
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Edit, Camera, Upload, Languages } from "lucide-react";
import ManualReceiptForm from "@/components/manual-receipt-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Scan() {
  const [showManualForm, setShowManualForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      console.log('Starting upload for file:', file.name, file.size, 'bytes');
      const formData = new FormData();
      formData.append('receipt', file);
      
      // Skip location for faster upload
      console.log('Uploading without location to speed up process...');
      
      try {
        const response = await fetch('/api/receipts/upload', {
          method: 'POST',
          body: formData,
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Upload failed:', response.status, errorText);
          throw new Error('Upload failed');
        }
        
        const result = await response.json();
        console.log('Upload successful:', result);
        return result;
      } catch (error) {
        console.error('Fetch error:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('Receipt created successfully:', data.id);
      
      // Reset file inputs
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      
      toast({
        title: t('scan.uploadSuccess'),
        description: t('scan.uploadSuccessDesc'),
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
    },
    onError: (error) => {
      console.error('Upload mutation error:', error);
      
      // Reset file inputs even on error
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      
      toast({
        title: t('scan.uploadError'),
        description: t('scan.uploadErrorDesc'),
        variant: "destructive",
      });
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('File selected:', file?.name, file?.size);
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  return (
    <div className="px-6 py-4 pb-24">
      {/* App Title Header */}
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-green-800 mb-1">{t('app.title')}</h1>
        <p className="text-sm text-gray-600 mb-3">{t('app.subtitle')}</p>
        
        {/* Language Selector - Small Dropdown */}
        <div className="flex justify-center">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
            <Languages className="w-3.5 h-3.5 text-gray-600" />
            <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-[100px] h-6 text-xs border-0 focus:ring-0 p-0" data-testid="select-language-scan">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="it">Italiano</SelectItem>
                <SelectItem value="pt">Português</SelectItem>
                <SelectItem value="nl">Nederlands</SelectItem>
                <SelectItem value="pl">Polski</SelectItem>
                <SelectItem value="ru">Русский</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="ko">한국어</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="hi">हिन्दी</SelectItem>
                <SelectItem value="tr">Türkçe</SelectItem>
                <SelectItem value="sv">Svenska</SelectItem>
                <SelectItem value="no">Norsk</SelectItem>
                <SelectItem value="da">Dansk</SelectItem>
                <SelectItem value="fi">Suomi</SelectItem>
                <SelectItem value="el">Ελληνικά</SelectItem>
                <SelectItem value="cs">Čeština</SelectItem>
                <SelectItem value="hu">Magyar</SelectItem>
                <SelectItem value="ro">Română</SelectItem>
                <SelectItem value="th">ไทย</SelectItem>
                <SelectItem value="vi">Tiếng Việt</SelectItem>
                <SelectItem value="id">Bahasa Indonesia</SelectItem>
                <SelectItem value="ms">Bahasa Melayu</SelectItem>
                <SelectItem value="uk">Українська</SelectItem>
                <SelectItem value="he">עברית</SelectItem>
                <SelectItem value="bn">বাংলা</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Section Header */}
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold text-primary mb-2">Add Receipt</h2>
        <p className="text-sm text-gray-600">Capture, upload or enter receipt details</p>
      </div>

      {/* Scan Options */}
      <div className="space-y-4 mb-8">
        {/* Camera Capture Option */}
        <Card className="hover:shadow-md transition-shadow border-2 border-primary" data-testid="card-camera-capture">
          <CardContent className="p-0">
            <label className="block w-full cursor-pointer">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploadMutation.isPending}
                data-testid="input-camera-capture"
              />
              <div className="flex items-center space-x-4 py-6 px-6 hover:bg-primary/5 rounded-lg transition-colors">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Camera className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-lg text-gray-900" data-testid="text-camera-title">
                    {uploadMutation.isPending ? "Processing..." : "Take Photo"}
                  </div>
                  <div className="text-sm text-gray-600">
                    Capture receipt with camera
                  </div>
                </div>
              </div>
            </label>
          </CardContent>
        </Card>

        {/* Gallery Upload Option */}
        <Card className="hover:shadow-md transition-shadow" data-testid="card-gallery-upload">
          <CardContent className="p-0">
            <label className="block w-full cursor-pointer">
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploadMutation.isPending}
                data-testid="input-gallery-upload"
              />
              <div className="flex items-center space-x-4 py-6 px-6 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-700" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-lg text-gray-900" data-testid="text-upload-title">
                    {uploadMutation.isPending ? "Processing..." : "Upload from Gallery"}
                  </div>
                  <div className="text-sm text-gray-600">
                    Choose existing photo from device
                  </div>
                </div>
              </div>
            </label>
          </CardContent>
        </Card>

        {/* Manual Entry Option */}
        <Card className="hover:shadow-md transition-shadow border-2 border-green-200" data-testid="card-manual-entry">
          <CardContent className="p-0">
            <Button
              onClick={() => setShowManualForm(true)}
              className="w-full h-full bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center justify-start p-6"
              data-testid="button-manual-entry"
            >
              <div className="flex items-center justify-center space-x-4 w-full">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Edit className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4 text-left">
                  <div className="font-semibold text-lg text-white">Import Receipt</div>
                  <div className="text-sm text-white/90">Enter receipt information manually</div>
                </div>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Information Section */}
      <Card className="bg-light-green border-accent/20">
        <CardContent className="p-6">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-primary mb-1">Smart Receipt Processing</h3>
              <p className="text-sm text-gray-700 mb-3">
                Your receipts, one digital wallet. Receipts organised your way.
              </p>
              <div className="text-xs text-gray-600 space-y-1">
                <div>✓ Automatic data extraction from photos</div>
                <div>✓ Secure image + data storage</div>
                <div>✓ Simplified management</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Receipt Form */}
      <ManualReceiptForm 
        open={showManualForm} 
        onOpenChange={setShowManualForm}
      />
    </div>
  );
}

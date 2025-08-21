import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Palette, Layout, Type, Eye, Settings } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { ReceiptDesign } from "@shared/schema";

const colorSchemes = [
  { value: "green", label: "Eco Green", preview: "bg-green-600" },
  { value: "blue", label: "Ocean Blue", preview: "bg-blue-600" },
  { value: "purple", label: "Royal Purple", preview: "bg-purple-600" },
  { value: "red", label: "Cherry Red", preview: "bg-red-600" },
  { value: "orange", label: "Sunset Orange", preview: "bg-orange-600" },
  { value: "dark", label: "Dark Mode", preview: "bg-gray-900" },
];

const backgroundStyles = [
  { value: "clean", label: "Clean", description: "Minimalist white background" },
  { value: "gradient", label: "Gradient", description: "Subtle color gradient" },
  { value: "pattern", label: "Pattern", description: "Light geometric patterns" },
  { value: "textured", label: "Textured", description: "Paper-like texture" },
];

const layoutStyles = [
  { value: "modern", label: "Modern", description: "Clean lines and spacing" },
  { value: "classic", label: "Classic", description: "Traditional receipt style" },
  { value: "minimal", label: "Minimal", description: "Essential info only" },
  { value: "detailed", label: "Detailed", description: "Complete information display" },
];

const fontStyles = [
  { value: "modern", label: "Modern Sans", description: "Inter, clean and readable" },
  { value: "classic", label: "Classic Serif", description: "Times-style serif font" },
  { value: "monospace", label: "Monospace", description: "Fixed-width font" },
  { value: "handwritten", label: "Handwritten", description: "Casual script style" },
];

const itemDisplayStyles = [
  { value: "list", label: "List View", description: "Traditional line-by-line" },
  { value: "grid", label: "Grid View", description: "Organized grid layout" },
  { value: "compact", label: "Compact", description: "Space-efficient layout" },
];

export default function ReceiptCustomization() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  
  const userId = "test-user-id"; // Replace with actual user ID from auth

  // Form state
  const [designForm, setDesignForm] = useState({
    name: "Custom Design",
    isDefault: false,
    colorScheme: "green",
    backgroundStyle: "clean",
    layoutStyle: "modern",
    showMap: true,
    showEcoPoints: true,
    showAnalyticsToggle: true,
    fontStyle: "modern",
    fontSize: "medium",
    itemDisplayStyle: "list",
    showItemCategories: false,
    showItemImages: false,
    groupSimilarItems: false,
    showMerchantLogo: true,
    customWatermark: "",
  });

  // Get user's receipt designs
  const { data: designs = [], isLoading } = useQuery({
    queryKey: ["/api/receipt-designs", userId],
    queryFn: () => apiRequest("GET", `/api/receipt-designs?userId=${userId}`),
  });

  // Get default design
  const { data: defaultDesign } = useQuery({
    queryKey: ["/api/receipt-designs/default", userId],
    queryFn: () => apiRequest("GET", `/api/receipt-designs/default?userId=${userId}`),
  });

  // Create new design mutation
  const createDesignMutation = useMutation({
    mutationFn: (designData: any) => apiRequest("POST", "/api/receipt-designs", designData),
    onSuccess: () => {
      toast({ title: "Design saved successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/receipt-designs"] });
    },
    onError: () => {
      toast({ title: "Failed to save design", variant: "destructive" });
    },
  });

  // Update design mutation
  const updateDesignMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest("PUT", `/api/receipt-designs/${id}`, data),
    onSuccess: () => {
      toast({ title: "Design updated successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/receipt-designs"] });
    },
    onError: () => {
      toast({ title: "Failed to update design", variant: "destructive" });
    },
  });

  // Load selected design into form
  useEffect(() => {
    if (selectedDesignId && designs.length > 0) {
      const design = designs.find((d: ReceiptDesign) => d.id === selectedDesignId);
      if (design) {
        setDesignForm({
          name: design.name,
          isDefault: design.isDefault,
          colorScheme: design.colorScheme,
          backgroundStyle: design.backgroundStyle,
          layoutStyle: design.layoutStyle,
          showMap: design.showMap,
          showEcoPoints: design.showEcoPoints,
          showAnalyticsToggle: design.showAnalyticsToggle,
          fontStyle: design.fontStyle,
          fontSize: design.fontSize,
          itemDisplayStyle: design.itemDisplayStyle,
          showItemCategories: design.showItemCategories,
          showItemImages: design.showItemImages,
          groupSimilarItems: design.groupSimilarItems,
          showMerchantLogo: design.showMerchantLogo,
          customWatermark: design.customWatermark || "",
        });
      }
    }
  }, [selectedDesignId, designs]);

  const handleSave = () => {
    if (selectedDesignId) {
      updateDesignMutation.mutate({
        id: selectedDesignId,
        data: designForm,
      });
    } else {
      createDesignMutation.mutate({
        userId,
        ...designForm,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Receipt Customization</h1>
              <p className="text-sm text-gray-600">Personalize how your receipts look and feel</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewMode(!previewMode)}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              {previewMode ? "Edit" : "Preview"}
            </Button>
            <Button
              onClick={handleSave}
              disabled={createDesignMutation.isPending || updateDesignMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Design
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Design Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Design Templates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Current Design</Label>
              <Select value={selectedDesignId || "new"} onValueChange={setSelectedDesignId}>
                <SelectTrigger>
                  <SelectValue placeholder="Create new design or select existing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Create New Design</SelectItem>
                  {designs.map((design: ReceiptDesign) => (
                    <SelectItem key={design.id} value={design.id}>
                      {design.name} {design.isDefault && "(Default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Design Name</Label>
              <Input
                value={designForm.name}
                onChange={(e) => setDesignForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter design name"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Set as Default Design</Label>
              <Switch
                checked={designForm.isDefault}
                onCheckedChange={(checked) => setDesignForm(prev => ({ ...prev, isDefault: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Theme Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Theme & Colors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Color Scheme</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {colorSchemes.map((scheme) => (
                    <button
                      key={scheme.value}
                      onClick={() => setDesignForm(prev => ({ ...prev, colorScheme: scheme.value }))}
                      className={`p-3 border rounded-lg flex items-center gap-3 hover:bg-gray-50 ${
                        designForm.colorScheme === scheme.value ? 'border-green-600 bg-green-50' : 'border-gray-200'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full ${scheme.preview}`} />
                      <span className="text-sm font-medium">{scheme.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Background Style</Label>
                <Select value={designForm.backgroundStyle} onValueChange={(value) => 
                  setDesignForm(prev => ({ ...prev, backgroundStyle: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {backgroundStyles.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        <div>
                          <div className="font-medium">{style.label}</div>
                          <div className="text-xs text-gray-500">{style.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Layout Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5" />
                Layout & Structure
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Layout Style</Label>
                <Select value={designForm.layoutStyle} onValueChange={(value) => 
                  setDesignForm(prev => ({ ...prev, layoutStyle: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {layoutStyles.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        <div>
                          <div className="font-medium">{style.label}</div>
                          <div className="text-xs text-gray-500">{style.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Item Display Style</Label>
                <Select value={designForm.itemDisplayStyle} onValueChange={(value) => 
                  setDesignForm(prev => ({ ...prev, itemDisplayStyle: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {itemDisplayStyles.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        <div>
                          <div className="font-medium">{style.label}</div>
                          <div className="text-xs text-gray-500">{style.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Show Location Map</Label>
                  <Switch
                    checked={designForm.showMap}
                    onCheckedChange={(checked) => setDesignForm(prev => ({ ...prev, showMap: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Show Eco Points</Label>
                  <Switch
                    checked={designForm.showEcoPoints}
                    onCheckedChange={(checked) => setDesignForm(prev => ({ ...prev, showEcoPoints: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Show Analytics Toggle</Label>
                  <Switch
                    checked={designForm.showAnalyticsToggle}
                    onCheckedChange={(checked) => setDesignForm(prev => ({ ...prev, showAnalyticsToggle: checked }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Typography Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                Typography
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Font Style</Label>
                <Select value={designForm.fontStyle} onValueChange={(value) => 
                  setDesignForm(prev => ({ ...prev, fontStyle: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fontStyles.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        <div>
                          <div className="font-medium">{style.label}</div>
                          <div className="text-xs text-gray-500">{style.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Font Size</Label>
                <Select value={designForm.fontSize} onValueChange={(value) => 
                  setDesignForm(prev => ({ ...prev, fontSize: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Display Options */}
          <Card>
            <CardHeader>
              <CardTitle>Display Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Show Item Categories</Label>
                  <Switch
                    checked={designForm.showItemCategories}
                    onCheckedChange={(checked) => setDesignForm(prev => ({ ...prev, showItemCategories: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Show Item Images</Label>
                  <Switch
                    checked={designForm.showItemImages}
                    onCheckedChange={(checked) => setDesignForm(prev => ({ ...prev, showItemImages: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Group Similar Items</Label>
                  <Switch
                    checked={designForm.groupSimilarItems}
                    onCheckedChange={(checked) => setDesignForm(prev => ({ ...prev, groupSimilarItems: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Show Merchant Logo</Label>
                  <Switch
                    checked={designForm.showMerchantLogo}
                    onCheckedChange={(checked) => setDesignForm(prev => ({ ...prev, showMerchantLogo: checked }))}
                  />
                </div>
              </div>

              <div>
                <Label>Custom Watermark</Label>
                <Input
                  value={designForm.customWatermark}
                  onChange={(e) => setDesignForm(prev => ({ ...prev, customWatermark: e.target.value }))}
                  placeholder="Optional text watermark"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
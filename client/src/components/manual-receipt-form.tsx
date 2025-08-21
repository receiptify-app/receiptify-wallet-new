import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Camera, Plus, Trash2, MapPin, Calendar, Receipt, Scan } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ReceiptItem {
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

interface ManualReceiptForm {
  merchantName: string;
  merchantAddress: string;
  date: string;
  time: string;
  receiptNumber: string;
  totalAmount: number;
  paymentMethod: string;
  notes?: string;
  items: ReceiptItem[];
}

interface ManualReceiptFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<ManualReceiptForm>;
}

const paymentMethods = [
  "Cash", "Credit Card", "Debit Card", "Apple Pay", "Google Pay", 
  "PayPal", "Bank Transfer", "Other"
];

const itemCategories = [
  "Food & Drinks", "Groceries", "Transport", "Shopping", "Healthcare", 
  "Entertainment", "Bills", "Education", "Other"
];

export default function ManualReceiptForm({ open, onOpenChange, initialData }: ManualReceiptFormProps) {
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<ManualReceiptForm>({
    defaultValues: {
      merchantName: "",
      merchantAddress: "",
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      receiptNumber: "",
      totalAmount: 0,
      paymentMethod: "",
      notes: "",
      items: [{ name: "", price: 0, quantity: 1, category: "" }],
      ...initialData
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const items = watch("items");
  const calculatedTotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);

  const createReceiptMutation = useMutation({
    mutationFn: async (data: ManualReceiptForm) => {
      // Get current location if available
      let latitude: number | undefined;
      let longitude: number | undefined;
      
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: true
          });
        });
        
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch (error) {
        console.log('Location not available for manual receipt:', error);
      }

      const receiptData = {
        merchantName: data.merchantName,
        location: data.merchantAddress || "Manual Entry",
        total: data.totalAmount.toString(),
        date: `${data.date}T${data.time}:00`,
        category: "Other",
        paymentMethod: data.paymentMethod,
        receiptNumber: data.receiptNumber,
        items: data.items,
        latitude,
        longitude,
        ecoPoints: 1
      };
      
      return await apiRequest("POST", "/api/receipts", receiptData);
    },
    onSuccess: () => {
      toast({
        title: "Receipt Added",
        description: "Your manual receipt has been successfully added!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      reset();
      setCapturedPhoto(null);
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add receipt. Please try again.",
        variant: "destructive",
      });
      console.error("Receipt creation error:", error);
    }
  });

  const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCapturedPhoto(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = (data: ManualReceiptForm) => {
    // Auto-calculate total if items exist but total is 0
    if (data.totalAmount === 0 && calculatedTotal > 0) {
      data.totalAmount = calculatedTotal;
    }
    
    createReceiptMutation.mutate(data);
  };

  const addNewItem = () => {
    append({ name: "", price: 0, quantity: 1, category: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-green-600" />
            Add Receipt Manually
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Photo Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Receipt Photo (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {capturedPhoto ? (
                <div className="relative">
                  <img 
                    src={capturedPhoto} 
                    alt="Receipt photo" 
                    className="w-full max-h-48 object-contain rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => setCapturedPhoto(null)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoCapture}
                    className="hidden"
                  />
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-400 transition-colors cursor-pointer">
                    <Camera className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Tap to take photo of receipt</p>
                  </div>
                </label>
              )}
            </CardContent>
          </Card>

          {/* Merchant Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Merchant Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="merchantName">Merchant Name *</Label>
                  <Input
                    id="merchantName"
                    placeholder="e.g., Tesco Express"
                    {...register("merchantName", { required: "Merchant name is required" })}
                  />
                  {errors.merchantName && (
                    <p className="text-sm text-red-500">{errors.merchantName.message}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="receiptNumber">Receipt Number</Label>
                  <Input
                    id="receiptNumber"
                    placeholder="e.g., #12345"
                    {...register("receiptNumber")}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="merchantAddress">Address</Label>
                <div className="relative">
                  <Input
                    id="merchantAddress"
                    placeholder="e.g., 123 High Street, London"
                    {...register("merchantAddress")}
                  />
                  <MapPin className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Date & Payment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Transaction Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="date">Date *</Label>
                  <div className="relative">
                    <Input
                      id="date"
                      type="date"
                      {...register("date", { required: "Date is required" })}
                    />
                    <Calendar className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
                  </div>
                  {errors.date && (
                    <p className="text-sm text-red-500">{errors.date.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    {...register("time")}
                  />
                </div>

                <div>
                  <Label htmlFor="paymentMethod">Payment Method *</Label>
                  <Select onValueChange={(value) => setValue("paymentMethod", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.paymentMethod && (
                    <p className="text-sm text-red-500">{errors.paymentMethod.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Receipt Items</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addNewItem}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="space-y-3 p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <Badge variant="secondary">Item #{index + 1}</Badge>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <Label>Item Name *</Label>
                      <Input
                        placeholder="e.g., Bread"
                        {...register(`items.${index}.name`, { required: true })}
                      />
                    </div>
                    
                    <div>
                      <Label>Price (£) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...register(`items.${index}.price`, { 
                          required: true,
                          valueAsNumber: true,
                          min: 0
                        })}
                      />
                    </div>
                    
                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        {...register(`items.${index}.quantity`, { 
                          valueAsNumber: true,
                          min: 1
                        })}
                      />
                    </div>
                    
                    <div>
                      <Label>Category</Label>
                      <Select onValueChange={(value) => setValue(`items.${index}.category`, value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {itemCategories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Total & Notes */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="totalAmount">Total Amount (£) *</Label>
                  <Input
                    id="totalAmount"
                    type="number"
                    step="0.01"
                    placeholder={calculatedTotal > 0 ? calculatedTotal.toFixed(2) : "0.00"}
                    {...register("totalAmount", { 
                      required: "Total amount is required",
                      valueAsNumber: true,
                      min: 0
                    })}
                  />
                  {calculatedTotal > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Calculated from items: £{calculatedTotal.toFixed(2)}
                    </p>
                  )}
                  {errors.totalAmount && (
                    <p className="text-sm text-red-500">{errors.totalAmount.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes about this purchase..."
                  rows={3}
                  {...register("notes")}
                />
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createReceiptMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createReceiptMutation.isPending ? "Adding..." : "Add Receipt"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Camera,
  Plus,
  Trash2,
  MapPin,
  Calendar,
  Receipt,
  Scan,
} from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import { CATEGORIES } from "@shared/categories";
import { getCurrentPositionOrNull } from "@/lib/geolocation";

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
  category: string;
  notes?: string;
  items: ReceiptItem[];
}

interface ManualReceiptFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<ManualReceiptForm>;
}

const MANUAL_RECEIPT_DESCRIPTION_ID = "manual-receipt-description";

function getReceiptErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback;
  if (error instanceof TypeError) {
    return "We couldn't confirm whether the receipt was saved. Check My Receipts before trying again.";
  }

  const message = error.message.replace(/^\d+:\s*/, "");
  try {
    const body = JSON.parse(message);
    if (typeof body?.error === "string" && body.error.trim()) {
      return body.error;
    }
  } catch {
    // Non-JSON errors, such as browser network failures, are already readable.
  }

  return message || fallback;
}

export default function ManualReceiptForm({
  open,
  onOpenChange,
  initialData,
}: ManualReceiptFormProps) {
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { currency: userCurrency, symbol: currencySymbol } = useCurrency();

  const paymentMethodOptions = [
    { key: "Cash", label: t("paymentMethods.cash") },
    { key: "Credit Card", label: t("paymentMethods.creditCard") },
    { key: "Debit Card", label: t("paymentMethods.debitCard") },
    { key: "Apple Pay", label: t("paymentMethods.applePay") },
    { key: "Google Pay", label: t("paymentMethods.googlePay") },
    { key: "Bank Transfer", label: t("paymentMethods.bankTransfer") },
    { key: "Other", label: t("paymentMethods.other") },
  ];

  const itemCategoryOptions = [
    { key: "groceries", label: t("categories.groceries") },
    { key: "fashion", label: t("categories.fashion") },
    { key: "electronics", label: t("categories.electronics") },
    { key: "fuel", label: t("categories.fuel") },
    { key: "dining", label: t("categories.dining") },
    { key: "entertainment", label: t("categories.entertainment") },
    { key: "healthcare", label: t("categories.healthcare") },
    { key: "travel", label: t("categories.travel") },
    { key: "utilities", label: t("categories.utilities") },
    { key: "other", label: t("categories.other") },
  ];

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ManualReceiptForm>({
    defaultValues: {
      merchantName: "",
      merchantAddress: "",
      date: new Date().toISOString().split("T")[0],
      time: new Date().toTimeString().slice(0, 5),
      receiptNumber: "",
      totalAmount: 0,
      paymentMethod: "",
      category: "Other",
      notes: "",
      items: [{ name: "", price: 0, quantity: 1, category: "" }],
      ...initialData,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const items = watch("items");
  const calculatedTotal = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  const createReceiptMutation = useMutation({
    mutationFn: async (data: ManualReceiptForm) => {
      let latitude: number | undefined;
      let longitude: number | undefined;

      const position = await getCurrentPositionOrNull();
      if (position) {
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }

      const receiptData = {
        merchantName: data.merchantName,
        location: data.merchantAddress || t("manual.title"),
        total: data.totalAmount.toString(),
        date: `${data.date}T${data.time}:00`,
        category: data.category || "Other",
        paymentMethod: data.paymentMethod,
        receiptNumber: data.receiptNumber,
        items: data.items,
        latitude,
        longitude,
        ecoPoints: 1,
        currency: userCurrency,
      };

      return await apiRequest("POST", "/api/receipts", receiptData);
    },
    onSuccess: () => {
      toast({
        title: t("manual.receiptAdded"),
        description: t("manual.receiptAddedDesc"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      reset();
      setCapturedPhoto(null);
      onOpenChange(false);
    },
    onError: (error) => {
      const fallbackMessage = t("manual.errorDesc");
      toast({
        title: t("manual.error"),
        description: getReceiptErrorMessage(error, fallbackMessage),
        variant: "destructive",
      });
      console.error("Receipt creation error:", error);
    },
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
      <DialogContent
        className="receiptify-dialog max-w-2xl max-h-[90vh] overflow-y-auto"
        aria-describedby={MANUAL_RECEIPT_DESCRIPTION_ID}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-green-600" />
            {t("manual.addManually")}
          </DialogTitle>
          <DialogDescription id={MANUAL_RECEIPT_DESCRIPTION_ID}>
            Enter the receipt details below. Required fields are marked with an asterisk.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Photo Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t("manual.receiptPhotoOptional")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {capturedPhoto ? (
                <div className="relative">
                  <img
                    src={capturedPhoto}
                    alt={t("manual.receiptPhoto")}
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
                    <p className="text-sm text-gray-600">
                      {t("manual.tapToTakePhoto")}
                    </p>
                  </div>
                </label>
              )}
            </CardContent>
          </Card>

          {/* Merchant Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t("manual.merchantDetails")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="merchantName">
                    {t("manual.merchantName")} *
                  </Label>
                  <Input
                    id="merchantName"
                    placeholder={t("manual.merchantNamePlaceholder")}
                    {...register("merchantName", {
                      required: t("manual.merchantNameRequired"),
                    })}
                  />
                  {errors.merchantName && (
                    <p className="text-sm text-red-500">
                      {errors.merchantName.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="receiptNumber">
                    {t("manual.receiptNumber")}
                  </Label>
                  <Input
                    id="receiptNumber"
                    placeholder={t("manual.receiptNumberPlaceholder")}
                    {...register("receiptNumber")}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="merchantAddress">{t("manual.address")}</Label>
                <div className="relative">
                  <Input
                    id="merchantAddress"
                    placeholder={t("manual.addressPlaceholder")}
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
              <CardTitle className="text-lg">
                {t("manual.transactionDetails")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="mb-4">
                <Label htmlFor="category">{t("manual.category")}</Label>
                <Select
                  defaultValue="Other"
                  onValueChange={(value) => setValue("category", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("manual.selectCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="date">{t("manual.date")} *</Label>
                  <div className="relative">
                    <Input
                      id="date"
                      type="date"
                      {...register("date", {
                        required: t("manual.dateRequired"),
                      })}
                    />
                    <Calendar className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
                  </div>
                  {errors.date && (
                    <p className="text-sm text-red-500">
                      {errors.date.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="time">{t("manual.time")}</Label>
                  <Input id="time" type="time" {...register("time")} />
                </div>

                <div>
                  <Label htmlFor="paymentMethod">
                    {t("manual.paymentMethod")} *
                  </Label>
                  <Select
                    onValueChange={(value) => setValue("paymentMethod", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("manual.selectPayment")} />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethodOptions.map((method) => (
                        <SelectItem key={method.key} value={method.key}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.paymentMethod && (
                    <p className="text-sm text-red-500">
                      {errors.paymentMethod.message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">
                {t("manual.receiptItems")}
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addNewItem}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("manual.addItem")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="space-y-3 p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex justify-between items-center">
                    <Badge variant="secondary">
                      {t("manual.items")} #{index + 1}
                    </Badge>
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
                      <Label>{t("manual.itemName")} *</Label>
                      <Input
                        placeholder={t("manual.itemNamePlaceholder")}
                        {...register(`items.${index}.name`, { required: true })}
                      />
                    </div>

                    <div>
                      <Label>
                        {t("manual.price")} ({currencySymbol}) *
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...register(`items.${index}.price`, {
                          required: true,
                          valueAsNumber: true,
                          min: 0,
                        })}
                      />
                    </div>

                    <div>
                      <Label>{t("manual.qty")}</Label>
                      <Input
                        type="number"
                        min="1"
                        {...register(`items.${index}.quantity`, {
                          valueAsNumber: true,
                          min: 1,
                        })}
                      />
                    </div>

                    <div>
                      <Label>{t("manual.category")}</Label>
                      <Select
                        onValueChange={(value) =>
                          setValue(`items.${index}.category`, value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("manual.selectCategory")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {itemCategoryOptions.map((category) => (
                            <SelectItem key={category.key} value={category.key}>
                              {category.label}
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
                  <Label htmlFor="totalAmount">
                    {t("manual.total")} ({currencySymbol}) *
                  </Label>
                  <Input
                    id="totalAmount"
                    type="number"
                    step="0.01"
                    placeholder={
                      calculatedTotal > 0 ? calculatedTotal.toFixed(2) : "0.00"
                    }
                    {...register("totalAmount", {
                      required: t("manual.error"),
                      valueAsNumber: true,
                      min: 0,
                    })}
                  />
                  {calculatedTotal > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      {t("manual.itemsTotal")}: {currencySymbol}
                      {calculatedTotal.toFixed(2)}
                    </p>
                  )}
                  {errors.totalAmount && (
                    <p className="text-sm text-red-500">
                      {errors.totalAmount.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="notes">{t("manual.notes")}</Label>
                <Textarea
                  id="notes"
                  placeholder={t("manual.notesPlaceholder")}
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
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={createReceiptMutation.isPending}
              className="receiptify-primary-action"
            >
              {createReceiptMutation.isPending
                ? t("manual.addingReceipt")
                : t("manual.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

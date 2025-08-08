import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, AlertTriangle, CheckCircle, Clock, Plus, FileText, Phone, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";

interface Warranty {
  id: string;
  productName: string;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  warrantyStartDate: string;
  warrantyEndDate: string;
  warrantyPeriodMonths: number;
  warrantyType: string;
  retailerName: string;
  retailerContact: string;
  retailerWebsite: string;
  retailerSupportEmail: string;
  retailerSupportPhone: string;
  category: string;
  isActive: boolean;
  reminderSent: boolean;
}

interface WarrantyClaim {
  id: string;
  warrantyId: string;
  claimType: string;
  issueDescription: string;
  status: string;
  claimNumber: string;
  claimDate: string;
  resolutionDate?: string;
  resolutionDetails?: string;
}

export default function Warranties() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);
  const [selectedWarranty, setSelectedWarranty] = useState<Warranty | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data: warranties = [], isLoading } = useQuery({
    queryKey: ["/api/warranties"],
  });

  const { data: claims = [] } = useQuery({
    queryKey: ["/api/warranty-claims"],
  });

  const claimMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/warranty-claims", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warranty-claims"] });
      toast({
        title: "Warranty Claim Submitted",
        description: "Your claim has been submitted successfully",
      });
      setIsClaimDialogOpen(false);
      reset();
    },
  });

  const getWarrantyStatus = (warranty: Warranty) => {
    const now = new Date();
    const endDate = new Date(warranty.warrantyEndDate);
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) return { status: "expired", color: "bg-red-500", text: "Expired" };
    if (daysRemaining <= 30) return { status: "expiring", color: "bg-yellow-500", text: `${daysRemaining} days left` };
    return { status: "active", color: "bg-green-500", text: "Active" };
  };

  const getClaimStatus = (status: string) => {
    const statusMap: Record<string, { color: string; text: string; icon: any }> = {
      submitted: { color: "bg-blue-500", text: "Submitted", icon: Clock },
      in_progress: { color: "bg-yellow-500", text: "In Progress", icon: Clock },
      approved: { color: "bg-green-500", text: "Approved", icon: CheckCircle },
      denied: { color: "bg-red-500", text: "Denied", icon: AlertTriangle },
      completed: { color: "bg-green-600", text: "Completed", icon: CheckCircle },
    };
    return statusMap[status] || statusMap.submitted;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const handleClaimSubmit = (data: any) => {
    if (!selectedWarranty) return;
    
    claimMutation.mutate({
      warrantyId: selectedWarranty.id,
      claimType: data.claimType,
      issueDescription: data.issueDescription,
    });
  };

  const activeWarranties = warranties.filter((w: Warranty) => getWarrantyStatus(w).status === "active");
  const expiringWarranties = warranties.filter((w: Warranty) => getWarrantyStatus(w).status === "expiring");
  const expiredWarranties = warranties.filter((w: Warranty) => getWarrantyStatus(w).status === "expired");

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Warranties</h1>
          <p className="text-gray-600">Track product warranties and manage claims</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Warranty
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <Shield className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-2xl font-bold">{activeWarranties.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <AlertTriangle className="h-8 w-8 text-yellow-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Expiring Soon</p>
              <p className="text-2xl font-bold">{expiringWarranties.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <Clock className="h-8 w-8 text-red-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Expired</p>
              <p className="text-2xl font-bold">{expiredWarranties.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <FileText className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Claims</p>
              <p className="text-2xl font-bold">{claims.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warranties List */}
      <div className="space-y-4">
        {warranties.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Shield className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Warranties Found</h3>
              <p className="text-gray-600 text-center mb-6">
                Add warranties for your purchases to track expiry dates and manage claims
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Warranty
              </Button>
            </CardContent>
          </Card>
        ) : (
          warranties.map((warranty: Warranty) => {
            const status = getWarrantyStatus(warranty);
            const warrantyClaims = claims.filter((c: WarrantyClaim) => c.warrantyId === warranty.id);
            
            return (
              <Card key={warranty.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                        <Shield className="h-6 w-6 text-blue-700" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{warranty.productName}</CardTitle>
                        <CardDescription>{warranty.brand} {warranty.model}</CardDescription>
                      </div>
                    </div>
                    <Badge className={`${status.color} text-white`}>
                      {status.text}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Purchase Date</p>
                      <p className="font-semibold">{formatDate(warranty.purchaseDate)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Warranty Period</p>
                      <p className="font-semibold">{warranty.warrantyPeriodMonths} months</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Expires</p>
                      <p className="font-semibold">{formatDate(warranty.warrantyEndDate)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Retailer</p>
                      <p className="font-semibold">{warranty.retailerName}</p>
                    </div>
                  </div>

                  {warrantyClaims.length > 0 && (
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium text-gray-900 mb-2">Recent Claims</p>
                      <div className="space-y-2">
                        {warrantyClaims.slice(0, 2).map((claim: WarrantyClaim) => {
                          const claimStatus = getClaimStatus(claim.status);
                          const Icon = claimStatus.icon;
                          return (
                            <div key={claim.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-gray-600" />
                                <span className="text-sm">{claim.claimType}</span>
                              </div>
                              <Badge className={`${claimStatus.color} text-white text-xs`}>
                                {claimStatus.text}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <Dialog open={isClaimDialogOpen} onOpenChange={setIsClaimDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedWarranty(warranty)}
                          disabled={status.status === "expired"}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          File Claim
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>File Warranty Claim</DialogTitle>
                          <DialogDescription>
                            Submit a warranty claim for {selectedWarranty?.productName}
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit(handleClaimSubmit)} className="space-y-4">
                          <div>
                            <Label htmlFor="claimType">Claim Type</Label>
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder="Select claim type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="repair">Repair</SelectItem>
                                <SelectItem value="replacement">Replacement</SelectItem>
                                <SelectItem value="refund">Refund</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="issueDescription">Issue Description</Label>
                            <Textarea
                              id="issueDescription"
                              {...register("issueDescription", { required: "Please describe the issue" })}
                              placeholder="Describe the problem with your product..."
                              className="min-h-[100px]"
                            />
                            {errors.issueDescription && (
                              <p className="text-sm text-red-600 mt-1">{errors.issueDescription.message as string}</p>
                            )}
                          </div>
                          <DialogFooter>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsClaimDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              disabled={claimMutation.isPending}
                            >
                              Submit Claim
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>

                    {warranty.retailerSupportPhone && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`tel:${warranty.retailerSupportPhone}`, '_self')}
                      >
                        <Phone className="h-4 w-4 mr-2" />
                        Call Support
                      </Button>
                    )}

                    {warranty.retailerWebsite && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(warranty.retailerWebsite, '_blank')}
                      >
                        <Globe className="h-4 w-4 mr-2" />
                        Website
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
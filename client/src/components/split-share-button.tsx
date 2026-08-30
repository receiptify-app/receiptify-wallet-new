import { useMutation } from "@tanstack/react-query";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { shareOrCopySplitLink, type SplitSharePayload } from "@/lib/split-sharing";
import { useToast } from "@/hooks/use-toast";

type ShareEntityType = "bill" | "receipt" | "payment_request";

export function SplitShareButton({
  folderId,
  entityType,
  entityId,
  label = "Share",
  className,
}: {
  folderId: string;
  entityType: ShareEntityType;
  entityId: string;
  label?: string;
  className?: string;
}) {
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/split-folders/${folderId}/shares`, {
        entityType,
        entityId,
      });
      const payload = await response.json() as SplitSharePayload;
      const outcome = await shareOrCopySplitLink(payload);
      return outcome;
    },
    onSuccess: (outcome) => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId, "shares"] });
      toast({
        title: outcome === "shared" ? "Shared securely" : "Secure link copied",
        description:
          outcome === "shared"
            ? "Only the safe Receiptify preview was shared."
            : "Paste the secure link into WhatsApp, iMessage, or anywhere else.",
      });
    },
    onError: (error: any) =>
      toast({
        title: "Couldn't share",
        description: error?.message || "Please try again.",
        variant: "destructive",
      }),
  });

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={className}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      data-testid={`share-${entityType}-${entityId}`}
    >
      <Share2 className="mr-1 h-3.5 w-3.5" />
      {mutation.isPending ? "Preparing…" : label}
    </Button>
  );
}
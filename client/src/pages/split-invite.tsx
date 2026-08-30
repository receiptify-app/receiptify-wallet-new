import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { setPendingSplitInvite, consumePendingSplitInvite } from "@/lib/post-auth-redirect";

export default function SplitInvitePage() {
  const params = useParams();
  const token = params.token as string;
  const [, navigate] = useLocation();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const { data: preview, isLoading } = useQuery<{ folderName: string; alreadyActive: boolean }>({
    queryKey: ["/api/split-folders/invites", token],
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/split-folders/invites/${token}/accept`, {});
      return res.json() as Promise<{ folderId: string }>;
    },
    onSuccess: (data) => {
      consumePendingSplitInvite();
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders"] });
      toast({ title: "You're in!", description: `Joined ${preview?.folderName ?? "the folder"}.` });
      navigate(`/split/${data.folderId}`);
    },
    onError: (err: any) => toast({ title: "Couldn't accept invite", description: err.message, variant: "destructive" }),
  });

  // Save token so post-login flow can return here.
  useEffect(() => {
    if (token) setPendingSplitInvite(token);
  }, [token]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center px-6">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 text-center space-y-4">
            <Users className="w-10 h-10 text-green-600 mx-auto" />
            <h1 className="text-xl font-semibold">You've been invited</h1>
            <p className="text-sm text-gray-600">
              {preview?.folderName ? `Join "${preview.folderName}" to split receipts together.` : "Sign in to join this split folder."}
            </p>
            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => navigate("/login")}>
              Sign in to continue
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate("/signup")}>
              Create an account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6 text-center space-y-4">
          <Users className="w-10 h-10 text-green-600 mx-auto" />
          <h1 className="text-xl font-semibold">Join split folder</h1>
          {isLoading ? (
            <div className="h-6 bg-gray-100 animate-pulse rounded" />
          ) : preview ? (
            <>
              <p className="text-sm text-gray-700">
                You're invited to <span className="font-semibold">{preview.folderName}</span>.
              </p>
            </>
          ) : (
            <p className="text-sm text-red-600">This invite link is no longer valid.</p>
          )}
          {preview && (
            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={acceptMutation.isPending}
              onClick={() => acceptMutation.mutate()}
              data-testid="button-accept-invite"
            >
              {acceptMutation.isPending ? "Joining…" : preview.alreadyActive ? "Open folder" : "Join folder"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

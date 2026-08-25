import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, FolderOpen, Receipt as ReceiptIcon, Plus } from "lucide-react";
import AppHeader from "@/components/app-header";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type FolderSummary = {
  id: string;
  name: string;
  description: string | null;
  totalAmount: number;
  memberCount: number;
  receiptCount: number;
  members: Array<{ id: string; displayName: string | null; userId: string | null; profileImageUrl?: string | null }>;
  status: "settled" | "pending";
};

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || name[0].toUpperCase();
}

export default function SplitPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: folders, isLoading } = useQuery<FolderSummary[]>({
    queryKey: ["/api/split-folders"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/split-folders", {
        name: name.trim(),
        description: description.trim() || null,
      });
      const folder = await res.json();
      return folder.id as string;
    },
    onSuccess: (folderId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders"] });
      setName("");
      setDescription("");
      setCreateOpen(false);
      navigate(`/split/${folderId}`);
    },
    onError: (err: any) =>
      toast({
        title: "Couldn't create folder",
        description: err.message,
        variant: "destructive",
      }),
  });

  return (
    <div className="receiptify-page pb-24">
      <AppHeader visualSystem />
      <main className="receiptify-content">
        <div className="receiptify-hero">
          <div>
            <p className="receiptify-eyebrow">Shared spending</p>
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-green-600" />
              <h1>Split folders<em>.</em></h1>
            </div>
            <p className="receiptify-subtitle">Group receipts and settle up with friends.</p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="receiptify-primary-action"
            data-testid="button-new-folder"
          >
            <Plus className="w-4 h-4 mr-1" />
            New folder
          </Button>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && folders && folders.length === 0 && (
          <Card className="receiptify-empty border-dashed border-2 border-gray-200">
            <CardContent className="p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <FolderOpen className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">No split folders yet</h2>
              <p className="text-sm text-gray-600">
                Create a folder to start grouping receipts and inviting friends,
                or open any receipt and tap <span className="font-medium">Split</span>.
              </p>
              <Button
                onClick={() => setCreateOpen(true)}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-empty-new-folder"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create your first folder
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {folders?.map((f) => (
            <Link key={f.id} href={`/split/${f.id}`}>
              <Card className="receiptify-panel cursor-pointer hover:shadow-md transition" data-testid={`folder-card-${f.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 truncate">{f.name}</h3>
                        <Badge
                          variant={f.status === "settled" ? "default" : "secondary"}
                          className={
                            f.status === "settled"
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : "bg-amber-100 text-amber-800 hover:bg-amber-100"
                          }
                        >
                          {f.status === "settled" ? "Settled" : "Pending"}
                        </Badge>
                      </div>
                      {f.description && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">{f.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><ReceiptIcon className="w-3 h-3" />{f.receiptCount}</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{f.memberCount}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">£{f.totalAmount.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 mt-3">
                    {f.members.slice(0, 5).map((m, idx) => (
                      <div
                        key={m.id}
                        className="w-7 h-7 rounded-full bg-green-100 border-2 border-white text-xs font-semibold text-green-700 flex items-center justify-center"
                        style={{ marginLeft: idx === 0 ? 0 : -8 }}
                      >
                        {initials(m.displayName)}
                      </div>
                    ))}
                    {f.members.length > 5 && (
                      <span className="text-xs text-gray-500 ml-1">+{f.members.length - 5}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              New split folder
            </DialogTitle>
            <DialogDescription>
              Give your folder a name. You can add receipts and invite friends to it next.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="folder-name">Folder name</Label>
              <Input
                id="folder-name"
                placeholder="e.g. Weekend in Brighton"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                data-testid="input-new-folder-name"
              />
            </div>
            <div>
              <Label htmlFor="folder-desc">Description (optional)</Label>
              <Input
                id="folder-desc"
                placeholder="Anything to remember about this trip"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="input-new-folder-desc"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!name.trim() || createMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
                data-testid="button-create-new-folder"
              >
                {createMutation.isPending ? "Creating…" : "Create folder"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

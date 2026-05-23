import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, FolderOpen, Users } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type FolderSummary = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  receiptCount: number;
  totalAmount: number;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptId: string;
}

export default function SplitFolderPicker({ open, onOpenChange, receiptId }: Props) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<"pick" | "create">("pick");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: folders = [], isLoading } = useQuery<FolderSummary[]>({
    queryKey: ["/api/split-folders"],
    enabled: open,
  });

  // Auto-switch to "create" when the user has no folders yet.
  if (open && !isLoading && folders.length === 0 && mode === "pick") {
    setMode("create");
  }

  const attachMutation = useMutation({
    mutationFn: async (folderId: string) => {
      await apiRequest("POST", `/api/split-folders/${folderId}/receipts`, { receiptId });
      return folderId;
    },
    onSuccess: (folderId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId] });
      onOpenChange(false);
      navigate(`/split/${folderId}`);
    },
    onError: (err: any) => toast({ title: "Couldn't add to folder", description: err.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/split-folders", { name: name.trim(), description: description.trim() || null });
      const folder = await res.json();
      await apiRequest("POST", `/api/split-folders/${folder.id}/receipts`, { receiptId });
      return folder.id as string;
    },
    onSuccess: (folderId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId] });
      setName("");
      setDescription("");
      setMode("pick");
      onOpenChange(false);
      navigate(`/split/${folderId}`);
    },
    onError: (err: any) => toast({ title: "Couldn't create folder", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setMode("pick"); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-green-600" />
            {mode === "create" ? "New split folder" : "Add to split folder"}
          </DialogTitle>
        </DialogHeader>

        {mode === "pick" ? (
          <div className="space-y-2">
            {isLoading && <div className="text-sm text-gray-500 py-4 text-center">Loading folders…</div>}
            {!isLoading && folders.map((f) => (
              <button
                key={f.id}
                onClick={() => attachMutation.mutate(f.id)}
                disabled={attachMutation.isPending}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-green-500 hover:bg-green-50 transition text-left"
                data-testid={`pick-folder-${f.id}`}
              >
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{f.name}</div>
                  <div className="text-xs text-gray-500">
                    {f.memberCount} member{f.memberCount === 1 ? "" : "s"} · {f.receiptCount} receipt{f.receiptCount === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-700">£{f.totalAmount.toFixed(2)}</div>
              </button>
            ))}
            <button
              onClick={() => setMode("create")}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-300 hover:border-green-500 hover:bg-green-50 transition text-left"
              data-testid="pick-folder-new"
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <Plus className="w-5 h-5 text-gray-600" />
              </div>
              <div className="font-medium text-gray-900">Create new folder</div>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="folder-name">Folder name</Label>
              <Input
                id="folder-name"
                placeholder="e.g. Weekend in Brighton"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                data-testid="input-folder-name"
              />
            </div>
            <div>
              <Label htmlFor="folder-desc">Description (optional)</Label>
              <Input
                id="folder-desc"
                placeholder="Anything to remember about this trip"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                data-testid="input-folder-desc"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!name.trim() || createMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
                data-testid="button-create-folder"
              >
                {createMutation.isPending ? "Creating…" : "Create & continue"}
              </Button>
              {folders.length > 0 && (
                <Button variant="outline" onClick={() => setMode("pick")} disabled={createMutation.isPending}>
                  Back
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

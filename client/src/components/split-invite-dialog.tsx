import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Mail, Link as LinkIcon } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Props {
  folderId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function SplitInviteDialog({ folderId, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"email" | "link">("email");
  const [email, setEmail] = useState("");
  const [linkName, setLinkName] = useState("");
  const [copied, setCopied] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);

  const inviteMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", `/api/split-folders/${folderId}/members`, body);
      return res.json();
    },
    onSuccess: (member: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/split-folders", folderId] });
      if (tab === "email" && member.inviteEmail) {
        if (member.emailSent) {
          toast({
            title: "Invite sent",
            description: `We emailed the invite to ${member.inviteEmail}.`,
          });
          onOpenChange(false);
          setEmail("");
        } else {
          toast({
            title: "Couldn't send email",
            description:
              (member.emailError || "Email delivery failed.") +
              " You can resend it from the folder's members list.",
            variant: "destructive",
          });
          onOpenChange(false);
          setEmail("");
        }
      } else if (member.inviteToken && (tab === "link" || !member.userId)) {
        const url = `${window.location.origin}/split/invite/${member.inviteToken}`;
        setLinkUrl(url);
        navigator.clipboard?.writeText(url).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: "Invite link copied", description: "Share it with your friend." });
      } else {
        toast({ title: "Invited", description: `Added ${member.displayName} to the folder.` });
        onOpenChange(false);
        setEmail("");
      }
    },
    onError: (err: any) => toast({ title: "Invite failed", description: err.message, variant: "destructive" }),
  });

  const resetTabState = () => { setLinkUrl(null); setCopied(false); setEmail(""); };
  const resetAll = () => { resetTabState(); setLinkName(""); };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetAll(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a friend</DialogTitle>
          <DialogDescription>
            Send a link or email invite to someone so they can join this folder.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          {[
            { k: "email", label: "Email", icon: Mail },
            { k: "link", label: "Link", icon: LinkIcon },
          ].map(({ k, label, icon: Icon }) => (
            <button
              key={k}
              onClick={() => { setTab(k as any); resetTabState(); }}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium ${tab === k ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}
              data-testid={`invite-tab-${k}`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "email" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="invite-name">Friend's name <span className="text-red-500">*</span></Label>
              <Input
                id="invite-name"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                placeholder="e.g. Sarah"
                className={!linkName.trim() && email.trim() ? "border-red-400 focus-visible:ring-red-400" : ""}
              />
              {!linkName.trim() && email.trim() && (
                <p className="text-xs text-red-500">Please enter your friend's name</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-email">Email address <span className="text-red-500">*</span></Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@example.com"
                data-testid="input-invite-email"
              />
            </div>
            <Button
              onClick={() => inviteMutation.mutate({ email: email.trim(), displayName: linkName.trim() || undefined })}
              disabled={!email.trim() || !linkName.trim() || inviteMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {inviteMutation.isPending ? "Sending…" : "Send invite"}
            </Button>
            {linkUrl && (
              <div className="text-xs text-gray-500 break-all bg-gray-50 p-2 rounded">{linkUrl}</div>
            )}
          </div>
        )}

        {tab === "link" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Generate a shareable invite link anyone with the URL can use to join.</p>
            <div className="space-y-1">
              <Label htmlFor="link-name">Friend's name</Label>
              <Input
                id="link-name"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                placeholder="e.g. Sarah"
              />
            </div>
            {!linkUrl ? (
              <Button
                onClick={() => inviteMutation.mutate({ generateLinkOnly: true, displayName: linkName.trim() || "Invited friend" })}
                disabled={inviteMutation.isPending}
                className="w-full bg-green-600 hover:bg-green-700"
                data-testid="button-generate-link"
              >
                {inviteMutation.isPending ? "Creating…" : "Generate invite link"}
              </Button>
            ) : (
              <>
                <div className="flex items-center gap-2 bg-gray-50 border rounded-lg p-2">
                  <code className="text-xs flex-1 break-all">{linkUrl}</code>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(linkUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

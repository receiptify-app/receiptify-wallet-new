import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, AtSign, Mail, Link as LinkIcon } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Props {
  folderId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

type UserHit = { id: string; username: string | null; email: string | null; firstName: string | null; lastName: string | null; profileImageUrl: string | null };

export default function SplitInviteDialog({ folderId, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"username" | "email" | "link">("username");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [linkName, setLinkName] = useState("");
  const [copied, setCopied] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);

  const { data: suggestions = [] } = useQuery<UserHit[]>({
    queryKey: ["/api/users/search", username],
    enabled: tab === "username" && username.trim().length > 0,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/users/search?q=${encodeURIComponent(username.trim())}`);
      return res.json();
    },
  });

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
          setUsername("");
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
          setUsername("");
          setEmail("");
        }
      } else if (member.inviteToken && (tab === "link" || (!member.userId && tab !== "username"))) {
        const url = `${window.location.origin}/split/invite/${member.inviteToken}`;
        setLinkUrl(url);
        navigator.clipboard?.writeText(url).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: "Invite link copied", description: "Share it with your friend." });
      } else {
        toast({ title: "Invited", description: `Added ${member.displayName} to the folder.` });
        onOpenChange(false);
        setUsername("");
        setEmail("");
      }
    },
    onError: (err: any) => toast({ title: "Invite failed", description: err.message, variant: "destructive" }),
  });

  const reset = () => { setLinkUrl(null); setCopied(false); setUsername(""); setEmail(""); setLinkName(""); };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a friend</DialogTitle>
          <DialogDescription>
            Send a link, email, or invite by username.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          {[
            { k: "username", label: "Username", icon: AtSign },
            { k: "email", label: "Email", icon: Mail },
            { k: "link", label: "Link", icon: LinkIcon },
          ].map(({ k, label, icon: Icon }) => (
            <button
              key={k}
              onClick={() => { setTab(k as any); reset(); }}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium ${tab === k ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}
              data-testid={`invite-tab-${k}`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "username" && (
          <div className="space-y-2">
            <Label htmlFor="invite-username">Receiptify username</Label>
            <Input
              id="invite-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              data-testid="input-invite-username"
            />
            {suggestions.length > 0 && (
              <div className="border rounded-lg divide-y">
                {suggestions.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => inviteMutation.mutate({ username: u.username })}
                    disabled={inviteMutation.isPending || !u.username}
                    className="w-full flex items-center gap-2 p-2 text-left hover:bg-gray-50"
                    data-testid={`suggest-${u.id}`}
                  >
                    {u.profileImageUrl && (
                      <img src={u.profileImageUrl} alt="" className="w-8 h-8 rounded-full" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || u.email}</div>
                      <div className="text-xs text-gray-500 truncate">@{u.username || "—"}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <Button
              onClick={() => inviteMutation.mutate({ username: username.trim() })}
              disabled={!username.trim() || inviteMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Invite
            </Button>
          </div>
        )}

        {tab === "email" && (
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com"
              data-testid="input-invite-email"
            />
            <Button
              onClick={() => inviteMutation.mutate({ email: email.trim() })}
              disabled={!email.trim() || inviteMutation.isPending}
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

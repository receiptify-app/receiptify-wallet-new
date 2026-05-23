import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, FolderOpen, Receipt as ReceiptIcon } from "lucide-react";
import AppHeader from "@/components/app-header";

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
  const { data: folders, isLoading } = useQuery<FolderSummary[]>({
    queryKey: ["/api/split-folders"],
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <AppHeader />
      <div className="px-6 py-4">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-6 h-6 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900">Split folders</h1>
        </div>
        <p className="text-sm text-gray-600 mb-6">Group receipts and settle up with friends.</p>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && folders && folders.length === 0 && (
          <Card className="border-dashed border-2 border-gray-200">
            <CardContent className="p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <FolderOpen className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">No split folders yet</h2>
              <p className="text-sm text-gray-600">
                Open any receipt and tap <span className="font-medium">Split</span> to start a folder with friends.
              </p>
              <Link href="/receipts" className="inline-block text-green-600 font-medium underline">
                Browse receipts
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {folders?.map((f) => (
            <Link key={f.id} href={`/split/${f.id}`}>
              <Card className="cursor-pointer hover:shadow-md transition" data-testid={`folder-card-${f.id}`}>
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
      </div>
    </div>
  );
}

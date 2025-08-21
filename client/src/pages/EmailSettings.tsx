import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Mail, Unlink, RefreshCw } from "lucide-react";

interface EmailIntegration {
  id: string;
  provider: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function EmailSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [autoAccept, setAutoAccept] = useState(false);

  // Query email integrations
  const { data: integrations, isLoading } = useQuery({
    queryKey: ['/api/email/integrations'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/email/integrations');
      return response.json();
    }
  });

  // Query forwarding address
  const { data: forwardingData } = useQuery({
    queryKey: ['/api/email/forwarding-address'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/email/forwarding-address');
      return response.json();
    }
  });

  // Connect Gmail mutation
  const connectGmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/email/authorize?provider=gmail');
      const data = await response.json();
      
      // Redirect to OAuth URL
      window.location.href = data.authUrl;
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: "Failed to connect Gmail account",
        variant: "destructive",
      });
    }
  });

  // Connect Outlook mutation
  const connectOutlookMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/email/authorize?provider=outlook');
      const data = await response.json();
      
      // Redirect to OAuth URL
      window.location.href = data.authUrl;
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: "Failed to connect Outlook account",
        variant: "destructive",
      });
    }
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      await apiRequest('POST', '/api/email/disconnect', { integrationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email/integrations'] });
      toast({
        title: "Disconnected",
        description: "Email account disconnected successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Disconnect Failed",
        description: "Failed to disconnect email account",
        variant: "destructive",
      });
    }
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      await apiRequest('POST', '/api/email/sync', { integrationId });
    },
    onSuccess: () => {
      toast({
        title: "Sync Started",
        description: "Email sync has been initiated",
      });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: "Failed to start email sync",
        variant: "destructive",
      });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Email Import Settings</h1>
      
      {/* Email Connections */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Connected Email Accounts</CardTitle>
          <CardDescription>
            Connect your email accounts to automatically import receipts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Gmail Connection */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium">Gmail</p>
                <p className="text-sm text-muted-foreground">
                  {integrations?.gmail ? integrations.gmail.email : 'Not connected'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {integrations?.gmail ? (
                <>
                  <Badge variant="secondary">Connected</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncMutation.mutate(integrations.gmail.id)}
                    disabled={syncMutation.isPending}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Sync
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => disconnectMutation.mutate(integrations.gmail.id)}
                    disabled={disconnectMutation.isPending}
                  >
                    <Unlink className="h-4 w-4 mr-1" />
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => connectGmailMutation.mutate()}
                  disabled={connectGmailMutation.isPending}
                >
                  Connect Gmail
                </Button>
              )}
            </div>
          </div>

          {/* Outlook Connection */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium">Outlook</p>
                <p className="text-sm text-muted-foreground">
                  {integrations?.outlook ? integrations.outlook.email : 'Not connected'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {integrations?.outlook ? (
                <>
                  <Badge variant="secondary">Connected</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncMutation.mutate(integrations.outlook.id)}
                    disabled={syncMutation.isPending}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Sync
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => disconnectMutation.mutate(integrations.outlook.id)}
                    disabled={disconnectMutation.isPending}
                  >
                    <Unlink className="h-4 w-4 mr-1" />
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => connectOutlookMutation.mutate()}
                  disabled={connectOutlookMutation.isPending}
                >
                  Connect Outlook
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Forwarding Address */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Email Forwarding</CardTitle>
          <CardDescription>
            Forward receipt emails to this address for automatic processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forwardingData?.forwardingAddress ? (
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-mono text-sm">{forwardingData.forwardingAddress}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {forwardingData.instructions}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">Loading forwarding address...</p>
          )}
        </CardContent>
      </Card>

      {/* Auto-Accept Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Import Settings</CardTitle>
          <CardDescription>
            Configure how receipts are processed automatically
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto-Accept High Confidence Receipts</p>
              <p className="text-sm text-muted-foreground">
                Automatically accept receipts with confidence score above 80%
              </p>
            </div>
            <Switch
              checked={autoAccept}
              onCheckedChange={setAutoAccept}
            />
          </div>
          
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Last sync: {integrations?.lastSync ? new Date(integrations.lastSync).toLocaleString() : 'Never'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
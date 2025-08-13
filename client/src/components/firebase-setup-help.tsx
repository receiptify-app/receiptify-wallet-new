import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink, CheckCircle } from "lucide-react";

export default function FirebaseSetupHelp() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Social Login Setup Required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Social logins need to be configured in your Firebase Console for them to work properly.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Step 1: Enable Authentication Providers</h4>
              <p className="text-sm text-gray-600 mb-2">
                Go to your Firebase Console → Authentication → Sign-in method
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open('https://console.firebase.google.com/u/0/project/recieptify-app/authentication/providers', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Firebase Console
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">Enable <strong>Google</strong> sign-in</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">Enable <strong>Facebook</strong> sign-in (optional)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">Enable <strong>Apple</strong> sign-in (optional)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">Enable <strong>Email/Password</strong> sign-in</span>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Step 2: Add Authorized Domains</h4>
              <p className="text-sm text-gray-600 mb-2">
                Add your Replit domain to the authorized domains list:
              </p>
              <div className="bg-gray-100 p-3 rounded text-sm font-mono">
                {window.location.hostname}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Copy this domain and add it in Authentication → Settings → Authorized domains
              </p>
            </div>

            <div>
              <h4 className="font-medium mb-2">Step 3: Test Authentication</h4>
              <p className="text-sm text-gray-600">
                After completing the above steps, refresh this page and try signing in again.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
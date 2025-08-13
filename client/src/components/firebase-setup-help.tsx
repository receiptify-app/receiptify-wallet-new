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

            <div className="border-2 border-red-200 bg-red-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2 text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                URGENT: Add Authorized Domain (Required for Social Login)
              </h4>
              <p className="text-sm text-red-700 mb-2">
                <strong>Error:</strong> auth/unauthorized-domain detected. Add this domain to Firebase:
              </p>
              <div className="bg-yellow-100 p-3 rounded text-sm font-mono border border-yellow-300">
                {window.location.hostname}
              </div>
              <div className="mt-3 space-y-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open('https://console.firebase.google.com/u/0/project/recieptify-app/authentication/settings', '_blank')}
                  className="w-full border-red-300 text-red-700 hover:bg-red-100"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Firebase Settings → Authorized Domains
                </Button>
                <p className="text-xs text-red-600">
                  1. Click the button above<br/>
                  2. Click "+ Add domain"<br/>
                  3. Paste: {window.location.hostname}<br/>
                  4. Click "Done" and return here to test
                </p>
              </div>
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
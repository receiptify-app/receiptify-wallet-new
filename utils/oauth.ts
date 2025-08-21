// OAuth configuration for email providers
export const OAUTH_CONFIG = {
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID || 'test-client-id',
    clientSecret: process.env.GMAIL_CLIENT_SECRET || 'test-client-secret',
    redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/email/callback?provider=gmail',
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth'
  },
  outlook: {
    clientId: process.env.OUTLOOK_CLIENT_ID || 'test-client-id',
    clientSecret: process.env.OUTLOOK_CLIENT_SECRET || 'test-client-secret',
    redirectUri: process.env.OUTLOOK_REDIRECT_URI || 'http://localhost:5000/api/email/callback?provider=outlook',
    scopes: ['https://graph.microsoft.com/mail.read'],
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
  }
}

export function buildAuthUrl(provider: 'gmail' | 'outlook', state?: string): string {
  const config = OAUTH_CONFIG[provider]
  
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent'
  })
  
  if (state) {
    params.set('state', state)
  }
  
  return `${config.authUrl}?${params.toString()}`
}

export async function exchangeCodeForTokens(provider: 'gmail' | 'outlook', code: string) {
  const config = OAUTH_CONFIG[provider]
  
  // This is a stub implementation - in real app would make actual OAuth token exchange
  console.log(`Exchanging code for tokens with ${provider}:`, code)
  
  return {
    access_token: `mock_access_token_${Date.now()}`,
    refresh_token: `mock_refresh_token_${Date.now()}`,
    expires_in: 3600,
    token_type: 'Bearer'
  }
}
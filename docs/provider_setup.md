# Email Provider Setup Guide

This document describes how to set up email integrations for automatic receipt import from Gmail, Outlook, and forwarding services.

## Gmail Integration

### OAuth Setup
1. Create a Google Cloud project at https://console.cloud.google.com
2. Enable the Gmail API
3. Create OAuth 2.0 credentials (Web application)
4. Add authorized redirect URIs:
   - `http://localhost:5000/api/email/callback` (development)
   - `https://your-domain.com/api/email/callback` (production)
5. Set environment variables:
   - `GMAIL_CLIENT_ID`: Your OAuth client ID
   - `GMAIL_CLIENT_SECRET`: Your OAuth client secret

### Watch vs Polling
- **Gmail Watch (Recommended)**: Uses Gmail push notifications via Pub/Sub
  - Real-time receipt processing
  - More efficient than polling
  - Requires Google Cloud Pub/Sub setup
- **Polling**: Periodically checks for new emails
  - Simpler to implement
  - May have delays up to polling interval
  - Uses Gmail API quotas

### Implementation
```javascript
// Watch setup (recommended)
await gmail.users.watch({
  userId: 'me',
  requestBody: {
    topicName: 'projects/your-project/topics/gmail-receipts',
    labelIds: ['INBOX'],
    labelFilterAction: 'include'
  }
});

// Polling alternative
setInterval(async () => {
  const messages = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:(amazon.com OR starbucks.com OR uber.com) newer_than:1d'
  });
  // Process messages...
}, 300000); // 5 minutes
```

## Microsoft Outlook Integration

### OAuth Setup
1. Register application at https://portal.azure.com
2. Add Microsoft Graph API permissions:
   - `Mail.Read`: Read user mail
   - `Mail.ReadWrite`: Manage user mail
3. Set environment variables:
   - `OUTLOOK_CLIENT_ID`: Your application ID
   - `OUTLOOK_CLIENT_SECRET`: Your client secret
   - `OUTLOOK_TENANT_ID`: Your tenant ID (or 'common')

### Delta vs Polling
- **Microsoft Graph Delta**: Tracks changes efficiently
  - Uses delta tokens for incremental sync
  - Recommended for production
- **Polling**: Simple message listing
  - Higher API usage
  - Suitable for development

### Implementation
```javascript
// Delta sync (recommended)
let deltaToken = await getDeltaToken();
const delta = await graphClient.api(`/me/mailFolders/inbox/messages/delta?$token=${deltaToken}`).get();

// Polling alternative
const messages = await graphClient.api('/me/mailFolders/inbox/messages')
  .filter(`receivedDateTime gt ${since.toISOString()}`)
  .get();
```

## SendGrid Inbound Parse

### Setup
1. Configure domain at https://app.sendgrid.com/settings/parse
2. Add MX record: `10 mx.sendgrid.net` for your subdomain
3. Set webhook URL: `https://your-domain.com/api/email/webhook`
4. Enable spam check and raw email options

### Webhook Security
```javascript
// Verify SendGrid webhook signature
const signature = req.headers['x-sendgrid-signature'];
const payload = JSON.stringify(req.body);
const expectedSignature = crypto
  .createHmac('sha256', process.env.SENDGRID_WEBHOOK_SECRET)
  .update(payload)
  .digest('base64');

if (signature !== expectedSignature) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

## Mailgun Inbound

### Setup
1. Add route at https://app.mailgun.com/app/routes
2. Set expression: `catch_all()`
3. Set action: `forward("https://your-domain.com/api/email/webhook")`
4. Enable storing raw messages

### Webhook Security
```javascript
// Verify Mailgun webhook signature
const signature = crypto
  .createHmac('sha256', process.env.MAILGUN_WEBHOOK_SECRET)
  .update(`${req.body.timestamp}${req.body.token}`)
  .digest('hex');

if (signature !== req.body.signature) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

## Email Forwarding Rules

### Gmail Forwarding
1. Go to Gmail Settings → Forwarding and POP/IMAP
2. Add forwarding address: `import-receipts@your-domain.com`
3. Create filter:
   - From: `amazon.com OR starbucks.com OR uber.com OR paypal.com`
   - Has words: `receipt OR order OR invoice`
   - Action: Forward to import address

### Outlook Forwarding
1. Go to Outlook Settings → Mail → Forwarding
2. Add rule:
   - Condition: From contains "receipt" OR subject contains "order"
   - Action: Forward to `import-receipts@your-domain.com`

### Apple Mail Rules
1. Mail → Preferences → Rules
2. Add rule:
   - If sender contains: `amazon.com, starbucks.com, uber.com`
   - Perform: Forward to `import-receipts@your-domain.com`

## Environment Variables

```bash
# Gmail OAuth
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret

# Outlook OAuth  
OUTLOOK_CLIENT_ID=your_outlook_client_id
OUTLOOK_CLIENT_SECRET=your_outlook_client_secret
OUTLOOK_TENANT_ID=common

# SendGrid
SENDGRID_WEBHOOK_SECRET=your_sendgrid_webhook_secret

# Mailgun
MAILGUN_WEBHOOK_SECRET=your_mailgun_webhook_secret

# Forwarding domain
FORWARDING_DOMAIN=receipts.your-domain.com

# Token encryption
JWT_SECRET=your_jwt_secret_for_token_encryption
```

## Testing

### Development Mode
- Use test email accounts
- Set up ngrok for webhook testing: `ngrok http 5000`
- Update webhook URLs to ngrok URLs

### Production Checklist
- [ ] SSL certificates configured
- [ ] Webhook signatures verified
- [ ] OAuth redirect URIs updated
- [ ] Rate limiting implemented
- [ ] Error monitoring enabled
- [ ] Backup token storage configured

## Troubleshooting

### Common Issues
1. **OAuth redirect mismatch**: Check redirect URIs in provider console
2. **Webhook timeout**: Ensure webhook processing is async
3. **Token expiry**: Implement automatic token refresh
4. **Rate limiting**: Add exponential backoff and retry logic
5. **Parsing failures**: Log raw email content for debugging

### Debug Commands
```bash
# Test webhook endpoint
curl -X POST http://localhost:5000/api/email/webhook \
  -H "Content-Type: application/json" \
  -d '{"messageId":"test","subject":"Test Receipt"}'

# Check OAuth flow
curl http://localhost:5000/api/email/authorize?provider=gmail

# Verify token encryption
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
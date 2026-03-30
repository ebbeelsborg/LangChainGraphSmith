/**
 * Synthetic demo data for SupportBrainz.
 * Populates realistic (slightly messy, redundant) documents and tickets
 * to demonstrate RAG value over naive search.
 */

import { pool } from "@workspace/db";
import { embed } from "./embeddings.js";
import { logger } from "./logger.js";

// ─── Demo Documents (Confluence-style) ─────────────────────────────────────

const DEMO_DOCUMENTS = [
  {
    title: "Password Reset Guide",
    url: "/docs/password-reset",
    content: `# Password Reset Guide

Users can reset their password via the login page by clicking "Forgot Password".
An email with a reset link is sent within 2 minutes.

## Steps
1. Go to login page
2. Click "Forgot Password"
3. Enter your registered email address
4. Check your inbox (and spam folder)
5. Click the reset link within 30 minutes — it expires after that
6. Set a new password meeting complexity requirements

## Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one number
- At least one special character

## Common Issues
- Link expired: request a new one
- Email not received: check spam or verify the email is registered
- Account locked: contact support after 5 failed attempts

Note: SSO users (Google/GitHub login) cannot reset passwords through this flow.`,
  },
  {
    title: "Troubleshooting Login Issues",
    url: "/docs/login-troubleshooting",
    content: `# Login Troubleshooting

If a user cannot log in, work through this checklist:

1. **Wrong credentials** - Ask them to try password reset
2. **Account locked** - Accounts lock after 5 failed attempts. Unlock via Admin panel > Users > [user] > Unlock
3. **SSO issues** - Check if their organization uses SAML/OAuth. SSO errors appear as "Authentication failed" not "Wrong password"
4. **Browser issues** - Clear cookies, try incognito mode, try different browser
5. **VPN/Firewall** - Some corporate firewalls block our auth domain. Whitelist: auth.ourapp.com
6. **MFA issues** - If MFA is enabled and codes fail, check time sync on their device

## After Password Reset Still Can't Login
Sometimes the browser caches old session data. Have them:
- Clear browser cookies for our domain
- Try incognito/private browsing
- Disable browser extensions (ad blockers can interfere)`,
  },
  {
    title: "Billing FAQ",
    url: "/docs/billing-faq",
    content: `# Billing FAQ

## Why was my card declined?
Most card declines are due to:
- Insufficient funds
- Bank blocking international charges
- Card expired
- Billing address mismatch with bank records

**Action**: Try a different card, or contact your bank.

## Why was I charged twice?
This can happen if:
- A plan upgrade was mid-cycle (prorated charge + next cycle)
- A failed payment was retried successfully

Check the Billing page for itemized charges.

## EU Customers Stripe SCA
EU cards may require Strong Customer Authentication (SCA/3DS). If payment fails for EU customers, they need to complete bank verification. Direct them to retry payment in the billing portal.

## How do I get a refund?
Refunds available within 14 days of charge. Contact billing@ourapp.com with your invoice number.

## Subscription auto-renews
All plans auto-renew. Cancel at least 24 hours before renewal to avoid the next charge.`,
  },
  {
    title: "Subscription Management",
    url: "/docs/subscriptions",
    content: `# Subscription Management

## Upgrading Your Plan
1. Go to Settings > Billing
2. Click "Change Plan"
3. Select new plan
4. Confirm payment — you'll be charged the prorated difference immediately

## Downgrading
Downgrades take effect at the end of the current billing period. You retain access to premium features until then.

## Cancellation
Cancel from Settings > Billing > Cancel Subscription. 
- Data retained for 30 days after cancellation
- No refund for partial months

## Team Plans
Admins can add/remove seats. Each seat is billed monthly. Adding a seat mid-cycle is prorated.

## Annual Plans
Annual billing gives a 20% discount. Annual plans can't be downgraded to monthly mid-term.`,
  },
  {
    title: "App Crash on Checkout",
    url: "/docs/checkout-troubleshooting",
    content: `# Checkout & Payment Troubleshooting

## App Crashes at Checkout
If the app crashes or freezes during checkout:

1. **Browser console errors** - Check for JavaScript errors (F12 > Console)
2. **Extensions blocking scripts** - Stripe requires JS to load properly. Disable ad blockers
3. **Old browser** - Require Chrome 80+, Firefox 75+, Safari 14+
4. **Network timeout** - Checkout may fail if the request takes too long (mobile networks)

## Payment Widget Not Loading
The payment form (Stripe Elements) requires:
- Third-party cookies not fully blocked
- stripe.js to load from js.stripe.com
- No Content Security Policy blocking stripe domains

## iOS/Mobile Issues
Safari on iOS sometimes blocks third-party iframes. If Stripe form doesn't appear:
- Check Safari settings: Privacy > Allow Cross-Website Tracking
- Try Chrome on iOS instead`,
  },
  {
    title: "API Rate Limits",
    url: "/docs/api-rate-limits",
    content: `# API Rate Limits

## Default Limits
- Free plan: 100 requests/hour
- Pro plan: 5,000 requests/hour  
- Enterprise: custom limits

## Rate Limit Headers
Every response includes:
- X-RateLimit-Limit: your limit
- X-RateLimit-Remaining: remaining requests
- X-RateLimit-Reset: Unix timestamp when limit resets

## 429 Too Many Requests
If you hit the limit, wait until the reset time. Implement exponential backoff in your code.

## Webhooks
Webhook deliveries don't count toward rate limits.

## Increasing Limits
Contact enterprise@ourapp.com or upgrade your plan.`,
  },
  {
    title: "Data Export & GDPR",
    url: "/docs/data-export",
    content: `# Data Export and GDPR Compliance

## Exporting Your Data
Users can export all their data from Settings > Privacy > Export Data.
Export includes: account info, usage history, all stored content.
Export file is a ZIP sent to your registered email within 24 hours.

## Right to Deletion (GDPR)
To request data deletion:
1. Submit request via Settings > Privacy > Delete Account
2. Or email privacy@ourapp.com
3. Deletion completes within 30 days per GDPR requirements

## Data Retention
- Active accounts: data retained indefinitely
- Cancelled accounts: 30 days retention, then deletion
- Billing records: 7 years (legal requirement)

## Data Location
EU customers' data is stored in EU-West region (Ireland).
US customers' data is in US-East (Virginia).`,
  },
  {
    title: "Team Permissions and Roles",
    url: "/docs/permissions",
    content: `# Team Permissions and Roles

## Roles
- **Owner**: full access, billing, can delete org
- **Admin**: user management, settings, no billing access
- **Member**: standard access to workspace features
- **Viewer**: read-only, can comment but not edit

## Changing Roles
Admins can change member roles in Settings > Team > Members.
Owners can only be changed by current owners.

## Inviting Members
Go to Settings > Team > Invite. Enter email address and select role.
Invites expire in 72 hours. Resend from the pending invites list.

## Removing Members
Removing a member immediately revokes their access.
Their content remains in the workspace (not deleted).`,
  },
  {
    title: "Two-Factor Authentication Setup",
    url: "/docs/2fa",
    content: `# Two-Factor Authentication (2FA)

## Enabling 2FA
1. Go to Settings > Security > Two-Factor Auth
2. Scan QR code with authenticator app (Google Authenticator, Authy, 1Password)
3. Enter the 6-digit code to verify
4. Save backup codes in a safe place

## Backup Codes
8 single-use backup codes are generated during setup. Use these if you lose your device.
Generate new codes from Settings > Security if you run out.

## Disabling 2FA
Requires entering a current TOTP code or backup code to disable.

## Lost Access to Auth App
If you've lost your 2FA device and have no backup codes:
Contact support with government ID for identity verification.
Recovery takes 1-3 business days.`,
  },
  {
    title: "Webhook Configuration",
    url: "/docs/webhooks",
    content: `# Webhooks

## Setting Up Webhooks
1. Go to Settings > Developer > Webhooks
2. Click "Add Endpoint"
3. Enter your endpoint URL (must be HTTPS)
4. Select events to subscribe to
5. Save and copy the signing secret

## Verifying Signatures
All webhook payloads are signed with HMAC-SHA256.
Verify the X-Signature header matches the expected signature.
See our SDK docs for helper functions.

## Retry Policy
Failed deliveries (non-2xx response) are retried:
- Immediately, then after 5m, 30m, 2h, 8h
- Total of 5 attempts before marking failed

## Common Issues
- Endpoint returning 200 but webhook failing: check signature verification
- Missing events: check event subscriptions in dashboard`,
  },
  {
    title: "Mobile App Troubleshooting",
    url: "/docs/mobile-troubleshooting",
    content: `# Mobile App Troubleshooting

## App Won't Open / Crashes on Launch
- Force close and reopen
- Check for app updates in App Store / Play Store
- Restart your phone
- Reinstall the app (data is cloud-synced, safe to reinstall)

## Login Issues on Mobile
- Mobile app requires internet connection (no offline login)
- Corporate MDM may block the app — contact your IT department
- If SSO is configured, ensure the browser used for SSO isn't blocked

## Notifications Not Working
- Check notification permissions: Settings > [App] > Notifications > Allow
- Ensure Do Not Disturb is off
- Check notification settings in app: Profile > Notifications

## Sync Issues
If mobile data doesn't match web:
- Pull to refresh
- Check internet connection
- Log out and log back in`,
  },
  {
    title: "SSO / SAML Configuration",
    url: "/docs/sso-saml",
    content: `# SSO and SAML Configuration

## Supported Providers
- Okta
- Azure AD / Microsoft Entra
- Google Workspace
- OneLogin
- Any SAML 2.0 compatible provider

## Setup (Okta example)
1. Create new SAML app in Okta
2. Set ACS URL: https://app.ourapp.com/auth/saml/callback
3. Set Entity ID: https://app.ourapp.com
4. Map attributes: email → email, firstName → first_name
5. Download metadata XML
6. Upload metadata in our app: Settings > SSO > Upload metadata

## Troubleshooting
- "Invalid signature": certificate mismatch, re-download metadata
- "User not found": email attribute mapping incorrect
- Redirect loop: check ACS URL is exactly correct (no trailing slash)`,
  },
  {
    title: "Storage Limits and File Management",
    url: "/docs/storage",
    content: `# Storage Limits and File Management

## Storage Limits by Plan
- Free: 1 GB
- Pro: 100 GB
- Business: 1 TB
- Enterprise: unlimited

## Checking Storage Usage
Settings > Account > Storage shows current usage breakdown.

## Reducing Storage
- Delete unused files from the trash (trash counts toward limit)
- Empty trash: Files > Trash > Empty Trash
- Remove old file versions (Settings > Storage > Version History)

## File Size Limits
Single file upload limit:
- Free: 50 MB
- Pro/Business: 1 GB
- Enterprise: 5 GB

## Supported File Types
All file types accepted. Preview available for: images, PDFs, videos, Office docs, code files.`,
  },
  {
    title: "Onboarding Guide for New Users",
    url: "/docs/onboarding",
    content: `# Getting Started with Our App

## First Steps
1. Verify your email address
2. Complete your profile (name, avatar, timezone)
3. Create or join a workspace
4. Invite your team members
5. Explore the getting started tutorial

## Key Concepts
- **Workspace**: your organization's shared environment
- **Projects**: containers for related work
- **Members**: people in your workspace with different permission levels

## Quick Start Tips
- Use keyboard shortcuts (press ? for help)
- Pin frequently used items to sidebar
- Use @mentions to notify teammates
- Set up integrations (Slack, GitHub, etc.) from Settings > Integrations

## Getting Help
- In-app: click ? icon for contextual help
- Documentation: docs.ourapp.com
- Support: support@ourapp.com
- Community forum: community.ourapp.com`,
  },
  {
    title: "Deploying to Production",
    url: "/docs/deploy-production",
    content: `# Deploying Your App to Production

## Pre-Deployment Checklist
Before going live:
1. Run all tests (unit, integration, e2e)
2. Review environment variables — never commit secrets
3. Set NODE_ENV=production
4. Configure your production database (separate from dev)
5. Enable error monitoring (Sentry, Datadog, etc.)
6. Set up uptime monitoring

## Deployment Methods

### Option A: One-Click Deploy (Recommended)
1. Go to Settings > Deployments > New Deployment
2. Connect your Git repository (GitHub, GitLab, Bitbucket)
3. Select the branch to deploy (usually main/master)
4. Configure build command: \`npm run build\` or \`pnpm build\`
5. Set output directory: \`dist\` or \`build\`
6. Click Deploy

### Option B: CLI Deploy
\`\`\`bash
npm install -g @ourapp/cli
ourapp login
ourapp deploy --env production
\`\`\`

### Option C: Docker
\`\`\`bash
docker build -t myapp:latest .
docker push registry.ourapp.com/myapp:latest
ourapp deploy --image myapp:latest
\`\`\`

## Environment Variables
Set production env vars in Settings > Deployments > [your deployment] > Environment Variables.
Never hardcode secrets in source code.

## Custom Domains
After deploying, go to Settings > Domains > Add Domain. Point your DNS CNAME to app.ourapp.com.

## Rolling Back
If a deployment fails: Settings > Deployments > [deployment] > Rollback to Previous.
Rollbacks complete in under 60 seconds.

## Build Failures
Common causes:
- Missing environment variables at build time
- Incompatible Node.js version — specify in .nvmrc or package.json engines field
- Out-of-memory during build — contact support to increase build memory`,
  },
  {
    title: "API Authentication & Keys",
    url: "/docs/api-auth",
    content: `# API Authentication

## API Keys
Generate API keys in Settings > Developer > API Keys.
- Keys are shown only once — copy and store securely
- Rotate keys regularly (recommend every 90 days)
- Use separate keys per environment (dev, staging, prod)

## Using Your API Key
Pass the key in the Authorization header:
\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## OAuth 2.0 (for user-facing integrations)
Use OAuth when your app acts on behalf of users.
1. Register your app in Settings > Developer > OAuth Apps
2. Redirect users to: https://app.ourapp.com/oauth/authorize
3. Exchange auth code for access token
4. Token expires in 1 hour — use refresh token to renew

## Scopes
Request only the scopes you need:
- read:documents — read documents
- write:documents — create/update documents
- read:users — read user profiles
- admin:team — manage team members

## Security Best Practices
- Store keys in environment variables, never in source code
- Use HTTPS for all API calls
- Rotate keys immediately if compromised
- Monitor API key usage in Settings > Developer > Usage Logs`,
  },
  {
    title: "Slack Integration Guide",
    url: "/docs/slack-integration",
    content: `# Slack Integration

## Setting Up Slack Integration
1. Go to Settings > Integrations > Slack
2. Click "Connect to Slack"
3. Authorize the app in your Slack workspace
4. Choose a default channel for notifications

## What Gets Sent to Slack
- New ticket created (if configured)
- Ticket assigned to you
- Mention notifications (@username)
- Status change alerts
- Daily digest (optional, configure schedule)

## Slash Commands
Once connected, use in any Slack channel:
- \`/support search [query]\` — search knowledge base
- \`/support ticket [id]\` — view ticket details
- \`/support status\` — check system status

## Notification Customization
Go to Settings > Integrations > Slack > Notification Rules to configure:
- Which events trigger Slack messages
- Which channel receives each notification type
- Quiet hours (no notifications between set times)

## Troubleshooting Slack
- Not receiving notifications: check Slack app permissions include channels:write
- Slash commands not working: re-install the Slack app
- Wrong channel receiving notifications: update channel in Settings > Integrations > Slack`,
  },
  {
    title: "GitHub Integration Guide",
    url: "/docs/github-integration",
    content: `# GitHub Integration

## Connecting GitHub
1. Go to Settings > Integrations > GitHub
2. Click "Connect GitHub"
3. Install our GitHub App on your repository (or organization)
4. Select which repositories to sync

## Features
- **Issue sync**: GitHub Issues appear as tickets in our app
- **PR mentions**: Pull requests mentioning tickets auto-link
- **Commit references**: Commits with #TICKET-ID update ticket status
- **Deploy tracking**: GitHub Actions deployments tracked in our app

## Setting Up Two-Way Sync
By default, changes in our app sync to GitHub. To enable full two-way sync:
Settings > Integrations > GitHub > Enable Bidirectional Sync

## Commit Message Format
To link commits to tickets:
\`git commit -m "Fix login bug [#TKT-1001]"\`

## Webhook from GitHub
To receive GitHub events in our app:
1. Copy webhook URL from Settings > Integrations > GitHub > Webhook URL
2. Add to GitHub: Repo Settings > Webhooks > Add Webhook
3. Select events: issues, pull_requests, push`,
  },
  {
    title: "Custom Domain Configuration",
    url: "/docs/custom-domains",
    content: `# Custom Domain Setup

## Adding a Custom Domain
1. Go to Settings > Domains > Add Domain
2. Enter your domain (e.g., support.yourcompany.com)
3. Choose domain type: subdomain (recommended) or apex domain
4. Follow the DNS configuration steps

## DNS Configuration

### Subdomain (CNAME record) — Recommended
Add a CNAME record:
- Host: support (or your chosen subdomain)
- Value: app.ourapp.com
- TTL: 300

### Apex Domain (A record)
Add A records pointing to our IP addresses:
- 198.51.100.10
- 198.51.100.11
- 198.51.100.12

## SSL Certificate
SSL is automatically provisioned after DNS verification (usually within 15 minutes). No action needed.

## Verification
DNS propagation can take up to 48 hours. Check status in Settings > Domains.

## Troubleshooting
- "Domain not verified": DNS hasn't propagated yet — wait and retry
- SSL error after setup: clear browser cache, try incognito
- Redirect loop: remove any existing HTTPS redirects in your DNS provider`,
  },
  {
    title: "Audit Log & Activity History",
    url: "/docs/audit-log",
    content: `# Audit Log and Activity History

## Accessing Audit Logs
Settings > Security > Audit Log (available on Business and Enterprise plans).

## What's Logged
- User logins (including failed attempts)
- Permission changes (role assignments)
- Data exports and deletions
- Settings changes
- API key creation and rotation
- Admin actions

## Log Retention
- Business plan: 90 days
- Enterprise plan: 1 year (custom retention available)

## Filtering Logs
Filter by:
- Date range
- User
- Action type (login, data_export, permission_change, etc.)
- IP address
- Status (success, failure)

## Exporting Audit Logs
Export to CSV or JSON from the Audit Log page.
Exports can also be streamed to your SIEM via webhook.

## Security Alerts
Configure alerts for suspicious activity:
- Login from new country
- Bulk data export
- Admin role assigned
Go to Settings > Security > Alerts to configure.`,
  },
  {
    title: "Data Backup and Recovery",
    url: "/docs/backup-recovery",
    content: `# Data Backup and Recovery

## Automatic Backups
All data is backed up automatically:
- Hourly snapshots retained for 24 hours
- Daily backups retained for 30 days
- Weekly backups retained for 1 year (Enterprise)

## Accessing Backups
Settings > Data > Backups (Business/Enterprise plans).
You can restore an entire workspace or specific data.

## Self-Service Restore
To restore deleted content:
1. Go to Settings > Data > Trash
2. Find the deleted item (retained 30 days)
3. Click Restore

For point-in-time restore:
1. Settings > Data > Backups
2. Select a backup date
3. Choose restore scope (entire workspace or specific project)
4. Confirm — restore completes in 1-4 hours depending on data size

## What Happens During Restore
- Current data is preserved
- Restored data is merged alongside current content
- Conflicts are flagged for manual review

## Disaster Recovery SLA
- RTO (Recovery Time Objective): 4 hours
- RPO (Recovery Point Objective): 1 hour
- Uptime SLA: 99.9% (Business), 99.95% (Enterprise)`,
  },
  {
    title: "Error Codes Reference",
    url: "/docs/error-codes",
    content: `# API Error Codes Reference

## 4xx Client Errors

### 400 Bad Request
Request is malformed or missing required fields.
Check request body against API documentation.

### 401 Unauthorized
API key missing or invalid.
Ensure Authorization: Bearer YOUR_KEY header is included.

### 403 Forbidden
Valid API key, but insufficient permissions.
Check the scopes your API key has in Settings > Developer.

### 404 Not Found
Resource doesn't exist or has been deleted.

### 409 Conflict
Resource already exists (e.g., duplicate email, existing record).

### 422 Unprocessable Entity
Request structure is valid but contains semantic errors (e.g., invalid field values).

### 429 Too Many Requests
Rate limit exceeded. Check X-RateLimit-Reset header for reset time.
Implement exponential backoff.

## 5xx Server Errors

### 500 Internal Server Error
Unexpected error on our side. Usually transient. Retry after 30 seconds.

### 502 Bad Gateway
Temporary infrastructure issue. Retry after 60 seconds.

### 503 Service Unavailable
Planned maintenance or overload. Check status.ourapp.com.

## Error Response Format
All errors return JSON:
\`\`\`json
{
  "error": "rate_limit_exceeded",
  "message": "You have exceeded your rate limit",
  "retry_after": 3600
}
\`\`\``,
  },
  {
    title: "Analytics & Reporting",
    url: "/docs/analytics",
    content: `# Analytics and Reporting

## Built-in Dashboard
Go to Analytics in the main navigation for:
- Active users (daily, weekly, monthly)
- Feature usage breakdown
- Team productivity metrics
- Storage consumption trends

## Support Metrics (for support teams)
- Ticket volume by day/week/month
- Average first response time
- Resolution time by category
- Customer satisfaction scores (CSAT)
- Most common issues (topic clustering)

## Exporting Reports
1. Go to Analytics > Reports
2. Select report type and date range
3. Click Export — available as CSV, PDF, or Excel

## Scheduled Reports
Set up automatic email reports:
Analytics > Reports > Schedule Report
- Choose frequency (daily, weekly, monthly)
- Select recipients (team members or external email)

## Custom Dashboards
Enterprise plan includes custom dashboard builder:
1. Analytics > Dashboards > New Dashboard
2. Drag and drop widgets
3. Set data sources and filters
4. Share with team or embed via iframe

## API Access to Analytics Data
Query your analytics programmatically:
GET /api/analytics/metrics?from=2024-01-01&to=2024-01-31&metric=active_users`,
  },
  {
    title: "Performance & Troubleshooting Guide",
    url: "/docs/performance",
    content: `# Performance & Troubleshooting Guide

## App Feels Slow — Quick Checks
1. **Browser**: Try a hard refresh (Ctrl+Shift+R / Cmd+Shift+R) to clear cached assets
2. **Extensions**: Disable browser extensions — ad blockers and script blockers can add 200-500ms per page load
3. **Network**: Run a speed test. If your connection is slow, switch to the mobile app which is optimized for lower bandwidth
4. **Device**: Close unused tabs and applications to free memory

## Slow Page Loads
- Large workspaces (10,000+ items) can experience slower load times
- Enable "Lazy Loading" in Settings > Performance to load content on demand instead of all at once
- Use filters and search instead of browsing long lists

## Slow Search Results
Search indexing runs every 15 minutes. Newly added content may not appear immediately.
If search is consistently slow (>5s), contact support — your search index may need rebuilding.

## High API Latency
Check status.ourapp.com for ongoing incidents.
If latency is consistently high:
- Use our status API to check: GET https://status.ourapp.com/api/v2/status.json
- Try a different region endpoint (EU, US, Asia-Pacific) if available on your plan
- Batch API requests to reduce round trips

## Database / Data Not Loading
- Clear application cache: Settings > Advanced > Clear Cache
- If specific records aren't loading, they may have been archived or deleted
- Check Audit Log to see recent changes: Settings > Security > Audit Log

## Memory / Performance on Mobile
- Force close and reopen the app to clear memory
- Disable background refresh: Settings > [App] > Background App Refresh > Off
- Reduce sync frequency in app settings if data is very large

## Contacting Support for Performance Issues
Include in your report:
- Browser name and version
- Time the issue occurred (with timezone)
- Screenshot of browser console (F12 > Console) if there are JS errors
- Network tab HAR file for slow load diagnosis`,
  },
  {
    title: "Webhook Event Reference",
    url: "/docs/webhook-events",
    content: `# Webhook Events Reference

## Event Types

### User Events
- user.created — new user registered
- user.updated — profile or role changed
- user.deleted — user removed from workspace

### Document Events
- document.created
- document.updated
- document.deleted
- document.shared

### Ticket Events
- ticket.created
- ticket.assigned
- ticket.status_changed
- ticket.resolved
- ticket.comment_added

### Billing Events
- subscription.created
- subscription.updated
- subscription.cancelled
- invoice.paid
- invoice.payment_failed

### Security Events
- user.login (includes IP and user-agent)
- user.login_failed
- api_key.rotated

## Payload Format
\`\`\`json
{
  "event": "ticket.created",
  "id": "evt_01HZ3K",
  "created_at": "2024-06-15T10:23:00Z",
  "data": { ... }
}
\`\`\`

## Signature Verification
\`\`\`javascript
const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
hmac.update(rawBody);
const signature = hmac.digest('hex');
if (signature !== req.headers['x-signature']) throw new Error('Invalid');
\`\`\``,
  },
];

// ─── Demo Tickets (Zendesk-style) ──────────────────────────────────────────

const DEMO_TICKETS = [
  {
    ticket_id: "TKT-1001",
    subject: "User cannot log in after password reset",
    tags: ["login", "password", "bug"],
    conversation: `Customer: Hi, I reset my password but I still can't log in. I keep getting "invalid credentials" even with the new password.

Agent: Sorry to hear that! Let's troubleshoot. Can you confirm you're using the email address you received the reset link at?

Customer: Yes, same email. I clicked the link, set a new password, it said success, but then when I try to login with the new password it doesn't work.

Agent: Could you try clearing your browser cookies and cache, then trying again? Sometimes old session data causes this.

Customer: That worked! Thank you!

Agent: Great! The issue was stale session cookies. Your account is working normally now. Let us know if you need anything else.

Resolution: Browser cookie cache was storing old session data. Clearing cookies resolved the issue.`,
  },
  {
    ticket_id: "TKT-1002",
    subject: "Payment failing for EU customers - Stripe 3DS",
    tags: ["billing", "payment", "eu", "stripe", "sca"],
    conversation: `Customer: We have multiple EU customers reporting that payments are failing. They see an error "Payment requires authentication" and then nothing happens.

Agent: This sounds like a Strong Customer Authentication (SCA) issue. EU regulations require 3D Secure verification for most card payments. Can you confirm which country they're in?

Customer: Netherlands, Germany, France. All EU.

Agent: That confirms it. The payment flow requires 3DS authentication which should show a popup from their bank. Is the popup appearing?

Customer: No popup appears. The button just spins and then shows the error.

Agent: The 3DS popup may be blocked by a popup blocker or the browser. Please ask customers to:
1. Disable popup blockers temporarily
2. Try Chrome or Firefox
3. Ensure third-party cookies are not fully blocked

Customer: One customer tried Chrome and it worked! But the others are on corporate machines where they can't change settings.

Agent: For corporate users, you may need to whitelist stripe.com in the browser settings or work with IT to allow the authentication popup.

Resolution: 3DS popup blocked by browser/corporate security settings. Workaround: use Chrome and disable popup blockers.`,
  },
  {
    ticket_id: "TKT-1003",
    subject: "App crashes at checkout page on iOS Safari",
    tags: ["mobile", "ios", "safari", "checkout", "crash"],
    conversation: `Customer: Our checkout page crashes every time on iPhone. Users can't complete purchases.

Agent: I'm sorry about that! Is this happening on a specific iOS version? And are users on Safari?

Customer: iOS 16 and 17, Safari browser. Chrome on the same phone works fine.

Agent: Safari on iOS has strict third-party cookie policies that can interfere with Stripe Elements. The payment form may not load properly. 

Can you ask users to go to Safari Settings > Privacy > Allow Cross-Website Tracking and enable it temporarily?

Customer: We can't ask all our customers to change settings. Is there a fix?

Agent: Understood. The long-term fix is to use Stripe's Payment Request Button which is more compatible with Safari's policies, or to use Stripe Checkout (hosted page). I'll escalate this to our engineering team.

Customer: How long will that take?

Agent: Engineering has confirmed this is a known issue with Safari ITP. Fix is scheduled for the next release (2 weeks). In the meantime, directing Safari users to Chrome is the workaround.

Resolution: Safari ITP blocks Stripe Elements third-party cookies. Fix pending in next release. Workaround: use Chrome on iOS.`,
  },
  {
    ticket_id: "TKT-1004",
    subject: "Account locked out after password attempts",
    tags: ["login", "locked", "security"],
    conversation: `Customer: I tried logging in several times and now my account is locked. It says "account temporarily locked".

Agent: I can help unlock your account. For security, accounts lock after 5 failed login attempts. 

Could you verify your identity by telling me the email address and the name on the account?

Customer: Email is john.smith@company.com, name is John Smith.

Agent: Thank you John. I can see your account in our system. Your account was locked at 2:34 PM UTC today after 5 failed attempts. I'm unlocking it now.

Customer: Thank you! But why did my password stop working? I didn't change it.

Agent: Did you recently receive a "successful login from new location" notification? Sometimes credential stuffing attacks cause this. I'd recommend resetting your password to something new and enabling 2FA from Settings > Security.

Customer: I did get that notification last week. That's scary.

Agent: I'll flag this for our security team. Please change your password and enable 2FA. We'll monitor the account.

Resolution: Account unlocked. Possible unauthorized access attempt. User advised to reset password and enable 2FA.`,
  },
  {
    ticket_id: "TKT-1005",
    subject: "Double charge on invoice - billing error",
    tags: ["billing", "refund", "duplicate-charge"],
    conversation: `Customer: I was charged twice this month. I can see two identical charges on my bank statement.

Agent: I apologize for the inconvenience! Let me look into this right away. Could you provide the last 4 digits of the card that was charged?

Customer: 4242.

Agent: I can see in our system there were indeed two charges on the 3rd: one for $49 and another for $49. 

It looks like you upgraded your plan on the 1st, which generated a prorated charge, and then the regular monthly renewal also hit on the 3rd. These are actually two different charges (not duplicates), but I understand the confusion.

Customer: Oh, I see. But the upgrade charge was listed as "$49" and the renewal is also "$49" — that's confusing.

Agent: You're right, the invoice descriptions should be clearer. The prorated amount happened to equal your full monthly rate. I'll submit feedback to improve billing clarity. Both charges are legitimate, but if you'd like, I can credit you one month's charge as a goodwill gesture.

Customer: Yes please, that would be appreciated.

Agent: Done! A credit of $49 has been applied to your account. You won't be charged next month.

Resolution: Two legitimate charges (upgrade prorate + renewal) coincidentally equal amounts caused confusion. Goodwill credit applied.`,
  },
  {
    ticket_id: "TKT-1006",
    subject: "Can't receive password reset email",
    tags: ["login", "password", "email", "spam"],
    conversation: `Customer: I requested a password reset 3 times but never received the email.

Agent: Let me check a few things. First, have you checked your spam/junk folder? Our emails sometimes get filtered there.

Customer: Yes, checked spam, nothing there.

Agent: Can you confirm the email address you're requesting the reset for? 

Customer: Sure, it's sarah.jones@acmecorp.com

Agent: I can see the emails were sent to that address. The last one was sent 10 minutes ago. This might be a corporate email filter issue. 

Could you have your IT team whitelist these domains: noreply@ourapp.com, mail.ourapp.com?

Customer: I can ask IT but this is urgent, I need access now.

Agent: I understand. As an alternative, if you have access to a personal email address on your account as a backup, we can send the reset there. Do you have one set up?

Customer: No I don't. 

Agent: In that case, I can verify your identity via our manual process. Can you answer: what's the name of your first project on the account?

Customer: Project Alpha

Agent: Correct! I've manually reset your password to a temporary one. Check your inbox for a message from support@ourapp.com with instructions.

Resolution: Corporate email filter blocking reset emails. Manually verified user and issued temporary password. IT to whitelist our mail domain.`,
  },
  {
    ticket_id: "TKT-1007",
    subject: "API returning 429 errors - rate limit exceeded",
    tags: ["api", "rate-limit", "integration"],
    conversation: `Customer: Our integration is suddenly getting 429 errors from your API. We haven't changed our code.

Agent: 429 means you've hit the rate limit. Can you tell me which plan you're on and roughly how many API calls you're making per hour?

Customer: We're on Pro plan. Let me check... we're doing about 3,000 calls/hour but the limit should be 5,000.

Agent: That's within limits. However, 429s can occur if there's a burst of requests in a short window (like 1,000 calls in 1 minute). Our rate limiting is also applied per-second.

Customer: Ah, we have a batch job that fires 500 requests almost simultaneously.

Agent: That's the issue! Even if you're within hourly limits, concurrent burst requests trigger per-second rate limits. 

Solution: implement exponential backoff and add a small delay between requests in your batch jobs. We recommend max 50 requests per second.

Customer: Got it. We'll add a queue. Any chance of increasing our limit temporarily while we fix it?

Agent: I can add a temporary rate limit increase for 48 hours while you implement the queue. I'll set your limit to 10,000/hour. Please implement the fix within 48 hours.

Resolution: Burst requests exceeding per-second limits despite being within hourly quota. Temporary limit increase granted. Customer implementing request queue.`,
  },
  {
    ticket_id: "TKT-1008",
    subject: "Team member unable to access shared workspace",
    tags: ["permissions", "access", "team"],
    conversation: `Customer: A new team member I invited can't access our workspace. They accepted the invite but see an empty dashboard.

Agent: Let me look at the invite. Can you tell me the email address you invited?

Customer: mark.wilson@ourcompany.com

Agent: I can see the invite was accepted 2 days ago. The account was created but there's an issue with workspace assignment. Let me check...

It appears the invite was created with "Viewer" role. With Viewer access, users can see content but the dashboard appears empty if there's no content shared with viewers explicitly.

Customer: Oh, I wanted to give him Member access.

Agent: Got it! I've updated his role from Viewer to Member. He should now see all workspace content. Have him refresh the page.

Customer: That fixed it! But why was Viewer the default?

Agent: Good question! "Viewer" is our default role for external invites to protect content. When inviting internal teammates, consider selecting "Member" explicitly during the invite flow. We're updating the UI to make this clearer.

Resolution: User assigned Viewer role instead of Member. Role updated to Member. UI improvement planned.`,
  },
  {
    ticket_id: "TKT-1009",
    subject: "Webhook not triggering for file upload events",
    tags: ["webhooks", "api", "developer"],
    conversation: `Customer: We configured webhooks for file.uploaded events but they're not triggering. We tested with other event types and they work fine.

Agent: Let me check your webhook configuration. Can you share your endpoint URL (without the secret)?

Customer: https://api.ourservice.com/webhooks/handler

Agent: I can see your endpoint is configured correctly. Let me look at recent deliveries...

I see the webhook fired 8 times in the last 24 hours for file.uploaded events, but your endpoint returned 500 errors on 6 of them. After 5 consecutive failures, we temporarily paused deliveries to that endpoint.

Customer: Oh! We didn't know webhooks could be paused. Our endpoint had a bug.

Agent: Yes, if an endpoint consistently fails, we pause it automatically to avoid overwhelming failing services. 

To re-enable: Settings > Developer > Webhooks > [your endpoint] > Resume Deliveries. And you can replay the failed events from there.

Customer: Found it! Resumed and replaying the failed events now. And our endpoint bug is fixed.

Resolution: Webhook endpoint paused after repeated 500 errors from customer's server bug. Customer fixed endpoint and resumed deliveries manually.`,
  },
  {
    ticket_id: "TKT-1010",
    subject: "Data not syncing between mobile and web",
    tags: ["mobile", "sync", "bug"],
    conversation: `Customer: Changes I make on mobile don't appear on the web and vice versa. This just started happening.

Agent: I'm sorry for the inconvenience. Is this affecting all data or specific types (e.g., files, comments)?

Customer: Seems like everything. A file I uploaded on mobile this morning isn't showing on web.

Agent: Let me check your account's sync status... I can see there's a sync backlog flag on your account. This sometimes happens during high traffic periods.

Can you try: 1) Log out and back in on both devices, 2) Pull to refresh on mobile

Customer: I logged out on both. Web is showing the file now! But mobile still doesn't show recent web changes.

Agent: On mobile, try going to Profile > Settings > Sync > Force Sync. 

Customer: That worked! Everything is showing correctly now.

Agent: The force sync cleared the backlog. This shouldn't happen again, but if it does, the force sync option will resolve it quickly. I've flagged your account for our engineering team to investigate why the sync backlog occurred.

Resolution: Sync backlog on account. Force sync resolved the issue. Engineering investigating root cause.`,
  },
  {
    ticket_id: "TKT-1011",
    subject: "Can't cancel subscription - button not working",
    tags: ["billing", "cancellation", "bug"],
    conversation: `Customer: I'm trying to cancel my subscription but the Cancel button doesn't do anything when I click it.

Agent: I'm sorry about that! This is a known issue in Safari on older macOS versions. Are you using Safari?

Customer: Yes, Safari on macOS Monterey.

Agent: That's the affected version. The cancellation flow uses a JavaScript dialog that's blocked in certain Safari security settings.

Workaround: Try Chrome or Firefox. Or if you prefer, I can process the cancellation for you right now.

Customer: Please cancel it for me. Effective end of billing period.

Agent: Confirmed — I've cancelled your subscription. It will remain active until May 15th (your next billing date), after which it will downgrade to the free plan. Your data will be retained for 30 days.

You'll receive a confirmation email shortly.

Customer: Thank you. Can you also make sure I'm not billed again?

Agent: Confirmed, no further charges will be made. Your card has been removed from auto-billing.

Resolution: Cancel button not working in Safari/macOS due to JavaScript dialog blocking. Manually cancelled subscription. Engineering aware of Safari bug.`,
  },
  {
    ticket_id: "TKT-1012",
    subject: "2FA codes not working",
    tags: ["2fa", "security", "login"],
    conversation: `Customer: My 2FA codes stopped working. I can't log in.

Agent: Sorry to hear that! 2FA TOTP codes can fail if your device's clock is out of sync with our servers. TOTP codes are time-sensitive.

Can you check your phone's time: Settings > General > Date & Time > Set Automatically (should be ON)?

Customer: I turned off automatic time a while ago. Let me turn it back on.

Customer: Codes are working now! That was it.

Agent: Great! TOTP codes are generated based on the current time. If your device clock drifts even 30-60 seconds, codes become invalid. Keeping "Set Time Automatically" on prevents this.

If the issue recurs, our app also has a backup "adjust for clock drift" feature in Security settings.

Resolution: Device clock not synced. Enabling automatic time sync resolved TOTP code failures.`,
  },
  {
    ticket_id: "TKT-1013",
    subject: "Storage full warning - can't upload files",
    tags: ["storage", "files", "plan"],
    conversation: `Customer: I'm getting "storage full" errors and can't upload any new files. We're on the free plan.

Agent: The free plan includes 1 GB of storage. Based on your account, you've used 987 MB. 

To free up space:
1. Empty your trash (deleted files still count toward limit)
2. Remove old file versions from Settings > Storage
3. Delete files you no longer need

Or you can upgrade to Pro for 100 GB.

Customer: I emptied the trash. How much space did that free?

Agent: Emptying trash freed 340 MB. You now have about 353 MB available.

Customer: That's enough for now. But what are the version history files? I never set that up.

Agent: Version history is automatic — we keep previous versions of edited files so you can revert changes. You can control this in Settings > Storage > Version History. Disabling or reducing the version count frees significant space.

Customer: Turned it to 5 versions max (was unlimited). That freed another 200 MB.

Agent: Perfect! You now have plenty of space. Consider upgrading when you grow to avoid hitting limits again.

Resolution: Trash and version history consuming storage quota. User freed space by emptying trash and limiting version history.`,
  },
  {
    ticket_id: "TKT-1014",
    subject: "Invitation link expired before new hire could use it",
    tags: ["team", "onboarding", "invite"],
    conversation: `Customer: We sent an invite to a new employee but she didn't use it in time and now it says expired.

Agent: Invitations expire after 72 hours for security reasons. I can resend the invitation for you.

What's the email address to resend to?

Customer: lisa.chen@ourcompany.com

Agent: Done! A new invitation has been sent to lisa.chen@ourcompany.com. This one is valid for another 72 hours.

Customer: Can we extend the expiry time? We often onboard remote employees who might not check email immediately.

Agent: Currently the 72-hour window is fixed, but I'll note your feedback. As a workaround:
- Send the invite closer to the employee's start date
- Or have them check the invitation email as part of pre-boarding

Customer: That makes sense. We'll adjust our process.

Resolution: Invitation expired (72h limit). Resent invite. Customer advised to time invitations closer to start date.`,
  },
  {
    ticket_id: "TKT-1015",
    subject: "SAML SSO redirect loop after Okta configuration",
    tags: ["sso", "saml", "okta", "login"],
    conversation: `Customer: We set up SAML SSO with Okta following your docs. Now when users try to log in they get stuck in a redirect loop.

Agent: Redirect loops in SAML usually mean the ACS URL or Entity ID is misconfigured. 

Can you double-check in Okta:
1. ACS URL should be exactly: https://app.ourapp.com/auth/saml/callback (no trailing slash)
2. Entity ID should be: https://app.ourapp.com

Customer: ACS URL looks right... Entity ID was https://app.ourapp.com/ (with trailing slash).

Agent: That trailing slash is the issue! Entity IDs must match exactly. Remove the trailing slash in Okta > App settings > SAML Settings > General > Audience URI (SP Entity ID).

Customer: Fixed it! Users can now log in through Okta.

Agent: Great! Exact string matching for Entity ID is a common SAML pitfall. One more thing: download fresh metadata XML from Okta and re-upload it to our app (Settings > SSO) to ensure the certificate is current.

Resolution: Trailing slash in Entity ID caused SAML assertion validation failure. Removing trailing slash resolved redirect loop.`,
  },
  {
    ticket_id: "TKT-1016",
    subject: "Billing emails going to wrong address",
    tags: ["billing", "email", "account"],
    conversation: `Customer: Our billing invoices are being sent to a former employee's email. How do I change the billing email?

Agent: You can update the billing email in Settings > Billing > Billing Contact.

Only account owners can change the billing email. Are you the account owner?

Customer: I'm an admin, not the owner. The owner is the former employee who left.

Agent: I see. This is a common situation. To transfer ownership or update billing contact without current owner access:

1. Verify you're a current admin (I can confirm this)
2. Submit a request with proof of employment (business email + company name)

I can start this process for you now. What's your company name and your direct email?

Customer: Acme Corp, my email is james.park@acmecorp.com

Agent: I've verified your admin status. I'll escalate to our accounts team who will contact you at james.park@acmecorp.com within 1 business day to complete the ownership transfer.

Resolution: Billing contact update requires owner access. Account team escalation initiated for ownership transfer.`,
  },
  {
    ticket_id: "TKT-1017",
    subject: "Mobile app login requires password even with SSO",
    tags: ["mobile", "sso", "login"],
    conversation: `Customer: Our company uses SSO (Azure AD). It works fine on web but the mobile app is asking for a password instead of redirecting to Azure.

Agent: The mobile app uses an in-app browser for SSO. Some Azure AD configurations require specific redirect URI registration for mobile apps.

Can you check in Azure AD: App Registrations > [your app] > Authentication > Mobile and desktop applications.

The redirect URI for our mobile app should be: myapp://auth/callback

Customer: I see redirect URIs listed but I don't see that one.

Agent: You'll need to add it. In Azure AD:
1. Go to App Registrations > Authentication
2. Under "Mobile and desktop applications", add: myapp://auth/callback
3. Save changes

Customer: Added it! Testing now... Yes! SSO is now working on mobile.

Agent: Great! The mobile app needs its own redirect URI registered separately from the web app. This is an Azure AD requirement for native app authentication.

Resolution: Mobile app redirect URI not registered in Azure AD. Adding myapp://auth/callback resolved SSO on mobile.`,
  },
  {
    ticket_id: "TKT-1018",
    subject: "Export taking too long / timing out",
    tags: ["export", "data", "timeout"],
    conversation: `Customer: I requested a data export yesterday and haven't received the email yet. How long does it take?

Agent: Standard exports are delivered within 24 hours. It's been about 18 hours for yours. Let me check the status...

I see your export job is stuck in a queue. This sometimes happens with very large accounts. Your account has about 45 GB of data, which requires extended processing.

Customer: Is there a way to speed it up?

Agent: I've manually prioritized your export job. It should complete within the next 2-3 hours. You'll receive an email with a download link when ready.

For future exports, you can also export by date range or content type (smaller exports) to get data faster:
Settings > Privacy > Export Data > Custom Range

Customer: Got it. I'll use that for specific data in the future.

Agent: The export email arrived with a download link. Issue resolved.

Resolution: Large account export (45GB) stuck in processing queue. Manually prioritized. Export completed. Advised customer to use partial exports for faster results.`,
  },
  {
    ticket_id: "TKT-1019",
    subject: "Getting charged after cancellation",
    tags: ["billing", "cancellation", "refund"],
    conversation: `Customer: I cancelled my subscription last month but I was charged again this month. This needs to be fixed immediately.

Agent: I sincerely apologize for this charge. Let me investigate immediately.

Looking at your account... I can see you submitted a cancellation on March 3rd, but it appears there was an error in our system that did not process the cancellation correctly.

Customer: This is unacceptable. I want a full refund.

Agent: You're absolutely right to be upset, and I completely understand. I'm issuing a full refund for this month's charge right now. The $49 will be refunded to your original payment method within 3-5 business days.

I've also cancelled your subscription effective immediately and ensured no future charges will occur.

Customer: What guarantee do I have this won't happen again?

Agent: I've added a manual block on your account to prevent any further billing. I'm also escalating this to our billing team to investigate why your cancellation didn't process correctly. You'll receive a follow-up email from our billing team within 24 hours.

Resolution: Cancellation not processed due to system error. Full refund issued. Subscription cancelled. Engineering investigating root cause.`,
  },
  {
    ticket_id: "TKT-1020",
    subject: "Notification emails not arriving",
    tags: ["email", "notifications", "deliverability"],
    conversation: `Customer: Team members aren't receiving notification emails. This started a few days ago.

Agent: This could be a deliverability issue. A few questions:
1. What domain are the affected email addresses on?
2. Are ALL notification emails failing or just some types?
3. Has your company changed email providers recently?

Customer: Company domain is bigcorp.com. Seems like all notification emails. Our IT team switched to a new email gateway 3 days ago — could that be related?

Agent: Almost certainly! New email gateways often have strict filtering that catches bulk/transactional emails. 

Your IT team needs to whitelist our sending domains:
- noreply@ourapp.com
- notifications@ourapp.com  
- Sending IPs: 198.51.100.1, 198.51.100.2, 198.51.100.3

Also add our SPF record: v=spf1 include:mail.ourapp.com ~all

Customer: IT has whitelisted the domains. Testing now... Emails are arriving!

Agent: That resolved it. The new email gateway was filtering our transactional emails. With the whitelist in place, all notifications should flow normally.

Resolution: New corporate email gateway blocking transactional emails. IT team whitelisted our sending domains and IPs. Issue resolved.`,
  },
  {
    ticket_id: "TKT-1021",
    subject: "How to bulk import users / CSV upload",
    tags: ["onboarding", "team", "import"],
    conversation: `Customer: We're onboarding 200 new employees at once. Do you support bulk user import?

Agent: Yes! You can import users via CSV from Settings > Team > Members > Import CSV.

The CSV format requires these columns:
- email (required)
- first_name (optional)
- last_name (optional)
- role (optional, defaults to "member")

Customer: What's the limit on CSV import?

Agent: Up to 500 users per import. For 200 users, you're within the limit.

Customer: Can we assign them to different teams/groups during import?

Agent: Currently the CSV import assigns everyone to the main workspace. Team assignments need to be done after import. This is a known limitation — bulk team assignment is on our roadmap.

Workaround: After import, use our API to batch-assign users to teams. The POST /api/teams/{id}/members endpoint accepts an array of user IDs.

Customer: We'll use the API for team assignment. Thanks for the detailed answer.

Resolution: User guided on CSV bulk import (500 user limit). Team assignment via API as workaround for post-import grouping.`,
  },
  {
    ticket_id: "TKT-1022",
    subject: "Billing plan shows wrong features",
    tags: ["billing", "plan", "display-bug"],
    conversation: `Customer: I upgraded to Business plan but my account still shows Pro plan features and limits.

Agent: Congratulations on upgrading! This display issue sometimes occurs when the plan upgrade processes but the UI doesn't refresh immediately.

Please try:
1. Log out and log back in
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

Customer: Logged out and back in, still shows Pro. Storage limit still says 100GB not 1TB.

Agent: Let me check the backend... Your payment was successful and the Business plan was applied, but I see the feature flags weren't updated properly. This is a bug on our end.

I've manually triggered a plan re-sync on your account. Please refresh now.

Customer: Now it shows Business plan correctly! 1TB storage showing.

Agent: Apologies for the confusion. The plan upgrade payment went through but the feature activation had a sync delay. This is fixed now and I've filed a bug report.

Resolution: Plan upgrade payment successful but UI feature flags not updated. Manual plan re-sync resolved display issue.`,
  },
  {
    ticket_id: "TKT-1023",
    subject: "API key stopped working after rotation",
    tags: ["api", "developer", "authentication"],
    conversation: `Customer: I rotated my API key yesterday and now API calls are failing with 401 Unauthorized.

Agent: After rotating an API key, you need to update your application configuration to use the new key. Are you using the new key in your requests?

Customer: I copied the new key right after generation. Let me double-check... Oh. I see the issue. I updated the environment variable but didn't restart the application. The old key was cached in memory.

Agent: That's it! Many applications read environment variables only at startup. Restarting ensures the new key is loaded.

Customer: Restarted the app, API calls working again.

Agent: Glad that resolved it. As a best practice, when rotating API keys:
1. Rotate the key in settings
2. Update your config/environment variable
3. Restart application services
4. Verify old key no longer works (it's immediately invalidated)

Resolution: Application cached old API key in memory. Restart after environment variable update resolved the 401 errors.`,
  },
  {
    ticket_id: "TKT-1024",
    subject: "Users seeing each other's private data",
    tags: ["security", "data-leak", "urgent", "permissions"],
    conversation: `Customer: URGENT: Users are seeing each other's private notes. This is a serious security issue.

Agent: I'm escalating this immediately. To investigate: can you provide two user IDs or emails where this is occurring?

Customer: User A is alice@company.com and User B is bob@company.com. Alice can see Bob's private notes.

Agent: I'm looking at their accounts now. I can see they're both in the same workspace and there's a permission misconfiguration. Your workspace has "Share all notes with team" enabled in Settings > Workspace > Defaults.

Customer: We didn't intentionally set that. When was that changed?

Agent: The setting was changed 3 days ago by admin account admin@company.com. Is that account still active?

Customer: That's a former admin who left! Their account should have been disabled.

Agent: I can see that account is still active with admin privileges. I'm immediately disabling it and reverting the "Share all notes" setting.

Customer: Good. Are any other settings changed?

Agent: Reviewing audit log... Only the notes sharing setting was changed. No other permissions modified.

Resolution: Former admin account used to change workspace sharing setting. Account disabled, setting reverted. No data loss but access violation occurred. Customer advised to review offboarding procedures.`,
  },
  {
    ticket_id: "TKT-1025",
    subject: "Subscription renewal failed - service interrupted",
    tags: ["billing", "subscription", "payment-failure"],
    conversation: `Customer: Our subscription renewal failed and now the service is showing limited functionality. We can't access our data properly.

Agent: I'm sorry for the disruption. I can see the renewal failed due to a payment decline. 

The card on file ending in 7891 was declined. This may be due to:
- Card expired
- Insufficient funds
- Bank requiring re-authorization

To restore service immediately: go to Settings > Billing > Update Payment Method.

Customer: The card is fine (we use it for other services). Our finance team thinks the bank blocked it because it's a foreign transaction (we're UK-based, you charge in USD).

Agent: That's very likely. UK banks often require pre-approval for USD charges. Your team should:
1. Contact their bank to pre-authorize our company (MerchantID: 4892)
2. Or add a UK card that can process international charges

In the meantime, I'm extending your service for 5 days to avoid disruption while you sort out the payment.

Customer: Thank you! We'll contact the bank today.

Resolution: UK bank blocking USD renewal charge. 5-day grace period extended. Customer contacting bank to pre-authorize charges.`,
  },
  // ── Additional tickets TKT-1026 to TKT-1100 ─────────────────────────────
  {
    ticket_id: "TKT-1026",
    subject: "Forgot password link not working — link already used error",
    tags: ["password", "login", "reset"],
    conversation: `Customer: I clicked the password reset link but it says "link already used or expired".

Agent: Password reset links are single-use and expire after 30 minutes. It looks like you may have opened the email twice (some email clients pre-fetch links, which counts as "using" the link).

Customer: I clicked it from my phone and it opened but showed an error. Then I clicked it on my laptop too.

Agent: That explains it — the phone click consumed the link even though the page may not have loaded properly. Please request a new reset link and open it on just one device.

Customer: Got it. I'll request a new one now.

Resolution: Single-use reset link consumed by mobile client pre-fetch. Advised customer to request new link and open on one device only.`,
  },
  {
    ticket_id: "TKT-1027",
    subject: "Password reset email arrives but password still wrong after reset",
    tags: ["password", "reset", "login"],
    conversation: `Customer: I reset my password successfully (page said "password changed") but I still can't log in with the new one.

Agent: Let me check your account. Are you using the exact same password you set, including capitalization and any special characters?

Customer: Yes — I copy-pasted it from my password manager right after setting it.

Agent: I can see your password was updated successfully. Let me try one thing: I'll force a logout of all active sessions on your account. Sometimes an old session token conflicts.

Customer: Tried now — it worked! I'm in.

Agent: The force logout cleared a stale authentication session. This is a rare race condition we're tracking. Thanks for your patience.

Resolution: Stale authentication session conflicting with new password. Force-logout of all sessions resolved the issue.`,
  },
  {
    ticket_id: "TKT-1028",
    subject: "Users locked out after SSO migration",
    tags: ["sso", "login", "migration"],
    conversation: `Customer: We just migrated from password login to SSO and now 30 users can't access their accounts.

Agent: During SSO migration, existing accounts need to be linked to their SSO identities. Can you confirm the email domains match between your old accounts and your identity provider?

Customer: Most do, but about 10 users have personal email addresses in our system (gmail.com) while their SSO identity uses company email.

Agent: That's the issue — email mismatch. For those 10 users, you'll need to update their account email to match their SSO email before they can log in. Admins can do this from Settings > Team > Users > [user] > Edit Email.

Customer: We updated all 10. They can log in now. The other 20 were already resolved by the migration tool.

Resolution: Email mismatch between legacy accounts and SSO identities. Admin updated mismatched emails. All users restored.`,
  },
  {
    ticket_id: "TKT-1029",
    subject: "Cannot log in — getting CAPTCHA loop",
    tags: ["login", "captcha", "security"],
    conversation: `Customer: Every time I try to log in I get a CAPTCHA that never completes. I solve it and it just shows another one.

Agent: This usually happens when our fraud detection flags unusual login patterns. Are you using a VPN or proxy?

Customer: Yes, our company routes all traffic through a corporate VPN.

Agent: That's the cause — VPN exit nodes are often flagged by CAPTCHA systems due to shared IP reputation. Try logging in with the VPN disabled, or contact your IT team to add our auth domain (auth.ourapp.com) to VPN split-tunneling exclusions.

Customer: Disabled VPN and got in immediately.

Resolution: Corporate VPN IP flagged by CAPTCHA fraud detection. Advised VPN split-tunneling exclusion for auth domain.`,
  },
  {
    ticket_id: "TKT-1030",
    subject: "Backup codes for 2FA not working",
    tags: ["2fa", "login", "backup-codes"],
    conversation: `Customer: I lost my phone and I'm trying to use backup codes but they all say "invalid".

Agent: Backup codes are one-time use. Have you used any of them before?

Customer: I think I used a couple when testing, but I should have 6 left.

Agent: The issue might be that backup codes are stored with your old account state. Let me check... I can see backup codes were regenerated 3 days ago. Do you have a newer set printed or saved?

Customer: Oh — I regenerated them after a security review but I don't think I saved the new ones.

Agent: I understand. I'll need to verify your identity to help. Can you provide your registered email, full name, and answer your security question?

Customer: Sure — [provided details].

Agent: Verified. I've disabled 2FA on your account temporarily so you can log in and set it up fresh. You'll need to reconfigure 2FA within 24 hours.

Resolution: Old backup codes invalidated after regeneration. Identity verified. 2FA temporarily disabled for account recovery.`,
  },
  {
    ticket_id: "TKT-1031",
    subject: "Charged for a user seat after removing team member",
    tags: ["billing", "seat", "refund"],
    conversation: `Customer: I removed a team member last week but I'm still being charged for their seat this month.

Agent: Seat charges for the current billing period are not refunded when members are removed mid-cycle. The removal takes effect from the next billing cycle.

Customer: That seems unfair — they haven't had access for a week.

Agent: I understand your frustration. While our standard policy is no mid-cycle refunds, as a goodwill gesture I can apply a prorated credit for the remaining days of the current period. That would be approximately 7/30ths of the seat cost.

Customer: Yes please, that would be appreciated.

Agent: Done — a credit of $4.90 has been applied. It'll appear on your next invoice.

Resolution: Standard policy: seat charges not refunded mid-cycle. Goodwill prorated credit applied.`,
  },
  {
    ticket_id: "TKT-1032",
    subject: "Annual plan renewal price increased without notice",
    tags: ["billing", "annual", "pricing"],
    conversation: `Customer: My annual plan renewed at a higher price than last year. I wasn't notified of the price increase.

Agent: I sincerely apologize for the surprise. We did update pricing in January, and notifications were sent in November and December. Let me check whether those reached your account email...

Customer: We changed our billing email in December. The notification may have gone to the old address.

Agent: That explains it. The price increase notification was sent to the previous billing email. The new rate is $599/year, up from $499 — a $100 increase.

As a one-time courtesy since the notification went to an outdated email, I can credit you $100 to offset the difference for this year.

Customer: That's fair. Thank you.

Resolution: Price increase notification sent to outdated billing email. $100 credit issued as goodwill for missed notification.`,
  },
  {
    ticket_id: "TKT-1033",
    subject: "Invoice not generating after payment",
    tags: ["billing", "invoice", "payment"],
    conversation: `Customer: I paid our invoice but the PDF invoice hasn't been generated in our billing portal. Our accounting team needs it.

Agent: This sometimes happens when payment is processed but the invoice generation job lags. Let me manually trigger invoice generation for your account.

Customer: How long will that take?

Agent: I've triggered it now — you should see the invoice in Settings > Billing > Invoices within the next 5 minutes. If not, I'll email it directly.

Customer: It's there now! Thanks.

Resolution: Invoice generation job lagged after payment. Manual trigger resolved. Invoice available in billing portal.`,
  },
  {
    ticket_id: "TKT-1034",
    subject: "Card declined despite sufficient funds — international issue",
    tags: ["billing", "payment", "international"],
    conversation: `Customer: My card keeps getting declined but I have plenty of funds. My bank says no transaction is even reaching them.

Agent: If the transaction isn't reaching your bank, the decline is happening on our payment processor's side. This can happen with international cards when the card BIN (bank identification number) is flagged.

Which country is your card issued in?

Customer: India. We use an HDFC corporate card.

Agent: Some Indian corporate cards require explicit international transaction enablement. Please check with HDFC:
1. Enable online international transactions on the card
2. Some HDFC cards need a one-time OTP to enable international payments

Also try: Billing > Payment Method > Use UPI or Net Banking as an alternative.

Customer: We enabled international transactions with HDFC and the payment went through!

Resolution: Indian corporate card had international transactions disabled. Enabling via bank app resolved payment.`,
  },
  {
    ticket_id: "TKT-1035",
    subject: "Proration calculation seems wrong on plan upgrade",
    tags: ["billing", "proration", "upgrade"],
    conversation: `Customer: I upgraded from Pro ($49/mo) to Business ($99/mo) on the 15th and was charged $74. How was that calculated?

Agent: Great question! Proration is calculated as follows:
- You had 16 days remaining in your billing cycle (15th to 31st)
- Business vs Pro difference: $99 - $49 = $50/month
- Prorated charge: ($50 / 30 days) × 16 days = ~$26.67
- Plus your next full month of Business at $99 = ~$99
- Wait, let me pull your actual invoice to verify.

Actually looking at your invoice, you were charged $25 prorated difference + renewed at $49 for the rest of the current cycle. The $74 = $25 + $49.

Customer: That makes sense now. Thank you for the clear breakdown.

Resolution: Customer needed explanation of proration calculation. Invoice breakdown reviewed and explained.`,
  },
  {
    ticket_id: "TKT-1036",
    subject: "API returning 401 even with correct key",
    tags: ["api", "authentication", "401"],
    conversation: `Customer: I'm getting 401 Unauthorized on every API call but I'm using the correct API key.

Agent: Let me help troubleshoot. First, how are you passing the key in your request?

Customer: In the query string: ?api_key=xxx

Agent: That's the issue! We no longer support query string authentication as of API v2. You must pass the key in the Authorization header:
Authorization: Bearer YOUR_KEY

Customer: Oh! I was following an old tutorial. Let me update my code.

Customer: Working now! Thank you.

Resolution: Customer using deprecated query string auth. Updated to Authorization header format.`,
  },
  {
    ticket_id: "TKT-1037",
    subject: "API responses extremely slow — 10+ second latency",
    tags: ["api", "performance", "latency"],
    conversation: `Customer: API calls that normally take 200ms are suddenly taking 10-15 seconds. This started this morning.

Agent: I can see elevated latency in our monitoring for the EU-West region starting at 08:42 UTC today. There's an ongoing infrastructure issue. Our engineering team is actively working on it.

Current status: Degraded performance in EU-West. US and Asia-Pacific regions are unaffected.

Customer: We're in Germany. Any ETA?

Agent: Our engineering team estimates resolution within 2 hours. I'll set up a status notification for you at your email address.

Customer: Please. And can we get a credit for the downtime?

Agent: Absolutely. Once resolved, I'll apply an SLA credit to your account per our uptime guarantee. I'll follow up via email.

Resolution: EU-West infrastructure degradation caused high API latency. SLA credit committed. Engineering resolved within 90 minutes.`,
  },
  {
    ticket_id: "TKT-1038",
    subject: "Webhook signature verification failing",
    tags: ["webhooks", "api", "security"],
    conversation: `Customer: Our webhook signature verification is failing. We're computing the HMAC-SHA256 but it never matches.

Agent: Signature verification failures are almost always caused by one of these:
1. Using the wrong webhook secret (check Settings > Developer > Webhooks > [endpoint] > Secret)
2. Signing the wrong body (must sign the raw body bytes, not parsed JSON)
3. Adding extra whitespace or newlines

What language/framework are you using?

Customer: Node.js with Express.

Agent: In Express, you need to capture the raw body before JSON parsing. Make sure you have:
\`app.use('/webhooks', express.raw({ type: 'application/json' }))\`
If you use express.json() first, the body is already parsed and you'll lose the raw bytes.

Customer: That was it! We had express.json() as middleware before our webhook route.

Resolution: Express.js JSON middleware parsing body before raw bytes captured. Fixed by using express.raw() for webhook routes.`,
  },
  {
    ticket_id: "TKT-1039",
    subject: "API pagination not returning all results",
    tags: ["api", "pagination", "developer"],
    conversation: `Customer: I'm paginating through records with page=1, page=2, etc. but the total count never adds up. I'm getting duplicates on some pages.

Agent: This happens when using offset-based pagination on a dataset that changes between requests. New records being inserted shift the offset.

Our API now supports cursor-based pagination which is stable:
Instead of page=2, use: cursor=[value from previous response's next_cursor field]

Customer: The docs don't mention cursor pagination for this endpoint.

Agent: You're right, this endpoint was migrated to cursor pagination in v2.3 but the docs weren't updated. I'll file a documentation bug. For now, use the next_cursor field in each response.

Customer: Got it, switching now. Is there any way to get the total count?

Agent: Yes — pass include_count=true in your first request. The count isn't returned by default to improve performance.

Resolution: Offset pagination unstable on live dataset. Switched to cursor pagination. Documentation bug filed.`,
  },
  {
    ticket_id: "TKT-1040",
    subject: "API key permissions — which scopes do I need?",
    tags: ["api", "permissions", "scopes"],
    conversation: `Customer: I'm building a read-only integration that only needs to list tickets and documents. What minimal scopes should I use?

Agent: For a read-only integration accessing tickets and documents, you only need:
- read:tickets
- read:documents

Avoid requesting admin or write scopes for read-only integrations — it's a security best practice to use the minimum required permissions.

Customer: Great. And if I need to add comments to tickets later?

Agent: Add write:ticket_comments to your scope list. You don't need write:tickets (which allows creating/deleting tickets) just for adding comments.

Customer: Perfect. This is really helpful.

Resolution: Customer guided on minimal scopes for read-only integration. Principle of least privilege applied.`,
  },
  {
    ticket_id: "TKT-1041",
    subject: "Deployment failing — build out of memory",
    tags: ["deploy", "production", "build", "error"],
    conversation: `Customer: Our deployment keeps failing during the build step. Error: "JavaScript heap out of memory".

Agent: This is a common issue with large JavaScript builds. The default Node.js heap is 512MB but complex builds can exceed that.

Try setting the memory limit in your build command:
\`NODE_OPTIONS="--max-old-space-size=4096" npm run build\`

You can set this as an environment variable in Settings > Deployments > [your deploy] > Environment Variables.

Customer: I added NODE_OPTIONS to environment variables and the build completed!

Agent: Great! For future reference, if you're still running out with 4096MB, we can also increase the build machine size for your account. Enterprise plan gets 8GB build memory by default.

Resolution: Build OOM error resolved by increasing Node.js heap via NODE_OPTIONS environment variable.`,
  },
  {
    ticket_id: "TKT-1042",
    subject: "Deployment succeeded but app shows old version",
    tags: ["deploy", "production", "cache"],
    conversation: `Customer: The deployment shows as successful but users are still seeing the old version of our app.

Agent: This is usually a CDN caching issue. After a new deployment, it can take up to 10 minutes for edge caches to refresh globally.

You can force a cache purge from Settings > Deployments > [deployment] > Purge CDN Cache.

Customer: I purged the cache. Some users see the new version but others in Asia don't.

Agent: CDN propagation to Asia-Pacific nodes can take an additional 5-10 minutes after a purge. This is normal — assets are refreshed region by region.

Customer: It's all showing the new version now after about 15 minutes total.

Resolution: Post-deployment CDN cache lag. Force purge initiated. Full global propagation completed in ~15 minutes.`,
  },
  {
    ticket_id: "TKT-1043",
    subject: "Environment variables not loading in production",
    tags: ["deploy", "production", "environment", "config"],
    conversation: `Customer: Our app works in development but in production it can't find environment variables we set in the dashboard.

Agent: Environment variables set in our dashboard are injected at build time AND runtime, depending on how your app reads them. Can you tell me how you're accessing them?

Customer: We use process.env.MY_VAR in our frontend React code.

Agent: Frontend code runs in the browser — process.env variables are substituted at build time by bundlers like Vite or webpack. The variable must be prefixed with VITE_ (for Vite) or REACT_APP_ (for CRA) and set before the build runs.

Customer: Our variable was named API_URL — not VITE_API_URL.

Agent: That's the issue! Rename it to VITE_API_URL in both your code and our deployment environment variables, then redeploy.

Customer: Redeployed with VITE_API_URL — working perfectly now.

Resolution: Vite requires VITE_ prefix for client-exposed env vars. Renamed variable and redeployed.`,
  },
  {
    ticket_id: "TKT-1044",
    subject: "How to set up staging environment separate from production?",
    tags: ["deploy", "staging", "environments"],
    conversation: `Customer: We want a staging environment that mirrors production but with test data. How do we set that up?

Agent: You can create multiple deployment environments in Settings > Deployments > New Deployment.

For staging:
1. Create a new deployment connected to your staging branch (e.g., develop or staging)
2. Set a separate set of environment variables (pointing to staging database, etc.)
3. You'll get a unique staging URL like staging.yourapp.ourapp.com

Customer: Can staging and production share the same codebase but different configs?

Agent: Yes, that's the recommended pattern. Use separate environment variable sets per deployment. Your code reads from environment variables and the same build works in both environments.

Customer: Perfect. Is there a way to promote a staging deployment to production without rebuilding?

Agent: Yes — Settings > Deployments > staging > Promote to Production. This copies the exact build artifact to production without rebuilding.

Resolution: Customer set up staging environment with separate deployment and environment variables. Learned about the promote-to-production workflow.`,
  },
  {
    ticket_id: "TKT-1045",
    subject: "Production deployment rollback — how to revert?",
    tags: ["deploy", "production", "rollback"],
    conversation: `Customer: We deployed a bad version and need to roll back immediately. How do we do it?

Agent: Go to Settings > Deployments > [your deployment] > Deployment History. You'll see a list of previous deployments. Click "Rollback" next to the last working version.

Rollback completes in under 60 seconds and the previous build is served immediately — no rebuild required.

Customer: I see the deployment history. I clicked Rollback on the previous version. It says "Rollback in progress".

Agent: It should complete momentarily. The old version is being promoted from our deployment cache.

Customer: Done! The old version is live. Users are reporting the issue is gone.

Agent: Great! I'd recommend keeping the bad deployment in your history so your engineering team can investigate what went wrong before the next release.

Resolution: Production rollback completed in under 60 seconds using deployment history. Previous stable build restored.`,
  },
  {
    ticket_id: "TKT-1046",
    subject: "Custom domain SSL certificate not provisioning",
    tags: ["deploy", "domain", "ssl"],
    conversation: `Customer: I added our custom domain and pointed DNS correctly but the SSL certificate shows as "Pending" for over an hour.

Agent: SSL provisioning requires DNS verification to complete first. Can you confirm the CNAME record is set correctly? Run: \`dig CNAME yourdomain.com\` and it should return our servers.

Customer: The dig output shows the CNAME pointing to app.ourapp.com.

Agent: DNS is correct. Sometimes SSL provisioning takes up to 24 hours if Let's Encrypt is under high load. However, I can see your certificate request is stuck in our provisioning queue. I've manually retried it.

Customer: It says "SSL Active" now! That was quick.

Agent: The manual retry pushed it through. Sometimes the automated provisioning gets stuck — we're working on better retry logic.

Resolution: SSL certificate stuck in provisioning queue. Manual retry resolved immediately. DNS was correct.`,
  },
  {
    ticket_id: "TKT-1047",
    subject: "Mobile app not syncing — data stuck offline",
    tags: ["mobile", "sync", "offline"],
    conversation: `Customer: Our field team uses the mobile app offline and data isn't syncing when they reconnect to WiFi.

Agent: The sync queue should flush automatically when connectivity is restored. A few questions:
1. What app version are they on?
2. iOS or Android?
3. Are they using the app's "Sync Now" feature under Profile > Settings?

Customer: iOS, version 4.2.1. They tried Sync Now but it shows "Sync complete" without actually syncing the data.

Agent: Version 4.2.1 has a known offline sync bug fixed in 4.2.3. The sync reports success but some records are held back due to a conflict detection error.

Please update to 4.2.3 from the App Store. The data collected offline will sync correctly after the update.

Customer: Updated and forced a sync — all data is now showing in the web portal!

Resolution: iOS 4.2.1 offline sync bug. Fixed in 4.2.3. Update resolved silent sync failure.`,
  },
  {
    ticket_id: "TKT-1048",
    subject: "Push notifications stopped working on Android",
    tags: ["mobile", "android", "notifications"],
    conversation: `Customer: Our Android users stopped receiving push notifications three days ago. iOS users are fine.

Agent: Android push notifications use Firebase Cloud Messaging (FCM). Three days ago corresponds to when Google deprecrated the legacy FCM API. Apps using the old API stopped receiving pushes.

Are you on our mobile app or using our push SDK in your own app?

Customer: We're using your mobile app directly.

Agent: Our app already migrated to the FCM v1 API, but some Android devices with aggressive battery optimization can block our notifications. Ask your users to:
1. Settings > Apps > [App Name] > Battery > Unrestricted
2. Settings > Apps > [App Name] > Notifications > All notifications ON

Customer: That fixed it for most users. Two users with Huawei phones still have issues.

Agent: Huawei phones use their own push service (HMS). On Huawei devices, our app falls back to polling every 15 minutes instead of real-time push. We're working on native HMS support.

Resolution: Android battery optimization blocking FCM notifications. Huawei devices limited to polling mode (HMS support in development).`,
  },
  {
    ticket_id: "TKT-1049",
    subject: "App crashes when opening large attachments on mobile",
    tags: ["mobile", "crash", "attachments", "ios"],
    conversation: `Customer: The iOS app crashes every time a user tries to open a PDF attachment larger than 50MB.

Agent: This is a known memory limitation on iOS. Large PDFs require significant memory to render, and the app crashes when available memory is exhausted.

Workarounds:
1. Compress PDFs before uploading (below 20MB for mobile viewing)
2. Use the "Open in Browser" option which streams the PDF instead of loading it into memory
3. Download the file to Files app for native PDF viewing

Customer: The "Open in Browser" option works. But users prefer in-app viewing.

Agent: Understood. We're working on a streaming PDF viewer for v4.4 that handles large files without memory spikes. Expected release: 6 weeks.

Customer: We'll use the browser option in the meantime. Can you notify us when 4.4 releases?

Agent: I've added you to the v4.4 release notification list.

Resolution: iOS memory limit causes crash with >50MB PDFs. Workaround: Open in Browser. Streaming viewer coming in v4.4.`,
  },
  {
    ticket_id: "TKT-1050",
    subject: "Mobile app login loop with Azure AD SSO",
    tags: ["mobile", "sso", "azure", "login"],
    conversation: `Customer: Mobile app users with Azure AD SSO get stuck in a login loop — it opens the browser, they authenticate, and then redirects back to a blank app screen.

Agent: This is typically caused by missing redirect URI registration in Azure AD for mobile. The mobile app uses a custom URI scheme for the callback.

In Azure AD App Registration > Authentication > Mobile and desktop applications, add:
ourapp://auth/callback

Customer: I added it. Still looping.

Agent: Also check: is "Allow public client flows" set to Yes in Azure AD? This is required for mobile app authentication flows.

Customer: It was set to No. Changed to Yes and tested — working!

Resolution: Azure AD "Allow public client flows" setting was disabled. Enabling resolved mobile SSO redirect loop.`,
  },
  {
    ticket_id: "TKT-1051",
    subject: "SSO users cannot be assigned to multiple teams",
    tags: ["sso", "permissions", "team"],
    conversation: `Customer: Users who log in via SSO can only be in one team. We need them in multiple teams.

Agent: By default, SSO provisioning assigns users to teams based on their identity provider group membership. If users are in multiple groups in your IdP, they should be in multiple teams.

Can you check in your Okta/Azure AD: are the users assigned to multiple groups that map to our teams?

Customer: In Okta they're in multiple groups but our app only shows one team.

Agent: The group-to-team mapping needs to be configured in Settings > SSO > Group Mapping. Make sure all your Okta groups are mapped to corresponding teams.

Customer: I see only one mapping was set up. I added the others and re-logged in — now showing all three teams!

Resolution: Incomplete group-to-team mapping in SSO configuration. Adding all group mappings resolved multi-team assignment.`,
  },
  {
    ticket_id: "TKT-1052",
    subject: "SAML assertion missing email attribute",
    tags: ["saml", "sso", "attribute-mapping"],
    conversation: `Customer: SSO login fails with "Email attribute not found in SAML assertion". We use Okta.

Agent: The email attribute name in your SAML assertion doesn't match what our app expects. We look for the attribute named "email" by default.

In Okta SAML app settings > Attribute Statements, check what name you've set for the email attribute.

Customer: Ours is called "user.email" not "email".

Agent: That's the discrepancy. Either rename it to "email" in Okta, or update our attribute mapping in Settings > SSO > Attribute Mapping and set Email Attribute Name to "user.email".

Customer: I updated the attribute mapping in your settings. Working now!

Resolution: SAML email attribute named "user.email" instead of "email". Fixed via attribute mapping configuration in SSO settings.`,
  },
  {
    ticket_id: "TKT-1053",
    subject: "Google Workspace SSO users need to re-authenticate every day",
    tags: ["sso", "google", "session"],
    conversation: `Customer: Users with Google Workspace SSO are being asked to log in every day. This is disruptive.

Agent: Session duration for SSO users is controlled by two settings:
1. Our app's session timeout (Settings > Security > Session Timeout)
2. Your Google Workspace session controls

What is your current session timeout set to in our app?

Customer: It's set to 24 hours.

Agent: The issue is likely Google Workspace's session controls. If Google forces re-authentication after 24 hours (common for enterprise Google Workspace setups), our app will receive an expired token and require a new login.

Check Google Admin Console > Security > Google session controls — the session length may be set to 24 hours there.

Customer: It was set to 1 day in Google Admin. I've extended it to 7 days. Users are no longer prompted daily.

Resolution: Google Workspace admin session duration (1 day) causing daily re-authentication. Extended to 7 days in Google Admin.`,
  },
  {
    ticket_id: "TKT-1054",
    subject: "2FA recovery — lost both phone and backup codes",
    tags: ["2fa", "recovery", "security"],
    conversation: `Customer: A team member lost their phone and also doesn't have their backup codes. They need account access urgently.

Agent: Account recovery without 2FA credentials requires identity verification. This process takes 1-3 business days for security reasons.

For the affected user, please have them email security@ourapp.com with:
1. Government-issued photo ID
2. Signed letter on company letterhead confirming employment
3. The registered email address and account name

Customer: This is urgent — our on-call engineer needs access now.

Agent: I understand the urgency. For admin-managed accounts, a workspace admin can temporarily disable 2FA for a specific user from Settings > Team > [user] > Security > Disable 2FA. This requires admin credentials.

Are you an admin on the workspace?

Customer: Yes! Found it. I disabled 2FA for them. They're in now.

Agent: Great. Please have them re-enable 2FA and set up new backup codes immediately after logging in.

Resolution: Workspace admin disabled 2FA for locked-out user via admin panel. User re-enrolled in 2FA.`,
  },
  {
    ticket_id: "TKT-1055",
    subject: "Audit log shows logins from unknown IP addresses",
    tags: ["security", "audit", "login", "suspicious"],
    conversation: `Customer: Our audit log shows successful logins from IP addresses in Russia and China. We're a US company with no international employees.

Agent: This is serious. I'm escalating immediately. I can see the logins in question — they occurred at 03:15 and 04:22 UTC using valid credentials.

I'm immediately:
1. Force-logging out all sessions for the affected accounts
2. Requiring password reset on next login
3. Flagging the accounts for 2FA enforcement

Which accounts were accessed?

Customer: The audit log shows admin@company.com.

Agent: The admin account was compromised. I've locked it. Your admin will need to reset their password and verify their identity before regaining access.

Immediate actions for you:
1. Rotate all API keys (Settings > Developer > API Keys > Rotate All)
2. Review what the attacker may have accessed in the audit log
3. Enable IP allowlisting (Settings > Security > IP Allowlist)

Resolution: Admin account compromised via credential stuffing. Account locked. All sessions invalidated. IP allowlisting enabled. Customer notified to audit accessed data.`,
  },
  {
    ticket_id: "TKT-1056",
    subject: "How to enforce 2FA for all team members?",
    tags: ["2fa", "security", "admin", "policy"],
    conversation: `Customer: We want to require 2FA for all users in our organization. How do we enforce this?

Agent: You can enforce 2FA org-wide from Settings > Security > Authentication Policy > Require Two-Factor Authentication.

When enabled:
- Existing users will be prompted to set up 2FA on their next login
- New users must set up 2FA before accessing the workspace
- Users who don't complete 2FA setup within 7 days lose access

Customer: What about users who already have 2FA? Are they affected?

Agent: No — users with 2FA already configured aren't interrupted. The enforcement only prompts users without 2FA.

Customer: Is there a way to see who hasn't set up 2FA yet before enforcing?

Agent: Yes — Settings > Security > Authentication Policy > View 2FA Enrollment Report. This shows who has and hasn't enrolled.

Customer: Great, I'll review that first and then enforce. Thanks.

Resolution: Admin guided on 2FA enforcement policy and pre-enforcement enrollment report.`,
  },
  {
    ticket_id: "TKT-1057",
    subject: "Data export stuck — no email received",
    tags: ["export", "data", "gdpr"],
    conversation: `Customer: I requested a data export 48 hours ago and still haven't received the email.

Agent: Exports typically complete within 24 hours. Yours appears to have gotten stuck. Let me check the job status...

I can see the export job failed silently due to an issue with a specific data type in your account (custom field with non-standard characters). I'm restarting the export job with that field excluded.

Customer: Will I still get all my data?

Agent: All data except that one corrupted custom field. I'll flag the field for our data team to export separately and send manually.

Customer: Understood. When will the export arrive?

Agent: The restarted job should complete within 2 hours. I've also manually triggered priority processing.

Customer: Got the email! Download is working.

Resolution: Export failed due to non-standard characters in custom field. Restarted with field excluded. Corrupted field data exported separately.`,
  },
  {
    ticket_id: "TKT-1058",
    subject: "GDPR deletion request — how long does it take?",
    tags: ["gdpr", "privacy", "data-deletion"],
    conversation: `Customer: A user submitted a right-to-erasure request. How do we process this and what's the timeline?

Agent: For GDPR right-to-erasure requests:

1. Submit the request in Settings > Privacy > Data Deletion Requests
2. We'll verify the requester's identity (via email confirmation)
3. Deletion begins within 30 days of confirmed request
4. Billing records are retained 7 years per legal requirements
5. You'll receive confirmation when deletion is complete

Customer: Does deletion affect our workspace data about this user?

Agent: Yes — the user's personal data is deleted:
- Profile, name, email, avatar removed
- Their authored content is anonymized (shown as "Deleted User")
- Audit log entries are pseudonymized
- Their account access is immediately revoked

Customer: And how do we track that we've complied?

Agent: Settings > Privacy > Data Deletion Requests shows all requests with status and completion timestamps. Export this for your compliance records.

Resolution: Customer educated on GDPR erasure request process, timeline, and compliance record-keeping.`,
  },
  {
    ticket_id: "TKT-1059",
    subject: "Storage usage jumped overnight — what happened?",
    tags: ["storage", "files", "audit"],
    conversation: `Customer: Our storage usage jumped from 40GB to 78GB overnight. No one on the team uploaded files intentionally.

Agent: A sudden jump like that is usually due to:
1. A large batch import or bulk file upload
2. A connected integration syncing data (e.g., Google Drive, Dropbox sync)
3. An automated workflow generating files

Let me check your audit log... I can see a large number of file uploads around 02:30 UTC via your API using key "sync-integration-key".

Customer: Oh — that's our Dropbox sync integration. It was set to "full sync" and re-synced our entire archive.

Agent: That explains it. Go to Settings > Integrations > Dropbox and change the sync mode from "Full Sync" to "Changes Only" to prevent future re-syncs.

Customer: Changed. And can we delete the duplicate files?

Agent: Files > Storage Analysis shows duplicate detection. You can bulk-delete duplicates from there.

Resolution: Dropbox integration full-sync re-uploaded entire archive. Changed to incremental sync. Duplicates removed via Storage Analysis tool.`,
  },
  {
    ticket_id: "TKT-1060",
    subject: "Cannot delete workspace — 'has active subscriptions' error",
    tags: ["billing", "workspace", "deletion"],
    conversation: `Customer: I'm trying to delete a test workspace but it says "workspace has active subscriptions". I already cancelled the subscription.

Agent: The subscription cancellation may still be processing. Cancellation takes effect at the end of the billing period — the subscription isn't fully removed until then.

When does your current billing period end?

Customer: It ended 3 days ago. I cancelled well before that.

Agent: Let me check... I can see the subscription is showing as "Cancelled" but there's a dangling payment method record keeping it in an active-like state. I'm clearing that now.

Customer: Tried deleting again — worked! The workspace is gone.

Resolution: Dangling payment record prevented workspace deletion despite cancelled subscription. Manual cleanup by support resolved.`,
  },
  {
    ticket_id: "TKT-1061",
    subject: "Slack integration posting duplicate notifications",
    tags: ["slack", "integration", "notifications"],
    conversation: `Customer: Our Slack integration is sending duplicate notifications — every event gets posted twice.

Agent: Duplicate Slack notifications usually mean the integration is connected twice. Go to Settings > Integrations > Slack and check if there are two active connections.

Customer: Yes! There are two connections — one from 3 months ago and one from last week when we reconnected.

Agent: Remove the old connection and keep only the most recent one. Click "Disconnect" on the older entry.

Customer: Disconnected the old one. Messages are coming through once now.

Resolution: Slack integration connected twice (re-authorization created duplicate). Removed old connection.`,
  },
  {
    ticket_id: "TKT-1062",
    subject: "GitHub integration not syncing new issues",
    tags: ["github", "integration", "issues"],
    conversation: `Customer: Our GitHub integration stopped syncing new issues. Existing issues are fine but anything created in the last 2 days isn't appearing.

Agent: This can happen when the GitHub webhook delivery fails. Check your GitHub webhook delivery logs: GitHub > Repo Settings > Webhooks > Recent Deliveries.

Customer: I see a lot of failed deliveries with status 503.

Agent: Our webhook receiver was having an incident 2 days ago that caused 503s. GitHub paused deliveries after repeated failures. To resume:
1. In GitHub, go to webhook settings and click "Redeliver" on the failed payloads
2. In our app, Settings > Integrations > GitHub > Re-sync

Customer: Re-synced and redelivered the webhooks. All issues are showing now.

Resolution: GitHub paused webhook deliveries after our service incident. Manual redeliver and re-sync recovered missed issues.`,
  },
  {
    ticket_id: "TKT-1063",
    subject: "CSV user import failed — no error message",
    tags: ["import", "team", "csv"],
    conversation: `Customer: I uploaded a CSV to bulk-import 150 users. The import says "completed" but only 120 users were created. No error message for the missing 30.

Agent: Silent failures during CSV import are usually caused by validation errors on specific rows. Go to Settings > Team > Import History > [your import] > Download Error Report.

Customer: Found it! The error report shows 30 rows with "email already exists".

Agent: Those 30 users already have accounts in your workspace (or a linked workspace). The import skipped them to avoid duplicates. This is expected behavior.

Customer: Ah, makes sense — we merged with another company and some users were already in the system. Is there a way to see which accounts are theirs?

Agent: Yes — Settings > Team > Members > Filter > "Created before [merge date]" will show pre-existing accounts.

Resolution: CSV import skipped 30 duplicate email addresses. Error report available in import history. Silent skip is expected behavior to prevent duplicate accounts.`,
  },
  {
    ticket_id: "TKT-1064",
    subject: "User can't access documents after role change",
    tags: ["permissions", "access", "documents"],
    conversation: `Customer: I changed a user from Member to Viewer but they can still edit documents they created before the role change.

Agent: Viewers have read-only access to shared content, but they retain edit access to content they personally created. This is by design to prevent data loss when roles are downgraded.

Customer: We need to remove their edit access to everything, including their own content. This is for a contractor who finished their engagement.

Agent: For full read-only enforcement including their own content, you have two options:
1. Settings > Team > [user] > Advanced > "Revoke creator edit rights" (Enterprise feature)
2. Transfer ownership of their documents to another user, then they'll only have viewer access

Customer: I'll use option 2 — can I bulk transfer document ownership?

Agent: Yes — Settings > Content > Ownership Transfer. Select the user and choose a new owner for all their documents.

Resolution: Viewer role retains edit rights on own content by design. Bulk ownership transfer used for full access removal.`,
  },
  {
    ticket_id: "TKT-1065",
    subject: "Admin accidentally deleted a project — can it be recovered?",
    tags: ["data", "recovery", "admin", "delete"],
    conversation: `Customer: An admin accidentally deleted an entire project with 200+ documents. Can it be recovered?

Agent: Yes! Deleted projects go to Trash and are retained for 30 days. Go to Settings > Data > Trash > Projects and find the deleted project.

Customer: I see it in the trash! It says deleted 2 hours ago.

Agent: Click Restore. The project and all its documents will be restored to their previous location. The restore usually completes within a few minutes.

Customer: Restored! All 200+ documents are back. What a relief.

Agent: Glad we could recover it. Going forward, you can protect critical projects from accidental deletion by enabling "Delete Protection" in the project settings.

Resolution: Project restored from 30-day trash retention. 200+ documents recovered. Delete Protection feature recommended.`,
  },
  {
    ticket_id: "TKT-1066",
    subject: "API rate limit increase request — enterprise migration",
    tags: ["api", "rate-limit", "enterprise"],
    conversation: `Customer: We're migrating to your platform from a competitor. During migration we'll need to import ~5 million records via API. Our current limit won't be sufficient.

Agent: For large-scale migrations, we have a Migration Assistance program. I can arrange:
1. A 30-day elevated rate limit (100,000 requests/hour instead of 5,000)
2. A dedicated migration support engineer
3. A bulk import API endpoint that bypasses per-record rate limits

Customer: The bulk import API sounds perfect. How do we access it?

Agent: The bulk import endpoint is at POST /api/v2/bulk-import. It accepts up to 1,000 records per request. With your current Pro plan, you'd need to contact sales for migration support access.

Would you like me to connect you with our sales team for a Migration Support package?

Customer: Yes, please. This is time-sensitive.

Agent: I've sent a priority referral to our sales team. Expect a call within 2 business hours.

Resolution: Enterprise migration requiring elevated rate limits. Referral to sales for Migration Support package with bulk import API access.`,
  },
  {
    ticket_id: "TKT-1067",
    subject: "How to monitor API usage and remaining rate limit?",
    tags: ["api", "rate-limit", "monitoring"],
    conversation: `Customer: How can I monitor our API usage in real time? I want to alert before hitting rate limits.

Agent: Every API response includes rate limit headers:
- X-RateLimit-Limit: your hourly limit
- X-RateLimit-Remaining: requests remaining
- X-RateLimit-Reset: Unix timestamp when limit resets

Customer: We have hundreds of services making API calls. Is there a central dashboard?

Agent: Yes — Settings > Developer > API Usage shows real-time and historical usage graphs broken down by API key.

You can also set up usage alerts: Settings > Developer > API Keys > [key] > Set Alert. We'll notify you at 80% usage.

Customer: I set up alerts at 80% and 95%. And the dashboard is exactly what we needed.

Resolution: Customer guided to API usage dashboard and rate limit headers. Alert thresholds configured.`,
  },
  {
    ticket_id: "TKT-1068",
    subject: "Ticket status not updating via API",
    tags: ["api", "tickets", "status"],
    conversation: `Customer: PATCH /api/tickets/:id with status field doesn't seem to update the ticket status. No error returned.

Agent: The status field is an enum. Can you share the value you're passing?

Customer: We're sending status: "closed".

Agent: The valid values are lowercase: "open", "in_progress", "resolved", "closed". However, "closed" requires a resolution_note field to be included per our data model.

Customer: Ah, I see. We're not sending resolution_note. Is it required?

Agent: It's technically optional in the schema but a business rule requires it for "closed" status. The request succeeds but silently ignores the status change if resolution_note is missing. This should return a 422 error — I'll file a bug.

Add resolution_note: "Issue resolved" (or your actual resolution) and the status will update.

Customer: Added resolution_note and it's working. Thanks for the quick debug.

Resolution: Closing tickets requires resolution_note field. Silent failure (should be 422) — bug filed. Customer unblocked.`,
  },
  {
    ticket_id: "TKT-1069",
    subject: "Webhook events not delivered — endpoint returning 200 but marked failed",
    tags: ["webhooks", "developer", "delivery"],
    conversation: `Customer: Our webhook endpoint returns 200 OK but deliveries are marked as failed in our dashboard.

Agent: If the endpoint returns 200 but we still mark it as failed, the issue is usually with the response body or timing.

Our webhook system requires:
1. Response within 5 seconds (we timeout after that)
2. HTTP status 200-299
3. Any response body is fine

Customer: We process the webhook synchronously before responding — could that cause the 5-second timeout?

Agent: Yes! If your processing takes more than 5 seconds, our system times out and marks it failed even though your 200 comes eventually.

Fix: Respond with 200 immediately, then process the webhook asynchronously (queue it for background processing).

Customer: We added a queue and now respond immediately. Deliveries are all succeeding.

Resolution: Synchronous webhook processing exceeded 5-second timeout. Fixed by async queuing with immediate 200 response.`,
  },
  {
    ticket_id: "TKT-1070",
    subject: "Notification emails going to spam for all users",
    tags: ["email", "notifications", "deliverability"],
    conversation: `Customer: All our users report notification emails going to spam since yesterday.

Agent: A domain-wide spam classification often means our sending domain was recently added to a blocklist, or your email provider updated its spam filters.

Can you tell me which email provider your users use?

Customer: Most use Google Workspace and Outlook.

Agent: I checked our sending reputation — one of our IP addresses (198.51.100.2) was added to the Spamhaus blocklist yesterday due to abuse from another customer. We've rotated that IP and submitted a delisting request.

In the meantime, ask users to mark our emails as "Not Spam" to help their providers learn.

Customer: We also had IT add your domains to the safe senders list. Emails are in inbox now.

Resolution: Sending IP blocklisted due to abuse. IP rotated, delisting submitted. Corporate safe-sender list addition as workaround.`,
  },
  {
    ticket_id: "TKT-1071",
    subject: "Invitation email contains wrong workspace name",
    tags: ["onboarding", "email", "invite"],
    conversation: `Customer: Invitation emails sent to new hires show the wrong workspace name — it says "Test Workspace" instead of "Acme Corp".

Agent: Invitation emails use the workspace display name. It sounds like your workspace name wasn't updated after initial setup.

Go to Settings > Workspace > General > Workspace Name and update it to "Acme Corp". Future invitations will use the new name.

Customer: Updated! But what about invites already sent that show the wrong name?

Agent: Already-sent invite emails can't be retracted, but the invite link still works correctly. The workspace name shown to users after they accept will be the new correct name.

For pending invitees who haven't accepted yet, you could resend their invitations from Settings > Team > Pending Invitations > Resend.

Customer: Makes sense. We'll resend the outstanding invites.

Resolution: Workspace display name wasn't set from default. Updated name propagated to future invite emails. Pending invites resent.`,
  },
  {
    ticket_id: "TKT-1072",
    subject: "Team member onboarding checklist not completing",
    tags: ["onboarding", "team", "checklist"],
    conversation: `Customer: New team members complete all onboarding steps but the checklist never shows as 100% complete.

Agent: The onboarding checklist tracks specific events. Which steps are showing as incomplete?

Customer: "Explore a Project" is always unchecked even after they open a project.

Agent: The "Explore a Project" step requires users to navigate to a project AND open at least one document within it. Opening the project listing page alone doesn't trigger it.

Customer: That's not clear in the UI. Users think clicking on the project name is enough.

Agent: You're right — the tooltip should explain this. I'll file a UX improvement request. For now, let your new users know they need to click into a project and open a document.

Customer: Okay. Also, can admins manually mark steps as complete?

Agent: Admins can dismiss the checklist entirely for a user from Settings > Team > [user] > Onboarding > Mark Complete.

Resolution: Onboarding checklist "Explore a Project" requires opening a document, not just the project. UX improvement filed. Admin override available.`,
  },
  {
    ticket_id: "TKT-1073",
    subject: "Password policy not enforcing minimum length for existing users",
    tags: ["security", "password", "policy"],
    conversation: `Customer: We set a minimum password length of 12 characters in our security policy but existing users with shorter passwords can still log in.

Agent: Password policies apply to new passwords set after the policy is enabled. Existing passwords that meet the old requirements aren't invalidated retroactively, as that would lock users out immediately.

Customer: We need all users on the new policy for compliance. How do we enforce it?

Agent: You can force a password reset for all users: Settings > Security > Password Policy > Force Password Reset. This logs out all users and requires them to set a new password meeting the current policy on their next login.

Customer: Will they get notified before being logged out?

Agent: Yes — you can choose to notify users 24 or 48 hours in advance. They'll receive an email explaining they need to set a new password.

Customer: We'll do 48-hour notice. Initiating it now.

Resolution: Password policy change applies prospectively. Force password reset with 48-hour notice initiated for compliance.`,
  },
  {
    ticket_id: "TKT-1074",
    subject: "IP allowlisting locked out the whole team",
    tags: ["security", "ip-allowlist", "lockout"],
    conversation: `Customer: An admin enabled IP allowlisting and accidentally locked everyone including themselves out. The office IP wasn't in the allowlist.

Agent: This is a known risk with IP allowlisting. We have an emergency recovery process.

I'll need to verify your identity as an account owner before making changes. Can you provide:
1. Your registered email address
2. The organization name on the account
3. Last four digits of the card on file (or invoice amount)

Customer: [provided details]

Agent: Verified. I've temporarily disabled IP allowlisting on your account. You and your team can now log in.

Please log in, add your correct IP addresses to the allowlist, and then re-enable the feature.

Customer: We're in! Adding our office IP now.

Agent: Tip: always test IP allowlisting with at least two admins on different networks, or use the "Test before saving" option to validate access before committing.

Resolution: Emergency IP allowlist disable via identity verification. Customer re-enabled with correct IPs.`,
  },
  {
    ticket_id: "TKT-1075",
    subject: "How to set up automatic backups for our workspace?",
    tags: ["backup", "data", "admin"],
    conversation: `Customer: We want to set up automated backups to our own S3 bucket. Is this possible?

Agent: Yes — on Business and Enterprise plans, you can configure external backup destinations. Go to Settings > Data > Backup Destinations > Add Destination.

For S3:
1. Enter your S3 bucket name and region
2. Create an IAM user with PutObject permission on the bucket
3. Enter the access key and secret key
4. Set your backup schedule (daily recommended)
5. Test the connection before saving

Customer: What format are backups exported in?

Agent: Backups are ZIP archives containing:
- JSON export of all structured data (tickets, documents, users)
- Original files (attachments, images) in their original format
- A manifest.json describing the backup contents

Customer: And can we restore from an S3 backup?

Agent: Yes — Settings > Data > Restore from Backup > Upload from S3. Restoration from external backups is also supported on Business and Enterprise plans.

Resolution: Customer set up S3 external backup destination. Explained backup format and restore process.`,
  },
  {
    ticket_id: "TKT-1076",
    subject: "Analytics report shows 0 users for date range that had activity",
    tags: ["analytics", "reporting", "bug"],
    conversation: `Customer: Our analytics report shows 0 active users for March, but we know people were using the app all month.

Agent: This can happen if the report is filtering by a user segment that's empty. What filters do you have applied in the report?

Customer: I filtered by "Department = Engineering" and "Plan = Pro".

Agent: I see the issue — the "Plan" filter applies to the workspace plan, not individual user plans. If your workspace was on Business plan in March, filtering for Pro plan returns 0 results.

Customer: Ah! We upgraded from Pro to Business in February. So our March data is under Business plan.

Agent: Exactly. Remove the Plan filter or change it to "Business" to see your March Engineering activity.

Customer: Changed the filter — now showing 47 active users in March. That's correct.

Resolution: Analytics plan filter mismatch — workspace upgraded to Business plan but filter set to Pro. Corrected filter resolved empty report.`,
  },
  {
    ticket_id: "TKT-1077",
    subject: "Bulk export of tickets for analysis",
    tags: ["export", "tickets", "analytics"],
    conversation: `Customer: I need to export all 5,000+ tickets to CSV for analysis in Excel. The export button only gives me the current page (50 tickets).

Agent: For full data exports, use Settings > Analytics > Export > Tickets > Export All (CSV). This exports all tickets regardless of current page.

The export is emailed to you as a download link since large exports can take a few minutes.

Customer: I don't see an "Export All" option — only "Export Current View".

Agent: The Export All option is available starting on the Business plan. On Pro, you're limited to exporting the current view (up to 500 rows with pagination).

Alternatively, you can use our API to pull all tickets programmatically: GET /api/tickets?limit=100&cursor=... with cursor pagination.

Customer: We'll use the API. Thanks for the clear explanation.

Resolution: Full ticket export requires Business plan. Customer directed to API with cursor pagination as Pro-tier alternative.`,
  },
  {
    ticket_id: "TKT-1078",
    subject: "Real-time collaboration editing conflict",
    tags: ["collaboration", "editing", "sync"],
    conversation: `Customer: Two team members edited the same document simultaneously and now the document has mixed content from both edits with some parts overwritten.

Agent: Our real-time collaboration should handle simultaneous edits via operational transforms without overwrites. Which browser and app version were they using?

Customer: Both on Chrome. The document is a long-form article — around 10,000 words.

Agent: Very long documents (above ~8,000 words) can occasionally have sync issues in the current version. This is a known limitation tracked for a fix in v3.8.

For recovery: Settings > Data > Version History for that document. You'll find auto-saved versions from both editors. You can compare and merge manually or restore the best version.

Customer: Found version history — it saved a version 30 seconds before the conflict. Restoring that one.

Resolution: Real-time sync issue on documents >8,000 words. Restored from version history. Fix tracked for v3.8.`,
  },
  {
    ticket_id: "TKT-1079",
    subject: "How to transfer workspace ownership?",
    tags: ["admin", "ownership", "team"],
    conversation: `Customer: Our current workspace owner is leaving the company. How do we transfer ownership to a new person?

Agent: Workspace ownership can be transferred by the current owner in Settings > Workspace > Members > [new owner] > Transfer Ownership.

The new owner must:
1. Already be a member of the workspace
2. Have a verified email address

Customer: The current owner already left and their account is deactivated. Can someone else do it?

Agent: In that case, we need to do an administrative ownership transfer. This requires verification that you have authority over the organization.

Please submit a request to support@ourapp.com with:
1. Business domain email from the organization
2. Business registration document or official company ID
3. Names of at least two existing admins as references

Processing time: 2-3 business days.

Customer: We'll send in the documentation today. Is there anything we can do in the meantime?

Agent: Your existing admins retain full administrative capabilities except billing. You can continue using all features normally while the ownership transfer processes.

Resolution: Departed owner's account deactivated. Administrative ownership transfer initiated via identity verification process (2-3 days).`,
  },
  {
    ticket_id: "TKT-1080",
    subject: "Downtime notification — how to subscribe to status updates?",
    tags: ["status", "downtime", "notifications"],
    conversation: `Customer: We had downtime yesterday and weren't notified. How do we get notified of future incidents?

Agent: You can subscribe to status updates at status.ourapp.com:
1. Click "Subscribe to Updates"
2. Enter your email (or Slack webhook URL for Slack notifications)
3. Select which components you want alerts for

Customer: Can we also get webhook notifications to our monitoring system?

Agent: Yes — on the status page, choose "Webhook" as the notification method. We'll send POST requests to your endpoint with incident details in JSON format.

Customer: Done! We also noticed the incident yesterday lasted 47 minutes but we couldn't find the post-mortem.

Agent: Post-mortems are published on our status page within 72 hours of incident resolution. The post-mortem for yesterday's incident is being finalized — it'll be published by tomorrow.

Resolution: Customer subscribed to status.ourapp.com with webhook notifications. Directed to post-mortem publication timeline.`,
  },
  {
    ticket_id: "TKT-1081",
    subject: "How to configure SSO just-in-time provisioning?",
    tags: ["sso", "provisioning", "admin"],
    conversation: `Customer: We want new users to be automatically created when they log in via SSO for the first time, without pre-inviting each one. Is this supported?

Agent: Yes — this is called "Just-in-Time (JIT) Provisioning". Enable it in Settings > SSO > Provisioning > Just-in-Time Provisioning.

When enabled, new users from your identity provider are automatically created on first login with:
- Role: Member (default, configurable)
- Team assignment based on IdP group mapping

Customer: Can we restrict JIT provisioning to specific email domains?

Agent: Yes — Settings > SSO > Provisioning > Allowed Domains. Add your corporate domains (e.g., company.com). Only users with emails from those domains will be auto-provisioned.

Customer: Perfect. And if someone from an outside domain tries to log in via SSO?

Agent: They'll be rejected with an error: "Your email domain is not authorized for this workspace." They'd need to be manually invited.

Resolution: JIT provisioning enabled with domain restriction. External domain SSO login blocked.`,
  },
  {
    ticket_id: "TKT-1082",
    subject: "File upload failing for video files",
    tags: ["files", "upload", "video", "storage"],
    conversation: `Customer: Users on Pro plan get an error when uploading video files larger than 500MB. The error says "file too large".

Agent: The file size limit for Pro plan is 1GB per file. A 500MB video should be within limits. Can you share the exact error message?

Customer: The error is: "Upload failed: 413 Request Entity Too Large"

Agent: 413 errors come from our proxy layer, not the file size limit. This is a proxy timeout issue for very slow uploads. The proxy has a 30-minute upload window.

Are users on slow internet connections?

Customer: Some are on home WiFi. A 500MB video might take longer than 30 minutes on slow connections.

Agent: That's the issue. We're working on a resumable upload feature. For now, workarounds:
1. Compress videos before uploading (target under 200MB)
2. Upload from a faster network connection
3. Use our desktop app which has built-in upload retry logic

Resolution: Large video uploads time out on slow connections due to 30-minute proxy window. Resumable uploads in development. Compression/desktop app as workarounds.`,
  },
  {
    ticket_id: "TKT-1083",
    subject: "API - how to search tickets by keyword?",
    tags: ["api", "search", "tickets"],
    conversation: `Customer: Is there an endpoint to search tickets by keyword? I want to find all tickets mentioning "payment" in the conversation.

Agent: Yes — use GET /api/tickets/search with the q parameter:

\`GET /api/tickets/search?q=payment&fields=subject,conversation\`

The search is full-text across subject and conversation fields. Results are ranked by relevance.

Customer: Can we filter search results by date range too?

Agent: Yes — combine with date filters:
\`GET /api/tickets/search?q=payment&created_after=2024-01-01&created_before=2024-03-31\`

Customer: And is there a way to search across both tickets and documents in one query?

Agent: Use the unified search endpoint:
\`GET /api/search?q=payment&types=tickets,documents\`

This returns a mixed result set ranked by relevance across both content types.

Resolution: Customer guided on ticket search API, date filtering, and unified search endpoint.`,
  },
  {
    ticket_id: "TKT-1084",
    subject: "Shared document link expired — how to refresh?",
    tags: ["sharing", "documents", "links"],
    conversation: `Customer: A document share link we sent to a client expired. Can we generate a new one?

Agent: Yes — open the document, go to Share > Manage Links > Create New Link. The old link will be automatically invalidated.

Customer: How long are share links valid by default?

Agent: Default is 30 days. You can set custom expiry (7 days, 30 days, 90 days, or never expires) when creating the link.

Customer: Can we see when the link was last accessed?

Agent: Yes — Share > Manage Links shows access analytics: number of views, last accessed date, and access history per link.

Customer: Very useful. Can we password-protect share links?

Agent: Yes — when creating a share link, check "Require Password" and set a password. Recipients will need to enter it before viewing. Available on Pro plan and above.

Resolution: Share link refreshed. Customer educated on link expiry options, analytics, and password protection.`,
  },
  {
    ticket_id: "TKT-1085",
    subject: "Onboarding — can't complete email verification",
    tags: ["onboarding", "email", "verification"],
    conversation: `Customer: A new user can't complete email verification. They receive the verification email but clicking the link shows "verification link invalid or expired".

Agent: Verification links expire after 24 hours. When did they receive the email?

Customer: They got it 2 days ago but didn't check email immediately.

Agent: The link has expired. Have them request a new verification email from the login page — there's a "Resend verification email" link on the sign-in page.

Customer: They requested a new one but it still shows the same error.

Agent: There might be a link encoding issue — some email clients alter link URLs. Ask them to copy the link and open it in a browser directly rather than clicking.

Customer: That worked! Copy-pasting the link into the address bar completed verification.

Resolution: Verification link expired after 24 hours. New link issued. Email client altering link URL — fixed by copy-pasting URL directly into browser.`,
  },
  {
    ticket_id: "TKT-1086",
    subject: "API response includes deleted records",
    tags: ["api", "data", "bug"],
    conversation: `Customer: GET /api/documents is returning documents that have been deleted. They show deleted: true but they appear in list responses.

Agent: By default, our list API returns all records including soft-deleted ones (deleted: true) to support applications that need to track deletions. This is intentional for sync purposes.

Customer: We don't need deleted records. How do we filter them out?

Agent: Add the filter status=active to exclude deleted records:
\`GET /api/documents?status=active\`

Customer: That worked. But is there a way to make that the default so we don't forget?

Agent: You can set default query parameters on your API key. Go to Settings > Developer > API Keys > [your key] > Default Query Parameters and add status=active.

All requests using that key will automatically include that parameter.

Resolution: API returns soft-deleted records by design for sync. Workaround: status=active filter. API key default parameters configured.`,
  },
  {
    ticket_id: "TKT-1087",
    subject: "How to archive old tickets in bulk?",
    tags: ["tickets", "admin", "bulk-actions"],
    conversation: `Customer: We have 2,000 resolved tickets older than 1 year that we want to archive. Is there a bulk archive option?

Agent: Yes — Tickets > All Tickets > Filter by "Status: Resolved" and "Created: Before [date]" > Select All > Archive.

Note: bulk operations are limited to 500 records at a time, so you may need to run this 4 times for 2,000 tickets.

Customer: Can we automate this? We want old tickets auto-archived monthly.

Agent: Yes — Settings > Automation > New Rule:
- Trigger: Ticket updated (or on schedule: monthly)
- Condition: Status is Resolved AND Age > 365 days
- Action: Archive ticket

Customer: Created the automation rule. Will it process the existing 2,000 retroactively?

Agent: No — automation rules apply to future events. You'll need to do the initial bulk archive manually, then automation handles new ones going forward.

Resolution: Bulk archive with 500/batch limit for immediate cleanup. Automation rule created for monthly retroactive archiving going forward.`,
  },
  {
    ticket_id: "TKT-1088",
    subject: "Two-factor authentication enrollment report",
    tags: ["2fa", "security", "admin", "reporting"],
    conversation: `Customer: Our security team needs a report of who has and hasn't enrolled in 2FA. Where can we find this?

Agent: Go to Settings > Security > Authentication Policy > 2FA Enrollment Report. This shows:
- Total members
- Enrolled (count and %)
- Not enrolled (with list of users)
- Enrollment date per user

Customer: Can we export this to CSV?

Agent: Yes — click "Export to CSV" in the top right of the report.

Customer: Can we automate a weekly email of this report to our CISO?

Agent: Set up a scheduled report: Settings > Reports > Schedule > New Scheduled Report > Select "2FA Enrollment" > Weekly > Add CISO's email.

Customer: Done! This will save us a lot of manual work.

Resolution: 2FA enrollment report found in security settings. CSV export and weekly scheduled email configured for CISO.`,
  },
  {
    ticket_id: "TKT-1089",
    subject: "Confluence integration — pages not syncing",
    tags: ["confluence", "integration", "sync"],
    conversation: `Customer: We connected Confluence integration but our pages aren't appearing in the knowledge base.

Agent: After connecting Confluence, you need to select which spaces to sync. Go to Settings > Integrations > Confluence > Manage Sync > Select Spaces.

Customer: I see the space list. I selected our "Engineering Docs" space. Now what?

Agent: Click "Sync Now" to trigger an initial full sync. It may take 10-30 minutes for large spaces. Future updates sync automatically within 15 minutes of changes in Confluence.

Customer: I can see a sync in progress. How will I know when it's done?

Agent: You'll see a notification in the app and receive a summary email when the sync completes, including how many pages were imported.

Customer: Got the email — 847 pages synced! They're all showing in the knowledge base now.

Resolution: Confluence space not selected for sync. After selecting space and triggering sync, 847 pages imported.`,
  },
  {
    ticket_id: "TKT-1090",
    subject: "Zendesk ticket sync — attachments missing",
    tags: ["zendesk", "integration", "attachments"],
    conversation: `Customer: Zendesk tickets are syncing to our knowledge base but attachments from those tickets are missing.

Agent: Zendesk attachment sync requires additional permissions in your Zendesk API token. The token needs the "Attachments" read permission scope.

Customer: I set up the token from Zendesk Admin > API > Tokens. Let me check the scopes.

Agent: In Zendesk, go to Admin Center > Apps and Integrations > APIs > Zendesk API. Create a new OAuth token with the "read" scope (which includes attachments), instead of using an API token.

Customer: Created a new OAuth token. Updated it in our integration settings. Running a re-sync now.

Agent: Attachments sync can add significant time to the sync process depending on total attachment size.

Customer: Re-sync completed. Attachments are now showing on tickets!

Resolution: Zendesk API token lacked attachment read scope. Switched to OAuth token with full read scope. Re-sync restored attachments.`,
  },
  {
    ticket_id: "TKT-1091",
    subject: "Can't delete API key — it's in use by production system",
    tags: ["api", "security", "key-rotation"],
    conversation: `Customer: We suspect an API key has been leaked. We need to rotate it immediately but we're not sure all systems using it. Deleting it immediately would break things.

Agent: The safe rotation process:
1. Create a new API key in Settings > Developer > API Keys > New Key
2. Update each system gradually to use the new key
3. Monitor old key usage in Settings > Developer > API Usage — when it drops to 0, the old key is unused
4. Delete the old key

Customer: How do we see which systems are still using the old key?

Agent: Settings > Developer > API Keys > [old key] > Usage Breakdown shows requests by IP, user-agent, and endpoint. This helps you identify which systems are still using it.

Customer: Very helpful. Three of our five systems are still using the old key. Updating them now.

Resolution: Guided zero-downtime API key rotation using usage breakdown to identify remaining consumers.`,
  },
  {
    ticket_id: "TKT-1092",
    subject: "Account showing wrong timezone — dates are off",
    tags: ["account", "timezone", "settings"],
    conversation: `Customer: Ticket timestamps and report dates are all off by 8 hours. I'm in PST but everything shows in UTC.

Agent: Timezone is set per user in Profile > Account Settings > Timezone. If it's set to UTC, all times will display in UTC.

Customer: I set it to America/Los_Angeles. Do I need to log out?

Agent: No log-out needed — refresh the page and times should update immediately.

Customer: Refreshed — timestamps are now correct in PST!

Agent: Note: if you use our API, timestamps are always returned in UTC ISO 8601 format regardless of your profile timezone. The timezone setting only affects the web and mobile app displays.

Resolution: User timezone set to UTC instead of PST. Updated in profile settings. API timestamps always in UTC per documentation.`,
  },
  {
    ticket_id: "TKT-1093",
    subject: "How to enable dark mode in the app?",
    tags: ["settings", "ui", "appearance"],
    conversation: `Customer: Is there a dark mode option? The bright interface is hard on my eyes.

Agent: Yes! Dark mode is available in Profile > Appearance > Theme. Options are Light, Dark, and System (follows your OS setting).

Customer: Found it! Switched to Dark. Perfect.

Agent: The System option is popular — it automatically follows your device's light/dark preference throughout the day.

Resolution: Dark mode enabled via Profile > Appearance > Theme.`,
  },
  {
    ticket_id: "TKT-1094",
    subject: "Keyboard shortcuts not working after browser update",
    tags: ["ui", "browser", "keyboard"],
    conversation: `Customer: After updating Chrome, keyboard shortcuts like Ctrl+K for search stopped working.

Agent: Chrome extensions sometimes intercept keyboard shortcuts after browser updates. Try opening the app in an incognito window (no extensions) and test the shortcuts.

Customer: Incognito works fine. So it's an extension.

Agent: Go to chrome://extensions and check which extensions have keyboard shortcut conflicts. Look for extensions that use Ctrl+K (common in clipboard managers and note-taking extensions).

Customer: Found it — our clipboard manager was using Ctrl+K. Changed it in the extension settings. All shortcuts working now.

Resolution: Chrome extension keyboard shortcut conflict. User reassigned conflicting shortcut in extension settings.`,
  },
  {
    ticket_id: "TKT-1095",
    subject: "How to configure deployment with custom build commands?",
    tags: ["deploy", "build", "config"],
    conversation: `Customer: Our build process requires two commands to run in sequence: first \`npm run generate\` then \`npm run build\`. How do we configure this?

Agent: In Settings > Deployments > [your deployment] > Build Settings > Build Command, you can chain commands with &&:
\`npm run generate && npm run build\`

Customer: What about pre-build scripts that need environment variables?

Agent: All environment variables set in Settings > Deployments > Environment Variables are available during the build. You can reference them as $MY_VAR in shell commands.

Customer: Perfect. One more question — how do we specify which Node.js version to use?

Agent: Add a .nvmrc file to your repository root with the Node version (e.g., \`20.11.0\`). Our build system detects it automatically and installs that version.

Resolution: Chained build commands with &&. Environment variables available at build time. Node version via .nvmrc.`,
  },
  {
    ticket_id: "TKT-1096",
    subject: "CI/CD pipeline integration with deployments",
    tags: ["deploy", "cicd", "github-actions"],
    conversation: `Customer: Can we trigger deployments from GitHub Actions instead of auto-deploy on push?

Agent: Yes — disable auto-deploy and use our deploy API instead. In Settings > Deployments > [deployment] > Deployment Triggers, set to "Manual / API only".

Then in GitHub Actions:
\`\`\`yaml
- name: Deploy
  run: |
    curl -X POST https://api.ourapp.com/deployments/YOUR_ID/deploy \\
      -H "Authorization: Bearer \${{ secrets.OURAPP_API_KEY }}" \\
      -H "Content-Type: application/json" \\
      -d '{"branch": "main"}'
\`\`\`

Customer: Can we wait for the deployment to finish in the pipeline?

Agent: Yes — poll the deployment status endpoint:
GET /api/deployments/YOUR_ID/status

It returns a status field: building, deploying, live, or failed.

Customer: This is exactly what we needed. Our pipeline can now gate on deployment success.

Resolution: Manual deploy trigger via API configured. GitHub Actions pipeline polls deployment status for gating.`,
  },
  {
    ticket_id: "TKT-1097",
    subject: "Production app returning 502 errors intermittently",
    tags: ["deploy", "production", "502", "error"],
    conversation: `Customer: Our production deployment is returning 502 errors every few minutes for about 30 seconds, then recovering.

Agent: Intermittent 502s followed by recovery usually indicate:
1. Memory exhaustion causing process restarts
2. Crash-loop restarts
3. Health check failures during a slow startup

Check your app logs in Settings > Deployments > [deployment] > Logs. Look for crash or out-of-memory messages.

Customer: I see "JavaScript heap out of memory" errors before each 502 period.

Agent: Your app is OOMing and being restarted. Solutions:
1. Set NODE_OPTIONS=--max-old-space-size=2048 in environment variables
2. Investigate memory leaks (common causes: unclosed DB connections, large in-memory caches, event listener leaks)

Customer: Added NODE_OPTIONS. The 502s stopped! But we should still investigate the root cause.

Agent: Agreed — the NODE_OPTIONS is a band-aid. I'd recommend profiling your app with \`--inspect\` in staging to find the memory leak.

Resolution: OOM crashes causing 502s. NODE_OPTIONS increased heap. Root cause investigation recommended.`,
  },
  {
    ticket_id: "TKT-1098",
    subject: "Deploying to production — database migration failing",
    tags: ["deploy", "production", "database", "migration"],
    conversation: `Customer: Deployment succeeds but the app crashes immediately with "relation does not exist" — looks like database migrations aren't running.

Agent: Database migrations need to be run as part of your deployment process. They don't run automatically unless you configure them as a pre-deployment step.

In Settings > Deployments > [deployment] > Pre-deploy Command, set your migration command:
\`npm run db:migrate\` (or your equivalent)

This runs before traffic is switched to the new version, ensuring the DB is ready.

Customer: Added db:migrate as pre-deploy command. Redeployed and it worked!

Agent: One tip: always test migrations on a staging environment with a copy of production data before deploying to production. Migration errors on prod are the most common cause of outages.

Customer: We'll set that up. Can we also roll back migrations automatically if deployment fails?

Agent: Not automatically — DB rollbacks need to be manual since reverting data changes can be destructive. We recommend maintaining down migration scripts for each migration.

Resolution: Pre-deploy command configured for database migrations. Deployment succeeded. Staging migration testing recommended.`,
  },
  {
    ticket_id: "TKT-1099",
    subject: "Production logs — how to access and filter?",
    tags: ["deploy", "production", "logs", "debugging"],
    conversation: `Customer: Our production app has an issue but I can't find where to view production logs.

Agent: Production logs are available in Settings > Deployments > [your deployment] > Logs.

Features:
- Live tail (real-time streaming)
- Search by text
- Filter by log level (info, warn, error)
- Time range picker (last hour, day, week)

Customer: I see the logs but there are thousands of entries. How do I filter for just errors?

Agent: Use the Level filter: select "Error" to show only error-level logs. You can also use the search box to filter by text, e.g., type "UnhandledPromiseRejection" to find async errors.

Customer: Found the issue — a third-party API we call is returning 503 and we're not handling it gracefully. Can we set up alerts for errors?

Agent: Yes — Settings > Deployments > [deployment] > Alerts > New Alert. Set trigger to "Error rate exceeds 1% over 5 minutes" and add your email or Slack webhook.

Resolution: Production logs found in deployment settings. Error filtering enabled. Alert configured for elevated error rate.`,
  },
  {
    ticket_id: "TKT-1100",
    subject: "How do I deploy my app to production for the first time?",
    tags: ["deploy", "production", "onboarding", "getting-started"],
    conversation: `Customer: I've built my app in development and it's ready to go live. What are the steps to deploy to production for the first time?

Agent: Here's the complete first-time production deployment checklist:

1. **Review your code** — remove debug logs, hardcoded secrets, test credentials
2. **Set up environment variables** — in Settings > Deployments > New Deployment > Environment Variables. Add your production API keys, database URL, etc.
3. **Connect your repository** — link GitHub/GitLab in Settings > Deployments > New Deployment > Source
4. **Configure build** — set build command (e.g., \`npm run build\`) and output directory (\`dist\`)
5. **Set up your production database** — separate from dev database
6. **Configure custom domain** (optional) — Settings > Domains > Add Domain
7. **Click Deploy** — first deployment takes 2-5 minutes
8. **Verify** — check the deployment URL, test core flows, check logs for errors

Customer: My app uses a PostgreSQL database — do I need to create it separately?

Agent: Yes — create a production database in Settings > Databases > New Database. Then copy the DATABASE_URL from there into your deployment's environment variables.

Customer: Got it. And how do I make sure migrations run?

Agent: Set your migration command as a Pre-deploy Command in deployment settings (e.g., \`npm run db:migrate\`). It runs automatically before each deployment.

Customer: Deployed! Everything looks good. Thank you for the complete walkthrough.

Resolution: First-time production deployment completed. Production database provisioned, env vars configured, migrations set as pre-deploy command, custom domain configured.`,
  },
];

// ─── Seeding Function ────────────────────────────────────────────────────────

export async function seedDemoData(): Promise<{
  documents_seeded: number;
  tickets_seeded: number;
}> {
  logger.info("Starting demo data seed...");

  let docCount = 0;
  let ticketCount = 0;

  for (const doc of DEMO_DOCUMENTS) {
    try {
      const embedding = await embed(`${doc.title}\n\n${doc.content}`);
      await pool.query(
        `INSERT INTO documents (title, content, url, embedding)
         VALUES ($1, $2, $3, $4::vector)
         ON CONFLICT DO NOTHING`,
        [doc.title, doc.content, doc.url, `[${embedding.join(",")}]`]
      );
      docCount++;
      logger.info({ title: doc.title }, "Seeded document");
    } catch (err) {
      logger.error({ err, title: doc.title }, "Failed to seed document");
    }
  }

  for (const ticket of DEMO_TICKETS) {
    try {
      const text = `${ticket.subject}\n\n${ticket.conversation}`;
      const embedding = await embed(text);
      await pool.query(
        `INSERT INTO tickets (ticket_id, subject, conversation, tags, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)
         ON CONFLICT DO NOTHING`,
        [ticket.ticket_id, ticket.subject, ticket.conversation, ticket.tags, `[${embedding.join(",")}]`]
      );
      ticketCount++;
      logger.info({ subject: ticket.subject }, "Seeded ticket");
    } catch (err) {
      logger.error({ err, subject: ticket.subject }, "Failed to seed ticket");
    }
  }

  logger.info({ docCount, ticketCount }, "Seeding complete");
  return { documents_seeded: docCount, tickets_seeded: ticketCount };
}

export async function getSeedStatus(): Promise<{
  seeded: boolean;
  document_count: number;
  ticket_count: number;
}> {
  const { rows: docRows } = await pool.query<{ count: string }>("SELECT COUNT(*) as count FROM documents");
  const { rows: ticketRows } = await pool.query<{ count: string }>("SELECT COUNT(*) as count FROM tickets");
  const docCount = parseInt(docRows[0].count);
  const ticketCount = parseInt(ticketRows[0].count);
  return {
    seeded: docCount > 0 || ticketCount > 0,
    document_count: docCount,
    ticket_count: ticketCount,
  };
}

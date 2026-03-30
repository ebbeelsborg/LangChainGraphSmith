import os
import logging
from typing import List

import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)

_seed_status = "not_seeded"


# ─── Documents ────────────────────────────────────────────────────────────────
DEMO_DOCUMENTS = [
    {
        "title": "Password Reset Guide",
        "url": "/docs/password-reset",
        "content": """# Password Reset Guide

## How to Reset Your Password
If you've forgotten your password or want to change it:
1. Go to the login page and click "Forgot password?"
2. Enter your email address
3. Check your inbox for a reset email (check spam if not received within 5 minutes)
4. Click the secure link in the email (valid for 1 hour)
5. Enter and confirm your new password

## Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one number or special character

## Can't Receive Reset Email?
- Check your spam/junk folder
- Ensure you're using the correct email (the one associated with your account)
- Corporate email filters may block automated emails — ask IT to whitelist noreply@ourapp.com
- Contact support if you still haven't received it after 10 minutes""",
    },
    {
        "title": "Troubleshooting Login Issues",
        "url": "/docs/login-issues",
        "content": """# Troubleshooting Login Issues

## Common Login Problems

### Invalid Credentials
- Ensure Caps Lock is off
- Try copy-pasting your password to avoid typos
- Reset your password if unsure

### Account Locked
After 5 failed login attempts, accounts are temporarily locked for 15 minutes.
Contact support to unlock immediately if needed.

### Browser Issues
Clear cookies and cache, then try again. Our app requires cookies to be enabled.

### Two-Factor Authentication Problems
- Ensure your device clock is synced (TOTP is time-sensitive)
- Try a backup code from your account security settings
- Contact support if you've lost access to your 2FA device

## Still Can't Log In?
Contact support with your email address and we'll verify your identity and restore access.""",
    },
    {
        "title": "Billing FAQ",
        "url": "/docs/billing-faq",
        "content": """# Billing FAQ

## When Am I Charged?
You're billed on the same day each month (your subscription start date). Annual plans are charged once per year.

## What Payment Methods Are Accepted?
- All major credit/debit cards (Visa, Mastercard, Amex, Discover)
- PayPal
- Bank transfer (Enterprise plans only)

## Can I Get a Refund?
We offer pro-rated refunds within 14 days of a charge. Contact support with your account email.

## How Do I Update My Payment Method?
Settings > Billing > Payment Method > Update Card

## What Happens If Payment Fails?
We retry 3 times over 7 days. You'll receive email notifications. After 7 days, account is downgraded to free plan.

## Can I Get an Invoice?
Yes — Settings > Billing > Invoice History. All invoices are also emailed on charge date.

## Do You Offer Nonprofit or Educational Discounts?
Yes! Contact sales@ourapp.com with proof of status for 30-50% discount.""",
    },
    {
        "title": "Subscription Management",
        "url": "/docs/subscription",
        "content": """# Subscription Management

## Upgrading Your Plan
Settings > Billing > Plans > Select Plan > Upgrade
Upgrades are prorated — you're charged only for the remaining days in your billing cycle.

## Downgrading Your Plan
Settings > Billing > Plans > Select Plan > Downgrade
Downgrade takes effect at end of current billing period. Data above new plan limits is archived.

## Cancelling Your Subscription
Settings > Billing > Cancel Subscription
- Subscription remains active until end of current billing period
- Data is retained for 30 days after cancellation, then deleted
- Export your data before cancelling: Settings > Privacy > Export Data

## Pausing a Subscription
Business and Enterprise plans can pause subscriptions for 1-3 months.
Contact support to pause — billing resumes automatically at end of pause period.

## Reactivating After Cancellation
Log in > Settings > Billing > Reactivate. Your data is restored if within 30-day retention window.""",
    },
    {
        "title": "Checkout & Payment Troubleshooting",
        "url": "/docs/checkout-troubleshooting",
        "content": """# Checkout & Payment Troubleshooting

## Payment Declined
- Verify card details (number, expiry, CVV, billing address)
- Ensure your bank hasn't blocked the transaction — call your bank to authorize
- Try a different card or payment method
- Check if your card supports international transactions

## 3D Secure / Bank Authentication
EU/UK customers may see a bank authentication popup (3DS). If the popup doesn't appear:
- Disable popup blockers
- Try Chrome or Firefox (Safari can block 3DS popups)
- Corporate networks may block authentication iframes

## App Crashes at Checkout on iOS Safari
Safari's Intelligent Tracking Prevention (ITP) can interfere with payment forms.
- Try Chrome on iOS instead
- Or enable cross-website tracking temporarily in Safari Settings

## Double Charges
Two charges on the same day usually indicate: a plan upgrade proration + regular renewal.
Check your invoice history for descriptions. Contact support if charges appear identical.""",
    },
    {
        "title": "API Rate Limits",
        "url": "/docs/api-rate-limits",
        "content": """# API Rate Limits

## Rate Limit Tiers
| Plan | Requests/Hour | Requests/Second |
|------|--------------|----------------|
| Free | 100 | 5 |
| Pro | 5,000 | 50 |
| Business | 20,000 | 200 |
| Enterprise | Custom | Custom |

## Rate Limit Headers
Every API response includes:
- X-RateLimit-Limit: your hourly limit
- X-RateLimit-Remaining: requests remaining in current window
- X-RateLimit-Reset: Unix timestamp when limit resets

## Handling 429 Errors
Implement exponential backoff:
1. On 429, wait (2^attempt) seconds before retrying
2. Check X-RateLimit-Reset header for exact reset time
3. Distribute batch requests over time — avoid simultaneous bursts

## Burst Limits
Even if within hourly limits, rapid bursts can trigger per-second limits.
Recommended: max 50% of your per-second limit to leave headroom.

## Increasing Limits
Contact sales or use Settings > Developer > Request Limit Increase for Business/Enterprise plans.""",
    },
    {
        "title": "Data Export & GDPR",
        "url": "/docs/data-export",
        "content": """# Data Export & GDPR

## Exporting Your Data
Settings > Privacy > Export Data > Request Export
You'll receive an email with a download link within 24 hours (large accounts may take longer).

Export includes:
- All documents and files
- Comments and activity history
- Account settings and profile data
- Billing history (but not payment card details)

## GDPR Rights
As a GDPR-covered user, you have the right to:
- Access: request a copy of your data
- Rectification: correct inaccurate data
- Erasure: request deletion of your account and data
- Portability: receive data in machine-readable format

## Requesting Account Deletion
Settings > Account > Delete Account
Or email privacy@ourapp.com with your account email.
Data is permanently deleted within 30 days.

## Data Retention Policy
- Active account data: retained indefinitely
- Deleted account data: removed within 30 days
- Backup data: removed within 90 days of deletion request
- Audit logs: retained 7 years for legal compliance (anonymized after 2 years)""",
    },
    {
        "title": "Team Permissions and Roles",
        "url": "/docs/permissions",
        "content": """# Team Permissions and Roles

## Role Overview
- Owner: Full access, billing control, can delete workspace
- Admin: Manage users and settings, cannot access billing
- Member: Standard access to workspace content
- Viewer: Read-only access to shared content
- Guest: Access only to explicitly shared items

## Changing a User's Role
Settings > Team > Members > Click user > Change Role
Only Owners and Admins can change roles. Owners can only be changed by current Owner.

## Custom Roles (Business/Enterprise)
Create custom roles with specific permission sets:
Settings > Team > Roles > Create Role
Assign permissions granularly (create, edit, delete, share, admin).

## Guest Access
Guests are external users (e.g., contractors, clients) who need limited access.
Share specific items with guests: right-click item > Share > Invite by email

## Revoking Access
Settings > Team > Members > Click user > Remove from workspace
User loses access immediately. Their contributions remain in the workspace.""",
    },
    {
        "title": "Two-Factor Authentication Setup",
        "url": "/docs/2fa",
        "content": """# Two-Factor Authentication (2FA) Setup

## Enabling 2FA
Settings > Security > Two-Factor Authentication > Enable
We support:
- Authenticator apps (Google Authenticator, Authy, 1Password) — recommended
- SMS verification (less secure)
- Hardware security keys (FIDO2/WebAuthn) — Enterprise only

## Setting Up Authenticator App
1. Install an authenticator app (e.g., Authy)
2. Go to Settings > Security > 2FA > Set Up Authenticator
3. Scan the QR code with your authenticator app
4. Enter the 6-digit code to confirm
5. Save your backup codes somewhere safe!

## Backup Codes
You receive 10 single-use backup codes when enabling 2FA. Store them safely (password manager, printed paper). Use one if you lose access to your authenticator.

## Lost Access to 2FA Device
Contact support with your account email and a government ID for identity verification. We can disable 2FA after verification.

## 2FA for Teams (Enforce for All Members)
Settings > Security > Require 2FA for all team members (Admin/Owner only)""",
    },
    {
        "title": "Webhook Configuration",
        "url": "/docs/webhooks",
        "content": """# Webhook Configuration

## Creating a Webhook
Settings > Developer > Webhooks > Add Endpoint
- Enter your endpoint URL (must be HTTPS)
- Select events to subscribe to
- Copy the signing secret to verify payloads

## Verifying Webhook Signatures
All webhook payloads include X-Signature-SHA256 header.
Verify by computing HMAC-SHA256 of raw request body using your signing secret.

## Retry Policy
Failed deliveries (non-2xx responses or timeout >30s) are retried:
- Retry 1: 5 minutes after failure
- Retry 2: 30 minutes
- Retry 3: 2 hours
- Retry 4: 5 hours
After 5 failures, endpoint is automatically paused.

## Replaying Events
Settings > Developer > Webhooks > [endpoint] > Event Log > Replay
You can replay any event from the last 72 hours.

## Testing Webhooks
Use Settings > Developer > Webhooks > Send Test Event to verify your endpoint.
We recommend using a service like webhook.site during development.""",
    },
    {
        "title": "Mobile App Troubleshooting",
        "url": "/docs/mobile-troubleshooting",
        "content": """# Mobile App Troubleshooting

## App Won't Open / Crashes on Launch
1. Force close the app completely
2. Restart your phone
3. Update the app to the latest version (App Store / Google Play)
4. Reinstall if issue persists (data syncs from cloud on next login)

## Login Issues on Mobile
- SSO users: ensure your IdP redirect URI for mobile is registered (myapp://auth/callback for Azure AD)
- Clear app cache: Settings > Apps > [app] > Clear Cache
- Ensure you have a stable internet connection

## Slow Performance on Mobile
- Close background apps to free memory
- Disable background refresh if not needed
- Use Wi-Fi instead of cellular for large file operations
- Enable "Low Data Mode" in app settings for cellular efficiency

## Sync Issues
If data isn't syncing between mobile and web:
1. Log out and back in
2. Pull-to-refresh on the main screen
3. Profile > Settings > Sync > Force Sync
4. Contact support if issue persists — we can reset your sync state

## Push Notifications Not Working
- iOS: Settings > [App] > Notifications > Allow Notifications
- Android: Settings > Apps > [App] > Notifications > Allow
- Ensure "Do Not Disturb" mode isn't active""",
    },
    {
        "title": "SSO / SAML Configuration",
        "url": "/docs/sso-saml",
        "content": """# SSO / SAML Configuration

## Supported Identity Providers
- Okta
- Azure Active Directory
- Google Workspace
- OneLogin
- Any SAML 2.0-compliant IdP

## Setup Overview
Settings > Security > Single Sign-On > Configure SAML

Required values to enter in your IdP:
- ACS URL: https://app.ourapp.com/auth/saml/callback
- Entity ID: https://app.ourapp.com (no trailing slash)
- Name ID format: Email

## Common SAML Issues
### Redirect Loop
Usually caused by mismatched Entity ID. Check for trailing slashes.

### Invalid Signature
Certificate mismatch. Download fresh metadata XML from your IdP and re-upload.

### Attribute Mapping
Ensure your IdP sends email in the NameID or as attribute "email".

## Just-In-Time Provisioning
New users logging in via SSO are automatically created in your workspace.
Configure their default role in Settings > SSO > Default Role.

## Forcing SSO for All Users
Settings > Security > Require SSO > Enable
After enabling, users can no longer use password login.""",
    },
    {
        "title": "Storage Limits and File Management",
        "url": "/docs/storage",
        "content": """# Storage Limits and File Management

## Storage Limits by Plan
| Plan | Storage |
|------|---------|
| Free | 1 GB |
| Pro | 100 GB |
| Business | 1 TB |
| Enterprise | Custom |

## What Counts Toward Storage
- Uploaded files and attachments
- File versions (revision history)
- Items in trash (until emptied)
- Does NOT include: text content, comments, metadata

## Managing Storage
Settings > Storage to see breakdown by folder/project.

To free up space:
1. Empty Trash: Settings > Storage > Empty Trash
2. Reduce version history: Settings > Storage > Version History > Set max versions
3. Delete unused files and projects
4. Compress large files before uploading

## File Size Limits
- Single file upload: 2 GB (Pro+), 100 MB (Free)
- Upload multiple files simultaneously (up to 10 at once)

## External Storage Integration
Business/Enterprise plans can connect external storage (S3, Google Drive) to avoid limits.
Settings > Integrations > Storage Providers""",
    },
    {
        "title": "Onboarding Guide for New Users",
        "url": "/docs/onboarding",
        "content": """# Onboarding Guide for New Users

## Getting Started (First 15 Minutes)
1. Complete your profile: Settings > Profile
2. Explore the dashboard — it shows recent activity and recommended content
3. Create your first project: New > Project
4. Invite team members: Settings > Team > Invite

## Key Concepts
- Workspaces: Your organization's top-level container
- Projects: Team workspaces within your organization
- Documents: Rich-text content, wikis, notes
- Tasks: To-do items with assignees, due dates, priorities

## Importing Existing Data
We support importing from:
- Notion (pages, databases)
- Confluence (spaces, pages)
- Google Docs (documents)
Settings > Import to get started.

## Keyboard Shortcuts
- New document: N
- Search: Cmd/Ctrl + K
- Quick switch: Cmd/Ctrl + O
- Bold: Cmd/Ctrl + B
- Create task from text: Select text > T

## Getting Help
- Help center: help.ourapp.com
- In-app chat: Help icon in bottom left
- Video tutorials: help.ourapp.com/videos
- Community forum: community.ourapp.com""",
    },
    {
        "title": "Deploying to Production",
        "url": "/docs/deploying",
        "content": """# Deploying to Production

## Pre-Deployment Checklist
- [ ] All tests passing in CI
- [ ] Staging environment tested by QA
- [ ] Database migrations ready and tested
- [ ] Feature flags configured
- [ ] Rollback plan documented
- [ ] On-call team notified

## Deployment Process
1. Merge PR to main branch
2. CI/CD pipeline runs tests automatically
3. On success, deployment begins to staging
4. After staging validation, promote to production
5. Monitor dashboards for 30 minutes post-deploy

## Database Migrations
Run migrations before deploying new code:
```
npm run migrate:production
```
Always test migrations on staging with production data snapshot first.

## Rollback Procedure
If issues detected after deploy:
1. Trigger rollback in deployment dashboard
2. Previous version deployed within 2 minutes
3. Investigate issues before re-deploying
4. For data migrations: rollback scripts should be prepared in advance

## Feature Flags
Use feature flags for gradual rollouts:
- Start with 1% of users, monitor errors
- Increase to 10%, 50%, 100% over hours/days
- Kill switch: disable flag instantly without deployment

## Monitoring Post-Deploy
Watch: error rate, response time p99, database query time, memory usage""",
    },
    {
        "title": "API Authentication & Keys",
        "url": "/docs/api-auth",
        "content": """# API Authentication & API Keys

## Generating an API Key
Settings > Developer > API Keys > Create New Key

Best practices:
- Give each key a descriptive name (e.g., "production-integration")
- Set appropriate scopes (principle of least privilege)
- Rotate keys periodically (every 90 days recommended)

## Authenticating Requests
Include your API key in every request:
```
Authorization: Bearer YOUR_API_KEY
```

## API Key Scopes
| Scope | Access |
|-------|--------|
| read | Read all resources |
| write | Create and update resources |
| delete | Delete resources |
| admin | Full access including user management |

## Key Rotation
1. Generate new key in Settings > Developer > API Keys
2. Update your application configuration
3. Restart your application
4. Verify old key is invalidated (test a call — should get 401)

## OAuth 2.0
For user-facing applications, use OAuth 2.0 instead of API keys.
Authorization URL: https://app.ourapp.com/oauth/authorize
Token URL: https://app.ourapp.com/oauth/token

## Troubleshooting 401 Errors
- Verify Authorization header format: `Bearer <key>` (note the space)
- Check key is for correct environment (production vs staging)
- Ensure key has not expired or been rotated""",
    },
    {
        "title": "Slack Integration Guide",
        "url": "/docs/slack-integration",
        "content": """# Slack Integration Guide

## Connecting Slack
Settings > Integrations > Slack > Connect

You'll be redirected to Slack to authorize the connection. Select the workspace and channels to connect.

## What the Integration Does
- Post notifications to Slack when items are updated, commented on, or assigned
- Create tasks from Slack messages via /task command
- Receive daily digest of your activity in Slack
- Link Slack conversations to documents for context

## Slash Commands
- /task Create [title]: Create a task
- /task list: View your assigned tasks
- /search [query]: Search your workspace from Slack

## Configuring Notifications
Settings > Integrations > Slack > Notification Settings
Choose which events trigger Slack notifications:
- @mentions
- Task assignments
- Comment replies
- Project updates

## Disconnecting Slack
Settings > Integrations > Slack > Disconnect
This removes all webhook connections but retains your Slack-linked items.

## Troubleshooting
If notifications stop: re-authorize the connection (tokens can expire if workspace settings change)""",
    },
    {
        "title": "GitHub Integration Guide",
        "url": "/docs/github-integration",
        "content": """# GitHub Integration Guide

## Connecting GitHub
Settings > Integrations > GitHub > Connect with GitHub

Authorize the GitHub App to access your repositories.

## Features
- Link GitHub PRs and issues to tasks
- Automatically update task status when PR is merged
- Embed code snippets from GitHub in documents
- View open PRs and issues directly in your workspace

## Linking a PR to a Task
In GitHub PR description, add: Closes #[task-id]
Or use the link button in the task sidebar.

## Auto-Status Updates
Configure in Settings > Integrations > GitHub > Automation:
- PR opened → Task moves to "In Review"
- PR merged → Task moves to "Done"
- PR closed (unmerged) → Task moves back to "In Progress"

## Branch Creation from Tasks
Click "Create Branch" on any task to create a linked GitHub branch.
Branch is named: [task-id]-[task-title-slugified]

## Troubleshooting
- Repository not appearing: Ensure GitHub App has access to the repo in GitHub App settings
- Status not syncing: Check webhook deliveries in Settings > Integrations > GitHub > Webhook Log""",
    },
    {
        "title": "Custom Domain Configuration",
        "url": "/docs/custom-domain",
        "content": """# Custom Domain Configuration

## Setting Up a Custom Domain
Business and Enterprise plans can use a custom domain (e.g., docs.yourcompany.com).

Settings > Workspace > Custom Domain > Add Domain

Steps:
1. Enter your domain (e.g., docs.yourcompany.com)
2. Copy the CNAME record we provide
3. Add the CNAME in your DNS provider (TTL: 300 seconds recommended)
4. Click Verify — propagation takes 1-24 hours
5. SSL certificate is auto-provisioned via Let's Encrypt

## DNS Configuration
Add a CNAME record:
- Name: docs (or your subdomain)
- Value: custom.ourapp.com
- TTL: 300

## SSL Certificates
SSL is automatically provisioned and renewed. If SSL shows errors:
- Ensure CNAME is correctly configured
- Wait up to 24 hours for propagation
- Contact support if still failing after 24 hours

## Custom Domain for Email
To send notifications from your domain:
Settings > Workspace > Email Branding > Configure

Add SPF, DKIM, and DMARC records per our instructions.

## Removing a Custom Domain
Settings > Workspace > Custom Domain > Remove
Users are redirected to yourcompany.ourapp.com automatically.""",
    },
    {
        "title": "Audit Log & Activity History",
        "url": "/docs/audit-log",
        "content": """# Audit Log & Activity History

## Accessing Audit Logs
Settings > Security > Audit Log (Admin/Owner access required)

## What's Logged
- User login/logout (including IP address and device)
- Failed login attempts
- Permission changes
- Document creation, edit, deletion
- File uploads and downloads
- API key creation and deletion
- Billing changes
- SSO configuration changes
- Admin actions (role changes, user removal)

## Filtering Audit Logs
Filter by:
- User (search by email)
- Event type
- Date range
- IP address

## Exporting Audit Logs
Audit Log > Export > CSV or JSON
Enterprise plans: integrate with SIEM systems via webhook or API:
GET /api/audit-logs?from=&to=&event_type=

## Retention
- Business plan: 90 days of logs
- Enterprise plan: 1 year (custom retention available)

## Real-time Alerts
Enterprise plans can configure alerts for security events:
Settings > Security > Alerts > Configure
E.g., alert on login from new country, multiple failed attempts, privilege escalation""",
    },
    {
        "title": "Data Backup and Recovery",
        "url": "/docs/backup-recovery",
        "content": """# Data Backup and Recovery

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
- Uptime SLA: 99.9% (Business), 99.95% (Enterprise)""",
    },
    {
        "title": "Error Codes Reference",
        "url": "/docs/error-codes",
        "content": """# API Error Codes Reference

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
```json
{
  "error": "rate_limit_exceeded",
  "message": "You have exceeded your rate limit",
  "retry_after": 3600
}
```""",
    },
    {
        "title": "Analytics & Reporting",
        "url": "/docs/analytics",
        "content": """# Analytics and Reporting

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
GET /api/analytics/metrics?from=2024-01-01&to=2024-01-31&metric=active_users""",
    },
    {
        "title": "Performance & Troubleshooting Guide",
        "url": "/docs/performance",
        "content": """# Performance & Troubleshooting Guide

## App Feels Slow — Quick Checks
1. Browser: Try a hard refresh (Ctrl+Shift+R / Cmd+Shift+R) to clear cached assets
2. Extensions: Disable browser extensions — ad blockers and script blockers can add 200-500ms per page load
3. Network: Run a speed test. If your connection is slow, switch to the mobile app which is optimized for lower bandwidth
4. Device: Close unused tabs and applications to free memory

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
- Network tab HAR file for slow load diagnosis""",
    },
    {
        "title": "Webhook Event Reference",
        "url": "/docs/webhook-events",
        "content": """# Webhook Events Reference

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
```json
{
  "event": "ticket.created",
  "id": "evt_01HZ3K",
  "created_at": "2024-06-15T10:23:00Z",
  "data": { ... }
}
```

## Signature Verification
```javascript
const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
hmac.update(rawBody);
const signature = hmac.digest('hex');
if (signature !== req.headers['x-signature']) throw new Error('Invalid');
```""",
    },
]


# ─── Tickets ──────────────────────────────────────────────────────────────────
DEMO_TICKETS = [
    {
        "ticket_id": "TKT-1001",
        "subject": "User cannot log in after password reset",
        "tags": ["login", "password", "bug"],
        "conversation": """Customer: Hi, I reset my password but I still can't log in. I keep getting "invalid credentials" even with the new password.

Agent: Sorry to hear that! Let's troubleshoot. Can you confirm you're using the email address you received the reset link at?

Customer: Yes, same email. I clicked the link, set a new password, it said success, but then when I try to login with the new password it doesn't work.

Agent: Could you try clearing your browser cookies and cache, then trying again? Sometimes old session data causes this.

Customer: That worked! Thank you!

Agent: Great! The issue was stale session cookies. Your account is working normally now.

Resolution: Browser cookie cache was storing old session data. Clearing cookies resolved the issue.""",
    },
    {
        "ticket_id": "TKT-1002",
        "subject": "Payment failing for EU customers - Stripe 3DS",
        "tags": ["billing", "payment", "eu", "stripe", "sca"],
        "conversation": """Customer: We have multiple EU customers reporting that payments are failing. They see an error "Payment requires authentication" and then nothing happens.

Agent: This sounds like a Strong Customer Authentication (SCA) issue. EU regulations require 3D Secure verification for most card payments. Is the popup appearing?

Customer: No popup appears. The button just spins and then shows the error.

Agent: The 3DS popup may be blocked by a popup blocker or the browser. Please ask customers to disable popup blockers temporarily and try Chrome or Firefox.

Customer: One customer tried Chrome and it worked! But the others are on corporate machines.

Agent: For corporate users, you may need to whitelist stripe.com in the browser settings.

Resolution: 3DS popup blocked by browser/corporate security settings. Workaround: use Chrome and disable popup blockers.""",
    },
    {
        "ticket_id": "TKT-1003",
        "subject": "App crashes at checkout page on iOS Safari",
        "tags": ["mobile", "ios", "safari", "checkout", "crash"],
        "conversation": """Customer: Our checkout page crashes every time on iPhone. Users can't complete purchases.

Agent: Is this happening on a specific iOS version? And are users on Safari?

Customer: iOS 16 and 17, Safari browser. Chrome on the same phone works fine.

Agent: Safari on iOS has strict third-party cookie policies that can interfere with Stripe Elements. Engineering has confirmed this is a known issue with Safari ITP. Fix is scheduled for the next release (2 weeks). In the meantime, directing Safari users to Chrome is the workaround.

Resolution: Safari ITP blocks Stripe Elements third-party cookies. Fix pending in next release. Workaround: use Chrome on iOS.""",
    },
    {
        "ticket_id": "TKT-1004",
        "subject": "Account locked out after password attempts",
        "tags": ["login", "locked", "security"],
        "conversation": """Customer: I tried logging in several times and now my account is locked.

Agent: Accounts lock after 5 failed login attempts. I can see your account was locked after 5 failed attempts. I'm unlocking it now.

Customer: Thank you! But why did my password stop working?

Agent: Did you recently receive a "successful login from new location" notification? I'll flag this for our security team. Please change your password and enable 2FA.

Resolution: Account unlocked. Possible unauthorized access attempt. User advised to reset password and enable 2FA.""",
    },
    {
        "ticket_id": "TKT-1005",
        "subject": "Double charge on invoice - billing error",
        "tags": ["billing", "refund", "duplicate-charge"],
        "conversation": """Customer: I was charged twice this month. I can see two identical charges on my bank statement.

Agent: I can see in our system there were indeed two charges. It looks like you upgraded your plan on the 1st, which generated a prorated charge, and then the regular monthly renewal also hit on the 3rd. These are actually two different charges (not duplicates), but I understand the confusion. I'll apply a credit of $49 as a goodwill gesture.

Customer: Yes please, that would be appreciated.

Resolution: Two legitimate charges (upgrade prorate + renewal) coincidentally equal amounts caused confusion. Goodwill credit applied.""",
    },
    {
        "ticket_id": "TKT-1006",
        "subject": "Can't receive password reset email",
        "tags": ["login", "password", "email", "spam"],
        "conversation": """Customer: I requested a password reset 3 times but never received the email.

Agent: Have you checked your spam/junk folder? The emails were sent successfully. This might be a corporate email filter issue. Could you have your IT team whitelist: noreply@ourapp.com?

Customer: I can ask IT but this is urgent.

Agent: I can verify your identity via our manual process. I've manually reset your password to a temporary one.

Resolution: Corporate email filter blocking reset emails. Manually verified user and issued temporary password.""",
    },
    {
        "ticket_id": "TKT-1007",
        "subject": "API returning 429 errors - rate limit exceeded",
        "tags": ["api", "rate-limit", "integration"],
        "conversation": """Customer: Our integration is suddenly getting 429 errors from your API.

Agent: 429 means you've hit the rate limit. Even if you're within hourly limits, concurrent burst requests trigger per-second rate limits. If you have a batch job that fires 500 requests almost simultaneously, that's the issue.

Customer: Ah yes, we have a batch job. We'll add a queue.

Agent: I can add a temporary rate limit increase for 48 hours while you implement the queue.

Resolution: Burst requests exceeding per-second limits. Temporary limit increase granted. Customer implementing request queue.""",
    },
    {
        "ticket_id": "TKT-1008",
        "subject": "Team member unable to access shared workspace",
        "tags": ["permissions", "access", "team"],
        "conversation": """Customer: A new team member I invited can't access our workspace. They accepted the invite but see an empty dashboard.

Agent: The invite was created with "Viewer" role. With Viewer access, users can see content but the dashboard appears empty if there's no content shared with viewers explicitly. I've updated his role from Viewer to Member.

Customer: That fixed it! But why was Viewer the default?

Agent: "Viewer" is our default role for external invites to protect content. When inviting internal teammates, consider selecting "Member" explicitly.

Resolution: User assigned Viewer role instead of Member. Role updated to Member.""",
    },
    {
        "ticket_id": "TKT-1009",
        "subject": "Webhook not triggering for file upload events",
        "tags": ["webhooks", "api", "developer"],
        "conversation": """Customer: We configured webhooks for file.uploaded events but they're not triggering.

Agent: I see the webhook fired 8 times in the last 24 hours for file.uploaded events, but your endpoint returned 500 errors. After 5 consecutive failures, we temporarily paused deliveries to that endpoint.

Customer: Oh! We didn't know webhooks could be paused. Our endpoint had a bug.

Agent: To re-enable: Settings > Developer > Webhooks > [your endpoint] > Resume Deliveries.

Resolution: Webhook endpoint paused after repeated 500 errors. Customer fixed endpoint and resumed deliveries.""",
    },
    {
        "ticket_id": "TKT-1010",
        "subject": "Data not syncing between mobile and web",
        "tags": ["mobile", "sync", "bug"],
        "conversation": """Customer: Changes I make on mobile don't appear on the web and vice versa.

Agent: There's a sync backlog flag on your account. Try: 1) Log out and back in on both devices, 2) Pull to refresh on mobile.

Customer: Web is showing the file now! But mobile still doesn't show recent web changes.

Agent: On mobile, try going to Profile > Settings > Sync > Force Sync.

Customer: That worked! Everything is showing correctly now.

Resolution: Sync backlog on account. Force sync resolved the issue.""",
    },
    {
        "ticket_id": "TKT-1011",
        "subject": "Can't cancel subscription - button not working",
        "tags": ["billing", "cancellation", "bug"],
        "conversation": """Customer: I'm trying to cancel my subscription but the Cancel button doesn't do anything.

Agent: This is a known issue in Safari on older macOS versions. The cancellation flow uses a JavaScript dialog that's blocked in certain Safari security settings. Workaround: try Chrome or Firefox. Or I can process the cancellation for you.

Customer: Please cancel it for me. Effective end of billing period.

Agent: Confirmed — I've cancelled your subscription. It will remain active until your next billing date, after which it will downgrade to the free plan.

Resolution: Cancel button not working in Safari/macOS. Manually cancelled subscription.""",
    },
    {
        "ticket_id": "TKT-1012",
        "subject": "2FA codes not working",
        "tags": ["2fa", "security", "login"],
        "conversation": """Customer: My 2FA codes stopped working. I can't log in.

Agent: 2FA TOTP codes can fail if your device's clock is out of sync. Can you check: Settings > General > Date & Time > Set Automatically (should be ON)?

Customer: I turned off automatic time a while ago. Let me turn it back on. Codes are working now!

Agent: TOTP codes are generated based on the current time. If your device clock drifts even 30-60 seconds, codes become invalid.

Resolution: Device clock not synced. Enabling automatic time sync resolved TOTP code failures.""",
    },
    {
        "ticket_id": "TKT-1013",
        "subject": "Storage full warning - can't upload files",
        "tags": ["storage", "files", "plan"],
        "conversation": """Customer: I'm getting "storage full" errors and can't upload any new files. We're on the free plan.

Agent: The free plan includes 1 GB. You've used 987 MB. To free up space: 1) Empty your trash, 2) Remove old file versions from Settings > Storage, 3) Delete unused files.

Customer: I emptied the trash. Also turned version history to 5 versions max. That freed another 200 MB.

Resolution: Trash and version history consuming storage quota. User freed space by emptying trash and limiting version history.""",
    },
    {
        "ticket_id": "TKT-1014",
        "subject": "Invitation link expired before new hire could use it",
        "tags": ["team", "onboarding", "invite"],
        "conversation": """Customer: We sent an invite to a new employee but she didn't use it in time and now it says expired.

Agent: Invitations expire after 72 hours for security reasons. I've resent the invitation. As a workaround: send the invite closer to the employee's start date.

Resolution: Invitation expired (72h limit). Resent invite.""",
    },
    {
        "ticket_id": "TKT-1015",
        "subject": "SAML SSO redirect loop after Okta configuration",
        "tags": ["sso", "saml", "okta", "login"],
        "conversation": """Customer: We set up SAML SSO with Okta. Now when users try to log in they get stuck in a redirect loop.

Agent: Redirect loops in SAML usually mean the Entity ID is misconfigured. Entity ID should be: https://app.ourapp.com (no trailing slash).

Customer: Entity ID was https://app.ourapp.com/ (with trailing slash). Fixed it! Users can now log in.

Resolution: Trailing slash in Entity ID caused SAML assertion validation failure. Removing trailing slash resolved redirect loop.""",
    },
    {
        "ticket_id": "TKT-1016",
        "subject": "Billing emails going to wrong address",
        "tags": ["billing", "email", "account"],
        "conversation": """Customer: Our billing invoices are being sent to a former employee's email.

Agent: You can update the billing email in Settings > Billing > Billing Contact. Only account owners can change the billing email. Since the owner is the former employee, I'll escalate to our accounts team for ownership transfer.

Resolution: Billing contact update requires owner access. Account team escalation initiated for ownership transfer.""",
    },
    {
        "ticket_id": "TKT-1017",
        "subject": "Mobile app login requires password even with SSO",
        "tags": ["mobile", "sso", "login"],
        "conversation": """Customer: Our company uses SSO (Azure AD). It works fine on web but the mobile app is asking for a password.

Agent: The mobile app needs its own redirect URI registered in Azure AD. Add: myapp://auth/callback under Mobile and desktop applications.

Customer: Added it! Testing now... Yes! SSO is now working on mobile.

Resolution: Mobile app redirect URI not registered in Azure AD. Adding myapp://auth/callback resolved SSO on mobile.""",
    },
    {
        "ticket_id": "TKT-1018",
        "subject": "Export taking too long / timing out",
        "tags": ["export", "data", "timeout"],
        "conversation": """Customer: I requested a data export yesterday and haven't received the email yet.

Agent: Your export job is stuck in a queue. Your account has about 45 GB of data, which requires extended processing. I've manually prioritized your export job. For future exports, you can export by date range or content type for faster results: Settings > Privacy > Export Data > Custom Range.

Resolution: Large account export (45GB) stuck in processing queue. Manually prioritized.""",
    },
    {
        "ticket_id": "TKT-1019",
        "subject": "Getting charged after cancellation",
        "tags": ["billing", "cancellation", "refund"],
        "conversation": """Customer: I cancelled my subscription last month but I was charged again this month.

Agent: I can see you submitted a cancellation on March 3rd, but there was an error in our system that did not process the cancellation correctly. I'm issuing a full refund right now and cancelling your subscription effective immediately.

Resolution: Cancellation not processed due to system error. Full refund issued. Subscription cancelled.""",
    },
    {
        "ticket_id": "TKT-1020",
        "subject": "Notification emails not arriving",
        "tags": ["email", "notifications", "deliverability"],
        "conversation": """Customer: Team members aren't receiving notification emails. Our IT team switched to a new email gateway 3 days ago.

Agent: New email gateways often have strict filtering. Your IT team needs to whitelist our sending domains: noreply@ourapp.com, notifications@ourapp.com. Also add our SPF record.

Customer: IT has whitelisted the domains. Emails are arriving!

Resolution: New corporate email gateway blocking transactional emails. IT team whitelisted our domains.""",
    },
    {
        "ticket_id": "TKT-1021",
        "subject": "How to bulk import users / CSV upload",
        "tags": ["onboarding", "team", "import"],
        "conversation": """Customer: We're onboarding 200 new employees at once. Do you support bulk user import?

Agent: Yes! Settings > Team > Members > Import CSV. The CSV format requires: email (required), first_name, last_name, role. Up to 500 users per import. Team assignments need to be done after import via our API: POST /api/teams/{id}/members.

Resolution: User guided on CSV bulk import. Team assignment via API as workaround.""",
    },
    {
        "ticket_id": "TKT-1022",
        "subject": "Billing plan shows wrong features",
        "tags": ["billing", "plan", "display-bug"],
        "conversation": """Customer: I upgraded to Business plan but my account still shows Pro plan features.

Agent: The payment was successful and the Business plan was applied, but the feature flags weren't updated properly. I've manually triggered a plan re-sync.

Customer: Now it shows Business plan correctly!

Resolution: Plan upgrade payment successful but UI feature flags not updated. Manual plan re-sync resolved display issue.""",
    },
    {
        "ticket_id": "TKT-1023",
        "subject": "API key stopped working after rotation",
        "tags": ["api", "developer", "authentication"],
        "conversation": """Customer: I rotated my API key yesterday and now API calls are failing with 401 Unauthorized.

Customer: I updated the environment variable but didn't restart the application. The old key was cached in memory.

Agent: Many applications read environment variables only at startup. Restarting ensures the new key is loaded.

Customer: Restarted the app, API calls working again.

Resolution: Application cached old API key in memory. Restart after environment variable update resolved the 401 errors.""",
    },
    {
        "ticket_id": "TKT-1024",
        "subject": "Users seeing each other's private data",
        "tags": ["security", "data-leak", "urgent", "permissions"],
        "conversation": """Customer: URGENT: Users are seeing each other's private notes.

Agent: Your workspace has "Share all notes with team" enabled in Settings > Workspace > Defaults. This setting was changed 3 days ago by a former admin account. I'm immediately disabling that account and reverting the setting.

Resolution: Former admin account enabled global note sharing. Account disabled, setting reverted.""",
    },
    {
        "ticket_id": "TKT-1025",
        "subject": "Slack integration stopped posting notifications",
        "tags": ["integrations", "slack", "notifications"],
        "conversation": """Customer: Our Slack integration stopped posting notifications yesterday. It was working fine before.

Agent: Slack integrations can stop if the OAuth token expires (e.g., if workspace admin revoked app access or changed permissions). Please re-authorize: Settings > Integrations > Slack > Reconnect.

Customer: Re-authorized. Notifications are flowing again!

Resolution: Slack OAuth token expired/revoked. Re-authorization resolved notification delivery.""",
    },
    {
        "ticket_id": "TKT-1026",
        "subject": "How to set up custom user roles",
        "tags": ["permissions", "admin", "roles"],
        "conversation": """Customer: We need a role that can view everything but only edit documents in their own team.

Agent: Custom roles are available on Business and Enterprise plans. Go to Settings > Team > Roles > Create Role. You can grant workspace-level read access and restrict write permissions to specific project types. Would you like me to walk you through the exact configuration?

Customer: Yes please.

Agent: Set permissions: global_read: true, document_write: team_only. This gives your users read access across the workspace but restricts document editing to their own team's projects.

Resolution: Custom role created with global read and team-scoped document write access.""",
    },
    {
        "ticket_id": "TKT-1027",
        "subject": "Can't connect GitHub repository",
        "tags": ["integrations", "github", "developer"],
        "conversation": """Customer: When I try to connect our GitHub repository, I get "Repository not found" error even though it exists.

Agent: This usually means the GitHub App doesn't have access to that specific repository. In GitHub: Settings > Applications > [App Name] > Repository access > Add the repository.

Customer: Found it — the app only had access to specific repos and ours wasn't listed. Added it and the connection works now!

Resolution: GitHub App had limited repository access. Added repository to app permissions.""",
    },
    {
        "ticket_id": "TKT-1028",
        "subject": "Slow loading on large workspace",
        "tags": ["performance", "workspace", "loading"],
        "conversation": """Customer: Our workspace has grown to about 15,000 items and everything is now very slow.

Agent: Large workspaces (10,000+ items) require optimization. Try: Settings > Performance > Enable Lazy Loading. This loads content on demand rather than all at once. Also use filters and search to narrow your view rather than browsing full lists.

Customer: Enabled lazy loading. It's noticeably faster now.

Resolution: Lazy loading enabled for large workspace. Performance improved.""",
    },
    {
        "ticket_id": "TKT-1029",
        "subject": "GDPR data deletion request",
        "tags": ["gdpr", "privacy", "data-deletion"],
        "conversation": """Customer: A former user has submitted a GDPR deletion request. How do I process it?

Agent: You can initiate account deletion from Settings > Team > Members > [user] > Delete Account & Data. This removes their personal data within 30 days. Their work contributions (documents, comments) are anonymized but retained for workspace integrity. You'll receive a confirmation email when deletion is complete.

Resolution: GDPR deletion request processed via admin panel.""",
    },
    {
        "ticket_id": "TKT-1030",
        "subject": "Audit logs not showing all events",
        "tags": ["security", "audit", "compliance"],
        "conversation": """Customer: Our compliance team says the audit logs are missing events from last Tuesday.

Agent: Checking your audit log... I can see a 4-hour gap between 14:00 and 18:00 UTC on Tuesday. This coincides with a planned infrastructure maintenance window. Events during that window were logged but there was a 2-hour delay in processing. The events are now visible — try setting the filter to include the full day rather than the specific hours.

Customer: Found the events! They were just appearing later in the log than expected.

Resolution: Events delayed during maintenance window. Events present but with timestamp offset.""",
    },
]


# ─── Seed status ──────────────────────────────────────────────────────────────
def get_seed_status() -> dict:
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM documents")
                doc_count = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM tickets")
                ticket_count = cur.fetchone()[0]

        if doc_count > 0 or ticket_count > 0:
            return {
                "seeded": True,
                "document_count": doc_count,
                "ticket_count": ticket_count,
            }
        return {"seeded": False, "document_count": 0, "ticket_count": 0}
    except Exception as e:
        logger.error(f"Error checking seed status: {e}")
        return {"seeded": False, "document_count": 0, "ticket_count": 0}


def get_db_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def vector_to_pg(vec: List[float]) -> str:
    return "[" + ",".join(str(v) for v in vec) + "]"


def run_seed() -> dict:
    global _seed_status
    _seed_status = "seeding"
    try:
        from fastembed import TextEmbedding
        import os as _os
        _cache_dir = _os.path.join(_os.path.dirname(__file__), ".model_cache")
        logger.info(f"Loading fastembed model (cache: {_cache_dir})...")
        model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5", cache_dir=_cache_dir)

        conn = get_db_conn()
        cur = conn.cursor()

        logger.info("Truncating existing data...")
        cur.execute("TRUNCATE TABLE tickets RESTART IDENTITY CASCADE")
        cur.execute("TRUNCATE TABLE documents RESTART IDENTITY CASCADE")
        conn.commit()

        logger.info(f"Seeding {len(DEMO_DOCUMENTS)} documents...")
        for doc in DEMO_DOCUMENTS:
            text_to_embed = f"{doc['title']}\n{doc['content']}"
            embedding = list(model.embed([text_to_embed]))[0].tolist()
            vec_str = vector_to_pg(embedding)
            cur.execute(
                """
                INSERT INTO documents (title, url, content, embedding)
                VALUES (%s, %s, %s, %s::vector)
                """,
                (doc["title"], doc["url"], doc["content"], vec_str),
            )
        conn.commit()

        logger.info(f"Seeding {len(DEMO_TICKETS)} tickets...")
        for ticket in DEMO_TICKETS:
            text_to_embed = f"{ticket['subject']}\n{ticket['conversation']}"
            embedding = list(model.embed([text_to_embed]))[0].tolist()
            vec_str = vector_to_pg(embedding)
            cur.execute(
                """
                INSERT INTO tickets (ticket_id, subject, tags, conversation, embedding)
                VALUES (%s, %s, %s, %s, %s::vector)
                """,
                (
                    ticket["ticket_id"],
                    ticket["subject"],
                    ticket["tags"],
                    ticket["conversation"],
                    vec_str,
                ),
            )
        conn.commit()

        cur.close()
        conn.close()

        _seed_status = "seeded"
        logger.info("Seeding complete!")
        return {
            "success": True,
            "message": f"Successfully seeded {len(DEMO_DOCUMENTS)} documents and {len(DEMO_TICKETS)} tickets",
            "documentCount": len(DEMO_DOCUMENTS),
            "ticketCount": len(DEMO_TICKETS),
        }

    except Exception as e:
        _seed_status = "error"
        logger.error(f"Seeding error: {e}")
        raise e

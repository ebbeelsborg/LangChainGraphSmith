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

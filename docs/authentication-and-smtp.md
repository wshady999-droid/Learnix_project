# Learnix Authentication, Custom SMTP, Google OAuth & Admin Provisioning Guide

This guide covers production configuration for **Supabase Auth**, **Custom SMTP**, **Google OAuth**, and **Server-Side Provisioning of the Predefined Administrators**.

---

## 1. Production Custom SMTP Configuration

> **Important**: Supabase's built-in default email sender is strictly for initial local testing (rate-limited to a few emails per hour and restricted to team addresses). **Do not use the default email sender in production.**

### Step-by-Step SMTP Setup in Supabase Dashboard
1. Open the Supabase Dashboard for project `awakujbdjoajjoxuvygn`.
2. Navigate to **Project Settings → Authentication → SMTP Settings**.
3. Toggle **Enable Custom SMTP** to **ON**.
4. Configure your verified domain transactional email provider:

| Setting | Resend | Postmark | AWS SES (EU West) | SendGrid |
| :--- | :--- | :--- | :--- | :--- |
| **Sender Email** | `no-reply@<your-verified-domain>` | `no-reply@<your-verified-domain>` | `no-reply@<your-verified-domain>` | `no-reply@<your-verified-domain>` |
| **Sender Name** | `Learnix` | `Learnix` | `Learnix` | `Learnix` |
| **Host** | `smtp.resend.com` | `smtp.postmarkapp.com` | `email-smtp.eu-west-3.amazonaws.com` | `smtp.sendgrid.net` |
| **Port** | `465` (SSL) or `587` (STARTTLS) | `587` | `587` | `587` |
| **Username** | `resend` | `<Server API Token>` | `<SES SMTP Username>` | `apikey` |
| **Password** | `<Resend API Key>` | `<Server API Token>` | `<SES SMTP Password>` | `<SendGrid API Key>` |

5. Ensure **SPF**, **DKIM**, and **DMARC** DNS records are verified on your sending domain so email confirmation and password recovery links deliver reliably.

---

## 2. Instant Registration & Password Recovery Links

Learnix uses **instant Email + Password registration** with **email confirmation disabled** (`Confirm email` = OFF in Supabase Dashboard → Authentication → Providers → Email, and `email_confirm: true` via server-only `auth.admin.createUser` in `registerAccountAction`). No confirmation emails or OTP emails are sent on signup, and users enter their workspace immediately.

- **Password Recovery (kept separate)**: Redirects to `${NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`, which exchanges the PKCE code for a recovery session and routes the user to `/reset-password`.

---

## 3. Google OAuth Configuration

1. In the **Google Cloud Console → APIs & Services → Credentials**:
   - Configure your **OAuth consent screen** (External or Internal) with app name **Learnix**.
   - Create an **OAuth 2.0 Client ID** (Web Application).
   - Add **Authorized JavaScript origins**:
     - `http://localhost:3000`
     - `https://<your-production-domain>`
   - Add **Authorized redirect URIs**:
     - `https://awakujbdjoajjoxuvygn.supabase.co/auth/v1/callback`
   - Copy the generated **Google Client ID** and **Google Client Secret**.
2. In **Supabase Dashboard → Authentication → Providers → Google**:
   - Enable Google and enter your **Client ID** and **Client Secret**.
3. In **Supabase Dashboard → Authentication → URL Configuration**:
   - Set **Site URL** to your production URL (or `http://localhost:3000` during local development).
   - Add the following to **Redirect URLs**:
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/auth/callback?next=/reset-password`
     - `https://<your-production-domain>/auth/callback`
     - `https://<your-production-domain>/auth/callback?next=/reset-password`

### How Google Users Receive Their Role
- When a user signs in with Google for the first time, the database trigger `on_auth_user_created` (`private.handle_new_auth_user`) automatically creates their `public.profiles` row with `role = 'student'` and `status = 'active'` (frontend/OAuth metadata is never trusted for privileged roles).
- On every Google sign-in, [`/auth/callback`](file:///d:/3th/learnix/src/app/auth/callback/route.ts) exchanges the PKCE code for a session, queries `public.profiles` on the server for the user's authoritative `role` and `status`, blocks suspended accounts, logs the login in `public.audit_logs`, and redirects to `/admin`, `/teacher`, or `/student`.

---

## 4. Provisioning the Six Predefined Administrators

Public registration of `admin` accounts is strictly forbidden at both the UI level and the database trigger/RLS level.

To provision the **6 predefined administrators** securely and idempotently:

1. Open your local, untracked `.env.local` file (never committed to Git).
2. Add your server-only `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) and the 6 administrator identities using **valid email addresses with a TLD** (Supabase Auth rejects single-label domains such as `@admin` with HTTP 400 `email_address_invalid`):

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJ... # or SUPABASE_SECRET_KEY=sb_secret_...

LEARNIX_ADMIN_1_EMAIL=shady@admin.learnix.edu
LEARNIX_ADMIN_1_PASSWORD=<strong-password-1>
LEARNIX_ADMIN_1_NAME=Shady
# ... repeat for LEARNIX_ADMIN_2_* through LEARNIX_ADMIN_6_*
```

3. Run the idempotent provisioning script:

```bash
npm run provision:admins
```

To explicitly rotate passwords for existing admin accounts, pass `--rotate`:

```bash
node --env-file=.env.local scripts/provision-admins.mjs --rotate
```

What the script does ([scripts/provision-admins.mjs](file:///d:/3th/learnix/scripts/provision-admins.mjs)):
- Checks whether each administrator already exists in Supabase Auth.
- Creates missing accounts via `supabase.auth.admin.createUser` with `email_confirm: true` without duplicating or overwriting existing passwords unless `--rotate` is passed.
- Ensures `public.profiles` has `role = 'admin'` and `status = 'active'` without wiping unrelated profile fields.
- Verifies the assigned role & status from `public.profiles` and prints an individual status per account (`Created and verified`, `Already existed and verified`, `Rotated and verified`, or `Failed`).
- Never prints passwords and writes an immutable entry to `public.audit_logs`.

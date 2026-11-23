# Learnix — Production Deployment & Operations Guide

## 1. Environment Variables

Configure these environment variables in your production host (Vercel / Docker / Windows Server) and **never** commit `.env.local` to Git.

| Variable | Visibility | Required | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Yes | Supabase project URL (`https://<project-ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Public | Yes | Supabase publishable/anon client key |
| `NEXT_PUBLIC_SITE_URL` | Public | Yes | Canonical production URL (e.g., `https://learnix.edu`) |
| `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) | **Server-Only** | Recommended | Service-role key for Admin provisioning & bulk user import |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | **Supabase Dashboard** | Optional | Configured in Supabase Auth → Providers → Google for Google Sign-In |
| `GEMINI_API_KEY` | **Server-Only** | Recommended | Google Gemini API key for Learnix AI Student/Teacher/Essay Grading |
| `GEMINI_MODEL` | **Server-Only** | Optional | Defaults to `gemini-2.5-flash` |
| `OPENAI_API_KEY` | **Server-Only** | Optional | Secondary LLM provider fallback (`gpt-4o-mini`) |

> **Security Note:** All AI provider keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`) and `SUPABASE_SECRET_KEY` are read exclusively inside server-only modules (`src/services/ai/engine.ts`, `src/services/admin/actions.ts`). They are never exposed to the browser bundle.

---

## 2. Database Migrations

All 15 SQL migrations are stored in `supabase/migrations/` in chronological order (`01` through `15`).

To apply migrations to a new or staging Supabase project using Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

> **Note on Migration 15 (`20261123214300_15_part10_shared_features_review_eligibility_and_certificate_verification.sql`):** Ensure Migration 15 is applied so PostgreSQL enforces completed-course eligibility at the RLS level in addition to the server-action check already active in `src/services/student/actions.ts`.

---

## 3. Supabase Production Configuration

1. **Authentication → Providers**:
   - Enable Email + Password and Google OAuth.
   - Add `<NEXT_PUBLIC_SITE_URL>/auth/callback` to Redirect URLs.
   - Enable **Leaked Password Protection** (HaveIBeenPwned check) under Authentication → Password Security.
2. **Custom Production SMTP**:
   - Configure a verified transactional email provider (Resend, Postmark, or Amazon SES) under Authentication → SMTP Settings for password recovery links. Email confirmation on signup is disabled (`Confirm email` = OFF).
3. **Storage Buckets**:
   - Verified buckets: `profile-pictures`, `course-thumbnails`, `course-videos`, `course-pdfs`, `course-presentations`, `course-materials`, `assignment-attachments`, `message-attachments`, `certificates`.
4. **Realtime**:
   - Enable Realtime broadcast on `public.notification_recipients` for instant Notification Bell updates.

---

## 4. Production Build & Deployment

```bash
npm ci
npm run typecheck
npm run lint
npm run build
npm run start
```

For Vercel deployment:
- Connect the Git repository, set the environment variables above, and deploy directly with Next.js 16 App Router support.

---

## 5. Backup & Disaster Recovery Strategy

1. **Automated Daily Backups & PITR**:
   - Enable Supabase Point-in-Time Recovery (PITR) for continuous WAL archiving and daily snapshots.
2. **Manual Logical Snapshot**:
   ```bash
   pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --file="learnix-backup-$(date +%F).dump"
   ```
3. **Recovery Procedure**:
   - Provision a clean Supabase project, apply migrations via `supabase db push` (or restore logical dump via `pg_restore`), re-verify RLS policies, update `NEXT_PUBLIC_SUPABASE_URL` & keys, and run `GET /api/health`.

---

## 6. Future Windows Desktop App (Electron) Readiness

Learnix is architected to support a future Windows Electron wrapper without duplicating business logic:
- **Runtime Bridge**: `src/lib/platform/desktop-bridge.ts` provides a typed `window.learnixDesktop` interface (`isDesktopAppRuntime()`, `getDesktopBridge()`, `openSafeExternalLink()`).
- **Recommended Electron Architecture**:
  - Load the hosted production HTTPS URL inside an isolated `BrowserWindow` (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`).
  - Expose only whitelisted IPC methods via a preload script implementing `LearnixDesktopBridge`.
  - Never bundle `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, or `OPENAI_API_KEY` inside the Electron installer.

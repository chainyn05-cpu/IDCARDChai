# Developer Credit & Usage Terms

**Developed by Chai.**

**Company 99 — Internal Use Only.** This project is intended for internal use within Company 99. Unauthorized copying, redistribution, resale, modification, or use outside Company 99 is prohibited without prior written authorization from the relevant rights holder. All rights are reserved subject to applicable ownership and licensing agreements.

See [`LICENSE`](./LICENSE) for the full project usage notice.

---

# Employee ID Card Generator

Vercel-ready React + Vite starter for staff ID cards with three supplied logos. It runs in local DEMO MODE when Supabase environment variables are not configured. When valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values are present, it automatically uses Supabase cloud mode:
- PUZZLE
- BAT
- POS TRAIN

Features:
- Premium black ID cards with small brand-color accents (BAT red, POS TRAIN green, PUZZLE blue)
- Employee self-registration form
- Live ID card preview
- Photo upload validation (image, max 5 MB); adjustable crop with zoom and horizontal/vertical position controls; rectangular portrait with rounded corners
- PNG and 54 × 86 mm PDF download
- Admin dashboard with Supabase email/password login, search; all submitted cards are automatically ready without manual approval; select cards for multi-card A4 PDF printing
- Optional Supabase cloud database, photo storage, and email/password admin sign-in
- Demo mode works locally in one browser with localStorage (not cloud synced)

## 1. Run locally
Install Node.js LTS, unzip the project, then run:

```bash
npm install
npm run dev
```

## 2. Deploy to Vercel
1. Upload this folder to a new GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Framework should be detected as Vite. Build command: `npm run build`; output directory: `dist`.
4. Deploy. Demo mode works without environment variables, but it stores data only in the browser that submitted it.

## 3. Enable cloud storage with Supabase
1. Create a project at https://supabase.com.
2. In Project Settings → API, copy the Project URL and anon/publishable key.
3. Copy `.env.example` to `.env.local`, fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. In Supabase SQL Editor, run all statements in `supabase/schema.sql`.
5. In Authentication → Users, create an admin user with email/password.
6. In SQL Editor, run the `UPDATE auth.users` statement at the bottom of `supabase/schema.sql`, replacing `admin@company.com` with the exact admin email. This assigns the protected `app_metadata.role = admin` claim.
7. Add the same two Vite environment variables in Vercel Project Settings → Environment Variables, then redeploy.
8. Sign out and back in, then use **Admin Dashboard → Sign in** with the admin credentials.

Important:
- Never expose the Supabase `service_role` key in the frontend or Vercel `VITE_` variables.
- SQL policy lets unauthenticated visitors submit a record and upload a photo, but only users with the Supabase-managed `app_metadata.role = admin` claim can read/update employee records and view private photos. Public visitors can submit registrations and upload a photo, but cannot read employee records.
- This is a starter implementation; before broad production use, consider adding CAPTCHA/rate limits, invite-only registration links, file moderation, and audit logs.
- Employee data and photos are personal information. Share the registration link only with intended staff.
- In cloud mode, uploaded photo is private in Supabase Storage; the admin dashboard creates a temporary signed link to display it.
- For large print runs, verify printer settings and card stock. PDF export for an individual card is 54 × 86 mm. A4 batch export fits 9 cards per page.

## 4. Logo files
The files under `public/logos/` are copied from the images supplied in the conversation. Replace them only if you want updated source artwork.


## Company 99 visual updates
- Black card face for all three brands; brand colors appear only as small accent details.
- Employee portrait uses a rounded rectangle instead of a circle.
- Responsive layout is improved for mobile screens.
- Supabase cloud mode activates automatically when valid Vite environment variables are supplied; otherwise the app stays in browser-local demo mode.


## Existing project update notes
- This update adds `photo_zoom`, `photo_x`, and `photo_y` columns using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so it does not delete existing records.
- The A4 print action includes all records by default; if you select individual rows, it prints only those selected. New submissions are automatically marked Approved, so no manual approval is needed.
- For production use, keep the Supabase service-role key out of all `VITE_` variables and browser code.


## Latest UI updates
- Removed Employee ID and Department from the employee submission form and card design. Existing database columns are retained for backward compatibility; the schema migration makes Employee ID optional for older tables.
- Shop-color card backgrounds: PUZZLE blue, BAT red, POS TRAIN green.
- Photo crop controls include zoom and horizontal/vertical positioning sliders.
- Demo-mode Admin Dashboard password: `Bong99`. This is a client-side demo gate only, not secure protection for real cloud data. When Supabase is configured, use Supabase Auth with an Admin account and `app_metadata.role = admin`; the account password may be set to `Bong99` in Supabase if desired.


## Automatic card creation (no approval step)
- Every employee submission is saved with `status = 'Approved'` and is ready to print immediately.
- Running `supabase/schema.sql` on the existing project changes existing Pending rows to Approved, sets the default for future rows, and updates the public insert policy.
- Employee submissions do not get permission to read the staff database. Only Supabase Auth users with `app_metadata.role = admin` can view the dashboard and private photos.

## Supabase setup checklist
1. Open the existing Supabase project → SQL Editor → paste and run `supabase/schema.sql`. This is written as a migration and does not drop employee records.
2. In Authentication → Users, create the admin account with the email and password you want (you may set the password to `Bong99`).
3. Run the admin-role UPDATE statement at the bottom of `supabase/schema.sql`, replacing the sample email. Then sign out and sign back in.
4. In Vercel → Project → Settings → Environment Variables, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase Project Settings → API. Never use the service-role key in a `VITE_` variable.
5. Redeploy Vercel. Test one submission from the public form, then sign in to Admin Dashboard and confirm the record and photo are visible.

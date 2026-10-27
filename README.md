# Staywise

Staywise is a multi-hotel reservation platform built with React, Express,
Supabase Auth, PostgreSQL, Row Level Security, and Supabase Storage.

## Current capabilities

- Visitors can open the home page without an account, search and filter hotels,
  inspect rooms, see maps and facilities, and request live availability quotes.
- Customers can register, confirm their email, choose or revise stay dates,
  reserve a room, and manage eligible reservations.
- Managers can register without admin approval, create multiple hotels, and
  immediately publish rooms with amenities, inventory, prices, and images.
- Managers can operate reservations, update payment status, view reports, and
  export CSV files.
- Administrators can monitor platform users, hotels, reservations, and reports.
- Sign out always returns the user to the public home page.

Tax and online payment collection are intentionally out of scope. Booking totals
use nightly prices, date overrides, and the hotel service fee.

## Architecture

```text
React + Vite
  ├─ Supabase Auth and Storage
  └─ Express REST API
       └─ Supabase PostgreSQL, RLS, and transactional RPC functions
```

The application is a modular monolith. The browser handles presentation and
authentication sessions, Express owns the REST contract, and PostgreSQL remains
the final authorization and booking-consistency boundary.

## Documentation

- [Complete project handoff](./PROJECT_HANDOFF.md)
- [Frontend setup and file guide](./frontend/getting-started.md)
- [Backend API and file guide](./backend/README.md)
- [Supabase migrations and demo data](./supabase/README.md)
- [Naming conventions](./naming-conventions.md)

## First-time setup

Use Git Bash. Create a Supabase project, then run every file in
`supabase/migrations/` in filename order using the Supabase SQL Editor.

Start the backend:

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Start the frontend in another Git Bash terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Health check: `http://localhost:3000/api/health`

Never commit either `.env` file. Never expose `SUPABASE_SECRET_KEY` in the
frontend.

## Optional demo catalog

After registering and confirming at least one manager account, run
`supabase/seeds/demo_hotels.sql` in the Supabase SQL Editor. It creates or
refreshes 10 fictional hotels, 50 room types, and 150 physical rooms with
realistic locations, pricing, facilities, amenities, and public image URLs.

The script is repeatable and does not delete reservations. See
[supabase/README.md](./supabase/README.md) for manager selection and verification.

## Verification

```bash
cd backend
npm run check

cd ../frontend
npm run lint
npm run build
```

## Repository map

| Path | Responsibility |
| --- | --- |
| `frontend/` | React public site, customer booking flow, manager workspace, admin view |
| `backend/` | Express REST API, validation, authorization, reporting, email worker |
| `supabase/` | Ordered database migrations, RLS policies, RPC transactions, demo seed |
| `.github/workflows/` | Continuous integration checks |
| `PROJECT_HANDOFF.md` | Detailed architecture, workflows, file ownership, and continuation prompt |
| `naming-conventions.md` | Required naming rules for future changes |

# STAYWISE PROJECT HANDOFF

Last verified: 2026-10-24

This is the authoritative continuation document for teammates and AI agents.
Read it before modifying the project. Do not recreate completed features or
replace the architecture without an explicit team decision.

## 1. Project purpose

Staywise is a multi-hotel reservation platform with three roles:

- Customers publicly search approved hotels, create accounts, receive live
  availability and prices, reserve rooms, view reservations, and cancel within
  policy.
- Managers register publicly but remain pending until an administrator approves
  them. Approved managers create and operate multiple hotels.
- Administrators approve or reject managers and hotels and can moderate
  platform-wide data through protected APIs.

The project is being built as a production-shaped MVP. The current code is not
throwaway scaffolding: new features should extend the existing modules and
database contracts.

## 2. Fixed product decisions

- Multi-hotel platform.
- Roles: `customer`, `manager`, and `admin`. There is no staff or receptionist
  role.
- Public hotel search; authentication is required to reserve.
- Manager accounts require administrator approval before manager operations.
- Reservations are immediately confirmed when availability exists.
- Payment is tracked only as `unpaid`, `paid`, or `refunded`. Online payment is
  intentionally out of scope for now.
- Free customer cancellation and modification until 48 hours before hotel-local
  check-in. After the deadline, manager handling is required.
- Reservation modification performs a fresh availability check and recalculates
  the price.
- Pricing uses a base nightly price plus non-overlapping date-range overrides.
- One review is allowed per completed reservation.
- Facilities and room amenities use predefined lists. Hotel descriptions remain
  free text.
- Images are public URLs; there is no upload/storage subsystem.
- Hotels store an address and optional coordinates. The frontend links to a map.
- Reports include totals, filters, charts, and CSV. PDF is out of scope.
- Confirmation is shown on screen. Email is delivered through an optional
  database outbox and Resend worker.

## 3. Architecture

The project is a modular monolith with a REST API. Do not split it into
microservices or add GraphQL without a concrete requirement.

```text
React SPA
  |-- Supabase Auth client: sign up, sign in, session
  |-- Express REST API: application reads and writes
          |-- validates JWT and role
          |-- uses the user's Supabase token
          |-- calls PostgreSQL tables and RPC functions
                    |-- constraints and transactions
                    |-- Row Level Security
                    |-- audit log and email outbox

Backend email worker
  |-- service-role Supabase client
  |-- polls notification_outbox every 30 seconds
  |-- sends through Resend when configured
```

Security is layered:

1. Frontend route guards improve navigation but are not trusted for security.
2. Express authenticates the Supabase token and checks the profile role.
3. PostgreSQL RLS and security-definer functions are the final authorization
   and transactional boundary.

## 4. Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, React Router 8, Vite 8, plain CSS |
| Authentication | Supabase Auth |
| Backend | Node.js 22, Express 5, Zod 4 |
| Database | Supabase PostgreSQL with RLS and PL/pgSQL RPCs |
| Email | PostgreSQL outbox plus optional Resend worker |
| Testing | Node built-in test runner, ESLint, Vite production build |
| Deployment support | Backend Dockerfile, static frontend build |
| CI | GitHub Actions for backend lint, tests, and Docker build |

There is no component library, state-management package, ORM, date library,
GraphQL layer, or payment SDK. Prefer native React, browser APIs, PostgreSQL,
and the dependencies already installed.

## 5. Current implementation status

### Complete foundations

- Supabase schema, enums, constraints, indexes, triggers, RLS, and lookup data.
- Customer, approved-manager, and admin authorization on backend routes.
- Public hotel search, filters, sorting, details, reviews, quotes, and room
  selection.
- Customer registration/login, booking, reservation list, and cancellation.
- Manager application status, multi-hotel CRUD, facilities, images, room types,
  amenities, physical rooms, price overrides, submission, reservations,
  operational/payment statuses, reports, charts, and CSV.
- Admin dashboard counts, manager moderation, and hotel moderation.
- Admins can approve a hotel directly from `draft` after migration 007 is
  applied. The owning manager must still be approved.
- Reservation emails use an outbox and retry worker when email configuration is
  present.
- Structured errors, request IDs, rate limiting, security headers, input
  validation, audit logging, and Docker support.

### Backend-ready but frontend not yet built

- Customer reservation modification.
- Customer review submission after a completed stay.
- Admin user-role management UI.
- Admin system-wide reservations, reports, CSV, and audit-log UI.

### Deliberately out of scope

- Online payments and refunds through a payment provider.
- PDF reports.
- File/image uploads.
- Staff/receptionist role.
- Microservices and GraphQL.

## 6. Role and status rules

| Actor | Rule |
| --- | --- |
| Anonymous visitor | May search and read approved properties and reviews. |
| Customer | May reserve, read own reservations, modify/cancel before deadline, and review completed stays. |
| Pending/rejected/suspended manager | Cannot use protected manager APIs. The frontend shows application status. |
| Approved manager | May operate only owned hotels and their inventory/reservations. |
| Admin | May moderate managers/hotels and use system-wide APIs. |

Manager statuses are `not_applicable`, `pending`, `approved`, `rejected`, and
`suspended`. Hotel statuses are `draft`, `submitted`, `approved`, `rejected`,
and `suspended`.

Valid hotel moderation transitions are:

```text
draft       -> approved
submitted   -> approved | rejected
approved    -> suspended
suspended   -> approved
```

A rejected hotel cannot be directly approved. A future revision workflow must
move it back to a valid review state first.

## 7. Core workflows

### Account and manager approval

1. A visitor registers as customer or manager through Supabase Auth.
2. The database signup trigger creates `profiles` from auth metadata.
3. Customers receive role `customer`; managers receive role `manager` and
   status `pending`.
4. An admin approves the manager from `/admin`.
5. The manager refreshes their status and gains access to `/manager`.

Admin accounts cannot be created from public registration. Bootstrap the first
admin in the Supabase SQL Editor after that person registers:

```sql
update public.profiles
set
  role = 'admin',
  manager_status = 'not_applicable'
where id = (
  select id
  from auth.users
  where email = 'replace-with-admin-email@example.com'
);
```

### Hotel publication

1. An approved manager creates a hotel; it starts as `draft`.
2. The manager adds details, facilities, image URLs, room types, amenities,
   physical rooms, and optional date pricing.
3. Normally the manager submits the hotel and an admin approves/rejects it.
4. The admin may also approve a draft directly.
5. Only approved hotels are publicly readable.

Approval does not invent missing inventory. A hotel without an active room type
will not appear in the current public search query, and a hotel without an
available physical room cannot be booked.

### Reservation

1. Public search accepts destination, dates, guests, price, rating, facility,
   and sort criteria.
2. PostgreSQL computes availability and a complete quote using hotel-local
   dates, base prices, date overrides, tax, and service fee.
3. A customer submits guest details.
4. `create_reservation` locks and allocates one physical room, preventing
   concurrent double booking.
5. Price fields are copied into the reservation as a historical snapshot.
6. The reservation is confirmed with payment status `unpaid`.
7. A confirmation email job is added without risking rollback of the booking.

## 8. Repository structure

```text
.
|-- .github/workflows/       Backend CI
|-- backend/                 Express REST API and email worker
|   |-- src/config/          Validated environment configuration
|   |-- src/jobs/            Background email processing
|   |-- src/lib/             Shared backend helpers
|   |-- src/middleware/      HTTP authentication, authorization, validation
|   |-- src/modules/         Domain modules grouped by actor/capability
|   `-- test/                Node API and helper tests
|-- frontend/                React single-page application
|   |-- public/              Static files copied by Vite
|   `-- src/
|       |-- components/      Shared visual/layout components
|       |-- features/        Feature folders by role/domain
|       |-- lib/             REST and Supabase clients
|       `-- assets/          Local image/vector assets
|-- supabase/migrations/     Ordered PostgreSQL migrations
|-- naming-conventions.md    Repository naming rules
|-- README.md                Human entry point
`-- PROJECT_HANDOFF.md       Authoritative continuation guide
```

Generated folders such as `node_modules/` and `frontend/dist/` are not source
code and must not be shared or committed.

## 9. File-by-file guide

### Root and automation

| File | Responsibility |
| --- | --- |
| `.gitignore` | Excludes dependencies, builds, secrets, logs, caches, dumps, and editor files. |
| `.github/workflows/backend-ci.yml` | Runs backend install, lint, tests, and Docker build on relevant pushes/PRs. |
| `README.md` | Short entry point and local commands. |
| `PROJECT_HANDOFF.md` | Full technical and project handoff; update it when architecture or major status changes. |
| `naming-conventions.md` | Naming rules for folders, code, docs, branches, and commits. |
| `desktop.ini` | Windows metadata; not used by the application and safe to remove from a future cleanup. |

### Backend configuration

| File | Responsibility |
| --- | --- |
| `backend/.env` | Local secrets/configuration. Never commit or share it. |
| `backend/.env.example` | Safe template for required and optional backend variables. |
| `backend/.dockerignore` | Keeps secrets, tests, dependencies, and noise out of the Docker build context. |
| `backend/Dockerfile` | Builds a Node 22 Alpine production API image as the non-root `node` user. |
| `backend/package.json` | Backend dependencies and `dev`, `start`, `lint`, `test`, and `check` scripts. |
| `backend/package-lock.json` | Exact generated dependency lock; update through npm, not by hand. |
| `backend/eslint.config.js` | Node/ES-module lint configuration. |
| `backend/README.md` | Detailed REST API reference, response format, and email notes. |

### Backend entry points and configuration

| File | Responsibility |
| --- | --- |
| `backend/src/server.js` | Starts Express and the email worker. |
| `backend/src/app.js` | Configures request IDs, Helmet, CORS, rate limit, JSON limit, routers, 404, and error handling. |
| `backend/src/config/env.js` | Validates environment variables with Zod and fails fast on invalid configuration. |

### Backend jobs and shared libraries

| File | Responsibility |
| --- | --- |
| `backend/src/jobs/emailWorker.js` | Polls up to 10 pending/failed email jobs every 30 seconds, escapes HTML, sends through Resend, and retries up to three attempts. |
| `backend/src/lib/auditService.js` | Lists filtered audit-log rows with pagination. |
| `backend/src/lib/httpError.js` | Application error class containing HTTP status, public code, and optional details. |
| `backend/src/lib/pagination.js` | Zod pagination fields, Supabase inclusive ranges, and response metadata. |
| `backend/src/lib/supabase.js` | Creates public, optional service-role, and per-user Supabase clients. |
| `backend/src/lib/supabaseError.js` | Converts database errors into safe HTTP errors without leaking internals. |
| `backend/src/lib/toCamelCase.js` | Recursively converts Supabase snake_case results to camelCase JSON. |

### Backend middleware

| File | Responsibility |
| --- | --- |
| `backend/src/middleware/authenticate.js` | Validates Bearer tokens, loads the profile, and attaches a user-scoped Supabase client. |
| `backend/src/middleware/authorize.js` | Enforces allowed roles and approved-manager status. |
| `backend/src/middleware/errorHandler.js` | Emits stable error JSON and structured server logs. |
| `backend/src/middleware/requestContext.js` | Accepts safe request IDs or generates UUIDs and returns `X-Request-ID`. |
| `backend/src/middleware/validate.js` | Validates route params/query/body and exposes normalized validated input. |

### Backend modules

| File | Responsibility |
| --- | --- |
| `backend/src/modules/auth/authRoutes.js` | Reads and updates the current profile. Authentication signup/login itself stays in Supabase Auth. |
| `backend/src/modules/public/publicRoutes.js` | Public lookup, hotel search/detail/review, and quote schemas/routes. |
| `backend/src/modules/public/publicService.js` | Queries approved hotels, joins catalog data, computes ratings, quotes, filters, sorting, and pagination. |
| `backend/src/modules/customer/customerRoutes.js` | Customer reservation CRUD lifecycle and review route validation. |
| `backend/src/modules/customer/customerService.js` | Reads own reservations and calls transactional create/modify/cancel RPCs; creates reviews. |
| `backend/src/modules/manager/managerRoutes.js` | Validated hotel, catalog, inventory, and pricing routes for approved managers. |
| `backend/src/modules/manager/hotelService.js` | Owned-hotel CRUD, submission, facility, and image persistence. |
| `backend/src/modules/manager/inventoryService.js` | Room type, amenity, physical room, and date-price persistence. |
| `backend/src/modules/manager/managerReservationRoutes.js` | Manager audit, reservation, status, payment, report, and CSV routes. |
| `backend/src/modules/manager/reservationService.js` | Owned-hotel reservation queries and reservation-operation RPC wrappers. |
| `backend/src/modules/manager/reportService.js` | Aggregates report metrics/chart rows and generates formula-safe CSV. |
| `backend/src/modules/admin/adminRoutes.js` | Protected system-wide users, managers, hotels, reservations, reports, CSV, and audit routes. |
| `backend/src/modules/admin/adminService.js` | Admin list queries and role/manager/hotel status RPC wrappers. |

### Backend tests

| File | Responsibility |
| --- | --- |
| `backend/test/api.test.js` | Starts the Express app on an ephemeral port and checks health, headers, request IDs, auth boundaries, validation, and error format. |
| `backend/test/helpers.test.js` | Checks pagination, camelCase conversion, safe database errors, and CSV escaping. |

### Frontend configuration and entry

| File | Responsibility |
| --- | --- |
| `frontend/.env` | Local public frontend configuration. Do not commit it. |
| `frontend/.env.example` | Template for API URL, Supabase URL, and publishable key. |
| `frontend/.gitignore` | Vite-generated ignore rules; root `.gitignore` is also active. |
| `frontend/package.json` | React/Vite dependencies and development scripts. |
| `frontend/package-lock.json` | Exact generated frontend dependency lock. |
| `frontend/eslint.config.js` | Browser, React Hooks, and Vite refresh lint rules. |
| `frontend/vite.config.js` | Enables the React Vite plugin. |
| `frontend/index.html` | SPA shell, metadata, favicon reference, and root element. |
| `frontend/getting-started.md` | Frontend-specific setup and verification commands. |
| `frontend/src/main.jsx` | Mounts React Strict Mode, BrowserRouter, AuthProvider, and global CSS. |
| `frontend/src/app.jsx` | Declares all routes, guards, redirects, Suspense fallback, and lazy-loaded pages. |
| `frontend/src/index.css` | Entire responsive design system and page/component styles. |

### Shared frontend components and libraries

| File | Responsibility |
| --- | --- |
| `frontend/src/components/dashboardLayout.jsx` | Role-aware sidebar, account summary, navigation, sign-out, and page shell. |
| `frontend/src/components/formField.jsx` | Reusable accessible input/textarea field with hint and error text. |
| `frontend/src/components/siteHeader.jsx` | Public Staywise header with auth-aware dashboard/sign-in actions. |
| `frontend/src/lib/api.js` | JSON REST client, Bearer-token support, standard errors, and authenticated file download. |
| `frontend/src/lib/supabase.js` | Browser Supabase client configured only with public values. |

### Frontend authentication and account

| File | Responsibility |
| --- | --- |
| `frontend/src/features/auth/authContext.js` | React context definition. |
| `frontend/src/features/auth/authProvider.jsx` | Session subscription, profile loading, signup/login/logout, and profile refresh. |
| `frontend/src/features/auth/useAuth.js` | Safe context consumer hook. |
| `frontend/src/features/auth/authLayout.jsx` | Shared authentication-page card layout. |
| `frontend/src/features/auth/loginPage.jsx` | Email/password login and return-to-original-route behavior. |
| `frontend/src/features/auth/registerPage.jsx` | Customer/manager signup, validation, and email-confirmation message. |
| `frontend/src/features/auth/getHomePath.js` | Maps a loaded user to the correct role/status landing page. |
| `frontend/src/features/auth/requireAuth.jsx` | Waits for auth/profile, redirects anonymous users, and handles profile errors. |
| `frontend/src/features/account/accountPage.jsx` | Edits current full name and phone number. |

### Public and customer frontend

| File | Responsibility |
| --- | --- |
| `frontend/src/features/public/hotelSearchForm.jsx` | Shared destination/date/guest search controls with native date constraints. |
| `frontend/src/features/public/homePage.jsx` | Public search, URL-backed criteria, filters, sorting, live-price result cards, and trust messaging. |
| `frontend/src/features/public/hotelDetailsPage.jsx` | Property gallery, map, facilities, reviews, room choices, and live room quotes. |
| `frontend/src/features/customer/requireCustomer.jsx` | Restricts nested routes to customers. |
| `frontend/src/features/customer/bookingPage.jsx` | Rechecks quote, collects guest details, creates reservation, and shows confirmation. |
| `frontend/src/features/customer/customerDashboardPage.jsx` | Lists the customer's reservations and performs eligible cancellation. |

### Manager frontend

| File | Responsibility |
| --- | --- |
| `frontend/src/features/manager/requireApprovedManager.jsx` | Restricts manager workspace to approved managers. |
| `frontend/src/features/manager/managerApplicationStatusPage.jsx` | Shows pending/rejected/suspended status, refresh, and sign-out. |
| `frontend/src/features/manager/managerDashboardPage.jsx` | Lists hotels, status totals, and the create-hotel form. |
| `frontend/src/features/manager/managerHotelPage.jsx` | Complete hotel editor for details, facilities, image URLs, room types, amenities, physical rooms, prices, and submission. |
| `frontend/src/features/manager/managerReservationsPage.jsx` | Filters reservations and updates operational/payment states or cancels with a reason. |
| `frontend/src/features/manager/managerReportsPage.jsx` | Date/hotel filters, totals, status distribution, revenue chart, and CSV download. |

### Admin frontend

| File | Responsibility |
| --- | --- |
| `frontend/src/features/admin/requireAdmin.jsx` | Restricts nested routes to administrators. |
| `frontend/src/features/admin/adminDashboardPage.jsx` | Shows platform counts and manager/hotel queues with approve, reject, suspend, and restore actions. |

### Frontend static and legacy assets

| File | Responsibility |
| --- | --- |
| `frontend/public/favicon.svg` | Current browser favicon; it is still the original Vite artwork, not a Staywise brand asset. |
| `frontend/public/icons.svg` | Unused starter symbol sheet. |
| `frontend/src/App.css` | Unused Vite starter CSS; `main.jsx` imports only `index.css`. |
| `frontend/src/assets/hero.png` | Unused starter image. |
| `frontend/src/assets/react.svg` | Unused starter asset. |
| `frontend/src/assets/vite.svg` | Unused starter asset. |

The unused starter files can be deleted in a dedicated cleanup commit. They do
not affect the application.

### Database migrations

| File | Responsibility |
| --- | --- |
| `202610230001_initial_schema.sql` | Core roles/status enums, profiles, hotels, room types, rooms, ownership helpers, signup trigger, indexes, and initial RLS. |
| `202610240001_catalog_and_pricing.sql` | Facilities, amenities, image URLs, join tables, price overrides, predefined lookup rows, and related RLS. |
| `202610240002_reservations_and_reviews.sql` | Reservation/payment/notification enums, reservations, reviews, outbox, audit logs, rating view, constraints, indexes, and RLS. |
| `202610240003_booking_functions.sql` | Hotel timezone validation, live quote calculation, conflict-safe immediate reservation creation, and email enqueueing. |
| `202610240004_customer_reservation_lifecycle.sql` | 48-hour deadline calculation plus transactional customer modification and cancellation. |
| `202610240005_manager_reservation_operations.sql` | Manager cancellation, operational status transitions, and payment-status transitions. |
| `202610240006_admin_and_hotel_workflows.sql` | Admin role/manager moderation, hotel submission checks, hotel moderation, and audit entries. |
| `202610240007_admin_approve_draft_hotels.sql` | Replaces hotel moderation RPC to allow an admin to approve a draft directly. |

Never reorder, rename, or edit an already-applied migration to change a live
database. Add the next timestamped migration instead. The existing files were
edited during initial development, so a fresh project should apply the current
files from the beginning; an existing project should apply only migrations it
has not already run.

## 10. Database model

| Table/view | Purpose |
| --- | --- |
| `profiles` | Public application identity linked one-to-one with `auth.users`; contains role and manager status. |
| `hotels` | Manager-owned property details, pricing settings, coordinates, timezone, and moderation state. |
| `room_types` | Customer-facing inventory categories, capacity, base price, and active flag. |
| `rooms` | Physical room numbers/status used for safe allocation and overlap prevention. |
| `facilities` | Predefined hotel-level lookup values. |
| `amenities` | Predefined room-level lookup values. |
| `hotel_images` | Ordered public image URLs. |
| `hotel_facilities` | Hotel-to-facility join table. |
| `room_type_amenities` | Room-type-to-amenity join table. |
| `price_overrides` | Non-overlapping inclusive date ranges with alternate nightly prices. |
| `reservations` | Allocated physical room, stay dates, guest details, state, and immutable price snapshot. |
| `reviews` | One rating/comment per completed reservation. |
| `notification_outbox` | Durable confirmation/modification/cancellation email jobs. |
| `audit_logs` | Actor, hotel, entity, action, details, and timestamp for sensitive operations. |
| `hotel_rating_summary` | Public aggregate view of visible ratings and review counts. |

Important database functions:

- `handle_new_auth_user`: creates profiles from signup metadata.
- `is_admin`, `can_manage_hotels`, `owns_hotel`: reusable authorization checks.
- `get_room_type_quote`: calculates nightly rates, taxes, fees, and availability.
- `create_reservation`: locks and assigns a room, snapshots price, audits, and
  queues email in one transaction.
- `get_reservation_change_deadline`: computes the hotel-local 48-hour deadline.
- `modify_reservation` and `cancel_reservation`: customer lifecycle operations.
- `manager_cancel_reservation`, `update_reservation_status`, and
  `update_reservation_payment_status`: manager/admin operations.
- `submit_hotel`, `admin_update_user_role`, `admin_update_manager_status`, and
  `admin_update_hotel_status`: approval workflows.

## 11. Frontend route map

| Route | Access | Page |
| --- | --- | --- |
| `/` | Public | Hotel search and results |
| `/hotels/:hotelId` | Public | Hotel detail, reviews, rooms, live quotes |
| `/login` | Public | Sign in |
| `/register` | Public | Customer or manager registration |
| `/account` | Authenticated | Profile editing |
| `/customer` | Customer | Customer reservation history/cancellation |
| `/book/:roomTypeId` | Customer | Reservation checkout/confirmation |
| `/manager/application-status` | Manager | Non-approved manager status |
| `/manager` | Approved manager | Owned hotels and creation |
| `/manager/hotels/:hotelId` | Approved manager | Hotel/inventory editor |
| `/manager/reservations` | Approved manager | Reservation operations |
| `/manager/reports` | Approved manager | Reports and CSV |
| `/admin` | Admin | Manager and hotel moderation dashboard |

Unknown paths redirect to `/`. Booking URLs preserve their query string when an
anonymous visitor is redirected through login.

## 12. REST API map

All API paths start with `/api`. Successful JSON is camelCase. List endpoints
include `pagination`. Errors have `error.code`, `error.message`, optional
`error.details`, and `error.requestId`.

### Public/shared

- `GET /health`
- `GET|PATCH /auth/me`
- `GET /public/lookups`
- `GET /public/hotels`
- `GET /public/hotels/:hotelId`
- `GET /public/hotels/:hotelId/reviews`
- `GET /public/room-types/:roomTypeId/quote`

### Customer

- `GET|POST /customer/reservations`
- `GET|PUT /customer/reservations/:reservationId`
- `POST /customer/reservations/:reservationId/cancel`
- `POST /customer/reservations/:reservationId/review`

### Manager

- Hotel list/create/detail/update/submit.
- Facility add/remove and image add/update/delete.
- Room type create/update and amenity add/remove.
- Physical room create/update.
- Price override create/update/delete.
- Reservation list/detail/cancel/status/payment-status.
- Audit logs, report summary, and reservation CSV.

### Admin

- User list and role update.
- Manager list and status update.
- Hotel list and status update.
- System reservation list/cancel/status/payment-status.
- System audit logs, report summary, and reservation CSV.

See `backend/README.md` and each route file for exact request schemas.

## 13. Local setup from a clean clone

Prerequisites:

- Git and Git Bash.
- Node.js 22 and npm.
- A Supabase project.
- Optional Resend account and verified sending domain.

### Database

1. Open the Supabase SQL Editor.
2. Run every file in `supabase/migrations/` in ascending filename order.
3. Confirm the final migration, `202610240007_admin_approve_draft_hotels.sql`,
   has run.
4. In Supabase Auth URL configuration, set the local site URL to
   `http://localhost:5173` and allow `http://localhost:5173/login` as a redirect.
5. Configure Supabase SMTP if real signup-confirmation emails are required.

### Backend

```bash
cd backend
cp .env.example .env
npm ci
npm run dev
```

Required backend values:

```dotenv
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Optional values:

```dotenv
SUPABASE_SECRET_KEY=your-secret-key
RESEND_API_KEY=re_your-api-key
EMAIL_FROM=Bookings <bookings@your-verified-domain.com>
```

The secret key is server-only. It enables email-outbox access and admin email
lookup. Never place it in `frontend/.env`, source control, logs, or screenshots.

### Frontend

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

```dotenv
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Open `http://localhost:5173`. If Vite selects another port, update
`FRONTEND_URL` and Supabase Auth URLs to exactly match it, then restart both
servers.

## 14. Verification commands

Run before handing work to another person:

```bash
cd backend
npm run check

cd ../frontend
npm run lint
npm run build
```

Current verified result:

- Backend lint passes.
- All 21 backend tests pass.
- Frontend lint passes.
- Frontend production build passes with route-level code splitting.

The automated backend suite does not connect to the live Supabase database.
Database RPC/RLS behavior still requires a manual end-to-end test or a future
Supabase local integration suite.

## 15. Manual end-to-end test

Use three separate accounts or browser profiles.

1. Register a manager and verify they remain on application status.
2. Log in as admin, confirm the pending count, and approve the manager.
3. Refresh the manager account and create a hotel.
4. Add at least one facility, image, active room type, active physical room, and
   optional date override.
5. Either leave it as draft or submit it.
6. In admin, choose the matching hotel filter and approve it.
7. As an anonymous visitor, search with future dates and matching guest count.
8. Open the hotel and verify the live total, tax, fee, and remaining rooms.
9. Register/log in as customer and reserve.
10. Verify confirmation number, `unpaid` status, customer reservation list, and
    manager reservation list.
11. Cancel before the deadline and verify availability returns.
12. If email is configured, wait up to 30 seconds and inspect outbox status.

## 16. Known limitations and cautions

- The repository currently contains substantial uncommitted and untracked work.
  Do not run `git reset --hard`, `git checkout --`, or bulk cleanup commands.
  Review `git status`, then commit intentionally before sharing.
- Migration files must be applied manually unless the project is later linked to
  the Supabase CLI. Repository presence does not prove the remote database has
  applied a migration.
- Public results are empty until approved hotels and active room types exist.
- Live availability is zero until physical rooms exist.
- Admin dashboard queues load the first 100 rows for a selected status; summary
  totals use exact pagination counts.
- Signup confirmation mail is controlled by Supabase Auth, not the Resend
  reservation worker.
- Without all three optional email settings, bookings still work and outbox jobs
  remain for later delivery.
- There are no frontend component or browser tests yet.
- The current favicon and several local assets are leftover starter files.
- `frontend/getting-started.md` should remain project-specific; do not replace it
  with the default Vite template again.

## 17. Recommended next work

Use this order unless the team changes priorities:

1. Apply migration 007 and perform the complete manual workflow above.
2. Commit the current baseline in small, reviewable commits.
3. Add customer reservation modification UI using the existing `PUT` endpoint.
4. Add customer review UI for completed reservations.
5. Add the remaining admin screens for users, reservations, reports, CSV, and
   audit logs using existing endpoints.
6. Add a small browser smoke test for public search, login redirect, booking,
   and role guards.
7. Replace/remove starter assets and create a Staywise favicon.
8. Add deployment configuration and verify production CORS/Auth redirect URLs.
9. Add sandbox payment only if the product scope changes.

## 18. Rules for future contributors and AI agents

- Read `PROJECT_HANDOFF.md`, `naming-conventions.md`, relevant route/service
  files, and relevant migrations before editing.
- Preserve the modular-monolith REST architecture.
- Use Git Bash for project commands.
- Follow Ponytail/YAGNI: reuse existing modules, native browser features, and
  installed dependencies before adding abstractions or packages.
- Keep frontend files camelCase and folders lowercase-kebab-case according to
  `naming-conventions.md`.
- Never expose the Supabase secret key or Resend key to the frontend.
- Treat route guards as UX only; enforce authorization in Express and RLS/RPCs.
- Put money, availability, status transitions, and booking concurrency in the
  database transaction layer, not client calculations.
- Return backend JSON in camelCase through `toCamelCase`.
- Keep errors in the existing stable error shape.
- Add a new migration for schema/function changes. Do not silently change a
  migration already applied to a shared database.
- Preserve unrelated user changes in the dirty worktree.
- Run backend check plus frontend lint/build before declaring completion.
- Update this handoff when adding routes, migrations, roles, architecture, or
  changing project status.

## 19. Ready-to-paste AI continuation prompt

Copy this when handing the repository to another AI:

```text
You are continuing the Staywise multi-hotel reservation project. The repository
is a React + Express + Supabase/PostgreSQL modular monolith using REST. Before
editing anything, read README.md, PROJECT_HANDOFF.md, naming-conventions.md,+backend/README.md, the relevant source files, and every migration relevant to
the requested change.

Preserve all existing work and inspect git status first because the worktree may
contain uncommitted user changes. Never reset or overwrite unrelated files. Use
Git Bash for commands. Follow the Ponytail principle: choose the simplest
production-safe solution, reuse existing patterns, avoid speculative abstractions
and unnecessary dependencies, but never weaken validation, authorization,
database constraints, accessibility, or error handling.

Architecture rules: Supabase Auth handles sessions; Express validates tokens,
roles, and inputs; PostgreSQL RLS and transactional RPCs are the final security
and business-rule boundary. Keep pricing, availability, room allocation,
cancellation deadlines, and status transitions in PostgreSQL. Never place the
Supabase secret key in frontend code.

After changes, run `npm run check` in backend and `npm run lint && npm run build`
in frontend. Explain changed files, any migration that must be applied, manual
test steps, and remaining limitations. Update PROJECT_HANDOFF.md if the project
structure, routes, migrations, or completion status changes.

Current requested task: [REPLACE THIS WITH THE NEXT TASK]
```

## 20. Handoff checklist

Before sending the project to teammates:

- [ ] Remove or securely exclude both local `.env` files from the shared archive.
- [ ] Confirm `git status` and commit intended files.
- [ ] Confirm migrations 001 through 007 are applied in order.
- [ ] Share Supabase project access through the provider, never by sending keys in
      chat or committing secrets.
- [ ] Configure team members' local `.env` files from the examples.
- [ ] Run backend and frontend verification commands.
- [ ] Create or identify the first admin account.
- [ ] Perform the manual manager-to-customer booking workflow.
- [ ] Give the teammate this document and the next concrete task.

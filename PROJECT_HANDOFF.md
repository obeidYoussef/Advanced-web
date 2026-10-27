# Staywise project handoff

Last updated: 2026-10-27

## 1. Product in one page

Staywise is a multi-hotel reservation platform.

- Anyone can open the home page, search, filter, and view hotels and rooms.
- A customer must confirm their email and sign in before reserving.
- Reservations are confirmed immediately; only payment status is tracked.
- Customers can revise check-in and check-out on the booking page. The server
  recalculates availability, night count, and the complete stay price.
- Customers can view, modify, or cancel eligible reservations from the public
  website. Changes are repriced and availability is checked again.
- Cancellation and customer changes are allowed until 48 hours before
  check-in. A cancellation changes status instead of deleting history.
- A manager confirms their email, enters the manager workspace immediately,
  creates one or more hotels, and manages rooms, inventory, pricing,
  reservations, reports, and CSV exports.
- A new hotel is created from a small essentials form. It is published without
  admin review.
- A room is created once with its guest-facing details, image URL or upload,
  amenities, price, capacity, and comma-separated physical room numbers.
- Admin is a monitoring/operations role, not an approval role.
- Tax is disabled. Totals use nightly prices plus the hotel service fee.
- Signing out from any protected area returns the user to the public home page.

## 2. Architecture

This is a modular monolith, not microservices.

```text
React/Vite browser
  ├─ Supabase Auth (signup, email confirmation, sessions)
  ├─ Supabase Storage (manager image uploads)
  └─ Express REST API
       └─ user-scoped Supabase client
            └─ PostgreSQL + Row Level Security + RPC transactions
```

Why: one deployable API is easier for this project and still has clear modules.
REST fits the current pages and operations without a GraphQL server, schema,
cache, or client dependency.

Security boundary:

1. The frontend sends the Supabase access token.
2. Express verifies it and loads the profile.
3. Route middleware checks the role.
4. Every database query uses that user's token.
5. PostgreSQL RLS is the final ownership/permission check.

Never put `SUPABASE_SECRET_KEY` in the frontend.

## 3. Roles and access

| Role | Access |
| --- | --- |
| Anonymous | Public hotel search, filters, hotel details, rooms, quotes, reviews |
| Customer | Anonymous access plus booking, profile, reservation change/cancel, review |
| Manager | Hotel workspace for owned hotels and their operations |
| Admin | Platform users/hotels overview plus system reservation/report operations |

Public signup can create only `customer` or `manager`. Admin must be assigned
securely in Supabase/SQL; never expose admin self-registration.

The database retains legacy manager/hotel status columns because earlier
migrations and public-read policies use them. Migration `202610260001` sets
every manager and hotel to the usable/published value and removes status-change
RPCs. Active frontend/API code has no approval, rejection, or submission flow.

## 4. Main workflows

### Manager creates inventory

1. Register as Hotel manager and confirm email.
2. Sign in; redirect goes directly to `/manager`.
3. Click **Add hotel** and enter name, country, city, and address.
4. Open **Manage** to complete description, contact, map, facilities, hotel
   images, service fee, timezone, and check-in/out times.
5. In **Create a room**, enter room name, description, capacity, base price,
   physical room numbers, amenities, and either a URL or uploaded image.
6. The backend calls one transactional RPC to create the room type, amenity
   links, and physical rooms together.
7. The active room is immediately available to public search and booking.
8. The manager may edit room details, visibility, amenities, physical room
   status, and date price overrides later.

The public customer chooses a room type. The database allocates a physical room
to prevent overlapping reservations. Room numbers remain private.

### Customer booking lifecycle

1. Search publicly and select dates/guests.
2. Open a hotel and request live quotes.
3. Clicking Reserve reaches a customer-only route; unauthenticated users go to
   sign in.
4. The customer may revise check-in/check-out on the booking page and apply the
   change to obtain a fresh quote and night count.
5. Confirming calls `create_reservation`, which locks and allocates inventory,
   snapshots pricing, and returns a confirmation immediately.
6. `/reservations` shows stays in normal public-site styling.
7. Change calls `modify_reservation`; the database rechecks availability and
   recalculates the total.
8. Cancel calls `cancel_reservation`; the row is preserved as cancelled.

## 5. Local setup

Use Git Bash. From the repository root:

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

In a second Git Bash terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:3000`

Apply all SQL files in `supabase/migrations/` in filename order. Existing
projects must apply the new `202610260001_direct_manager_hotel_workflow.sql`
migration before testing this version.

Optional demo data: after a manager has registered and confirmed their email,
run `supabase/seeds/demo_hotels.sql`. It creates or refreshes 10 demo hotels,
50 room types, and 150 bookable physical rooms. It is a seed, not a migration.

Backend `.env`:

```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-key
RESEND_API_KEY=re_your-api-key
EMAIL_FROM=Bookings <bookings@your-verified-domain.com>
```

Frontend `.env`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The last three backend email/admin variables are optional for basic booking.
Supabase confirmation email is configured separately in Authentication settings
(SMTP, Site URL, and redirect URLs).

## 6. Folder and file guide

### Repository root

| File/folder | Responsibility |
| --- | --- |
| `README.md` | Fast setup and links |
| `PROJECT_HANDOFF.md` | This complete continuation guide |
| `naming-conventions.md` | Required naming rules |
| `.gitignore` | Local/build/secret exclusions |
| `frontend/` | React browser application |
| `backend/` | Express REST API and email worker |
| `supabase/` | Ordered PostgreSQL migrations, RLS, RPCs, Storage setup |
| `.github/` | Automated backend verification workflow |

### Frontend root

| File | Responsibility |
| --- | --- |
| `frontend/package.json` | Vite, React, Router, Supabase dependencies and scripts |
| `frontend/.env.example` | Browser-safe environment template |
| `frontend/getting-started.md` | Frontend setup and route quick reference |
| `frontend/vite.config.js` | Vite React setup |
| `frontend/eslint.config.js` | Frontend lint rules |
| `frontend/index.html` | Vite HTML entry |

### `frontend/src`

| File | Responsibility |
| --- | --- |
| `main.jsx` | Mounts React, BrowserRouter, and AuthProvider |
| `app.jsx` | Complete route map and lazy page loading |
| `index.css` | Shared public, auth, workspace, responsive styles |
| `App.css` | Legacy Vite stylesheet; currently not imported |
| `assets/` | Local image assets; only import assets that are actually used |
| `components/siteHeader.jsx` | Public navbar; customer reservation/account links; manager/admin workspace link and sign-out action |
| `components/dashboardLayout.jsx` | Manager/admin sidebar shell |
| `components/formField.jsx` | Reusable labeled input |
| `lib/api.js` | Fetch wrapper, Bearer tokens, and normalized API errors |
| `lib/supabase.js` | Browser Supabase client |
| `lib/uploadImage.js` | Validates and uploads JPG/PNG/WebP files to `hotel-images` |

### Frontend auth/account

| File | Responsibility |
| --- | --- |
| `features/auth/authProvider.jsx` | Session subscription, profile load, signup/signin, and sign-out redirect to `/` |
| `features/auth/authContext.js` | Context object |
| `features/auth/useAuth.js` | Safe auth hook |
| `features/auth/authLayout.jsx` | Shared login/register presentation |
| `features/auth/loginPage.jsx` | Email/password sign in and role redirect |
| `features/auth/registerPage.jsx` | Customer/manager signup and confirmation message |
| `features/auth/getHomePath.js` | Role landing paths |
| `features/auth/requireAuth.jsx` | Authentication route guard |
| `features/account/accountPage.jsx` | Profile edit; public shell for customers, workspace shell otherwise |

### Frontend public/customer

| File | Responsibility |
| --- | --- |
| `features/public/homePage.jsx` | Public search results, filters, sort, pagination |
| `features/public/hotelSearchForm.jsx` | Reusable destination/date/guest form |
| `features/public/hotelDetailsPage.jsx` | Responsive gallery, map, facilities, rooms, quotes, reviews |
| `features/customer/requireCustomer.jsx` | Customer-only route guard |
| `features/customer/bookingPage.jsx` | Editable stay dates, night count, fresh server quote, guest form, confirmation |
| `features/customer/customerReservationsPage.jsx` | Public-style My Reservations page with edit/cancel |

### Frontend manager/admin

| File | Responsibility |
| --- | --- |
| `features/manager/requireManager.jsx` | Manager-only route guard |
| `features/manager/managerDashboardPage.jsx` | Small hotel creation form and owned hotel list |
| `features/manager/managerHotelPage.jsx` | Hotel details, facilities, images, complete room creation/editing, inventory, pricing |
| `features/manager/managerReservationsPage.jsx` | Reservation search and operational/payment updates |
| `features/manager/managerReportsPage.jsx` | Totals, charts, filters, CSV export |
| `features/admin/requireAdmin.jsx` | Admin-only route guard |
| `features/admin/adminDashboardPage.jsx` | Read-oriented platform totals, hotels, and users |

### Backend root and shared code

| File | Responsibility |
| --- | --- |
| `backend/package.json` | API dependencies and scripts |
| `backend/.env.example` | Server environment template |
| `backend/src/server.js` | Starts HTTP server and optional email worker |
| `backend/src/app.js` | Express middleware, rate limit, routes, health endpoint |
| `backend/src/config/env.js` | Validates environment variables |
| `backend/src/lib/supabase.js` | Anonymous/admin/user-scoped Supabase clients |
| `backend/src/lib/httpError.js` | Public HTTP error type |
| `backend/src/lib/supabaseError.js` | Maps database errors safely |
| `backend/src/lib/pagination.js` | Page/range helpers |
| `backend/src/lib/toCamelCase.js` | Recursive database-to-JSON casing |
| `backend/src/lib/auditService.js` | Audit log listing |
| `backend/src/middleware/authenticate.js` | Verifies JWT, loads profile, creates scoped client |
| `backend/src/middleware/authorize.js` | Role check only; no manager approval check |
| `backend/src/middleware/validate.js` | Zod request parsing |
| `backend/src/middleware/requestContext.js` | Request identifier and logging context |
| `backend/src/middleware/errorHandler.js` | Stable JSON errors and server logs |
| `backend/src/jobs/emailWorker.js` | Delivers queued reservation emails through Resend |

### Backend modules

| File | Responsibility |
| --- | --- |
| `modules/auth/authRoutes.js` | Current profile read/update |
| `modules/public/publicRoutes.js` | Public request validation/routes |
| `modules/public/publicService.js` | Search, details, ratings, filters, quotes |
| `modules/customer/customerRoutes.js` | Customer reservation/review validation/routes |
| `modules/customer/customerService.js` | Customer reservation RPCs and deadlines |
| `modules/manager/managerRoutes.js` | Hotel/catalog/inventory/pricing validation/routes |
| `modules/manager/hotelService.js` | Owned hotel, facility, and image persistence |
| `modules/manager/inventoryService.js` | Transactional room creation and later inventory/pricing edits |
| `modules/manager/managerReservationRoutes.js` | Manager reservation/report routes |
| `modules/manager/reservationService.js` | Manager/admin reservation operations |
| `modules/manager/reportService.js` | Metrics and CSV generation |
| `modules/admin/adminRoutes.js` | Admin users/hotels plus platform operations |
| `modules/admin/adminService.js` | Admin user/hotel reads and role updates |
| `backend/test/api.test.js` | HTTP/security/validation integration checks |
| `backend/test/helpers.test.js` | Helper and CSV unit tests |

### Supabase migrations

| Migration | Adds/changes |
| --- | --- |
| `202610230001_initial_schema.sql` | Profiles, hotels, room types, physical rooms, initial RLS |
| `202610240001_catalog_and_pricing.sql` | Facilities, amenities, images, date price overrides |
| `202610240002_reservations_and_reviews.sql` | Reservations, reviews, audit logs, notification outbox |
| `202610240003_booking_functions.sql` | Live quote and conflict-safe reservation transaction |
| `202610240004_customer_reservation_lifecycle.sql` | 48-hour change/cancel functions |
| `202610240005_manager_reservation_operations.sql` | Manager reservation/payment operations |
| `202610240006_admin_and_hotel_workflows.sql` | Admin/report foundations and historical lifecycle functions |
| `202610240007_admin_approve_draft_hotels.sql` | Historical compatibility migration |
| `202610260001_direct_manager_hotel_workflow.sql` | Supersedes approval: immediate managers/hotels, zero tax, room image, atomic room creation, Storage bucket/policies |

### Supabase support files

| File | Responsibility |
| --- | --- |
| `supabase/README.md` | Migration order, database rules, seed instructions, and verification |
| `supabase/seeds/demo_hotels.sql` | Repeatable 10-hotel catalog with 50 room types, images, amenities, and physical inventory |

Do not edit a migration already applied remotely. Add a newer migration.

## 7. Important API contracts

Full endpoint tables are in `backend/README.md`.

Complete room creation:

```http
POST /api/manager/hotels/:hotelId/room-types
Authorization: Bearer <manager-token>
Content-Type: application/json
```

```json
{
  "name": "Deluxe double room",
  "description": "King bed, city view, private bathroom",
  "capacity": 2,
  "basePrice": 120,
  "imageUrl": "https://...",
  "amenityIds": [1, 3, 5],
  "roomNumbers": ["101", "102", "103"]
}
```

The endpoint calls `create_room_type_with_inventory`, so partial room setup is
rolled back if any insert fails.

Successful list responses contain the resource array plus:

```json
{ "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 } }
```

Errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [],
    "requestId": "..."
  }
}
```

## 8. Database facts that must not be broken

- `rooms` are physical inventory; `room_types` are customer-facing choices.
- The `(room_type_id, hotel_id)` relationship prevents cross-hotel inventory.
- RLS ownership checks must remain active. Do not replace user-scoped clients
  with the service key in normal requests.
- Reservation creation/modification belongs in database RPC transactions to
  keep availability conflict-safe.
- Reservation prices are snapshots. Later manager price edits must not silently
  rewrite old reservations.
- Cancellation preserves the reservation row.
- Tax columns currently remain only for migration/history compatibility and are
  constrained to zero for hotels. Do not show tax in current UI.
- Uploaded image objects are public-read, but only managers can write inside
  their own `auth.uid()` folder.

## 9. Verification checklist

Automated:

```bash
cd backend && npm run check
cd ../frontend && npm run lint && npm run build
```

Manual smoke test after applying migrations:

1. Open `/` signed out; search and filters must remain accessible.
2. Register manager, confirm email, sign in, and verify direct `/manager` access.
3. Create a hotel with the four-field form.
4. Complete hotel details and create a room with URL image.
5. Create another room with a JPG/PNG/WebP upload under 5 MB.
6. Verify both rooms appear publicly and quote availability matches room count.
7. On a hotel with only a cover image, verify the detail hero keeps the property
   visible on desktop and mobile instead of showing an excessively wide crop.
8. Register customer, revise stay dates on the booking page, and confirm the
   night count and price are refreshed before reservation creation.
9. Change reservation dates/guest data before the deadline.
10. Cancel and confirm the row remains with `cancelled` status.
11. Sign out and confirm the browser returns to `/`.
12. Confirm no tax input or tax row appears.
13. Confirm admin overview contains no approve/reject actions.

## 10. Current deliberate limits

- No online payment gateway; payment status only.
- No PDF export; CSV only.
- Email delivery needs Supabase SMTP for signup and optional Resend credentials
  for reservation emails.
- Hotel gallery additions still use public URLs; room creation supports URL or
  direct upload.
- Legacy status columns remain for safe migration compatibility, but active
  product behavior does not expose them.

## 11. Prompt for another AI

Use this when handing the repository to another AI:

> Continue the Staywise project from `PROJECT_HANDOFF.md`. Read
> `naming-conventions.md` and the Ponytail skill before coding. Preserve the
> modular-monolith React + Express + Supabase architecture and existing user
> changes. Use Git Bash, make direct code edits, add new migrations instead of
> changing applied ones, and keep RLS plus transactional booking logic intact.
> Managers and hotels are immediate—do not reintroduce approval, rejection,
> draft submission, or tax UI. Run backend checks and frontend lint/build before
> handing back the result.

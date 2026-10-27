# Staywise frontend

React 19 and Vite client for the public marketplace, customer reservations,
manager workspace, and admin overview.

## Setup

Use Git Bash:

```bash
cp .env.example .env
npm install
npm run dev
```

Required frontend variables:

```env
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Run the Express backend separately on port `3000`. Apply every SQL migration
in `../supabase/migrations/` before testing authenticated workflows.

Current public behavior:

- The home page, hotel search, filters, property details, and room availability
  are accessible without signing in.
- Reserving requires a confirmed customer account.
- The booking page lets the customer revise check-in/check-out, refresh the
  server quote, and see the resulting night count before confirming.
- A property with one image uses a responsive hero crop; multi-image properties
  use the gallery grid.
- Signing out redirects to `/` for every role.

## Main routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Search and filter hotels |
| `/hotels/:hotelId` | Public | Hotel, rooms, prices, and reviews |
| `/login`, `/register` | Public | Authentication |
| `/book/:roomTypeId` | Customer | Confirm a reservation |
| `/reservations` | Customer | View, change, or cancel stays |
| `/account` | Signed in | Edit profile |
| `/manager` | Manager | Create and list hotels |
| `/manager/hotels/:hotelId` | Manager | Hotel and room management |
| `/manager/reservations` | Manager | Reservation operations |
| `/manager/reports` | Manager | Metrics and CSV export |
| `/admin` | Admin | Platform overview |

## Folder and file guide

### Application entry and shared UI

| Path | Responsibility |
| --- | --- |
| `src/main.jsx` | Mounts React, BrowserRouter, and AuthProvider |
| `src/app.jsx` | Route map, role boundaries, redirects, and lazy page imports |
| `src/index.css` | Shared public, booking, auth, workspace, and responsive styling |
| `src/App.css` | Legacy Vite stylesheet; currently not imported |
| `src/components/siteHeader.jsx` | Public navigation and customer sign-out action |
| `src/components/dashboardLayout.jsx` | Manager/admin sidebar and sign-out action |
| `src/components/formField.jsx` | Reusable labeled form control |

### Features

| Folder | Responsibility |
| --- | --- |
| `src/features/public/` | Home search, filters, hotel details, gallery, room quotes, and reviews |
| `src/features/customer/` | Booking dates and quote refresh, reservation creation, edits, cancellation |
| `src/features/manager/` | Hotel creation, full hotel/room management, reservations, reports, CSV |
| `src/features/admin/` | Platform overview and admin route protection |
| `src/features/auth/` | Supabase sessions, signup/signin, profile loading, guards, role redirects, sign-out redirect |
| `src/features/account/` | Shared profile editing page |

### Browser services and static files

| Path | Responsibility |
| --- | --- |
| `src/lib/api.js` | REST fetch wrapper, Bearer token support, normalized API errors |
| `src/lib/supabase.js` | Browser-safe Supabase client |
| `src/lib/uploadImage.js` | JPG/PNG/WebP validation and upload to the public `hotel-images` bucket |
| `src/assets/` | Imported local assets; remove starter assets when no longer needed |
| `public/` | Files copied unchanged into the Vite build |
| `index.html` | Browser entry document |
| `vite.config.js` | Vite and React plugin configuration |
| `eslint.config.js` | Frontend lint rules |
| `.env.example` | Browser-safe environment template; never add a secret key |

Data from the API is camelCase. Keep API calls in page/service boundaries and
keep reusable presentation in `components/`; do not query PostgreSQL directly
from feature pages.

## Checks

```bash
npm run lint
npm run build
```

After a UI change, manually check desktop and narrow mobile widths, public
navigation, the authenticated role involved, and sign-out redirection.

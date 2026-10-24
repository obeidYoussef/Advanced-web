# Hotel Reservation API

Express REST API backed by Supabase Auth and PostgreSQL. Supabase Row Level
Security is the final authorization boundary; the API also validates roles and
inputs before sending queries to the database.

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

The API runs at `http://localhost:3000`. Use the Supabase access token returned
to the frontend after login:

```http
Authorization: Bearer <access-token>
Content-Type: application/json
```

Run all automated checks with `npm test`.

## Response conventions

Successful responses use camelCase JSON. Lists include:

```json
{
  "hotels": [],
  "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

Errors always use:

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

## Endpoints

### Shared and public

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/auth/me` | Current account and role |
| PATCH | `/api/auth/me` | Update `fullName` and/or `phone` |
| GET | `/api/public/lookups` | Predefined facilities and amenities |
| GET | `/api/public/hotels` | Search approved hotels |
| GET | `/api/public/hotels/:hotelId` | Approved hotel details |
| GET | `/api/public/hotels/:hotelId/reviews` | Visible hotel reviews |
| GET | `/api/public/room-types/:roomTypeId/quote` | Live price and availability |

Hotel search accepts `page`, `limit`, `search`, `country`, `city`, `guests`,
`roomType`, `minPrice`, `maxPrice`, `minRating`, `facilityId`, `checkIn`,
`checkOut`, and `sort`. Valid sort values are `name_asc`, `name_desc`, `newest`,
`price_asc`, `price_desc`, and `rating_desc`. Both dates must be sent
together as `YYYY-MM-DD`.

The quote endpoint requires `checkIn`, `checkOut`, and `guests` query values.

### Customer

All paths start with `/api/customer` and require a customer token.

| Method | Path | Body / purpose |
| --- | --- | --- |
| GET | `/reservations` | Filters: status, page, limit |
| GET | `/reservations/:reservationId` | Reservation details and change deadline |
| POST | `/reservations` | Create an immediately confirmed reservation |
| PUT | `/reservations/:reservationId` | Replace editable booking details and reprice |
| POST | `/reservations/:reservationId/cancel` | Cancel before the 48-hour deadline |
| POST | `/reservations/:reservationId/review` | `{ rating, comment }` after completion |

Create and modify body:

```json
{
  "roomTypeId": "uuid",
  "checkIn": "2027-06-10",
  "checkOut": "2027-06-13",
  "guestCount": 2,
  "primaryGuestName": "Guest Name",
  "primaryGuestEmail": "guest@example.com",
  "primaryGuestPhone": "+961000000",
  "specialRequests": "Quiet room"
}
```

### Manager

All paths start with `/api/manager` and require an approved manager token.
Pending, rejected, and suspended managers receive `MANAGER_NOT_APPROVED`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET, POST | `/hotels` | List owned hotels / create a draft |
| GET, PATCH | `/hotels/:hotelId` | Read / edit an owned hotel |
| POST | `/hotels/:hotelId/submit` | Submit a complete draft for admin approval |
| POST, DELETE | `/hotels/:hotelId/facilities/:facilityId` | Add / remove a facility |
| POST | `/hotels/:hotelId/images` | Add an image URL |
| PATCH, DELETE | `/images/:imageId` | Edit / remove an image |
| POST | `/hotels/:hotelId/room-types` | Create a room type |
| PATCH | `/room-types/:roomTypeId` | Edit or deactivate a room type |
| POST, DELETE | `/room-types/:roomTypeId/amenities/:amenityId` | Add / remove an amenity |
| POST | `/hotels/:hotelId/rooms` | Create a physical room |
| PATCH | `/rooms/:roomId` | Edit or deactivate a physical room |
| POST | `/room-types/:roomTypeId/price-overrides` | Create a date price |
| PATCH, DELETE | `/price-overrides/:overrideId` | Edit / remove a date price |
| GET | `/reservations` | Filter reservations |
| GET | `/audit-logs` | Read owned-hotel audit history |
| GET | `/reservations/:reservationId` | Reservation details |
| POST | `/reservations/:reservationId/cancel` | Manager cancellation with reason |
| PATCH | `/reservations/:reservationId/status` | Check-in, complete, or no-show transition |
| PATCH | `/reservations/:reservationId/payment-status` | Update payment status only |
| GET | `/reports/summary` | Totals and chart data; requires `from` and `to` |
| GET | `/reports/reservations.csv` | CSV export; requires `from` and `to` |

Use `hotelId` on report routes to report one hotel. Without it, all hotels
owned by the manager are included.

### Administrator

All paths start with `/api/admin` and require an admin token.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/users` | Paginated users, optionally filtered by role |
| PATCH | `/users/:userId/role` | Set customer, manager, or admin role |
| GET | `/managers` | Manager applications by status |
| PATCH | `/managers/:managerId/status` | Approve, reject, suspend, or reopen |
| GET | `/hotels` | Hotels by moderation status |
| PATCH | `/hotels/:hotelId/status` | Approve, reject, or suspend a hotel |
| GET | `/reservations` | System-wide filtered reservations |
| POST | `/reservations/:reservationId/cancel` | Cancel with a recorded reason |
| PATCH | `/reservations/:reservationId/status` | Update operational status |
| PATCH | `/reservations/:reservationId/payment-status` | Update payment status |
| GET | `/reports/summary` | System-wide totals and chart data |
| GET | `/reports/reservations.csv` | System-wide CSV export |
| GET | `/audit-logs` | System-wide audit history |

Rejection and suspension requests require a `reason` between 2 and 500
characters. Admin accounts are not available through public registration.

## Email delivery

Reservation transactions write email jobs to `notification_outbox`. Add
`SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, and `EMAIL_FROM` to enable the worker.
Without all three values, booking still works and email jobs remain stored for
later delivery. `EMAIL_FROM` must use a domain verified in Resend.

Supabase signup confirmation email is separate: configure its SMTP provider,
site URL, and redirect URLs in the Supabase Auth dashboard.

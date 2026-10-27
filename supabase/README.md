# Staywise Supabase database

This folder owns the PostgreSQL schema, Row Level Security policies, booking
transactions, Storage rules, and optional development data.

## Folder guide

| Path | Responsibility |
| --- | --- |
| `migrations/` | Immutable schema changes applied in filename order |
| `seeds/` | Optional repeatable development/test data; never part of production migration history |
| `seeds/demo_hotels.sql` | Ten realistic fictional hotels, 50 room types, and 150 physical rooms with images |

## Apply the database

For a new Supabase project, open **SQL Editor** and run every migration in this
exact order:

1. `202610230001_initial_schema.sql`
2. `202610240001_catalog_and_pricing.sql`
3. `202610240002_reservations_and_reviews.sql`
4. `202610240003_booking_functions.sql`
5. `202610240004_customer_reservation_lifecycle.sql`
6. `202610240005_manager_reservation_operations.sql`
7. `202610240006_admin_and_hotel_workflows.sql`
8. `202610240007_admin_approve_draft_hotels.sql`
9. `202610260001_direct_manager_hotel_workflow.sql`

The `202610240006` and `202610240007` files contain historical approval workflow
changes. They still need to run because later objects depend on that history.
The final migration is the current product behavior: managers and hotels are
immediately usable, tax is zero, room images are supported, complete room
creation is transactional, and the `hotel-images` Storage bucket is configured.

Never edit a migration that has already been applied to a shared or remote
project. Add a new timestamped migration instead.

## Load the demo catalog

1. Register a manager through the application.
2. Confirm the manager's email and sign in once.
3. Open `seeds/demo_hotels.sql`.
4. If the project has several managers, replace
   `v_target_manager_email text := null;` with the chosen manager email.
5. Paste the complete script into the Supabase SQL Editor and run it.

Expected verification result:

| demo_hotels | demo_room_types | demo_physical_rooms |
| ---: | ---: | ---: |
| 10 | 50 | 150 |

The seed can be run again. It updates the named demo hotels, room types, room
images, amenities, and room inventory without deleting reservations. The hotel
names and contacts are fictional. Images use public Unsplash URLs, so an
internet connection is required to display them.

## Core data model

- `profiles` extends Supabase Auth users with `customer`, `manager`, or `admin`.
- `hotels` belongs to one manager; a manager may own multiple hotels.
- `room_types` is the customer-facing room choice and price.
- `rooms` is physical inventory. Customers never select a room number.
- `price_overrides` replaces the base nightly price for inclusive date ranges.
- `reservations` stores assigned inventory and a price snapshot.
- `reviews` is limited to one review per completed reservation.
- `notification_outbox` stores reservation email jobs.
- `audit_logs` records sensitive operational changes.

## Booking and lifecycle rules

- `get_room_type_quote` returns live night count, availability, and totals.
- `create_reservation` locks inventory and prevents overlapping assignments.
- `modify_reservation` rechecks availability and recalculates the price.
- `cancel_reservation` preserves history by changing status instead of deleting.
- Customer changes and cancellation are allowed until 48 hours before the
  hotel's local check-in time.
- Tax remains in historical schema only and is constrained to zero.
- Active totals are nightly prices plus the hotel service fee.

## Security rules

- Keep RLS enabled on application tables.
- Normal API requests must use the signed-in user's access token, not the
  service key.
- Admin accounts must be assigned securely; public registration creates only
  customer or manager profiles.
- Storage uploads are public-read but manager writes are restricted to the
  folder matching `auth.uid()`.
- `SUPABASE_SECRET_KEY` belongs only in the backend environment.

## Adding a database change

1. Create a new file under `migrations/` with a later timestamp.
2. Wrap related changes in `begin;` and `commit;` when possible.
3. Preserve existing RLS and explicit grants/revokes.
4. Update RPC permissions after creating or replacing a function.
5. Update this README, `PROJECT_HANDOFF.md`, and relevant API documentation.
6. Re-run backend checks and the frontend build after applying the migration.

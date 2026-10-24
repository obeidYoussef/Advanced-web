# Staywise

Staywise is a multi-hotel reservation platform built with React, Express,
Supabase Auth, and PostgreSQL. Customers can search and reserve hotels,
approved managers can operate their properties, and administrators moderate
manager accounts and hotel listings.

## Start here

- [Complete project handoff](./PROJECT_HANDOFF.md)
- [Backend API reference](./backend/README.md)
- [Frontend setup](./frontend/getting-started.md)
- [Naming conventions](./naming-conventions.md)

## Local development

Use Git Bash and run the backend and frontend in separate terminals.

```bash
cd backend
cp .env.example .env
npm ci
npm run dev
```

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

Apply every file in `supabase/migrations/` to the same Supabase project in
filename order before testing the application. Never commit either `.env`
file or expose `SUPABASE_SECRET_KEY` in the frontend.

## Verification

```bash
cd backend && npm run check
cd ../frontend && npm run lint && npm run build
```

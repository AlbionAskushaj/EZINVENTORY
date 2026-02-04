# EZInventory

Multi-tenant restaurant inventory app with an Express/Mongo API and a Vite/React frontend. Current scope covers auth, units, ingredients with adjustments, menu items with recipes, and invoice PDF import that creates missing items and updates stock.

## Current State (Dec 2025)
- **Authentication**: Email/password signup/login issuing JWTs; restaurants are created on signup and all data is scoped per restaurant via middleware.
- **Units**: CRUD for measurement units with precision; UI table with inline edit.
- **Ingredients**: CRUD with category, base unit, par level, and current quantity. Supports stock adjustments with reason logging and soft delete (active flag). UI shows to-order amount.
- **Menu Items**: CRUD with ingredient references and pricing; validates ingredient ownership; UI supports inline edit/delete.
- **Invoice Import**: Upload vendor invoice PDFs → server parses line items, previews new vs existing, allows selective apply, auto-creates units/ingredients if missing, and increments stock while recording movements.
- **Health Check**: `/api/health` endpoint and frontend page to confirm API reachability.

## Tech Stack
- **API**: Node.js, Express 4, MongoDB/Mongoose, Zod validation, Multer/PDF parsing.
- **Frontend**: React 19 + React Router 7, Vite 7, TypeScript, minimal CSS.
- **Tooling**: pnpm workspaces, ts-node-dev for API dev, concurrently for combined dev server.

## Repository Layout
- `api/` — Express API (TypeScript). Entry: `src/index.ts`. Routes: `src/routes/*`. Models: `src/models/*`. Services: invoice parsing.
- `frontend/` — Vite React app. Entry: `src/main.tsx` + `src/App.tsx`. Pages: `src/pages/*`. Auth context: `src/context/AuthContext.tsx`.
- Root `package.json` — workspace scripts (`pnpm dev` runs API + frontend).

## Prerequisites
- Node 18+ (uses `import` modules).
- pnpm (preferred) or npm/yarn.
- MongoDB connection string for the API.

## Environment Variables
Create an `.env` in `api/`:
```
MONGO_URI=mongodb://localhost:27017/ezinventory-dev
JWT_SECRET=change-me
PORT=4000
```

Create a `.env` in `frontend/`:
```
VITE_API_URL=http://localhost:4000
```

## Install & Run
```bash
# from repo root
pnpm install              # installs workspace deps
pnpm dev                  # runs both API and frontend (via concurrently)

# or run individually
cd api && pnpm dev        # API at :4000
cd frontend && pnpm dev   # Vite dev server (proxy to API via VITE_API_URL)
```

## API Overview
- **Auth**: `POST /api/auth/signup` (`email`, `password`, `restaurantName`), `POST /api/auth/login` → `{ token, restaurant }`.
- **Units**: `GET/POST /api/units`, `PATCH/DELETE /api/units/:id` (delete guarded if in use).
- **Ingredients**: `GET /api/ingredients?active=true|false`, `POST /api/ingredients`, `PATCH /api/ingredients/:id`, `POST /api/ingredients/:id/adjust`, `DELETE /api/ingredients/:id` (soft delete).
- **Menu Items**: `GET/POST /api/menu`, `PATCH/DELETE /api/menu/:id`.
- **Invoices**: `POST /api/invoices/preview` (PDF upload, returns parsed items), `POST /api/invoices/apply` (apply selected items, auto-create units/ingredients, log movements).
- All non-auth routes require `Authorization: Bearer <token>` and are scoped to the restaurant from the token.

## Frontend Highlights
- Navigation across Home, Health, Units, Ingredients, Invoice Import, Menu, Login/Signup.
- Auth state persisted in `sessionStorage`; redirects to login when missing a token.
- Inline editing tables for Units, Ingredients, Menu items; form validation and basic error surfaces.
- Invoice Import flow: drag/drop PDF → preview table → select items → apply → results table.

## Development Notes
- Mongo buffering is disabled; API fails fast if `MONGO_URI` is invalid/unreachable.
- Schema validation uses Zod at route level; Mongoose handles persistence constraints.
- Invoice parser currently targets PDFs with "Item Code / Qty" style tables; parser is easily swappable (`api/src/services/invoiceParser.ts`).

## Roadmap / Next Steps
- Strengthen data integrity (per-restaurant unique constraints, cross-collection ownership checks, movement scoping).
- Better UX (toasts, inline validation, loading/empty states, error boundaries).
- Reporting: movement history, usage vs par, recipe costing, sales/import for variance.
- Testing: add API integration tests and frontend smoke tests; wire lint/test into CI.

# Bill360

A multi-tenant billing & POS application. Pure client-side React (Vite) talking
directly to Supabase — no backend server to host or maintain, deployable to
GitHub Pages.

## Stack

- **Frontend:** React 19 + Vite, React Router
- **UI:** Tailwind CSS v4 + hand-rolled shadcn/ui-style components (Radix primitives)
- **State:** Zustand (`authStore`, `cartStore`)
- **Backend-as-a-Service:** Supabase (Postgres + Auth + Storage + Edge Functions)
- **PDF invoices:** jsPDF + jspdf-autotable
- **Bulk import:** SheetJS (`xlsx`)
- **UPI QR codes:** `qrcode.react`
- **Charts:** Recharts

## Why Supabase over Firebase

Billing data is inherently relational (companies → categories → products →
bills → bill_items, with per-tenant isolation and running invoice sequences).
Postgres + Row Level Security maps onto that far more naturally than
Firestore's document model, and RLS gives you tenant isolation enforced by
the database itself rather than by application code you have to get right
everywhere. Supabase's free tier is generous and has no forced project
pause on inactivity issues that would surprise a small business's billing
system.

## 1. Project structure

```
src/
  components/
    ui/            shadcn-style primitives (button, card, dialog, table, …)
    layout/         AppShell (sidebar/topbar), ProtectedRoute
    pos/            ProductCard, CartPanel, CustomItemDialog, CheckoutModal
    products/       ProductFormDialog, BulkImportDialog
    users/          CreateUserDialog (calls the admin-create-user edge function)
    bills/          BillsTable (shared by MyBills / AllBills)
    dashboard/      StatCard, LowStockBell
  hooks/            useProducts, useBills, useDashboardStats, useLowStockProducts
  lib/              supabase client, generateInvoicePdf, reprintBill, utils
  store/            authStore (session/profile), cartStore (current bill)
  pages/
    Login.jsx
    sales/          POS.jsx, MyBills.jsx                      (sales_user)
    admin/          Dashboard, Products, Categories, Stock,
                    Reports, AllBills, TeamUsers, CompanySettings   (company_admin)
    superadmin/     Companies, PlatformUsers                  (super_admin)
supabase/
  schema.sql                       full DB schema + RLS policies
  functions/admin-create-user/     edge function for privileged user creation
```

Routing and the sidebar (`src/App.jsx`, `src/components/layout/AppShell.jsx`)
gate each page behind `ProtectedRoute roles={[...]}`, and `authStore` exposes
`profile.role` (`super_admin` | `company_admin` | `sales_user`) plus
`profile.company_id` to every screen.

## 2. Database schema

See [`supabase/schema.sql`](supabase/schema.sql) for the full script. Summary:

| Table | Purpose |
|---|---|
| `companies` | Tenant record: name, GST settings, bill series/sequence, UPI ID, footer note, subscription plan/status |
| `profiles` | 1:1 with `auth.users`; adds `role` + `company_id` (null for super_admin) |
| `categories` | Per-company product categories |
| `products` | Per-company catalog: price, GST rate, stock, low-stock threshold, image |
| `customers` | Lightweight repeat-customer directory (autofill at checkout) |
| `bills` | Invoice header — customer details are **snapshotted** at bill time so past invoices never change if the customer record is edited later |
| `bill_items` | Line items; `product_id` is null for ad-hoc/custom items |
| `stock_movements` | Audit trail for every stock change (sale, restock, manual adjustment, import) |
| `product_batches` | Batch numbers + expiry dates; drives the "expires soon" warning on product cards |
| `suppliers` / `purchases` / `purchase_items` | Goods-in and accounts payable — a purchase increases stock for any line linked to an existing product |
| `payments` / `purchase_payments` | Recovery payments recorded over time against a credit sale or a credit purchase; a trigger recomputes `payment_status` on insert |

Run [`supabase/migrations/002_v2_features.sql`](supabase/migrations/002_v2_features.sql) **after** `schema.sql` — it adds the tables above plus `products.brand` / `hsn_code` / `unit_type` / `weight_unit`, `bill_items.uom`, and a `company-logos` storage bucket. Both files are idempotent (`if not exists` / `drop policy if exists`), so re-running either is safe.

Key design points:
- **Multi-tenancy via RLS**, not application code: every tenant table has
  policies keyed off `my_company_id()` / `my_role()` helper functions, so a
  compromised or buggy client can't read another company's data — Postgres
  enforces it.
- **Bill numbering** is atomic: `next_bill_number(company_id)` increments
  `companies.bill_seq` and returns `"<bill_series>-0007"` in one statement,
  avoiding race conditions between concurrent cashiers.
- **Stock decrement** happens via the `apply_stock_sale()` RPC so the stock
  update and its audit-log row are applied together.

### Run it

1. Create a Supabase project (supabase.com — free tier).
2. SQL Editor → paste and run `supabase/schema.sql`.
3. Sign up your first user from the app's `/login` page (or via the Supabase
   dashboard), then in the SQL editor promote them to super admin:
   ```sql
   update profiles set role = 'super_admin', company_id = null
   where id = '<their auth.users id>';
   ```
   Every other user is created **in-app** afterwards (Super Admin creates
   companies + company admins; a Company Admin creates sales users).

## 3. Environment variables

```
cp .env.example .env
```
Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from
Project Settings → API. The anon key is safe to ship to the browser — it's
subject to RLS, which is exactly what `schema.sql` sets up.

## 4. Privileged user creation (Edge Function)

Creating an auth user requires the Supabase **service role** key, which must
never reach the browser. `supabase/functions/admin-create-user/index.ts`
runs on Supabase's infrastructure (still part of the BaaS — nothing for you
to host) and is the only place that key is used. It enforces:
- `super_admin` → can create a user with any role for any company
- `company_admin` → can only create `sales_user` accounts in their own company

Deploy it once:
```
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy admin-create-user
```
The function reads `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
from its own environment automatically — Supabase injects the first two, and
you don't need to (and shouldn't) put the service role key in this repo or
in `.env`.

## 5. Run locally

```
npm install
npm run dev
```

## 6. Deploy to GitHub Pages

Two options are wired up:

**A. GitHub Actions (recommended)** — `.github/workflows/deploy.yml` builds
and publishes on every push to `main`. Add `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` as repo secrets (Settings → Secrets and variables →
Actions), then enable Pages with source "GitHub Actions" (Settings → Pages).

**B. Manual** —
```
BASE_PATH=/<your-repo-name>/ npm run deploy
```
(uses the `gh-pages` package to push `dist/` to the `gh-pages` branch).

Because this is a single-page app on static hosting, `public/404.html` plus
the inline script in `index.html` implement the standard
[spa-github-pages](https://github.com/rafgraph/spa-github-pages) redirect
trick so deep links and refreshes on routes like `/pos` don't 404. If you
deploy as a user/org root page (`<user>.github.io`) instead of a project
page, change `pathSegmentsToKeep` to `0` in `public/404.html`.

## 7. State management

- **`authStore` (Zustand)** — holds the Supabase `session` and the joined
  `profiles` row (`role`, `company_id`, `companies: {...}`). `ProtectedRoute`
  and `AppShell` read from it directly; there's no prop-drilling of "current
  user" through the tree.
- **`cartStore` (Zustand)** — the in-progress bill: cart line items, qty,
  per-line discount %. `getTotals(gstEnabled)` is a derived selector that
  recomputes subtotal/discount/GST/grand-total from the line items so the
  cart never stores redundant computed state. Kept separate from auth state
  because it's POS-page-local and should reset per bill, not per session.
- Both stores are intentionally *not* persisted to localStorage — an
  abandoned cart shouldn't survive a refresh at a billing counter, and auth
  session persistence is handled by Supabase's own client instead.

## 8. Camera-based features

- **Scan product** (POS page) and **Scan purchase bill** (Purchases page) both
  need `getUserMedia` camera access, which browsers only grant on a *secure
  context* — `localhost` is fine for dev, but anywhere else needs HTTPS.
  GitHub Pages serves over HTTPS by default, so this works once deployed;
  it will silently fail to prompt for camera permission over plain `http://`
  on a LAN IP, for example.
- **Testing the camera from your phone during development**: `npm run dev`
  alone won't work for this (your phone can't reach `localhost` on your
  laptop, and the LAN address is plain HTTP). Use `npm run dev:https`
  instead — it starts Vite with a self-signed HTTPS cert bound to your LAN
  IP. Open the `https://<your-lan-ip>:5173` URL it prints from your phone,
  accept the self-signed-certificate warning once, and the camera dialogs
  will work exactly as they will once deployed.
- **Product QR/barcode scanning** expects the label to encode the product's
  `sku` (falling back to its `id`). Generate/print labels from the QR icon on
  each row in the Products table — it encodes the same value.
- **Purchase bill OCR** (`tesseract.js`) runs entirely in-browser — no image
  ever leaves the device — but it's a heuristic line-parser on top of OCR
  text, not a real structured-invoice reader. Treat its output as a rough
  first draft: the item list it produces is fully editable before you save
  the purchase, and it will sometimes miss lines or misread numbers on messy
  or handwritten bills.
- Both scanning dependencies (`tesseract.js`, `html5-qrcode`) are code-split
  behind `React.lazy` so they only download when a user opens that specific
  dialog — they add nothing to the initial POS/Purchases page load.

## 9. Known trade-offs

- `xlsx` (SheetJS) has an [open ReDoS/prototype-pollution advisory](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6)
  with no npm-published fix; it's only used for admin-side bulk import of
  trusted files, but if that's a concern, pin to SheetJS's own CDN build
  per their advisory guidance instead of the npm package.
- Product images upload to a public Supabase Storage bucket
  (`product-images`) — fine for product photos, not for anything sensitive.
- The 7-day/monthly revenue rollups in Dashboard/Reports run client-side
  over rows fetched per request; fine at small-business scale, but move to
  a Postgres view/RPC if a tenant's bill volume grows large.
- Bulk-import re-matching (name + brand + category) means renaming a product
  in the sheet creates a new row instead of updating the old one — expected,
  but worth knowing if you're re-importing a corrected price list.

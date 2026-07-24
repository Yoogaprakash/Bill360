import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { isSupabaseConfigured } from '@/lib/supabase'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppShell from '@/components/layout/AppShell'
import SetupRequired from '@/components/SetupRequired'

import Login from '@/pages/Login'
import ResetPassword from '@/pages/ResetPassword'
import Profile from '@/pages/Profile'
import POS from '@/pages/sales/POS'
import MyBills from '@/pages/sales/MyBills'
import MyDashboard from '@/pages/sales/MyDashboard'
import Quotations from '@/pages/sales/Quotations'
import Dashboard from '@/pages/admin/Dashboard'
import Products from '@/pages/admin/Products'
import Categories from '@/pages/admin/Categories'
import Stock from '@/pages/admin/Stock'
import Reports from '@/pages/admin/Reports'
import CompanySettings from '@/pages/admin/CompanySettings'
import TeamUsers from '@/pages/admin/TeamUsers'
import AllBills from '@/pages/admin/AllBills'
import Purchases from '@/pages/admin/Purchases'
import CreditReport from '@/pages/admin/CreditReport'
import CreditDebitLedger from '@/pages/admin/CreditDebitLedger'
import Companies from '@/pages/superadmin/Companies'
import PlatformUsers from '@/pages/superadmin/PlatformUsers'

function App() {
  const init = useAuthStore((s) => s.init)
  const loading = useAuthStore((s) => s.loading)

  useEffect(() => {
    if (isSupabaseConfigured) init()
  }, [init])

  if (!isSupabaseConfigured) {
    return <SetupRequired />
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading Bill360…
      </div>
    )
  }

  return (
    // basename must match Vite's `base` (import.meta.env.BASE_URL) — without
    // it, react-router builds absolute paths like /pos instead of
    // /Bill360/pos, which 404s on GitHub Pages once you navigate or refresh.
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Toaster richColors position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute roles={['sales_user', 'manager', 'company_admin', 'super_admin']} />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/pos" replace />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/quotations" element={<Quotations />} />
            <Route path="/my-bills" element={<MyBills />} />
            <Route path="/profile" element={<Profile />} />

            {/* Sales-scoped analytics + view-only credit/purchase visibility: sales_user and manager */}
            <Route element={<ProtectedRoute roles={['sales_user', 'manager']} />}>
              <Route path="/my-dashboard" element={<MyDashboard />} />
            </Route>

            {/* Purchases/Credit: full for company_admin, add/view for manager, view-only for sales_user (enforced in-page + RLS) */}
            <Route element={<ProtectedRoute roles={['sales_user', 'manager', 'company_admin']} />}>
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/credit" element={<CreditReport />} />
            </Route>

            {/* Product catalog + stock: company_admin and manager (no delete for manager, enforced in-page) */}
            <Route element={<ProtectedRoute roles={['manager', 'company_admin']} />}>
              <Route path="/products" element={<Products />} />
              <Route path="/stock" element={<Stock />} />
            </Route>

            {/* All Bills (edit), Team (manage sales_user only), Credit & Debit ledger: company_admin full, manager scoped */}
            <Route element={<ProtectedRoute roles={['manager', 'company_admin']} />}>
              <Route path="/bills" element={<AllBills />} />
              <Route path="/team" element={<TeamUsers />} />
              <Route path="/credit-debit" element={<CreditDebitLedger />} />
            </Route>

            <Route element={<ProtectedRoute roles={['company_admin']} />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<CompanySettings />} />
            </Route>

            <Route element={<ProtectedRoute roles={['super_admin']} />}>
              <Route path="/companies" element={<Companies />} />
              <Route path="/platform-users" element={<PlatformUsers />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

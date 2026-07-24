import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tags,
  Boxes,
  BarChart3,
  Settings,
  Users,
  Receipt,
  Building2,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Truck,
  Wallet,
  User,
  UserCircle,
  FileText,
  ArrowLeftRight,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import LowStockBell from '@/components/dashboard/LowStockBell'

const NAV = {
  sales_user: [
    { to: '/my-dashboard', label: 'My Dashboard', icon: LayoutDashboard },
    { to: '/pos', label: 'Sales / POS', icon: ShoppingCart },
    { to: '/quotations', label: 'Quotations', icon: FileText },
    { to: '/my-bills', label: 'My Bills', icon: Receipt },
    { to: '/purchases', label: 'Purchases', icon: Truck },
    { to: '/credit', label: 'Credit Report', icon: Wallet },
  ],
  manager: [
    { to: '/my-dashboard', label: 'My Dashboard', icon: LayoutDashboard },
    { to: '/pos', label: 'Sales / POS', icon: ShoppingCart },
    { to: '/quotations', label: 'Quotations', icon: FileText },
    { to: '/products', label: 'Products', icon: Package },
    { to: '/stock', label: 'Stock', icon: Boxes },
    { to: '/purchases', label: 'Purchases', icon: Truck },
    { to: '/credit', label: 'Credit Report', icon: Wallet },
    { to: '/credit-debit', label: 'Credit & Debit', icon: ArrowLeftRight },
    { to: '/bills', label: 'All Bills', icon: Receipt },
    { to: '/my-bills', label: 'My Bills', icon: Receipt },
    { to: '/team', label: 'Team', icon: Users },
  ],
  company_admin: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/pos', label: 'Sales / POS', icon: ShoppingCart },
    { to: '/quotations', label: 'Quotations', icon: FileText },
    { to: '/products', label: 'Products', icon: Package },
    { to: '/categories', label: 'Categories', icon: Tags },
    { to: '/stock', label: 'Stock', icon: Boxes },
    { to: '/purchases', label: 'Purchases', icon: Truck },
    { to: '/credit', label: 'Credit Report', icon: Wallet },
    { to: '/credit-debit', label: 'Credit & Debit', icon: ArrowLeftRight },
    { to: '/bills', label: 'All Bills', icon: Receipt },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
    { to: '/team', label: 'Team', icon: Users },
    { to: '/settings', label: 'Company Settings', icon: Settings },
  ],
  super_admin: [
    { to: '/companies', label: 'Companies', icon: Building2 },
    { to: '/platform-users', label: 'Platform Users', icon: ShieldCheck },
  ],
}

export default function AppShell() {
  const profile = useAuthStore((s) => s.profile)
  const signOut = useAuthStore((s) => s.signOut)
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const items = NAV[profile?.role] || []
  const companyName = profile?.companies?.name || (profile?.role === 'super_admin' ? 'Platform Admin' : 'Bill360')
  const logoUrl = profile?.companies?.logo_url

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col border-r bg-background transition-all lg:static lg:translate-x-0',
          collapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className={cn('flex h-14 shrink-0 items-center border-b px-3', collapsed ? 'justify-center' : 'justify-between')}>
          <div className={cn('flex min-w-0 items-center gap-2', collapsed && 'justify-center')}>
            {logoUrl ? (
              <img src={logoUrl} alt={companyName} className="h-8 w-8 shrink-0 rounded object-cover" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-brand text-sm font-bold text-brand-foreground">
                {companyName.slice(0, 1).toUpperCase()}
              </div>
            )}
            {!collapsed && <span className="truncate font-semibold">{companyName}</span>}
          </div>
          {!collapsed && (
            <Button variant="ghost" size="icon" className="hidden shrink-0 lg:inline-flex" onClick={() => setCollapsed(true)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {collapsed && (
          <button
            className="hidden shrink-0 items-center justify-center border-b py-1.5 text-muted-foreground hover:bg-accent lg:flex"
            onClick={() => setCollapsed(false)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-2',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

        <div className={cn('shrink-0 border-t py-2 text-center text-[10px] font-medium text-muted-foreground', collapsed && 'px-0')}>
          {collapsed ? 'B360' : 'Bill360'}
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            {profile?.role === 'company_admin' && <LowStockBell />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-accent">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name} className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <span className="max-w-24 truncate text-xs font-medium text-muted-foreground">
                    {profile?.full_name || 'User'}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="capitalize text-xs text-muted-foreground">
                  {profile?.role?.replace('_', ' ')}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <UserCircle className="h-4 w-4" /> My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

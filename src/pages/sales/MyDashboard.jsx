import { IndianRupee, Receipt, CalendarDays } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import StatCard from '@/components/dashboard/StatCard'
import { usePersonalSalesStats } from '@/hooks/usePersonalSalesStats'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/lib/utils'

export default function MyDashboard() {
  const profile = useAuthStore((s) => s.profile)
  const { stats, loading } = usePersonalSalesStats()

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold">My Dashboard</h1>
      <p className="-mt-4 text-sm text-muted-foreground">Sales performance for {profile?.full_name || 'you'} only.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Today's Sales" value={formatCurrency(stats.todaySales)} icon={IndianRupee} tone="success" />
        <StatCard label="Today's Bills" value={stats.todayBills} icon={Receipt} />
        <StatCard label="This Month" value={formatCurrency(stats.monthRevenue)} icon={CalendarDays} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My sales — last 7 days</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.last7Days}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

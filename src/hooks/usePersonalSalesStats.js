import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// Same shape as useDashboardStats but scoped to bills the current user
// personally created — used by the sales_user / manager "My Dashboard".
export function usePersonalSalesStats() {
  const profile = useAuthStore((s) => s.profile)
  const [stats, setStats] = useState({ todaySales: 0, todayBills: 0, monthRevenue: 0, monthBills: 0, last7Days: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const sevenDaysAgo = startOfDay(new Date(now.getTime() - 6 * 86400000))

      const { data, error } = await supabase
        .from('bills')
        .select('grand_total, created_at')
        .eq('created_by', profile.id)
        .gte('created_at', monthStart.toISOString())

      if (!error && data && !cancelled) {
        const today = startOfDay(now).getTime()
        let todaySales = 0
        let todayBills = 0
        let monthRevenue = 0
        const byDay = {}

        for (const b of data) {
          monthRevenue += Number(b.grand_total)
          const day = startOfDay(b.created_at).getTime()
          if (day === today) {
            todaySales += Number(b.grand_total)
            todayBills += 1
          }
          if (day >= sevenDaysAgo.getTime()) {
            const key = new Date(day).toLocaleDateString('en-IN', { weekday: 'short' })
            byDay[key] = (byDay[key] || 0) + Number(b.grand_total)
          }
        }

        const last7Days = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 86400000)
          const key = d.toLocaleDateString('en-IN', { weekday: 'short' })
          last7Days.push({ day: key, revenue: Math.round(byDay[key] || 0) })
        }

        setStats({ todaySales, todayBills, monthRevenue, monthBills: data.length, last7Days })
      }
      if (!cancelled) setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [profile])

  return { stats, loading }
}

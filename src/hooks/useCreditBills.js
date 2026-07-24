import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { round2 } from '@/lib/utils'

// Bills + their recovery payments, merged into one balance-aware row per bill.
// A bill's "amount received to date" = bills.amount_received (collected at
// billing time) + sum(payments.amount) recorded afterward against it.
export function useCreditBills({ from, to, status = 'all', search = '' } = {}) {
  const profile = useAuthStore((s) => s.profile)
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!profile?.company_id) return
    setLoading(true)

    let query = supabase
      .from('bills')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })
    if (from) query = query.gte('created_at', `${from}T00:00:00`)
    if (to) query = query.lte('created_at', `${to}T23:59:59`)

    const { data: billRows, error: billErr } = await query
    if (billErr) {
      setLoading(false)
      return
    }

    const ids = (billRows || []).map((b) => b.id)
    let paymentsByBill = new Map()
    if (ids.length > 0) {
      const { data: payments } = await supabase.from('payments').select('bill_id, amount').in('bill_id', ids)
      for (const p of payments || []) {
        paymentsByBill.set(p.bill_id, round2((paymentsByBill.get(p.bill_id) || 0) + Number(p.amount)))
      }
    }

    let merged = (billRows || []).map((b) => {
      const recovered = paymentsByBill.get(b.id) || 0
      const totalPaid = round2(Number(b.amount_received) + recovered)
      const balanceDue = round2(Math.max(0, Number(b.grand_total) - totalPaid))
      return { ...b, recovered, totalPaid, balanceDue }
    })

    if (status !== 'all') merged = merged.filter((b) => b.payment_status === status)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      merged = merged.filter(
        (b) => b.customer_name.toLowerCase().includes(q) || b.customer_phone.includes(q) || b.bill_number.toLowerCase().includes(q)
      )
    }

    setBills(merged)
    setLoading(false)
  }, [profile, from, to, status, search])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { bills, loading, refresh }
}

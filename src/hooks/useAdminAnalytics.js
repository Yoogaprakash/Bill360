import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

// Raw bills+items and purchases+items for a date range — Dashboard.jsx does
// the product/supplier/customer filtering and aggregation client-side, since
// a single small-business company's per-day record volume is small enough
// that this stays snappy without building out dynamic server-side queries.
export function useAdminAnalytics({ from, to }) {
  const profile = useAuthStore((s) => s.profile)
  const [bills, setBills] = useState([])
  const [purchases, setPurchases] = useState([])
  const [creditReceivable, setCreditReceivable] = useState(0)
  const [creditPayable, setCreditPayable] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.company_id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const fromTs = `${from}T00:00:00`
      const toTs = `${to}T23:59:59`

      const [billsRes, purchasesRes, allBillsRes, allPurchasesRes, paymentsRes, purchasePaymentsRes] = await Promise.all([
        supabase
          .from('bills')
          .select('*, bill_items(*)')
          .eq('company_id', profile.company_id)
          .gte('created_at', fromTs)
          .lte('created_at', toTs)
          .order('created_at'),
        supabase
          .from('purchases')
          .select('*, purchase_items(*)')
          .eq('company_id', profile.company_id)
          .gte('purchase_date', from)
          .lte('purchase_date', to)
          .order('purchase_date'),
        // All-time (unfiltered by date) balances for the credit tiles — an
        // outstanding balance doesn't really have a "period", it's a snapshot.
        supabase.from('bills').select('id, grand_total, amount_received').eq('company_id', profile.company_id),
        supabase.from('purchases').select('id, grand_total, amount_paid').eq('company_id', profile.company_id),
        supabase.from('payments').select('amount, bill_id').eq('company_id', profile.company_id),
        supabase.from('purchase_payments').select('amount, purchase_id').eq('company_id', profile.company_id),
      ])

      if (cancelled) return

      setBills(billsRes.data || [])
      setPurchases(purchasesRes.data || [])

      const recoveredByBill = new Map()
      for (const p of paymentsRes.data || []) {
        recoveredByBill.set(p.bill_id, (recoveredByBill.get(p.bill_id) || 0) + Number(p.amount))
      }
      const receivable = (allBillsRes.data || []).reduce((sum, b) => {
        const paid = Number(b.amount_received) + (recoveredByBill.get(b.id) || 0)
        return sum + Math.max(0, Number(b.grand_total) - paid)
      }, 0)

      const paidByPurchase = new Map()
      for (const p of purchasePaymentsRes.data || []) {
        paidByPurchase.set(p.purchase_id, (paidByPurchase.get(p.purchase_id) || 0) + Number(p.amount))
      }
      const payable = (allPurchasesRes.data || []).reduce((sum, p) => {
        const paid = Number(p.amount_paid) + (paidByPurchase.get(p.id) || 0)
        return sum + Math.max(0, Number(p.grand_total) - paid)
      }, 0)

      setCreditReceivable(receivable)
      setCreditPayable(payable)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [profile, from, to])

  return { bills, purchases, creditReceivable, creditPayable, loading }
}

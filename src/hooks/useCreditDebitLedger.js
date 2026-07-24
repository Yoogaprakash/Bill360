import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { round2 } from '@/lib/utils'

/**
 * A unified cash-flow ledger: every rupee that came in from a customer
 * (credit) or went out to a supplier (debit), each shown with a running
 * company balance. Sourced from four places:
 *   - bills.amount_received   (money collected at the moment of sale)
 *   - payments                (later collections against a credit sale)
 *   - purchases.amount_paid   (money paid at the moment of purchase)
 *   - purchase_payments       (later payments against a credit purchase)
 */
export function useCreditDebitLedger({ from, to }) {
  const profile = useAuthStore((s) => s.profile)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.company_id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const fromTs = `${from}T00:00:00`
      const toTs = `${to}T23:59:59`

      const [billsRes, paymentsRes, purchasesRes, purchasePaymentsRes] = await Promise.all([
        supabase
          .from('bills')
          .select('id, bill_number, customer_name, customer_phone, amount_received, payment_method, created_at')
          .eq('company_id', profile.company_id)
          .gt('amount_received', 0)
          .gte('created_at', fromTs)
          .lte('created_at', toTs),
        supabase
          .from('payments')
          .select('id, amount, method, paid_at, bills(bill_number, customer_name, customer_phone)')
          .eq('company_id', profile.company_id)
          .gte('paid_at', fromTs)
          .lte('paid_at', toTs),
        supabase
          .from('purchases')
          .select('id, purchase_number, supplier_name, supplier_phone, amount_paid, payment_method, purchase_date')
          .eq('company_id', profile.company_id)
          .gt('amount_paid', 0)
          .gte('purchase_date', from)
          .lte('purchase_date', to),
        supabase
          .from('purchase_payments')
          .select('id, amount, method, paid_at, purchases(purchase_number, supplier_name, supplier_phone)')
          .eq('company_id', profile.company_id)
          .gte('paid_at', fromTs)
          .lte('paid_at', toTs),
      ])
      if (cancelled) return

      const rows = []

      for (const b of billsRes.data || []) {
        rows.push({
          id: `bill-${b.id}`,
          type: 'credit',
          referenceNo: b.bill_number,
          partyName: b.customer_name,
          partyPhone: b.customer_phone,
          date: b.created_at,
          method: b.payment_method || 'Cash',
          amount: Number(b.amount_received),
        })
      }
      for (const p of paymentsRes.data || []) {
        rows.push({
          id: `payment-${p.id}`,
          type: 'credit',
          referenceNo: p.bills?.bill_number || '—',
          partyName: p.bills?.customer_name || '—',
          partyPhone: p.bills?.customer_phone || '—',
          date: p.paid_at,
          method: p.method || 'Cash',
          amount: Number(p.amount),
        })
      }
      for (const p of purchasesRes.data || []) {
        rows.push({
          id: `purchase-${p.id}`,
          type: 'debit',
          referenceNo: p.purchase_number,
          partyName: p.supplier_name,
          partyPhone: p.supplier_phone || '—',
          date: p.purchase_date,
          method: p.payment_method || 'Cash',
          amount: Number(p.amount_paid),
        })
      }
      for (const p of purchasePaymentsRes.data || []) {
        rows.push({
          id: `purchase-payment-${p.id}`,
          type: 'debit',
          referenceNo: p.purchases?.purchase_number || '—',
          partyName: p.purchases?.supplier_name || '—',
          partyPhone: p.purchases?.supplier_phone || '—',
          date: p.paid_at,
          method: p.method || 'Cash',
          amount: Number(p.amount),
        })
      }

      // Running balance is computed chronologically (oldest first), then
      // each entry keeps its computed balance regardless of display order.
      rows.sort((a, b) => new Date(a.date) - new Date(b.date))
      let running = 0
      for (const r of rows) {
        running = round2(running + (r.type === 'credit' ? r.amount : -r.amount))
        r.balance = running
      }

      if (!cancelled) {
        setEntries(rows)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [profile, from, to])

  return { entries, loading }
}

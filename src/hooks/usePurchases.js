import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { round2 } from '@/lib/utils'

export function usePurchases() {
  const profile = useAuthStore((s) => s.profile)
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!profile?.company_id) return
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })

    if (!error && rows) {
      const ids = rows.map((p) => p.id)
      let paidByPurchase = new Map()
      if (ids.length > 0) {
        const { data: pays } = await supabase.from('purchase_payments').select('purchase_id, amount').in('purchase_id', ids)
        for (const p of pays || []) {
          paidByPurchase.set(p.purchase_id, round2((paidByPurchase.get(p.purchase_id) || 0) + Number(p.amount)))
        }
      }
      setPurchases(
        rows.map((p) => {
          const recovered = paidByPurchase.get(p.id) || 0
          const totalPaid = round2(Number(p.amount_paid) + recovered)
          const balanceDue = round2(Math.max(0, Number(p.grand_total) - totalPaid))
          return { ...p, totalPaid, balanceDue }
        })
      )
    }
    setLoading(false)
  }, [profile])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { purchases, loading, refresh }
}

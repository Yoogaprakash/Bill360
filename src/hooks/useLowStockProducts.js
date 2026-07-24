import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export function useLowStockProducts() {
  const profile = useAuthStore((s) => s.profile)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!profile?.company_id) return
    setLoading(true)
    const defaultThreshold = profile.companies?.low_stock_threshold ?? 5
    const { data, error } = await supabase
      .from('products')
      .select('id, name, stock_qty, low_stock_threshold, image_url')
      .eq('company_id', profile.company_id)
      .eq('is_active', true)
      .order('stock_qty', { ascending: true })

    if (!error && data) {
      const low = data.filter((p) => p.stock_qty <= (p.low_stock_threshold ?? defaultThreshold))
      setProducts(low)
    }
    setLoading(false)
  }, [profile])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { products, loading, refresh }
}

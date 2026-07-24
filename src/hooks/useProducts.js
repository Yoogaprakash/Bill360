import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export function useProducts() {
  const companyId = useAuthStore((s) => s.profile?.company_id)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    const [{ data: prod, error: prodErr }, { data: cats, error: catErr }, { data: batches, error: batchErr }] = await Promise.all([
      supabase
        .from('products')
        .select('*, categories(id, name)')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('categories')
        .select('*')
        .eq('company_id', companyId)
        .order('sort_order'),
      supabase
        .from('product_batches')
        .select('product_id, expiry_date')
        .eq('company_id', companyId)
        .not('expiry_date', 'is', null),
    ])

    if (!prodErr) {
      const warningByProduct = new Map()
      if (!batchErr) {
        const now = Date.now()
        for (const b of batches || []) {
          const days = Math.ceil((new Date(b.expiry_date).getTime() - now) / 86400000)
          if (days > 30) continue
          const label = days < 0 ? 'Expired batch' : `Batch expires in ${days}d`
          const severity = days < 0 ? 2 : 1
          const existing = warningByProduct.get(b.product_id)
          if (!existing || severity > existing.severity) {
            warningByProduct.set(b.product_id, { label, severity })
          }
        }
      }
      setProducts((prod || []).map((p) => ({ ...p, batchWarning: warningByProduct.get(p.id)?.label ?? null })))
    }
    if (!catErr) setCategories(cats || [])
    setLoading(false)
  }, [companyId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { products, categories, loading, refresh }
}

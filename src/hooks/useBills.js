import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export function useBills({ mineOnly = false } = {}) {
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

    if (mineOnly) query = query.eq('created_by', profile.id)

    const { data, error } = await query
    if (!error) setBills(data || [])
    setLoading(false)
  }, [profile, mineOnly])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { bills, loading, refresh }
}

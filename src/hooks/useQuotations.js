import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export function useQuotations() {
  const profile = useAuthStore((s) => s.profile)
  const [quotations, setQuotations] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!profile?.company_id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('quotations')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })
    if (!error) setQuotations(data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { quotations, loading, refresh }
}

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useSubscriptionPlans() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('subscription_plans').select('*').order('price')
    if (!error) setPlans(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { plans, loading, refresh }
}

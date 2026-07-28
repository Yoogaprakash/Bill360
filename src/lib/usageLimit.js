import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

/** Checks + logs a metered action (bill print / report export) against the
 * company's effective subscription limit. Returns false (and toasts) if the
 * caller should skip generating the PDF/export. */
export async function checkUsageLimit(companyId, usageType) {
  if (!companyId) return true
  const { error } = await supabase.rpc('log_and_check_usage', {
    p_company_id: companyId,
    p_usage_type: usageType,
  })
  if (error) {
    toast.error(error.message || 'Usage limit reached')
    return false
  }
  return true
}

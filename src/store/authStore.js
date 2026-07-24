import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export const useAuthStore = create((set, get) => ({
  session: null,
  profile: null, // { id, role, company_id, full_name, companies: {...} }
  loading: true,
  initialized: false,

  init: async () => {
    if (get().initialized) return
    const { data: { session } } = await supabase.auth.getSession()
    set({ session })
    if (session) await get().loadProfile()
    set({ loading: false, initialized: true })

    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session })
      if (session) {
        await get().loadProfile()
      } else {
        set({ profile: null })
      }
    })
  },

  loadProfile: async () => {
    const userId = get().session?.user?.id
    if (!userId) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*, companies(*)')
      .eq('id', userId)
      .single()
    if (error) {
      console.error('Failed to load profile', error)
      return
    }
    set({ profile: data })
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    set({ session: data.session })
    await get().loadProfile()
    return data
  },

  signUp: async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
    return data
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, profile: null })
  },

  sendPasswordReset: async (email) => {
    // redirectTo must be on Supabase's Auth > URL Configuration > Redirect URLs
    // allow-list, or the email link will bounce back to the Site URL instead.
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw error
  },

  isSuperAdmin: () => get().profile?.role === 'super_admin',
  isCompanyAdmin: () => get().profile?.role === 'company_admin',
  isSalesUser: () => get().profile?.role === 'sales_user',
  companyId: () => get().profile?.company_id ?? null,
}))

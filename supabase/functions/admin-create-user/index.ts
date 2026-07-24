// Supabase Edge Function: admin-create-user
//
// Purpose: creating/editing/deleting an auth user requires the SERVICE_ROLE
// key, which must never be shipped to the browser. This function runs on
// Supabase's servers (part of the BaaS, not a separate backend you host)
// and performs the privileged step on behalf of an authorized caller.
//
// Deploy:   supabase functions deploy admin-create-user
// Invoke from the client with supabase.functions.invoke('admin-create-user', { body: {...} })
//
// Body shape: { action: 'create' | 'update' | 'delete', ... }
// 'action' defaults to 'create' when omitted, for backwards compatibility.
//
// Authorization rules:
//   - super_admin   -> may create/update/delete a user with any role, in any company
//   - company_admin -> may create/update/delete sales_user / manager / company_admin
//                       accounts within their own company; cannot touch super_admin
//                       accounts, and cannot delete/demote themselves
//   - manager       -> may create/update sales_user accounts within their own
//                       company only; cannot change anyone's role, and cannot delete

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const COMPANY_ADMIN_MANAGEABLE_ROLES = ['sales_user', 'manager', 'company_admin']
const MANAGER_MANAGEABLE_ROLES = ['sales_user']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    // Client scoped to the caller's JWT — respects RLS, tells us who's calling.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: userErr } = await callerClient.auth.getUser()
    if (userErr || !caller) throw new Error('Not authenticated')

    const { data: callerProfile, error: profileErr } = await callerClient
      .from('profiles')
      .select('role, company_id')
      .eq('id', caller.id)
      .single()
    if (profileErr || !callerProfile) throw new Error('Caller profile not found')

    const body = await req.json()
    const action = body.action || 'create'
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    if (action === 'create') {
      const { email, password, full_name, role, company_id } = body
      if (!email || !password || !role) throw new Error('email, password and role are required')

      let targetCompanyId = company_id ?? null
      if (callerProfile.role === 'company_admin') {
        if (!COMPANY_ADMIN_MANAGEABLE_ROLES.includes(role)) throw new Error('Company admins cannot assign this role')
        targetCompanyId = callerProfile.company_id
      } else if (callerProfile.role === 'manager') {
        if (!MANAGER_MANAGEABLE_ROLES.includes(role)) throw new Error('Managers can only create sales_user accounts')
        targetCompanyId = callerProfile.company_id
      } else if (callerProfile.role !== 'super_admin') {
        throw new Error('Not authorized to create users')
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      })
      if (createErr) throw createErr

      // The DB trigger already inserted a default profile row; finalize role/company here.
      const { error: upsertErr } = await admin
        .from('profiles')
        .upsert({ id: created.user.id, full_name, role, company_id: targetCompanyId, is_active: true, email })
      if (upsertErr) throw upsertErr

      return json({ user: created.user })
    }

    // 'update' and 'delete' both act on an existing target user — resolve and
    // authorize against their *current* profile before doing anything.
    const targetUserId = body.target_user_id
    if (!targetUserId) throw new Error('target_user_id is required')

    const { data: targetProfile, error: targetErr } = await admin
      .from('profiles')
      .select('role, company_id')
      .eq('id', targetUserId)
      .single()
    if (targetErr || !targetProfile) throw new Error('Target user not found')

    const callerIsCompanyAdmin = callerProfile.role === 'company_admin'
    const callerIsManager = callerProfile.role === 'manager'

    if (callerProfile.role === 'super_admin') {
      // unrestricted
    } else if (callerIsCompanyAdmin) {
      if (targetProfile.company_id !== callerProfile.company_id) throw new Error('That user is not in your company')
      if (!COMPANY_ADMIN_MANAGEABLE_ROLES.includes(targetProfile.role)) throw new Error('Company admins cannot manage this account')
      if (targetUserId === caller.id) throw new Error('Use your Profile page to manage your own account')
    } else if (callerIsManager) {
      if (targetProfile.company_id !== callerProfile.company_id) throw new Error('That user is not in your company')
      if (!MANAGER_MANAGEABLE_ROLES.includes(targetProfile.role)) throw new Error('Managers can only manage sales_user accounts')
      if (targetUserId === caller.id) throw new Error('Use your Profile page to manage your own account')
      if (action === 'delete') throw new Error('Managers cannot delete users')
    } else {
      throw new Error('Not authorized')
    }

    if (action === 'delete') {
      const { error: deleteErr } = await admin.auth.admin.deleteUser(targetUserId)
      if (deleteErr) throw deleteErr
      return json({ deleted: targetUserId })
    }

    if (action === 'update') {
      const { full_name, email, password, role, is_active } = body

      if (callerIsCompanyAdmin && role && !COMPANY_ADMIN_MANAGEABLE_ROLES.includes(role)) {
        throw new Error('Company admins cannot assign this role')
      }
      if (callerIsManager && role && role !== 'sales_user') {
        throw new Error('Managers cannot change a user’s role')
      }

      if (email || password) {
        const authUpdate: Record<string, string> = {}
        if (email) authUpdate.email = email
        if (password) authUpdate.password = password
        const { error: authErr } = await admin.auth.admin.updateUserById(targetUserId, authUpdate)
        if (authErr) throw authErr
      }

      const profileUpdate: Record<string, unknown> = {}
      if (full_name !== undefined) profileUpdate.full_name = full_name
      if (role !== undefined) profileUpdate.role = role
      if (is_active !== undefined) profileUpdate.is_active = is_active
      if (email) profileUpdate.email = email

      if (Object.keys(profileUpdate).length > 0) {
        const { error: updateErr } = await admin.from('profiles').update(profileUpdate).eq('id', targetUserId)
        if (updateErr) throw updateErr
      }

      return json({ updated: targetUserId })
    }

    throw new Error(`Unknown action: ${action}`)
  } catch (err) {
    return json({ error: err.message }, 400)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

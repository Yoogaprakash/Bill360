import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'

const empty = { full_name: '', email: '', password: '', role: '' }

/**
 * roleOptions: [{ value, label }]  — if only one option, the role select is hidden.
 * fixedCompanyId: when set, the user is created under this company (company_admin flow).
 */
export default function CreateUserDialog({ open, onOpenChange, roleOptions, fixedCompanyId, onCreated }) {
  const [form, setForm] = useState({ ...empty, role: roleOptions[0]?.value || '' })
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!form.full_name || !form.email || form.password.length < 6) {
      toast.error('Full name, email and a password (6+ chars) are required')
      return
    }
    setSaving(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          role: form.role,
          company_id: fixedCompanyId,
        },
      })
      if (error) {
        // supabase-js doesn't parse the JSON error body for non-2xx responses —
        // dig the real message out of the raw Response on error.context.
        let message = error.message
        try {
          const body = await error.context?.json()
          if (body?.error) message = body.error
        } catch {
          // response body wasn't JSON / already consumed — fall back to error.message
        }
        throw new Error(message)
      }
      if (data?.error) throw new Error(data.error)
      toast.success('User created')
      setForm({ ...empty, role: roleOptions[0]?.value || '' })
      onOpenChange(false)
      onCreated?.()
    } catch (err) {
      toast.error(err.message || 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>Runs through the admin-create-user edge function.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Temporary password</Label>
            <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          {roleOptions.length > 1 && (
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating…' : 'Create user'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

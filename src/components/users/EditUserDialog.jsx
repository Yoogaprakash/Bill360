import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'

async function callManageUser(body) {
  const { data, error } = await supabase.functions.invoke('admin-create-user', { body })
  if (error) {
    let message = error.message
    try {
      const parsed = await error.context?.json()
      if (parsed?.error) message = parsed.error
    } catch {
      // response body wasn't JSON — fall back to error.message
    }
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

/** roleOptions: [{ value, label }] the caller is allowed to assign. */
export default function EditUserDialog({ user, open, onOpenChange, roleOptions, canDelete = true, onUpdated, onDeleted }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '')
      setEmail(user.email || '')
      setRole(user.role || roleOptions[0]?.value || '')
      setIsActive(user.is_active)
      setNewPassword('')
    }
  }, [user])

  if (!user) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      await callManageUser({
        action: 'update',
        target_user_id: user.id,
        full_name: fullName.trim(),
        email: email.trim() || undefined,
        password: newPassword || undefined,
        role,
        is_active: isActive,
      })
      toast.success('User updated')
      onOpenChange(false)
      onUpdated?.()
    } catch (err) {
      toast.error(err.message || 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete ${user.full_name || user.email}? This permanently removes their login and cannot be undone.`)) return
    setDeleting(true)
    try {
      await callManageUser({ action: 'delete', target_user_id: user.id })
      toast.success('User deleted')
      onOpenChange(false)
      onDeleted?.()
    } catch (err) {
      toast.error(err.message || 'Failed to delete user')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>Runs through the admin-create-user edge function.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Reset password (leave blank to keep current)</Label>
            <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New temporary password" />
          </div>
          {roleOptions.length > 1 && (
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {canDelete ? (
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={deleting}>
              <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting…' : 'Delete user'}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

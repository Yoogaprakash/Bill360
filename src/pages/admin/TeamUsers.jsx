import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import CreateUserDialog from '@/components/users/CreateUserDialog'
import EditUserDialog from '@/components/users/EditUserDialog'

const COMPANY_ADMIN_ROLE_OPTIONS = [
  { value: 'sales_user', label: 'Sales User' },
  { value: 'manager', label: 'Manager' },
  { value: 'company_admin', label: 'Company Admin' },
]
const MANAGER_ROLE_OPTIONS = [{ value: 'sales_user', label: 'Sales User' }]

export default function TeamUsers() {
  const profile = useAuthStore((s) => s.profile)
  const isCompanyAdmin = profile?.role === 'company_admin'
  const roleOptions = isCompanyAdmin ? COMPANY_ADMIN_ROLE_OPTIONS : MANAGER_ROLE_OPTIONS
  // A manager may only touch sales_user accounts (server-side enforced too — this just keeps the UI honest).
  const canManage = (u) => u.id !== profile.id && (isCompanyAdmin || u.role === 'sales_user')

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)

  const refresh = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('created_at')
    if (!error) setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (profile?.company_id) refresh()
  }, [profile])

  const toggleActive = async (u) => {
    const { error } = await supabase.from('profiles').update({ is_active: !u.is_active }).eq('id', u.id)
    if (error) return toast.error(error.message)
    refresh()
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Team</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Add user
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company users</CardTitle>
          {!isCompanyAdmin && <p className="text-xs text-muted-foreground">As a manager, you can manage Sales User accounts only.</p>}
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground">Loading…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{u.role.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={u.is_active} onCheckedChange={() => toggleActive(u)} disabled={!canManage(u)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setEditingUser(u)} disabled={!canManage(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        roleOptions={roleOptions}
        fixedCompanyId={profile?.company_id}
        onCreated={refresh}
      />
      <EditUserDialog
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(v) => !v && setEditingUser(null)}
        roleOptions={roleOptions}
        canDelete={isCompanyAdmin}
        onUpdated={refresh}
        onDeleted={refresh}
      />
    </div>
  )
}

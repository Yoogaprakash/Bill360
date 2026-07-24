import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import CreateUserDialog from '@/components/users/CreateUserDialog'

export default function PlatformUsers() {
  const profile = useAuthStore((s) => s.profile)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const refresh = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*, companies(name)')
      .order('created_at', { ascending: false })
    if (!error) setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  const toggleActive = async (u) => {
    const { error } = await supabase.from('profiles').update({ is_active: !u.is_active }).eq('id', u.id)
    if (error) return toast.error(error.message)
    refresh()
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Platform Users</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New super admin
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading ? <p className="text-muted-foreground">Loading…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{u.companies?.name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{u.role.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={u.is_active} onCheckedChange={() => toggleActive(u)} disabled={u.id === profile.id} />
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
        roleOptions={[{ value: 'super_admin', label: 'Super Admin' }]}
        fixedCompanyId={null}
        onCreated={refresh}
      />
    </div>
  )
}

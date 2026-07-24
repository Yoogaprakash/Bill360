import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import CreateUserDialog from '@/components/users/CreateUserDialog'

function NewCompanyDialog({ open, onOpenChange, onCreated }) {
  const [name, setName] = useState('')
  const [plan, setPlan] = useState('free')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('companies').insert({ name: name.trim(), subscription_plan: plan })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Company created')
    setName('')
    onOpenChange(false)
    onCreated?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New company</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Company name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating…' : 'Create company'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [newOpen, setNewOpen] = useState(false)
  const [adminTarget, setAdminTarget] = useState(null)

  const refresh = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('companies').select('*').order('created_at', { ascending: false })
    if (!error) setCompanies(data || [])
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  const toggleActive = async (c) => {
    const { error } = await supabase.from('companies').update({ is_active: !c.is_active }).eq('id', c.id)
    if (error) return toast.error(error.message)
    refresh()
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Companies</h1>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4" /> New company
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>All tenants</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground">Loading…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="capitalize">{c.subscription_plan}</TableCell>
                    <TableCell>
                      <Badge variant={c.subscription_status === 'active' ? 'success' : 'warning'} className="capitalize">
                        {c.subscription_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setAdminTarget(c)}>
                        <UserPlus className="h-4 w-4" /> Add admin
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NewCompanyDialog open={newOpen} onOpenChange={setNewOpen} onCreated={refresh} />

      {adminTarget && (
        <CreateUserDialog
          open={!!adminTarget}
          onOpenChange={(v) => !v && setAdminTarget(null)}
          roleOptions={[{ value: 'company_admin', label: 'Company Admin' }]}
          fixedCompanyId={adminTarget.id}
          onCreated={() => setAdminTarget(null)}
        />
      )}
    </div>
  )
}

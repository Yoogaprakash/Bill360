import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, UserPlus, Settings2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import CreateUserDialog from '@/components/users/CreateUserDialog'
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans'
import LimitFields, { LIMIT_FIELDS } from '@/components/superadmin/LimitFields'

const NO_PLAN = '__none__'

function NewCompanyDialog({ open, onOpenChange, plans, onCreated }) {
  const [name, setName] = useState('')
  const [planId, setPlanId] = useState(NO_PLAN)
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('companies')
      .insert({ name: name.trim(), plan_id: planId === NO_PLAN ? null : planId })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Company created')
    setName('')
    setPlanId(NO_PLAN)
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
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PLAN}>No plan (unlimited)</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
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

function PlanLimitsDialog({ company, plans, open, onOpenChange, onSaved }) {
  const [planId, setPlanId] = useState(NO_PLAN)
  const [overrides, setOverrides] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !company) return
    setPlanId(company.plan_id || NO_PLAN)
    setOverrides(Object.fromEntries(LIMIT_FIELDS.map(({ key }) => [key, company[`${key}_override`] ?? null])))
  }, [open, company])

  if (!company) return null
  const selectedPlan = plans.find((p) => p.id === planId)

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      plan_id: planId === NO_PLAN ? null : planId,
      ...Object.fromEntries(LIMIT_FIELDS.map(({ key }) => [`${key}_override`, overrides[key]])),
    }
    const { error } = await supabase.from('companies').update(payload).eq('id', company.id)
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Plan & limits updated')
    onOpenChange(false)
    onSaved?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Plan &amp; limits — {company.name}</DialogTitle>
          <DialogDescription>Overrides win over the plan's value; leave blank to just use the plan (or unlimited if no plan).</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Plan</Label>
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PLAN}>No plan (unlimited)</SelectItem>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">Manual overrides for this company (placeholders show the plan's current value):</p>
        <LimitFields values={overrides} onChange={(key, value) => setOverrides({ ...overrides, [key]: value })} placeholderSource={selectedPlan} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
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
  const [planTarget, setPlanTarget] = useState(null)
  const { plans } = useSubscriptionPlans()

  const refresh = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('companies')
      .select('*, subscription_plans(name)')
      .order('created_at', { ascending: false })
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
                    <TableCell>
                      <Badge variant="secondary">{c.subscription_plans?.name || 'Unlimited'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.subscription_status === 'active' ? 'success' : 'warning'} className="capitalize">
                        {c.subscription_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => setPlanTarget(c)}>
                          <Settings2 className="h-4 w-4" /> Plan
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setAdminTarget(c)}>
                          <UserPlus className="h-4 w-4" /> Add admin
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NewCompanyDialog open={newOpen} onOpenChange={setNewOpen} plans={plans} onCreated={refresh} />

      <PlanLimitsDialog
        company={planTarget}
        plans={plans}
        open={!!planTarget}
        onOpenChange={(v) => !v && setPlanTarget(null)}
        onSaved={refresh}
      />

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

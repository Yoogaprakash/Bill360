import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans'
import LimitFields, { LIMIT_FIELDS } from '@/components/superadmin/LimitFields'

const emptyPlan = { name: '', price: 0, user_limit: null, product_limit: null, sales_bill_limit: null, purchase_bill_limit: null, bill_print_limit: null, report_print_limit: null }

function PlanFormDialog({ open, onOpenChange, plan, onSaved }) {
  const [form, setForm] = useState(emptyPlan)
  const [saving, setSaving] = useState(false)
  const isEditing = !!plan

  useEffect(() => {
    if (!open) return
    setForm(plan ? { ...emptyPlan, ...plan } : emptyPlan)
  }, [open, plan])

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Plan name is required')
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      price: Number(form.price) || 0,
      ...Object.fromEntries(LIMIT_FIELDS.map(({ key }) => [key, form[key] === '' ? null : form[key]])),
    }
    const { error } = isEditing
      ? await supabase.from('subscription_plans').update(payload).eq('id', plan.id)
      : await supabase.from('subscription_plans').insert(payload)
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success(isEditing ? 'Plan updated' : 'Plan created')
    onOpenChange(false)
    onSaved?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEditing ? `Edit plan — ${plan.name}` : 'New plan'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Price (₹/month)</Label>
            <Input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Leave any limit blank for unlimited.</p>
        <LimitFields values={form} onChange={(key, value) => setForm({ ...form, [key]: value })} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save plan'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function SubscriptionPlans() {
  const { plans, loading, refresh } = useSubscriptionPlans()
  const [formOpen, setFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)

  const handleNew = () => { setEditingPlan(null); setFormOpen(true) }
  const handleEdit = (plan) => { setEditingPlan(plan); setFormOpen(true) }

  const fmtLimit = (v) => (v === null || v === undefined ? '∞' : v)

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Subscription Plans</h1>
        <Button onClick={handleNew}><Plus className="h-4 w-4" /> New plan</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Plans</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground">Loading…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="text-right">Sales bills/mo</TableHead>
                  <TableHead className="text-right">Purchases/mo</TableHead>
                  <TableHead className="text-right">Bill prints/mo</TableHead>
                  <TableHead className="text-right">Report prints/mo</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.name}
                      {p.price === 0 && <Badge variant="secondary" className="ml-2">Free</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(p.price)}</TableCell>
                    <TableCell className="text-right">{fmtLimit(p.user_limit)}</TableCell>
                    <TableCell className="text-right">{fmtLimit(p.product_limit)}</TableCell>
                    <TableCell className="text-right">{fmtLimit(p.sales_bill_limit)}</TableCell>
                    <TableCell className="text-right">{fmtLimit(p.purchase_bill_limit)}</TableCell>
                    <TableCell className="text-right">{fmtLimit(p.bill_print_limit)}</TableCell>
                    <TableCell className="text-right">{fmtLimit(p.report_print_limit)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
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

      <PlanFormDialog open={formOpen} onOpenChange={setFormOpen} plan={editingPlan} onSaved={refresh} />
    </div>
  )
}

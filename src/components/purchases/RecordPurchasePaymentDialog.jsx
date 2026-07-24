import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

export default function RecordPurchasePaymentDialog({ purchase, open, onOpenChange, onRecorded }) {
  const profile = useAuthStore((s) => s.profile)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Cash')
  const [paidAt, setPaidAt] = useState(isoToday())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount('')
      setMethod('Cash')
      setPaidAt(isoToday())
    }
  }, [open, purchase])

  if (!purchase) return null

  const handleSubmit = async () => {
    const value = Number(amount)
    if (!value || value <= 0) return toast.error('Enter a valid amount')
    if (value > purchase.balanceDue) return toast.error(`Amount exceeds balance due (${formatCurrency(purchase.balanceDue)})`)

    setSaving(true)
    const { error } = await supabase.from('purchase_payments').insert({
      company_id: profile.company_id,
      purchase_id: purchase.id,
      amount: value,
      method,
      paid_at: new Date(`${paidAt}T12:00:00`).toISOString(),
      created_by: profile.id,
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Payment recorded')
    onOpenChange(false)
    onRecorded?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay supplier — {purchase.supplier_name}</DialogTitle>
          <DialogDescription>Balance due {formatCurrency(purchase.balanceDue)}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input type="number" min="0" max={purchase.balanceDue} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Payment date</Label>
            <Input type="date" max={isoToday()} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Record payment'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

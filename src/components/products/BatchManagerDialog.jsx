import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Trash2, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

const emptyBatch = { batch_no: '', qty: '', expiry_date: '' }

function expiryBadge(expiryDate) {
  if (!expiryDate) return null
  const days = Math.ceil((new Date(expiryDate) - new Date()) / 86400000)
  if (days < 0) return <Badge variant="destructive">Expired</Badge>
  if (days <= 30) return <Badge variant="warning">Expires in {days}d</Badge>
  return null
}

export default function BatchManagerDialog({ open, onOpenChange, product }) {
  const profile = useAuthStore((s) => s.profile)
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyBatch)

  const refresh = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('product_batches')
      .select('*')
      .eq('product_id', product.id)
      .order('expiry_date', { ascending: true, nullsFirst: false })
    if (!error) setBatches(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (open) refresh()
  }, [open, product?.id])

  const handleAdd = async () => {
    if (!form.batch_no.trim() || form.qty === '') {
      toast.error('Batch number and quantity are required')
      return
    }
    const { error } = await supabase.from('product_batches').insert({
      company_id: profile.company_id,
      product_id: product.id,
      batch_no: form.batch_no.trim(),
      qty: Number(form.qty) || 0,
      expiry_date: form.expiry_date || null,
    })
    if (error) return toast.error(error.message)
    setForm(emptyBatch)
    refresh()
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('product_batches').delete().eq('id', id)
    if (error) return toast.error(error.message)
    refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Batches — {product?.name}</DialogTitle>
          <DialogDescription>Track batch numbers and expiry dates. Cards flag batches expiring within 30 days.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Batch no</label>
            <Input value={form.batch_no} onChange={(e) => setForm({ ...form, batch_no: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Qty</label>
            <Input type="number" min="0" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Expiry date</label>
            <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
          </div>
          <Button onClick={handleAdd}><Plus className="h-4 w-4" /> Add</Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && batches.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">No batches recorded.</TableCell>
              </TableRow>
            )}
            {batches.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.batch_no}</TableCell>
                <TableCell className="text-right">{b.qty}</TableCell>
                <TableCell className="flex items-center gap-2">
                  {b.expiry_date || '—'} {expiryBadge(b.expiry_date)}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  )
}

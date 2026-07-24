import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, round2 } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const blankItem = () => ({ key: Math.random().toString(36).slice(2), product_id: null, name: '', qty: 1, unit_price: 0, discount_pct: 0, gst_rate: 0, uom: 'pcs' })

/**
 * Edits an existing bill's customer info and line items, recalculating all
 * totals from scratch. Any change in a line's qty adjusts that product's
 * stock by the delta (increase qty sold -> stock decreases further;
 * decrease qty or remove a line -> stock is given back) and is logged to
 * stock_movements for audit, same as a normal sale/restock.
 */
export default function EditBillDialog({ bill, open, onOpenChange, gstEnabled, onSaved }) {
  const [customer, setCustomer] = useState({ name: '', phone: '', gst: '', address: '' })
  const [amountReceived, setAmountReceived] = useState(0)
  const [items, setItems] = useState([])
  const [originalItems, setOriginalItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !bill) return
    setLoading(true)
    supabase
      .from('bill_items')
      .select('*')
      .eq('bill_id', bill.id)
      .then(({ data, error }) => {
        if (error) {
          toast.error('Failed to load bill items')
          setLoading(false)
          return
        }
        const rows = (data || []).map((i) => ({
          key: i.id,
          product_id: i.product_id,
          name: i.name,
          qty: Number(i.qty),
          unit_price: Number(i.unit_price),
          discount_pct: Number(i.discount_pct),
          gst_rate: Number(i.gst_rate),
          uom: i.uom || 'pcs',
        }))
        setItems(rows)
        setOriginalItems(rows)
        setCustomer({
          name: bill.customer_name || '',
          phone: bill.customer_phone || '',
          gst: bill.customer_gst || '',
          address: bill.customer_address || '',
        })
        setAmountReceived(Number(bill.amount_received) || 0)
        setLoading(false)
      })
  }, [open, bill])

  const lines = items.map((it) => {
    const base = round2(it.qty * it.unit_price)
    const discountAmt = round2(base * (it.discount_pct / 100))
    const taxable = round2(base - discountAmt)
    const gstAmt = gstEnabled ? round2(taxable * (it.gst_rate / 100)) : 0
    return { ...it, total: round2(taxable + gstAmt) }
  })
  const subtotal = round2(lines.reduce((s, l) => s + round2(l.qty * l.unit_price), 0))
  const discountTotal = round2(lines.reduce((s, l) => s + round2(l.qty * l.unit_price * (l.discount_pct / 100)), 0))
  const gstTotal = round2(lines.reduce((s, l) => s + (gstEnabled ? round2((round2(l.qty * l.unit_price) - round2(l.qty * l.unit_price * (l.discount_pct / 100))) * (l.gst_rate / 100)) : 0), 0))
  const grandTotal = round2(subtotal - discountTotal + gstTotal)

  const updateItem = (key, field, value) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, [field]: field === 'name' ? value : Number(value) } : it)))
  }
  const addItem = () => setItems((prev) => [...prev, blankItem()])
  const removeItem = (key) => setItems((prev) => prev.filter((it) => it.key !== key))

  const handleSave = async () => {
    if (!customer.name.trim() || !customer.phone.trim()) {
      toast.error('Customer name and phone are required')
      return
    }
    const validItems = items.filter((it) => it.name.trim() && it.qty > 0)
    if (validItems.length === 0) {
      toast.error('A bill needs at least one item')
      return
    }
    setSaving(true)
    try {
      // Reconcile stock: compare total qty per product before vs after.
      const qtyByProduct = (rows) => {
        const map = new Map()
        for (const r of rows) {
          if (!r.product_id) continue
          map.set(r.product_id, (map.get(r.product_id) || 0) + Number(r.qty))
        }
        return map
      }
      const beforeQty = qtyByProduct(originalItems)
      const afterQty = qtyByProduct(validItems)
      const affectedProductIds = new Set([...beforeQty.keys(), ...afterQty.keys()])

      for (const productId of affectedProductIds) {
        const delta = (afterQty.get(productId) || 0) - (beforeQty.get(productId) || 0)
        if (delta === 0) continue
        const { data: product } = await supabase.from('products').select('stock_qty').eq('id', productId).single()
        if (!product) continue
        await supabase.from('products').update({ stock_qty: Number(product.stock_qty) - delta }).eq('id', productId)
        await supabase.from('stock_movements').insert({
          company_id: bill.company_id,
          product_id: productId,
          change_qty: -delta,
          reason: 'bill_edit',
        })
      }

      // Factor in any credit-recovery payments already recorded against this bill.
      const { data: payments } = await supabase.from('payments').select('amount').eq('bill_id', bill.id)
      const recovered = (payments || []).reduce((s, p) => s + Number(p.amount), 0)
      const totalPaid = round2(amountReceived + recovered)
      const paymentStatus = totalPaid >= grandTotal ? 'paid' : totalPaid > 0 ? 'partial' : 'pending'

      const { error: billErr } = await supabase
        .from('bills')
        .update({
          customer_name: customer.name.trim(),
          customer_phone: customer.phone.trim(),
          customer_gst: customer.gst || null,
          customer_address: customer.address || null,
          subtotal,
          discount_total: discountTotal,
          gst_total: gstTotal,
          grand_total: grandTotal,
          amount_received: amountReceived,
          payment_status: paymentStatus,
        })
        .eq('id', bill.id)
      if (billErr) throw billErr

      const { error: deleteErr } = await supabase.from('bill_items').delete().eq('bill_id', bill.id)
      if (deleteErr) throw deleteErr

      const { error: insertErr } = await supabase.from('bill_items').insert(
        validItems.map((it) => ({
          bill_id: bill.id,
          product_id: it.product_id,
          name: it.name,
          qty: it.qty,
          unit_price: it.unit_price,
          discount_pct: it.discount_pct,
          gst_rate: it.gst_rate,
          line_total: lines.find((l) => l.key === it.key)?.total ?? 0,
          is_custom: !it.product_id,
          uom: it.uom || 'pcs',
        }))
      )
      if (insertErr) throw insertErr

      toast.success(`Bill ${bill.bill_number} updated`)
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      toast.error(err.message || 'Failed to update bill')
    } finally {
      setSaving(false)
    }
  }

  if (!bill) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit bill {bill.bill_number}</DialogTitle>
          <DialogDescription>Totals recalculate automatically; quantity changes adjust stock accordingly.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Customer name</Label>
                <Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>GST No (optional)</Label>
                <Input value={customer.gst} onChange={(e) => setCustomer({ ...customer, gst: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Address (optional)</Label>
                <Input value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} />
              </div>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto">
              <div className="hidden rounded-md border sm:block">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-20">Qty</TableHead>
                      <TableHead className="w-24">Price</TableHead>
                      <TableHead className="w-20">Disc%</TableHead>
                      <TableHead className="w-20">GST%</TableHead>
                      <TableHead className="w-24 text-right">Total</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((it) => (
                      <TableRow key={it.key}>
                        <TableCell><Input className="h-7" value={it.name} onChange={(e) => updateItem(it.key, 'name', e.target.value)} /></TableCell>
                        <TableCell><Input className="h-7" type="number" min="0" value={it.qty} onChange={(e) => updateItem(it.key, 'qty', e.target.value)} /></TableCell>
                        <TableCell><Input className="h-7" type="number" min="0" value={it.unit_price} onChange={(e) => updateItem(it.key, 'unit_price', e.target.value)} /></TableCell>
                        <TableCell><Input className="h-7" type="number" min="0" max="100" value={it.discount_pct} onChange={(e) => updateItem(it.key, 'discount_pct', e.target.value)} /></TableCell>
                        <TableCell><Input className="h-7" type="number" min="0" value={it.gst_rate} onChange={(e) => updateItem(it.key, 'gst_rate', e.target.value)} /></TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(it.total)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(it.key)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2 sm:hidden">
                {lines.map((it) => (
                  <div key={it.key} className="space-y-2 rounded-xl border p-3">
                    <div className="flex items-center gap-2">
                      <Input className="flex-1" value={it.name} onChange={(e) => updateItem(it.key, 'name', e.target.value)} />
                      <Button variant="ghost" size="icon" onClick={() => removeItem(it.key)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">Qty</Label><Input type="number" value={it.qty} onChange={(e) => updateItem(it.key, 'qty', e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">Price</Label><Input type="number" value={it.unit_price} onChange={(e) => updateItem(it.key, 'unit_price', e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">Disc%</Label><Input type="number" value={it.discount_pct} onChange={(e) => updateItem(it.key, 'discount_pct', e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">GST%</Label><Input type="number" value={it.gst_rate} onChange={(e) => updateItem(it.key, 'gst_rate', e.target.value)} /></div>
                    </div>
                    <p className="text-right text-sm font-semibold">{formatCurrency(it.total)}</p>
                  </div>
                ))}
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4" /> Add item</Button>

            <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1.5">
                <Label>Amount received</Label>
                <Input type="number" min="0" value={amountReceived} onChange={(e) => setAmountReceived(Number(e.target.value) || 0)} className="w-full sm:w-40" />
              </div>
              <div className="text-right text-sm">
                <p className="text-muted-foreground">Subtotal {formatCurrency(subtotal)} − Disc {formatCurrency(discountTotal)} + GST {formatCurrency(gstTotal)}</p>
                <p className="text-lg font-bold">Total {formatCurrency(grandTotal)}</p>
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

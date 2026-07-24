import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, round2 } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

const blankItem = () => ({ key: Math.random().toString(36).slice(2), product_id: '', name: '', qty: 1, unit_price: 0, discount_pct: 0, gst_rate: 0, uom: 'pcs' })

/** quotation: pass an existing row to edit a draft; null creates a new one. */
export default function QuotationFormDialog({ open, onOpenChange, products, quotation, gstEnabled, onSaved }) {
  const profile = useAuthStore((s) => s.profile)
  const isEditing = !!quotation
  const [customer, setCustomer] = useState({ name: '', phone: '', gst: '', address: '' })
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([blankItem()])
  const [loadingItems, setLoadingItems] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (isEditing) {
      setCustomer({ name: quotation.customer_name, phone: quotation.customer_phone, gst: quotation.customer_gst || '', address: quotation.customer_address || '' })
      setValidUntil(quotation.valid_until || '')
      setNotes(quotation.notes || '')
      setLoadingItems(true)
      supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', quotation.id)
        .then(({ data, error }) => {
          if (error) toast.error('Failed to load quotation items')
          else {
            setItems(
              (data || []).map((i) => ({
                key: i.id,
                product_id: i.product_id || '',
                name: i.name,
                qty: Number(i.qty),
                unit_price: Number(i.unit_price),
                discount_pct: Number(i.discount_pct),
                gst_rate: Number(i.gst_rate),
                uom: i.uom || 'pcs',
              }))
            )
          }
          setLoadingItems(false)
        })
    } else {
      setCustomer({ name: '', phone: '', gst: '', address: '' })
      setValidUntil('')
      setNotes('')
      setItems([blankItem()])
    }
  }, [open, isEditing, quotation])

  const lines = items.map((it) => {
    const base = round2(Number(it.qty) * Number(it.unit_price))
    const discountAmt = round2(base * (Number(it.discount_pct) / 100))
    const taxable = round2(base - discountAmt)
    const gstAmt = gstEnabled ? round2(taxable * (Number(it.gst_rate) / 100)) : 0
    return { ...it, total: round2(taxable + gstAmt) }
  })
  const subtotal = round2(lines.reduce((s, l) => s + round2(l.qty * l.unit_price), 0))
  const discountTotal = round2(lines.reduce((s, l) => s + round2(l.qty * l.unit_price * (l.discount_pct / 100)), 0))
  const gstTotal = round2(lines.reduce((s, l) => s + (l.total - (round2(l.qty * l.unit_price) - round2(l.qty * l.unit_price * (l.discount_pct / 100)))), 0))
  const grandTotal = round2(subtotal - discountTotal + gstTotal)

  const updateItem = (key, field, value) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it
        if (field === 'product_id') {
          const product = products.find((p) => p.id === value)
          return {
            ...it,
            product_id: value,
            name: product ? product.name : it.name,
            unit_price: product ? product.unit_price : it.unit_price,
            gst_rate: product ? product.gst_rate : it.gst_rate,
            uom: product ? (product.unit_type === 'weight' ? product.weight_unit || 'kg' : 'pcs') : it.uom,
          }
        }
        return { ...it, [field]: field === 'name' ? value : Number(value) }
      })
    )
  }
  const addItem = () => setItems((prev) => [...prev, blankItem()])
  const removeItem = (key) => setItems((prev) => prev.filter((it) => it.key !== key))

  const handleSave = async () => {
    if (!customer.name.trim() || !customer.phone.trim()) return toast.error('Customer name and phone are required')
    const validLines = lines.filter((l) => l.name.trim() && l.qty > 0)
    if (validLines.length === 0) return toast.error('Add at least one item')

    setSaving(true)
    try {
      const payload = {
        customer_name: customer.name.trim(),
        customer_phone: customer.phone.trim(),
        customer_gst: customer.gst || null,
        customer_address: customer.address || null,
        valid_until: validUntil || null,
        notes: notes || null,
        subtotal,
        discount_total: discountTotal,
        gst_total: gstTotal,
        grand_total: grandTotal,
      }

      let quotationId = quotation?.id
      if (isEditing) {
        const { error } = await supabase.from('quotations').update(payload).eq('id', quotationId)
        if (error) throw error
        const { error: deleteErr } = await supabase.from('quotation_items').delete().eq('quotation_id', quotationId)
        if (deleteErr) throw deleteErr
      } else {
        const { data: quotationNumber, error: numErr } = await supabase.rpc('next_quotation_number', {
          p_company_id: profile.company_id,
        })
        if (numErr) throw numErr

        const { data: created, error } = await supabase
          .from('quotations')
          .insert({ ...payload, company_id: profile.company_id, created_by: profile.id, quotation_number: quotationNumber })
          .select()
          .single()
        if (error) throw error
        quotationId = created.id
      }

      const { error: itemsErr } = await supabase.from('quotation_items').insert(
        validLines.map((l) => ({
          quotation_id: quotationId,
          product_id: l.product_id || null,
          name: l.name,
          qty: l.qty,
          unit_price: l.unit_price,
          discount_pct: l.discount_pct,
          gst_rate: l.gst_rate,
          line_total: l.total,
          is_custom: !l.product_id,
          uom: l.uom || 'pcs',
        }))
      )
      if (itemsErr) throw itemsErr

      toast.success(isEditing ? 'Quotation updated' : 'Quotation created')
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      toast.error(err.message || 'Failed to save quotation')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Edit quotation ${quotation.quotation_number}` : 'New quotation'}</DialogTitle>
          <DialogDescription>Quotations don't affect stock or accounts until converted to an invoice.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Customer name *</Label>
            <Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone *</Label>
            <Input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Valid until</Label>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>GST No (optional)</Label>
            <Input value={customer.gst} onChange={(e) => setCustomer({ ...customer, gst: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label>Address (optional)</Label>
            <Input value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} />
          </div>
        </div>

        <div className="hidden max-h-64 overflow-y-auto rounded-md border sm:block">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="min-w-40">Match product</TableHead>
                <TableHead className="min-w-32">Name</TableHead>
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
                  <TableCell>
                    <Select value={it.product_id} onValueChange={(v) => updateItem(it.key, 'product_id', v)}>
                      <SelectTrigger className="h-7"><SelectValue placeholder="Custom item" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
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

        <div className="max-h-72 space-y-2 overflow-y-auto sm:hidden">
          {lines.map((it) => (
            <div key={it.key} className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <Select value={it.product_id} onValueChange={(v) => updateItem(it.key, 'product_id', v)}>
                  <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Custom item" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => removeItem(it.key)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <Input placeholder="Item name" value={it.name} onChange={(e) => updateItem(it.key, 'name', e.target.value)} />
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

        <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4" /> Add item</Button>

        <div className="space-y-1.5">
          <Label>Notes (optional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Terms, delivery notes, etc." />
        </div>

        <div className="flex items-center justify-end border-t pt-3 text-right text-sm">
          <div>
            <p className="text-muted-foreground">Subtotal {formatCurrency(subtotal)} − Disc {formatCurrency(discountTotal)} + GST {formatCurrency(gstTotal)}</p>
            <p className="text-lg font-bold">Total {formatCurrency(grandTotal)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loadingItems}>{saving ? 'Saving…' : 'Save quotation'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

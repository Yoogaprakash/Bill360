import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, PackagePlus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, round2 } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import ProductFormDialog from '@/components/products/ProductFormDialog'

const blankItem = () => ({ key: Math.random().toString(36).slice(2), product_id: '', name: '', hsn_code: '', qty: 1, unit_price: 0, discount_pct: 0, gst_rate: 0 })

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * source: 'manual' | 'scanned' — just recorded for audit; scanned purchases
 * pre-fill items/supplier from OCR output but still go through this same
 * review-and-confirm form before anything is written to the database.
 *
 * purchase: pass an existing purchases row to edit it instead of creating a
 * new one — its items load in, and saving recalculates totals and adjusts
 * stock by the delta between the old and new quantities per product.
 */
export default function NewPurchaseDialog({ open, onOpenChange, products, categories, initialItems, initialSupplierName, source = 'manual', purchase = null, onSaved, onProductsChanged }) {
  const profile = useAuthStore((s) => s.profile)
  const isEditing = !!purchase
  const [supplierName, setSupplierName] = useState('')
  const [supplierPhone, setSupplierPhone] = useState('')
  const [referenceNo, setReferenceNo] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(isoToday())
  const [newProductOpen, setNewProductOpen] = useState(false)
  const [extraProducts, setExtraProducts] = useState([]) // products created inline, merged into the picker immediately
  const [items, setItems] = useState([blankItem()])
  const [originalItems, setOriginalItems] = useState([])
  const [amountPaid, setAmountPaid] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [loadingItems, setLoadingItems] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setExtraProducts([])

    if (isEditing) {
      setSupplierName(purchase.supplier_name || '')
      setSupplierPhone(purchase.supplier_phone || '')
      setReferenceNo(purchase.reference_no || '')
      setPurchaseDate(purchase.purchase_date || isoToday())
      setAmountPaid(String(purchase.amount_paid ?? ''))
      setPaymentMethod(purchase.payment_method || 'Cash')
      setLoadingItems(true)
      supabase
        .from('purchase_items')
        .select('*')
        .eq('purchase_id', purchase.id)
        .then(({ data, error }) => {
          if (error) {
            toast.error('Failed to load purchase items')
          } else {
            const rows = (data || []).map((i) => ({
              key: i.id,
              product_id: i.product_id || '',
              name: i.name,
              hsn_code: i.hsn_code || '',
              qty: Number(i.qty),
              unit_price: Number(i.unit_price),
              discount_pct: Number(i.discount_pct) || 0,
              gst_rate: Number(i.gst_rate),
            }))
            setItems(rows.length > 0 ? rows : [blankItem()])
            setOriginalItems(rows)
          }
          setLoadingItems(false)
        })
    } else {
      setSupplierName(initialSupplierName || '')
      setSupplierPhone('')
      setReferenceNo('')
      setPurchaseDate(isoToday())
      setItems(initialItems && initialItems.length > 0 ? initialItems.map((i) => ({ ...blankItem(), ...i })) : [blankItem()])
      setOriginalItems([])
      setAmountPaid('')
      setPaymentMethod('Cash')
    }
  }, [open, isEditing, purchase, initialItems, initialSupplierName])

  const allProducts = [...products, ...extraProducts]

  const lines = items.map((it) => {
    const base = round2(Number(it.qty) * Number(it.unit_price))
    const discountAmt = round2(base * (Number(it.discount_pct) / 100))
    const taxable = round2(base - discountAmt)
    const gstAmt = round2(taxable * (Number(it.gst_rate) / 100))
    return { ...it, base, discountAmt, taxable, gstAmt, total: round2(taxable + gstAmt) }
  })
  const subtotal = round2(lines.reduce((s, l) => s + l.base, 0))
  const discountTotal = round2(lines.reduce((s, l) => s + l.discountAmt, 0))
  const gstTotal = round2(lines.reduce((s, l) => s + l.gstAmt, 0))
  const grandTotal = round2(subtotal - discountTotal + gstTotal)
  const paidValue = amountPaid === '' ? grandTotal : Math.min(grandTotal, Number(amountPaid) || 0)

  const updateItem = (key, field, value) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it
        if (field === 'product_id') {
          const product = allProducts.find((p) => p.id === value)
          return {
            ...it,
            product_id: value,
            name: product ? product.name : it.name,
            hsn_code: product?.hsn_code || it.hsn_code,
            unit_price: product ? product.unit_price : it.unit_price,
            gst_rate: product ? product.gst_rate : it.gst_rate,
          }
        }
        return { ...it, [field]: value }
      })
    )
  }

  const addItem = () => setItems((prev) => [...prev, blankItem()])
  const removeItem = (key) => setItems((prev) => prev.filter((it) => it.key !== key))

  const handleNewProductSaved = (newProduct) => {
    setExtraProducts((prev) => [...prev, newProduct])
    setItems((prev) => [
      ...prev,
      {
        ...blankItem(),
        product_id: newProduct.id,
        name: newProduct.name,
        hsn_code: newProduct.hsn_code || '',
        unit_price: newProduct.unit_price,
        gst_rate: newProduct.gst_rate,
      },
    ])
    onProductsChanged?.()
  }

  const handleSave = async () => {
    if (!supplierName.trim()) return toast.error('Supplier name is required')
    const validLines = lines.filter((l) => l.name.trim() && l.qty > 0)
    if (validLines.length === 0) return toast.error('Add at least one item')

    setSaving(true)
    try {
      // Find-or-create the supplier by name within this company.
      let supplierId = null
      const { data: existingSupplier } = await supabase
        .from('suppliers')
        .select('id')
        .eq('company_id', profile.company_id)
        .ilike('name', supplierName.trim())
        .maybeSingle()
      if (existingSupplier) {
        supplierId = existingSupplier.id
      } else {
        const { data: created, error: supErr } = await supabase
          .from('suppliers')
          .insert({ company_id: profile.company_id, name: supplierName.trim(), phone: supplierPhone || null })
          .select()
          .single()
        if (supErr) throw supErr
        supplierId = created.id
      }

      const paymentStatus = paidValue >= grandTotal ? 'paid' : paidValue > 0 ? 'partial' : 'pending'
      const itemRows = validLines.map((l) => ({
        product_id: l.product_id || null,
        name: l.name,
        hsn_code: l.hsn_code || null,
        qty: Number(l.qty),
        unit_price: Number(l.unit_price),
        discount_pct: Number(l.discount_pct) || 0,
        gst_rate: Number(l.gst_rate) || 0,
        line_total: l.total,
      }))

      if (isEditing) {
        // Reconcile stock by the delta in quantity per product between the
        // old and new item lists (increasing purchased qty adds stock;
        // decreasing/removing a line gives stock back).
        const qtyByProduct = (rows) => {
          const map = new Map()
          for (const r of rows) {
            if (!r.product_id) continue
            map.set(r.product_id, (map.get(r.product_id) || 0) + Number(r.qty))
          }
          return map
        }
        const beforeQty = qtyByProduct(originalItems)
        const afterQty = qtyByProduct(validLines)
        const affected = new Set([...beforeQty.keys(), ...afterQty.keys()])

        for (const productId of affected) {
          const delta = (afterQty.get(productId) || 0) - (beforeQty.get(productId) || 0)
          if (delta === 0) continue
          const product = allProducts.find((p) => p.id === productId)
          if (!product) continue
          await supabase.from('products').update({ stock_qty: Number(product.stock_qty) + delta }).eq('id', productId)
          await supabase.from('stock_movements').insert({
            company_id: profile.company_id,
            product_id: productId,
            change_qty: delta,
            reason: 'purchase_edit',
            created_by: profile.id,
          })
        }

        const { error: updateErr } = await supabase
          .from('purchases')
          .update({
            supplier_id: supplierId,
            supplier_name: supplierName.trim(),
            supplier_phone: supplierPhone || null,
            reference_no: referenceNo || null,
            purchase_date: purchaseDate,
            subtotal,
            discount_total: discountTotal,
            gst_total: gstTotal,
            grand_total: grandTotal,
            amount_paid: paidValue,
            payment_status: paymentStatus,
            payment_method: paymentMethod,
          })
          .eq('id', purchase.id)
        if (updateErr) throw updateErr

        const { error: deleteErr } = await supabase.from('purchase_items').delete().eq('purchase_id', purchase.id)
        if (deleteErr) throw deleteErr
        const { error: itemsErr } = await supabase.from('purchase_items').insert(itemRows.map((r) => ({ ...r, purchase_id: purchase.id })))
        if (itemsErr) throw itemsErr

        toast.success(`Purchase updated`)
      } else {
        const { data: purchaseNumber, error: numErr } = await supabase.rpc('next_purchase_number', {
          p_company_id: profile.company_id,
        })
        if (numErr) throw numErr

        const { data: created, error: purchaseErr } = await supabase
          .from('purchases')
          .insert({
            company_id: profile.company_id,
            purchase_number: purchaseNumber,
            supplier_id: supplierId,
            supplier_name: supplierName.trim(),
            supplier_phone: supplierPhone || null,
            reference_no: referenceNo || null,
            purchase_date: purchaseDate,
            subtotal,
            discount_total: discountTotal,
            gst_total: gstTotal,
            grand_total: grandTotal,
            amount_paid: paidValue,
            payment_status: paymentStatus,
            payment_method: paymentMethod,
            source,
            created_by: profile.id,
          })
          .select()
          .single()
        if (purchaseErr) throw purchaseErr

        const { error: itemsErr } = await supabase.from('purchase_items').insert(itemRows.map((r) => ({ ...r, purchase_id: created.id })))
        if (itemsErr) throw itemsErr

        // Restock: only lines linked to an existing product move inventory.
        const stockLines = validLines.filter((l) => l.product_id)
        await Promise.all(
          stockLines.map(async (l) => {
            const product = allProducts.find((p) => p.id === l.product_id)
            if (!product) return
            await supabase.from('products').update({ stock_qty: Number(product.stock_qty) + Number(l.qty) }).eq('id', l.product_id)
            await supabase.from('stock_movements').insert({
              company_id: profile.company_id,
              product_id: l.product_id,
              change_qty: Number(l.qty),
              reason: 'purchase',
              created_by: profile.id,
            })
          })
        )

        toast.success(`Purchase ${purchaseNumber} recorded${stockLines.length ? `, stock updated for ${stockLines.length} product(s)` : ''}`)
      }

      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      toast.error(err.message || 'Failed to save purchase')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Edit purchase — ${purchase.supplier_name}` : 'New purchase'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Totals recalculate automatically; quantity changes adjust stock by the difference.'
              : 'Recording a purchase increases stock for any line linked to an existing product.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Supplier name *</Label>
            <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Supplier phone</Label>
            <Input value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Reference / bill no</Label>
            <Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Purchase date</Label>
            <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
        </div>

        {/* Items — table on sm+ screens, stacked cards on mobile where a 7-column table can't fit */}
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
                      <SelectTrigger className="h-7"><SelectValue placeholder="Non-stock item" /></SelectTrigger>
                      <SelectContent>
                        {allProducts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input className="h-7" value={it.name} onChange={(e) => updateItem(it.key, 'name', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <Input className="h-7" type="number" min="0" value={it.qty} onChange={(e) => updateItem(it.key, 'qty', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <Input className="h-7" type="number" min="0" value={it.unit_price} onChange={(e) => updateItem(it.key, 'unit_price', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <Input className="h-7" type="number" min="0" max="100" value={it.discount_pct} onChange={(e) => updateItem(it.key, 'discount_pct', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <Input className="h-7" type="number" min="0" value={it.gst_rate} onChange={(e) => updateItem(it.key, 'gst_rate', e.target.value)} />
                  </TableCell>
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
              <div className="flex items-center justify-between gap-2">
                <Select value={it.product_id} onValueChange={(v) => updateItem(it.key, 'product_id', v)}>
                  <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Non-stock item" /></SelectTrigger>
                  <SelectContent>
                    {allProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeItem(it.key)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Input placeholder="Item name" value={it.name} onChange={(e) => updateItem(it.key, 'name', e.target.value)} />
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Qty</Label>
                  <Input type="number" min="0" value={it.qty} onChange={(e) => updateItem(it.key, 'qty', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Price</Label>
                  <Input type="number" min="0" value={it.unit_price} onChange={(e) => updateItem(it.key, 'unit_price', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Disc%</Label>
                  <Input type="number" min="0" max="100" value={it.discount_pct} onChange={(e) => updateItem(it.key, 'discount_pct', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">GST%</Label>
                  <Input type="number" min="0" value={it.gst_rate} onChange={(e) => updateItem(it.key, 'gst_rate', e.target.value)} />
                </div>
              </div>
              <p className="text-right text-sm font-semibold">{formatCurrency(it.total)}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4" /> Add item</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setNewProductOpen(true)}>
            <PackagePlus className="h-4 w-4" /> New product
          </Button>
        </div>

        <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="space-y-1.5">
              <Label>Amount paid now</Label>
              <Input type="number" min="0" max={grandTotal} placeholder={grandTotal.toFixed(2)} value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="w-full sm:w-40" />
              {paidValue < grandTotal && (
                <p className="text-xs text-warning-foreground">{formatCurrency(grandTotal - paidValue)} recorded as credit owed to supplier</p>
              )}
            </div>
            {paidValue > 0 && (
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="text-right text-sm">
            <p className="text-muted-foreground">
              Subtotal {formatCurrency(subtotal)}
              {discountTotal > 0 && ` − Disc ${formatCurrency(discountTotal)}`} + GST {formatCurrency(gstTotal)}
            </p>
            <p className="text-lg font-bold">Total {formatCurrency(grandTotal)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loadingItems}>
            {saving ? 'Saving…' : loadingItems ? 'Loading…' : isEditing ? 'Save changes' : 'Save purchase'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ProductFormDialog
      open={newProductOpen}
      onOpenChange={setNewProductOpen}
      categories={categories || []}
      product={null}
      onSaved={handleNewProductSaved}
    />
    </>
  )
}

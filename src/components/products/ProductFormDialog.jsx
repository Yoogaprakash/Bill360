import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Boxes, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import BatchManagerDialog from '@/components/products/BatchManagerDialog'
import ProductQrDialog from '@/components/products/ProductQrDialog'

const empty = {
  name: '', brand: '', sku: '', hsn_code: '', category_id: '', unit_price: '', gst_rate: '',
  stock_qty: '', low_stock_threshold: '', image_url: '', unit_type: 'unit', weight_unit: 'kg', qr_code: '',
}

export default function ProductFormDialog({ open, onOpenChange, categories, product, onSaved }) {
  const profile = useAuthStore((s) => s.profile)
  const [form, setForm] = useState(empty)
  const [imageFile, setImageFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [batchesOpen, setBatchesOpen] = useState(false)
  const [qrPrintOpen, setQrPrintOpen] = useState(false)

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        brand: product.brand || '',
        sku: product.sku || '',
        hsn_code: product.hsn_code || '',
        category_id: product.category_id || '',
        unit_price: product.unit_price ?? '',
        gst_rate: product.gst_rate ?? '',
        stock_qty: product.stock_qty ?? '',
        low_stock_threshold: product.low_stock_threshold ?? '',
        image_url: product.image_url || '',
        unit_type: product.unit_type || 'unit',
        weight_unit: product.weight_unit || 'kg',
        qr_code: product.qr_code || '',
      })
    } else {
      setForm(empty)
    }
    setImageFile(null)
  }, [product, open])

  const handleSave = async () => {
    if (!form.name.trim() || form.unit_price === '') {
      toast.error('Name and price are required')
      return
    }
    setSaving(true)
    try {
      let imageUrl = form.image_url
      if (imageFile) {
        const path = `${profile.company_id}/${Date.now()}-${imageFile.name}`
        const { error: uploadErr } = await supabase.storage.from('product-images').upload(path, imageFile)
        if (uploadErr) throw uploadErr
        imageUrl = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
      }

      const payload = {
        company_id: profile.company_id,
        name: form.name.trim(),
        brand: form.brand || null,
        sku: form.sku || null,
        hsn_code: form.hsn_code || null,
        category_id: form.category_id || null,
        unit_price: Number(form.unit_price) || 0,
        gst_rate: Number(form.gst_rate) || 0,
        stock_qty: Number(form.stock_qty) || 0,
        low_stock_threshold: form.low_stock_threshold === '' ? null : Number(form.low_stock_threshold),
        image_url: imageUrl || null,
        unit_type: form.unit_type,
        weight_unit: form.unit_type === 'weight' ? form.weight_unit : null,
        qr_code: form.qr_code || null,
      }

      const { data: saved, error } = product
        ? await supabase.from('products').update(payload).eq('id', product.id).select().single()
        : await supabase.from('products').insert(payload).select().single()

      if (error) throw error
      toast.success(product ? 'Product updated' : 'Product added')
      onOpenChange(false)
      onSaved?.(saved)
    } catch (err) {
      toast.error(err.message || 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  const qrPreviewValue = form.qr_code || form.sku || product?.id

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit product' : 'Add product'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Brand</Label>
            <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger><SelectValue placeholder="Uncategorized" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>SKU</Label>
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>HSN code</Label>
            <Input value={form.hsn_code} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Sold by</Label>
            <Select value={form.unit_type} onValueChange={(v) => setForm({ ...form, unit_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unit">Piece / unit</SelectItem>
                <SelectItem value="weight">Weight (kg / g)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.unit_type === 'weight' && (
            <div className="space-y-1.5">
              <Label>Weight unit</Label>
              <Select value={form.weight_unit} onValueChange={(v) => setForm({ ...form, weight_unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Kilogram (kg)</SelectItem>
                  <SelectItem value="g">Gram (g)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Price {form.unit_type === 'weight' ? `(per ${form.weight_unit})` : ''} *</Label>
            <Input type="number" min="0" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>GST %</Label>
            <Input type="number" min="0" value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Stock qty {form.unit_type === 'weight' ? `(${form.weight_unit})` : ''}</Label>
            <Input type="number" min="0" step="any" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Low stock threshold</Label>
            <Input type="number" min="0" placeholder="Company default" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Product image</Label>
            <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
          </div>

          <div className="col-span-2 space-y-3 rounded-lg border p-3">
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1.5">
                <Label>QR / barcode value (manual, optional)</Label>
                <Input
                  value={form.qr_code}
                  onChange={(e) => setForm({ ...form, qr_code: e.target.value })}
                  placeholder="Leave blank to use SKU automatically"
                />
                <p className="text-xs text-muted-foreground">
                  Set this if you already have printed barcodes with your own numbering — scanning that code will match this product.
                </p>
              </div>
              {qrPreviewValue && (
                <div className="flex shrink-0 flex-col items-center gap-1.5">
                  <div className="rounded-md border bg-white p-1.5">
                    <QRCodeSVG value={qrPreviewValue} size={64} />
                  </div>
                  {product && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setQrPrintOpen(true)}>
                      <QrCode className="h-3.5 w-3.5" /> Print
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {product ? (
            <Button type="button" variant="outline" onClick={() => setBatchesOpen(true)}>
              <Boxes className="h-4 w-4" /> Manage batches
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save product'}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {product && (
      <BatchManagerDialog open={batchesOpen} onOpenChange={setBatchesOpen} product={product} />
    )}
    {product && (
      <ProductQrDialog open={qrPrintOpen} onOpenChange={setQrPrintOpen} product={{ ...product, qr_code: form.qr_code, sku: form.sku }} />
    )}
    </>
  )
}

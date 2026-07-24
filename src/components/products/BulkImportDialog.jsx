import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { Trash2, AlertTriangle, XCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

// Expected worksheet headers (case-insensitive). All optional except Name/Price.
function normalizeRow(row) {
  const get = (...keys) => {
    for (const k of Object.keys(row)) {
      if (keys.includes(k.trim().toLowerCase())) return row[k]
    }
    return undefined
  }
  const unitTypeRaw = String(get('unit type', 'sold by') ?? '').trim().toLowerCase()
  return {
    name: String(get('name', 'product name') ?? '').trim(),
    brand: String(get('brand') ?? '').trim(),
    sku: String(get('sku', 'code') ?? '').trim(),
    hsn_code: String(get('hsn code', 'hsn') ?? '').trim(),
    category: String(get('category') ?? '').trim(),
    unit_price: get('price', 'unit price') === undefined ? '' : Number(get('price', 'unit price')),
    gst_rate: get('gst rate', 'gst', 'gst%') === undefined ? 0 : Number(get('gst rate', 'gst', 'gst%')),
    stock_qty: get('stock qty', 'stock', 'quantity') === undefined ? 0 : Number(get('stock qty', 'stock', 'quantity')),
    low_stock_threshold: get('low stock threshold') === undefined || get('low stock threshold') === '' ? '' : Number(get('low stock threshold')),
    image_url: String(get('image url', 'image') ?? '').trim(),
    unit_type: unitTypeRaw === 'weight' ? 'weight' : 'unit',
    weight_unit: ['kg', 'g'].includes(String(get('weight unit') ?? '').trim().toLowerCase())
      ? String(get('weight unit')).trim().toLowerCase()
      : 'kg',
  }
}

function validateRow(row) {
  const errors = []
  const warnings = []
  if (!row.name) errors.push('Name is required')
  if (row.unit_price === '' || Number.isNaN(row.unit_price) || row.unit_price <= 0) errors.push('Price must be a number > 0')
  if (Number.isNaN(row.gst_rate) || row.gst_rate < 0 || row.gst_rate > 100) warnings.push('GST rate looks invalid, check it')
  if (Number.isNaN(row.stock_qty)) warnings.push('Stock qty is not a number, will import as 0')
  if (!row.category) warnings.push('No category — will import as Uncategorized')
  if (!row.sku) warnings.push('No SKU')
  if (!row.brand) warnings.push('No brand')
  if (row.image_url && !/^https?:\/\//i.test(row.image_url)) warnings.push('Image URL doesn’t look like a valid link')
  return { errors, warnings }
}

function withValidation(row) {
  return { ...row, ...validateRow(row) }
}

async function chunked(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn))
  }
}

export default function BulkImportDialog({ open, onOpenChange, categories, onImported }) {
  const profile = useAuthStore((s) => s.profile)
  const [rows, setRows] = useState([])
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)

  const errorCount = rows.filter((r) => r.errors.length > 0).length
  const warningCount = rows.filter((r) => r.errors.length === 0 && r.warnings.length > 0).length

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    const parsed = json.map(normalizeRow).filter((r) => r.name || r.sku).map(withValidation)
    setRows(parsed)
  }

  const updateRow = (idx, field, value) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? withValidation({ ...r, [field]: field === 'unit_price' || field === 'gst_rate' || field === 'stock_qty' || field === 'low_stock_threshold' ? (value === '' ? '' : Number(value)) : value }) : r))
    )
  }

  const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx))

  const clearAll = () => {
    setRows([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleImport = async () => {
    const validRows = rows.filter((r) => r.errors.length === 0)
    if (validRows.length === 0) {
      toast.error('No valid rows to import')
      return
    }
    setImporting(true)
    try {
      // Auto-create any categories referenced by name that don't exist yet.
      const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))
      const newCategoryNames = [
        ...new Set(validRows.filter((r) => r.category && !categoryMap.has(r.category.toLowerCase())).map((r) => r.category)),
      ]
      if (newCategoryNames.length > 0) {
        const { data: created, error } = await supabase
          .from('categories')
          .insert(newCategoryNames.map((name) => ({ company_id: profile.company_id, name })))
          .select()
        if (error) throw error
        created.forEach((c) => categoryMap.set(c.name.toLowerCase(), c.id))
      }

      // Match against existing products by name+brand+category so re-imports
      // (e.g. a supplier's refreshed price list) update rather than duplicate.
      const { data: existingProducts, error: existingErr } = await supabase
        .from('products')
        .select('id, name, brand, category_id')
        .eq('company_id', profile.company_id)
      if (existingErr) throw existingErr
      const existingKey = (name, brand, categoryId) => `${name.trim().toLowerCase()}|${(brand || '').trim().toLowerCase()}|${categoryId || ''}`
      const existingMap = new Map((existingProducts || []).map((p) => [existingKey(p.name, p.brand, p.category_id), p.id]))

      const toInsert = []
      const toUpdate = []

      for (const r of validRows) {
        const category_id = r.category ? categoryMap.get(r.category.toLowerCase()) : null
        const payload = {
          company_id: profile.company_id,
          name: r.name,
          brand: r.brand || null,
          sku: r.sku || null,
          hsn_code: r.hsn_code || null,
          category_id: category_id || null,
          unit_price: r.unit_price,
          gst_rate: Number.isNaN(r.gst_rate) ? 0 : r.gst_rate,
          stock_qty: Number.isNaN(r.stock_qty) ? 0 : r.stock_qty,
          low_stock_threshold: r.low_stock_threshold === '' ? null : r.low_stock_threshold,
          image_url: r.image_url || null,
          unit_type: r.unit_type,
          weight_unit: r.unit_type === 'weight' ? r.weight_unit : null,
        }
        const matchId = existingMap.get(existingKey(r.name, r.brand, category_id))
        if (matchId) toUpdate.push({ id: matchId, payload })
        else toInsert.push(payload)
      }

      if (toInsert.length > 0) {
        const { error: insertErr } = await supabase.from('products').insert(toInsert)
        if (insertErr) throw insertErr
      }
      if (toUpdate.length > 0) {
        await chunked(toUpdate, 20, ({ id, payload }) => supabase.from('products').update(payload).eq('id', id))
      }

      const skipped = rows.length - validRows.length
      toast.success(`Imported ${toInsert.length} new, updated ${toUpdate.length}${skipped ? `, skipped ${skipped} with errors` : ''}`)
      clearAll()
      onOpenChange(false)
      onImported?.()
    } catch (err) {
      toast.error(err.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Bulk import products</DialogTitle>
          <DialogDescription>
            Columns: Name, Brand, SKU, HSN Code, Category, Price, GST Rate, Stock Qty, Low Stock Threshold, Image URL,
            Unit Type (unit/weight), Weight Unit (kg/g). Rows are matched to existing products by Name + Brand +
            Category — a match updates that product instead of creating a duplicate.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="max-w-xs" />
          {rows.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">{rows.length} rows</span>
              {errorCount > 0 && <span className="flex items-center gap-1 text-xs text-destructive"><XCircle className="h-3.5 w-3.5" />{errorCount} with errors</span>}
              {warningCount > 0 && <span className="flex items-center gap-1 text-xs text-warning-foreground"><AlertTriangle className="h-3.5 w-3.5" />{warningCount} with warnings</span>}
              <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={clearAll}>Clear all</Button>
            </>
          )}
        </div>

        {rows.length > 0 && (
          <div className="max-h-96 overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead className="min-w-40">Name</TableHead>
                  <TableHead className="min-w-24">Brand</TableHead>
                  <TableHead className="min-w-28">Category</TableHead>
                  <TableHead className="w-24">Price</TableHead>
                  <TableHead className="w-20">GST%</TableHead>
                  <TableHead className="w-24">Stock</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i} className={r.errors.length ? 'bg-destructive/5' : r.warnings.length ? 'bg-warning/5' : ''}>
                    <TableCell>
                      {r.errors.length > 0 ? (
                        <XCircle className="h-4 w-4 text-destructive" />
                      ) : r.warnings.length > 0 ? (
                        <AlertTriangle className="h-4 w-4 text-warning-foreground" />
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Input className="h-7" value={r.name} onChange={(e) => updateRow(i, 'name', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-7" value={r.brand} onChange={(e) => updateRow(i, 'brand', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-7" value={r.category} onChange={(e) => updateRow(i, 'category', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-7" type="number" value={r.unit_price} onChange={(e) => updateRow(i, 'unit_price', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-7" type="number" value={r.gst_rate} onChange={(e) => updateRow(i, 'gst_rate', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-7" type="number" value={r.stock_qty} onChange={(e) => updateRow(i, 'stock_qty', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {rows.some((r) => r.errors.length > 0 || r.warnings.length > 0) && (
          <p className="text-xs text-muted-foreground">
            Rows with a red icon have errors and will be skipped on import. Edit any cell directly above to fix it —
            the row re-validates as you type.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleImport} disabled={rows.filter((r) => r.errors.length === 0).length === 0 || importing}>
            {importing ? 'Importing…' : `Import ${rows.filter((r) => r.errors.length === 0).length || ''} products`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

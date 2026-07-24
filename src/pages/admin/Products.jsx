import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus, Upload, Download, FileDown, Search, QrCode } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useProducts } from '@/hooks/useProducts'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { downloadProductTemplate, exportProductsToExcel } from '@/lib/productsExcel'
import ProductFormDialog from '@/components/products/ProductFormDialog'
import BulkImportDialog from '@/components/products/BulkImportDialog'
import ProductQrDialog from '@/components/products/ProductQrDialog'

export default function Products() {
  const profile = useAuthStore((s) => s.profile)
  const canDelete = profile?.role === 'company_admin'
  const { products, categories, loading, refresh } = useProducts()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [qrProduct, setQrProduct] = useState(null)
  const [selected, setSelected] = useState(new Set())

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id))

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(filtered.map((p) => p.id)))
  }

  const handleEdit = (product) => {
    setEditing(product)
    setFormOpen(true)
  }

  const handleAddNew = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const handleDelete = async (product) => {
    if (!confirm(`Delete "${product.name}"?`)) return
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', product.id)
    if (error) return toast.error(error.message)
    refresh()
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} selected product(s)?`)) return
    const { error } = await supabase.from('products').update({ is_active: false }).in('id', [...selected])
    if (error) return toast.error(error.message)
    toast.success(`Deleted ${selected.size} product(s)`)
    setSelected(new Set())
    refresh()
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Products</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadProductTemplate}>
            <FileDown className="h-4 w-4" /> Download template
          </Button>
          <Button variant="outline" onClick={() => exportProductsToExcel(products)} disabled={products.length === 0}>
            <Download className="h-4 w-4" /> Export products
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" /> Bulk import
          </Button>
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4" /> Add product
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" className="pl-9" />
            </div>
            {canDelete && selected.size > 0 && (
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4" /> Delete selected ({selected.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {canDelete && (
                    <TableHead className="w-8">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                    </TableHead>
                  )}
                  <TableHead>Name</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">GST%</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const threshold = p.low_stock_threshold ?? 5
                  const low = p.stock_qty <= threshold
                  return (
                    <TableRow key={p.id}>
                      {canDelete && (
                        <TableCell>
                          <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.brand || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{p.categories?.name || '—'}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(p.unit_price)}
                        {p.unit_type === 'weight' && <span className="text-xs text-muted-foreground">/{p.weight_unit}</span>}
                      </TableCell>
                      <TableCell className="text-right">{p.gst_rate}%</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={p.stock_qty <= 0 ? 'destructive' : low ? 'warning' : 'secondary'}>
                          {p.stock_qty}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setQrProduct(p)}>
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {canDelete && (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(p)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} categories={categories} product={editing} onSaved={refresh} />
      <BulkImportDialog open={importOpen} onOpenChange={setImportOpen} categories={categories} onImported={refresh} />
      <ProductQrDialog open={!!qrProduct} onOpenChange={(v) => !v && setQrProduct(null)} product={qrProduct} />
    </div>
  )
}

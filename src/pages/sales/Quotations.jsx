import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Download, ArrowRightCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useQuotations } from '@/hooks/useQuotations'
import { useProducts } from '@/hooks/useProducts'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { reprintQuotation } from '@/lib/reprintQuotation'
import QuotationFormDialog from '@/components/quotations/QuotationFormDialog'
import CheckoutModal from '@/components/pos/CheckoutModal'

const STATUS_VARIANT = { draft: 'secondary', sent: 'warning', converted: 'success', expired: 'destructive' }

export default function Quotations() {
  const profile = useAuthStore((s) => s.profile)
  const company = profile?.companies
  const gstEnabled = company?.gst_enabled ?? true
  const { quotations, loading, refresh } = useQuotations()
  const { products } = useProducts()
  const replaceItems = useCartStore((s) => s.replaceItems)

  const [formOpen, setFormOpen] = useState(false)
  const [editingQuotation, setEditingQuotation] = useState(null)
  const [convertingQuotation, setConvertingQuotation] = useState(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  const handleNew = () => {
    setEditingQuotation(null)
    setFormOpen(true)
  }

  const handleEdit = (q) => {
    setEditingQuotation(q)
    setFormOpen(true)
  }

  const handleDownload = async (q) => {
    try {
      await reprintQuotation(q, company)
    } catch {
      toast.error('Could not generate PDF')
    }
  }

  const handleConvert = async (q) => {
    // Converting loads the quotation into the shared POS cart (so it reuses
    // the normal checkout/payment flow) — warn before clobbering an
    // in-progress sale at the register.
    if (useCartStore.getState().items.length > 0) {
      if (!confirm('This will replace items currently in your POS cart with this quotation. Continue?')) return
    }

    const { data: items, error } = await supabase.from('quotation_items').select('*').eq('quotation_id', q.id)
    if (error) return toast.error('Failed to load quotation items')

    const cartItems = items.map((i) => {
      const product = i.product_id ? products.find((p) => p.id === i.product_id) : null
      const isWeight = product?.unit_type === 'weight'
      return {
        key: i.id,
        productId: i.product_id,
        name: i.name,
        unitPrice: Number(i.unit_price),
        qty: Number(i.qty),
        discountPct: Number(i.discount_pct),
        gstRate: Number(i.gst_rate),
        stockQty: product ? Number(product.stock_qty) : null,
        isCustom: !i.product_id,
        unitType: isWeight ? 'weight' : 'unit',
        uom: i.uom || 'pcs',
        qtyStep: isWeight ? (product.weight_unit === 'g' ? 50 : 0.25) : 1,
      }
    })

    replaceItems(cartItems)
    setConvertingQuotation(q)
    setCheckoutOpen(true)
  }

  const handleConverted = () => {
    setConvertingQuotation(null)
    refresh()
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quotations</h1>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4" /> New quotation
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>All quotations</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No quotations yet.</TableCell>
                  </TableRow>
                )}
                {quotations.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.quotation_number}</TableCell>
                    <TableCell>{new Date(q.created_at).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell>
                      <div>{q.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{q.customer_phone}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[q.status] || 'secondary'} className="capitalize">{q.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(q.grand_total)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleDownload(q)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        {q.status !== 'converted' && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(q)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" onClick={() => handleConvert(q)}>
                              <ArrowRightCircle className="h-4 w-4" /> Convert to invoice
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <QuotationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        products={products}
        quotation={editingQuotation}
        gstEnabled={gstEnabled}
        onSaved={refresh}
      />

      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        gstEnabled={gstEnabled}
        initialCustomer={
          convertingQuotation
            ? {
                name: convertingQuotation.customer_name,
                phone: convertingQuotation.customer_phone,
                gst: convertingQuotation.customer_gst || '',
                address: convertingQuotation.customer_address || '',
              }
            : null
        }
        sourceQuotationId={convertingQuotation?.id}
        onComplete={handleConverted}
      />
    </div>
  )
}

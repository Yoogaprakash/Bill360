import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, round2 } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useCartStore, computeTotals } from '@/store/cartStore'
import { generateInvoicePdf } from '@/lib/generateInvoicePdf'

const emptyCustomer = { name: '', phone: '', gst: '', address: '' }

/**
 * initialCustomer: when set (converting a quotation), skips the customer
 * details step and opens straight to payment, prefilled from the quotation.
 * sourceQuotationId: if set, the quotation is marked 'converted' and linked
 * to the resulting bill once payment is confirmed.
 */
export default function CheckoutModal({ open, onOpenChange, gstEnabled, onComplete, initialCustomer = null, sourceQuotationId = null }) {
  const [step, setStep] = useState('details') // 'details' | 'payment'
  const [customer, setCustomer] = useState(emptyCustomer)
  const [amountReceived, setAmountReceived] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const profile = useAuthStore((s) => s.profile)
  const company = profile?.companies
  const clearCart = useCartStore((s) => s.clearCart)
  const items = useCartStore((s) => s.items)
  const totals = useMemo(() => computeTotals(items, gstEnabled), [items, gstEnabled])
  const balanceDue = Math.max(0, round2(totals.grandTotal - amountReceived))
  const isCreditSale = amountReceived < totals.grandTotal

  useEffect(() => {
    if (!open) return
    if (initialCustomer) {
      setCustomer(initialCustomer)
      setAmountReceived(totals.grandTotal)
      setStep('payment')
    } else {
      setCustomer(emptyCustomer)
      setStep('details')
    }
    // Only re-run when the dialog opens — totals changing afterwards
    // (e.g. amountReceived edits) shouldn't reset the step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const upiLink = useMemo(() => {
    if (!company?.upi_id || amountReceived <= 0) return null
    const params = new URLSearchParams({
      pa: company.upi_id,
      pn: company.name || 'Bill360 Merchant',
      am: amountReceived.toFixed(2),
      cu: 'INR',
      tn: `Bill360 payment`,
    })
    return `upi://pay?${params.toString()}`
  }, [company, amountReceived])

  const resetAndClose = () => {
    setStep('details')
    setCustomer(emptyCustomer)
    onOpenChange(false)
  }

  const handleDetailsSubmit = (e) => {
    e.preventDefault()
    if (!customer.name.trim() || !customer.phone.trim()) {
      toast.error('Customer name and phone are required')
      return
    }
    setAmountReceived(totals.grandTotal)
    setStep('payment')
  }

  const handleAmountReceived = async () => {
    setSubmitting(true)
    try {
      // Best-effort: remember the customer for next time (ignore conflicts)
      supabase
        .from('customers')
        .upsert(
          { company_id: profile.company_id, name: customer.name, phone: customer.phone, gst_number: customer.gst || null, address: customer.address || null },
          { onConflict: 'company_id,phone' }
        )
        .then(() => {})

      const { data: billNumber, error: billNoErr } = await supabase.rpc('next_bill_number', {
        p_company_id: profile.company_id,
      })
      if (billNoErr) throw billNoErr

      const { data: billRow, error: billErr } = await supabase
        .from('bills')
        .insert({
          company_id: profile.company_id,
          created_by: profile.id,
          bill_number: billNumber,
          customer_name: customer.name,
          customer_phone: customer.phone,
          customer_gst: customer.gst || null,
          customer_address: customer.address || null,
          subtotal: totals.subtotal,
          discount_total: totals.discountTotal,
          gst_total: totals.gstTotal,
          grand_total: totals.grandTotal,
          amount_received: amountReceived,
          payment_status: amountReceived >= totals.grandTotal ? 'paid' : amountReceived > 0 ? 'partial' : 'pending',
          payment_method: upiLink ? 'UPI' : 'Cash',
        })
        .select()
        .single()
      if (billErr) throw billErr

      const itemRows = totals.lines.map((l) => ({
        bill_id: billRow.id,
        product_id: l.productId,
        name: l.name,
        qty: l.qty,
        unit_price: l.unitPrice,
        discount_pct: l.discountPct,
        gst_rate: l.gstRate,
        line_total: l.total,
        is_custom: l.isCustom,
        uom: l.uom || 'pcs',
      }))
      const { error: itemsErr } = await supabase.from('bill_items').insert(itemRows)
      if (itemsErr) throw itemsErr

      if (sourceQuotationId) {
        await supabase
          .from('quotations')
          .update({ status: 'converted', converted_bill_id: billRow.id })
          .eq('id', sourceQuotationId)
      }

      // Decrement stock for catalog (non-custom) items
      await Promise.all(
        totals.lines
          .filter((l) => l.productId)
          .map((l) =>
            supabase.rpc('apply_stock_sale', {
              p_product_id: l.productId,
              p_qty: l.qty,
              p_bill_id: billRow.id,
              p_company_id: profile.company_id,
              p_user_id: profile.id,
            })
          )
      )

      generateInvoicePdf({
        company,
        bill: {
          billNumber,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerGst: customer.gst,
          customerAddress: customer.address,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          gstTotal: totals.gstTotal,
          grandTotal: totals.grandTotal,
          amountReceived,
          createdAt: billRow.created_at,
        },
        lines: totals.lines,
      })

      toast.success(
        isCreditSale ? `Bill ${billNumber} generated · ${formatCurrency(balanceDue)} on credit` : `Bill ${billNumber} generated`
      )
      clearCart()
      resetAndClose()
      onComplete?.(billRow)
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to generate bill')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : resetAndClose())}>
      <DialogContent>
        {step === 'details' && (
          <form onSubmit={handleDetailsSubmit}>
            <DialogHeader>
              <DialogTitle>Customer details</DialogTitle>
              <DialogDescription>Required for the invoice.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input required autoFocus value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone No *</Label>
                <Input required value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>GST No (optional)</Label>
                <Input value={customer.gst} onChange={(e) => setCustomer({ ...customer, gst: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Address (optional)</Label>
                <Textarea value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetAndClose}>Cancel</Button>
              <Button type="submit">Continue to payment</Button>
            </DialogFooter>
          </form>
        )}

        {step === 'payment' && (
          <>
            <DialogHeader>
              <DialogTitle>Collect payment</DialogTitle>
              <DialogDescription>Bill total is {formatCurrency(totals.grandTotal)}. Reduce the amount below for a partial / credit sale.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-full max-w-52 space-y-1.5">
                <Label>Amount received</Label>
                <Input
                  type="number"
                  min={0}
                  max={totals.grandTotal}
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(Math.max(0, Math.min(totals.grandTotal, Number(e.target.value) || 0)))}
                  className="text-center text-lg font-semibold"
                />
              </div>
              {isCreditSale && (
                <p className="rounded-md bg-warning/15 px-3 py-1.5 text-center text-sm text-warning-foreground">
                  {formatCurrency(balanceDue)} will be recorded as credit due from {customer.name || 'this customer'}
                </p>
              )}
              {upiLink ? (
                <div className="rounded-lg border bg-white p-4">
                  <QRCodeSVG value={upiLink} size={200} />
                </div>
              ) : amountReceived > 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  No UPI ID configured for this company. Add one in Company Settings to show a QR code — you can still record cash/other payment.
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">{customer.name} · {customer.phone}</p>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setStep('details')} disabled={submitting}>
                Back
              </Button>
              <Button onClick={handleAmountReceived} disabled={submitting}>
                {submitting ? 'Processing…' : isCreditSale ? 'Confirm & Record Credit' : 'Amount Received'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

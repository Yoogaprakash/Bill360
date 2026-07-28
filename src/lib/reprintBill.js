import { supabase } from '@/lib/supabase'
import { generateInvoicePdf } from '@/lib/generateInvoicePdf'
import { checkUsageLimit } from '@/lib/usageLimit'

export async function reprintBill(bill, company) {
  const allowed = await checkUsageLimit(bill.company_id || company?.id, 'bill_print')
  if (!allowed) return

  const { data: items, error } = await supabase
    .from('bill_items')
    .select('*')
    .eq('bill_id', bill.id)
  if (error) throw error

  const lines = items.map((i) => ({
    name: i.name,
    qty: i.qty,
    unitPrice: i.unit_price,
    discountPct: i.discount_pct,
    gstRate: i.gst_rate,
    total: i.line_total,
  }))

  generateInvoicePdf({
    company,
    bill: {
      billNumber: bill.bill_number,
      customerName: bill.customer_name,
      customerPhone: bill.customer_phone,
      customerGst: bill.customer_gst,
      customerAddress: bill.customer_address,
      subtotal: bill.subtotal,
      discountTotal: bill.discount_total,
      gstTotal: bill.gst_total,
      grandTotal: bill.grand_total,
      amountReceived: bill.amount_received,
      createdAt: bill.created_at,
    },
    lines,
  })
}

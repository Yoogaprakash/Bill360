import { supabase } from '@/lib/supabase'
import { generateQuotationPdf } from '@/lib/generateQuotationPdf'

export async function reprintQuotation(quotation, company) {
  const { data: items, error } = await supabase
    .from('quotation_items')
    .select('*')
    .eq('quotation_id', quotation.id)
  if (error) throw error

  const lines = items.map((i) => ({
    name: i.name,
    qty: i.qty,
    unitPrice: i.unit_price,
    discountPct: i.discount_pct,
    gstRate: i.gst_rate,
    total: i.line_total,
  }))

  generateQuotationPdf({
    company,
    quotation: {
      quotationNumber: quotation.quotation_number,
      customerName: quotation.customer_name,
      customerPhone: quotation.customer_phone,
      customerGst: quotation.customer_gst,
      customerAddress: quotation.customer_address,
      validUntil: quotation.valid_until,
      subtotal: quotation.subtotal,
      discountTotal: quotation.discount_total,
      gstTotal: quotation.gst_total,
      grandTotal: quotation.grand_total,
      createdAt: quotation.created_at,
    },
    lines,
  })
}

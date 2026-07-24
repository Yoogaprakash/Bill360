import { supabase } from '@/lib/supabase'
import { generatePurchasePdf } from '@/lib/generatePurchasePdf'

export async function reprintPurchase(purchase, company) {
  const { data: items, error } = await supabase
    .from('purchase_items')
    .select('*')
    .eq('purchase_id', purchase.id)
  if (error) throw error

  const purchaseNumber = purchase.purchase_number || purchase.reference_no || `PUR-${purchase.id.slice(0, 8)}`

  generatePurchasePdf({
    company,
    purchase: {
      purchaseNumber,
      supplierName: purchase.supplier_name,
      supplierPhone: purchase.supplier_phone,
      referenceNo: purchase.reference_no,
      purchaseDate: purchase.purchase_date,
      subtotal: purchase.subtotal,
      discountTotal: purchase.discount_total,
      gstTotal: purchase.gst_total,
      grandTotal: purchase.grand_total,
      amountPaid: purchase.totalPaid ?? purchase.amount_paid,
    },
    lines: items,
  })
}

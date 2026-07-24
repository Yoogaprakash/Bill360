import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrencyForPdf as formatCurrency } from '@/lib/utils'

/**
 * Renders and downloads a PDF for a purchase (goods-in) record. The file is
 * named after the purchase number so it matches what's shown in the app and
 * on the printed page, same convention as sales invoices.
 * @param {object} params
 * @param {object} params.company   - companies row (name, address, phone, gst_number)
 * @param {object} params.purchase  - { purchaseNumber, supplierName, supplierPhone, referenceNo,
 *                                      purchaseDate, subtotal, discountTotal, gstTotal, grandTotal, amountPaid }
 * @param {Array}  params.lines     - purchase_items rows: { name, hsn_code, qty, unit_price, discount_pct, gst_rate, line_total }
 */
export function generatePurchasePdf({ company, purchase, lines }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40
  const colWidth = (pageWidth - margin * 2 - 20) / 2
  const leftX = margin
  const rightX = margin + colWidth + 20

  // --- Company (left) / Supplier (right), side by side -------------------
  let leftY = 50
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(company?.name || 'Company', leftX, leftY)
  leftY += 18

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90)
  if (company?.address) {
    const wrapped = doc.splitTextToSize(company.address, colWidth)
    doc.text(wrapped, leftX, leftY)
    leftY += wrapped.length * 12
  }
  if (company?.gst_number) {
    doc.text(`GSTIN: ${company.gst_number}`, leftX, leftY)
    leftY += 12
  }

  let rightY = 50
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(120)
  doc.text('SUPPLIER', rightX, rightY)
  rightY += 16
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text(purchase.supplierName, rightX, rightY)
  rightY += 16
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90)
  if (purchase.supplierPhone) {
    doc.text(purchase.supplierPhone, rightX, rightY)
    rightY += 12
  }
  if (purchase.referenceNo) {
    doc.text(`Ref: ${purchase.referenceNo}`, rightX, rightY)
    rightY += 12
  }

  // --- Divider, then Purchase No / Date on their own row ------------------
  let y = Math.max(leftY, rightY) + 12
  doc.setDrawColor(220)
  doc.line(margin, y, pageWidth - margin, y)
  y += 22

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text(`Purchase No: ${purchase.purchaseNumber}`, leftX, y)
  doc.text(`Date: ${new Date(purchase.purchaseDate).toLocaleDateString('en-IN')}`, rightX, y)
  y += 18

  autoTable(doc, {
    startY: y,
    head: [['#', 'Item', 'HSN', 'Qty', 'Unit Price', 'Disc %', 'GST %', 'Amount']],
    body: lines.map((l, idx) => [
      idx + 1,
      l.name,
      l.hsn_code || '—',
      l.qty,
      formatCurrency(l.unit_price),
      `${l.discount_pct || 0}%`,
      `${l.gst_rate}%`,
      formatCurrency(l.line_total),
    ]),
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    columnStyles: { 0: { cellWidth: 24 }, 7: { halign: 'right' } },
  })

  let finalY = doc.lastAutoTable.finalY + 20
  const totalsX = pageWidth - margin - 200
  const printTotal = (label, value, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 12 : 10)
    doc.text(label, totalsX, finalY)
    doc.text(value, pageWidth - margin, finalY, { align: 'right' })
    finalY += bold ? 18 : 14
  }

  printTotal('Subtotal', formatCurrency(purchase.subtotal))
  if (purchase.discountTotal > 0) printTotal('Discount', `-${formatCurrency(purchase.discountTotal)}`)
  printTotal('GST', formatCurrency(purchase.gstTotal))
  printTotal('Grand Total', formatCurrency(purchase.grandTotal), true)
  printTotal('Amount Paid', formatCurrency(purchase.amountPaid))
  const balance = Math.max(0, (purchase.grandTotal || 0) - (purchase.amountPaid || 0))
  if (balance > 0) printTotal('Balance Due', formatCurrency(balance))

  doc.save(`${purchase.purchaseNumber}.pdf`)
  return doc
}

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrencyForPdf as formatCurrency } from '@/lib/utils'

/**
 * Renders and downloads a PDF invoice.
 * @param {object} params
 * @param {object} params.company   - companies row (name, address, phone, gst_number, footer_note, gst_enabled)
 * @param {object} params.bill      - { billNumber, customerName, customerPhone, customerGst, customerAddress,
 *                                      subtotal, discountTotal, gstTotal, grandTotal, amountReceived, createdAt }
 * @param {Array}  params.lines     - cart lines: { name, qty, unitPrice, discountPct, gstRate, total }
 */
export function generateInvoicePdf({ company, bill, lines }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40
  const colWidth = (pageWidth - margin * 2 - 20) / 2
  const leftX = margin
  const rightX = margin + colWidth + 20

  // --- Company (left) / Customer (right), side by side ------------------
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
  const contactLine = [company?.phone, company?.email].filter(Boolean).join('  ·  ')
  if (contactLine) {
    doc.text(contactLine, leftX, leftY)
    leftY += 12
  }
  if (company?.gst_number) {
    doc.text(`GSTIN: ${company.gst_number}`, leftX, leftY)
    leftY += 12
  }

  let rightY = 50
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(120)
  doc.text('BILL TO', rightX, rightY)
  rightY += 16
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text(bill.customerName, rightX, rightY)
  rightY += 16
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90)
  doc.text(bill.customerPhone, rightX, rightY)
  rightY += 12
  if (bill.customerGst) {
    doc.text(`GSTIN: ${bill.customerGst}`, rightX, rightY)
    rightY += 12
  }
  if (bill.customerAddress) {
    const wrapped = doc.splitTextToSize(bill.customerAddress, colWidth)
    doc.text(wrapped, rightX, rightY)
    rightY += wrapped.length * 12
  }

  // --- Divider, then Bill No / Date on their own row ---------------------
  let y = Math.max(leftY, rightY) + 12
  doc.setDrawColor(220)
  doc.line(margin, y, pageWidth - margin, y)
  y += 22

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text(`Invoice No: ${bill.billNumber}`, leftX, y)
  doc.text(`Date: ${new Date(bill.createdAt || Date.now()).toLocaleDateString('en-IN')}`, rightX, y)
  y += 18

  // --- Line items table --------------------------------------------------
  const gstEnabled = company?.gst_enabled
  const head = gstEnabled
    ? [['#', 'Item', 'Qty', 'Unit Price', 'Disc %', 'GST %', 'Amount']]
    : [['#', 'Item', 'Qty', 'Unit Price', 'Disc %', 'Amount']]

  const body = lines.map((l, idx) => {
    const row = [idx + 1, l.name, l.qty, formatCurrency(l.unitPrice), `${l.discountPct}%`]
    if (gstEnabled) row.push(`${l.gstRate}%`)
    row.push(formatCurrency(l.total))
    return row
  })

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    columnStyles: { 0: { cellWidth: 24 }, [head[0].length - 1]: { halign: 'right' } },
  })

  let finalY = doc.lastAutoTable.finalY + 20

  // --- Totals ---------------------------------------------------------
  const totalsX = pageWidth - margin - 200
  const printTotal = (label, value, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 12 : 10)
    doc.text(label, totalsX, finalY)
    doc.text(value, pageWidth - margin, finalY, { align: 'right' })
    finalY += bold ? 18 : 14
  }

  printTotal('Subtotal', formatCurrency(bill.subtotal))
  if (bill.discountTotal > 0) printTotal('Discount', `-${formatCurrency(bill.discountTotal)}`)
  if (gstEnabled) printTotal('GST', formatCurrency(bill.gstTotal))
  printTotal('Grand Total', formatCurrency(bill.grandTotal), true)
  printTotal('Amount Received', formatCurrency(bill.amountReceived))
  const balance = Math.max(0, (bill.grandTotal || 0) - (bill.amountReceived || 0))
  if (balance > 0) printTotal('Balance Due', formatCurrency(balance))

  // --- Footer -----------------------------------------------------------
  const pageHeight = doc.internal.pageSize.getHeight()
  const footerY = pageHeight - 60
  doc.setDrawColor(220)
  doc.line(margin, footerY - 16, pageWidth - margin, footerY - 16)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(90)
  const footerText = company?.footer_note || 'Thank you for your business!'
  doc.text(doc.splitTextToSize(footerText, pageWidth - margin * 2), margin, footerY)

  doc.save(`${bill.billNumber}.pdf`)
  return doc
}

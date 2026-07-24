import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrencyForPdf as formatCurrency } from '@/lib/utils'

/**
 * @param {object} params.company    - companies row
 * @param {object} params.quotation  - { quotationNumber, customerName, customerPhone, customerGst, customerAddress,
 *                                       validUntil, subtotal, discountTotal, gstTotal, grandTotal, createdAt }
 * @param {Array}  params.lines      - { name, qty, unitPrice, discountPct, gstRate, total }
 */
export function generateQuotationPdf({ company, quotation, lines }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40
  const colWidth = (pageWidth - margin * 2 - 20) / 2
  const leftX = margin
  const rightX = margin + colWidth + 20

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
  doc.text('QUOTATION FOR', rightX, rightY)
  rightY += 16
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text(quotation.customerName, rightX, rightY)
  rightY += 16
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90)
  doc.text(quotation.customerPhone, rightX, rightY)
  rightY += 12
  if (quotation.customerGst) {
    doc.text(`GSTIN: ${quotation.customerGst}`, rightX, rightY)
    rightY += 12
  }
  if (quotation.customerAddress) {
    const wrapped = doc.splitTextToSize(quotation.customerAddress, colWidth)
    doc.text(wrapped, rightX, rightY)
    rightY += wrapped.length * 12
  }

  let y = Math.max(leftY, rightY) + 12
  doc.setDrawColor(220)
  doc.line(margin, y, pageWidth - margin, y)
  y += 22

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text(`Quotation No: ${quotation.quotationNumber}`, leftX, y)
  doc.text(`Date: ${new Date(quotation.createdAt || Date.now()).toLocaleDateString('en-IN')}`, rightX, y)
  y += 16
  if (quotation.validUntil) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(90)
    doc.text(`Valid until: ${new Date(quotation.validUntil).toLocaleDateString('en-IN')}`, leftX, y)
    y += 14
  }
  y += 6

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
  const totalsX = pageWidth - margin - 200
  const printTotal = (label, value, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 12 : 10)
    doc.text(label, totalsX, finalY)
    doc.text(value, pageWidth - margin, finalY, { align: 'right' })
    finalY += bold ? 18 : 14
  }

  printTotal('Subtotal', formatCurrency(quotation.subtotal))
  if (quotation.discountTotal > 0) printTotal('Discount', `-${formatCurrency(quotation.discountTotal)}`)
  if (gstEnabled) printTotal('GST', formatCurrency(quotation.gstTotal))
  printTotal('Total', formatCurrency(quotation.grandTotal), true)

  const pageHeight = doc.internal.pageSize.getHeight()
  const footerY = pageHeight - 50
  doc.setDrawColor(220)
  doc.line(margin, footerY - 16, pageWidth - margin, footerY - 16)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(90)
  doc.text('This is a quotation, not a tax invoice. Prices are subject to change until converted to an invoice.', margin, footerY)

  doc.save(`${quotation.quotationNumber}.pdf`)
  return doc
}

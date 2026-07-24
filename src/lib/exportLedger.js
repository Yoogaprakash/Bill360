import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { formatCurrencyForPdf } from '@/lib/utils'

const COLUMNS = ['Type', 'Ref #', 'Name', 'Mobile No', 'Date', 'Method', 'Amount', 'Balance']

function toRows(entries) {
  return entries.map((e) => [
    e.type === 'credit' ? 'Credit' : 'Debit',
    e.referenceNo,
    e.partyName,
    e.partyPhone,
    new Date(e.date).toLocaleDateString('en-IN'),
    e.method,
    e.amount.toFixed(2),
    e.balance.toFixed(2),
  ])
}

function exportXlsx(entries) {
  const ws = XLSX.utils.aoa_to_sheet([COLUMNS, ...toRows(entries)])
  ws['!cols'] = COLUMNS.map(() => ({ wch: 16 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Credit & Debit')
  XLSX.writeFile(wb, `bill360-credit-debit-${Date.now()}.xlsx`)
}

function exportPdf(entries) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text('Credit & Debit Ledger', 40, 40)
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(`Generated ${new Date().toLocaleString('en-IN')} · ${entries.length} entries`, 40, 56)

  const totalCredit = entries.filter((e) => e.type === 'credit').reduce((s, e) => s + e.amount, 0)
  const totalDebit = entries.filter((e) => e.type === 'debit').reduce((s, e) => s + e.amount, 0)
  const closingBalance = entries.length ? entries[entries.length - 1].balance : 0

  autoTable(doc, {
    startY: 70,
    head: [COLUMNS],
    body: entries.map((e) => [
      e.type === 'credit' ? 'Credit' : 'Debit',
      e.referenceNo,
      e.partyName,
      e.partyPhone,
      new Date(e.date).toLocaleDateString('en-IN'),
      e.method,
      formatCurrencyForPdf(e.amount),
      formatCurrencyForPdf(e.balance),
    ]),
    margin: { left: 40, right: 40 },
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.styles.textColor = data.cell.raw === 'Credit' ? [22, 130, 90] : [190, 40, 40]
      }
    },
  })

  const finalY = doc.lastAutoTable.finalY + 20
  doc.setFontSize(10)
  doc.setTextColor(22, 130, 90)
  doc.text(`Total Credit: ${formatCurrencyForPdf(totalCredit)}`, 40, finalY)
  doc.setTextColor(190, 40, 40)
  doc.text(`Total Debit: ${formatCurrencyForPdf(totalDebit)}`, 220, finalY)
  doc.setTextColor(closingBalance >= 0 ? 22 : 190, closingBalance >= 0 ? 130 : 40, closingBalance >= 0 ? 90 : 40)
  doc.setFont('helvetica', 'bold')
  doc.text(`Closing Balance: ${formatCurrencyForPdf(closingBalance)}`, 400, finalY)

  doc.save(`bill360-credit-debit-${Date.now()}.pdf`)
}

export function exportLedger(entries, format) {
  if (entries.length === 0) return
  if (format === 'xlsx') return exportXlsx(entries)
  if (format === 'pdf') return exportPdf(entries)
}

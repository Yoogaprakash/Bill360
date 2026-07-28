import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { formatCurrencyForPdf } from '@/lib/utils'
import { checkUsageLimit } from '@/lib/usageLimit'

const COLUMNS = ['Bill No', 'Date', 'Customer', 'Phone', 'Status', 'Grand Total', 'Received', 'Balance Due']

function toRows(bills) {
  return bills.map((b) => [
    b.bill_number,
    new Date(b.created_at).toLocaleDateString('en-IN'),
    b.customer_name,
    b.customer_phone,
    b.payment_status,
    Number(b.grand_total).toFixed(2),
    Number(b.totalPaid).toFixed(2),
    Number(b.balanceDue).toFixed(2),
  ])
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportCsv(bills) {
  const ws = XLSX.utils.aoa_to_sheet([COLUMNS, ...toRows(bills)])
  const csv = XLSX.utils.sheet_to_csv(ws)
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `credit-report-${Date.now()}.csv`)
}

function exportXlsx(bills) {
  const ws = XLSX.utils.aoa_to_sheet([COLUMNS, ...toRows(bills)])
  ws['!cols'] = COLUMNS.map(() => ({ wch: 16 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Credit Report')
  XLSX.writeFile(wb, `credit-report-${Date.now()}.xlsx`)
}

function exportPdf(bills) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text('Credit Report', 40, 40)
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(`Generated ${new Date().toLocaleString('en-IN')} · ${bills.length} bills`, 40, 56)

  const totalDue = bills.reduce((s, b) => s + Number(b.balanceDue), 0)

  autoTable(doc, {
    startY: 70,
    head: [COLUMNS],
    body: bills.map((b) => [
      b.bill_number,
      new Date(b.created_at).toLocaleDateString('en-IN'),
      b.customer_name,
      b.customer_phone,
      b.payment_status,
      formatCurrencyForPdf(b.grand_total),
      formatCurrencyForPdf(b.totalPaid),
      formatCurrencyForPdf(b.balanceDue),
    ]),
    margin: { left: 40, right: 40 },
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
  })

  const finalY = doc.lastAutoTable.finalY + 20
  doc.setFontSize(11)
  doc.setTextColor(0)
  doc.text(`Total balance due: ${formatCurrencyForPdf(totalDue)}`, 40, finalY)

  doc.save(`credit-report-${Date.now()}.pdf`)
}

export async function exportCreditReport(bills, format, companyId) {
  if (bills.length === 0) return
  if (!(await checkUsageLimit(companyId, 'report_print'))) return
  if (format === 'csv') return exportCsv(bills)
  if (format === 'xlsx') return exportXlsx(bills)
  if (format === 'pdf') return exportPdf(bills)
}

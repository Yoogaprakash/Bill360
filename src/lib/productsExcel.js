import * as XLSX from 'xlsx'

// Must match the columns BulkImportDialog.jsx knows how to read back in.
const COLUMNS = ['Name', 'Brand', 'SKU', 'HSN Code', 'Category', 'Price', 'GST Rate', 'Stock Qty', 'Low Stock Threshold', 'Image URL', 'Unit Type', 'Weight Unit']

function buildSheet(rows) {
  const ws = XLSX.utils.aoa_to_sheet([COLUMNS, ...rows])
  ws['!cols'] = COLUMNS.map(() => ({ wch: 18 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Products')
  return wb
}

export function downloadProductTemplate() {
  const sampleRows = [
    ['Basmati Rice 1kg', 'India Gate', 'RIC-001', '1006', 'Grocery Staples', 120, 5, 50, 5, '', 'unit', ''],
    ['Tomatoes', '', 'VEG-001', '0702', 'Vegetables', 40, 0, 20, 5, '', 'weight', 'kg'],
  ]
  XLSX.writeFile(buildSheet(sampleRows), 'bill360-product-import-template.xlsx')
}

export function exportProductsToExcel(products) {
  const rows = products.map((p) => [
    p.name,
    p.brand || '',
    p.sku || '',
    p.hsn_code || '',
    p.categories?.name || '',
    p.unit_price,
    p.gst_rate,
    p.stock_qty,
    p.low_stock_threshold ?? '',
    p.image_url || '',
    p.unit_type || 'unit',
    p.weight_unit || '',
  ])
  const filename = `bill360-products-${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(buildSheet(rows), filename)
}

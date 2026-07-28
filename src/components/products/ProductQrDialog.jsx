import { QRCodeSVG } from 'qrcode.react'
import { Printer } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

export default function ProductQrDialog({ open, onOpenChange, product }) {
  if (!product) return null
  // The QR must encode something unique per product to scan reliably — HSN
  // codes are a *tax classification* shared by many unrelated products (e.g.
  // every bag of rice might carry the same HSN), so encoding it would make
  // scanning ambiguous. A manually-set code takes priority (for businesses
  // with their own existing barcode scheme), then SKU, then id as a fallback
  // that's always unique. HSN is printed as visible text, same as a GST tag.
  const value = product.qr_code || product.sku || product.id

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=400,height=500')
    win.document.write(`
      <html>
        <head><title>${product.name}</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:24px;">
          <div id="qr"></div>
          <p style="margin-top:8px;font-weight:600;">${product.name}</p>
          <p style="font-size:12px;color:#666;">${value}</p>
          ${product.hsn_code ? `<p style="font-size:12px;color:#666;">HSN: ${product.hsn_code}</p>` : ''}
          <p style="font-size:14px;font-weight:600;margin-top:4px;">${formatCurrency(product.unit_price)}</p>
        </body>
      </html>
    `)
    win.document.close()
    // Render the QR into the popup once its DOM is ready.
    const svg = document.getElementById(`qr-print-source-${product.id}`)
    if (svg) {
      const xml = new XMLSerializer().serializeToString(svg)
      win.document.getElementById('qr').innerHTML = xml
    }
    setTimeout(() => {
      win.focus()
      win.print()
    }, 250)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>QR label — {product.name}</DialogTitle>
          {!product.hsn_code && (
            <DialogDescription>No HSN code set for this product — add one in Edit product to print it on the label.</DialogDescription>
          )}
        </DialogHeader>
        <div className="flex flex-col items-center gap-1 py-2">
          <div className="rounded-lg border bg-white p-4">
            <QRCodeSVG id={`qr-print-source-${product.id}`} value={value} size={200} />
          </div>
          <p className="mt-2 text-sm font-medium">{product.name}</p>
          {product.hsn_code && <p className="text-xs text-muted-foreground">HSN: {product.hsn_code}</p>}
          <p className="text-sm font-semibold text-brand">{formatCurrency(product.unit_price)}</p>
          <p className="text-xs text-muted-foreground">Scan code: {value}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handlePrint}><Printer className="h-4 w-4" /> Print label</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

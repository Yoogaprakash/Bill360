import { lazy, Suspense, useState } from 'react'
import { toast } from 'sonner'
import { Plus, ScanLine, Pencil, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { usePurchases } from '@/hooks/usePurchases'
import { useProducts } from '@/hooks/useProducts'
import { useAuthStore } from '@/store/authStore'
import NewPurchaseDialog from '@/components/purchases/NewPurchaseDialog'
import RecordPurchasePaymentDialog from '@/components/purchases/RecordPurchasePaymentDialog'
import { reprintPurchase } from '@/lib/reprintPurchase'

// tesseract.js is a large, only-sometimes-needed dependency — split it out
// of the Purchases page bundle until someone actually opens the scanner.
const ScanPurchaseBillDialog = lazy(() => import('@/components/purchases/ScanPurchaseBillDialog'))

export default function Purchases() {
  const profile = useAuthStore((s) => s.profile)
  const canAdd = profile?.role === 'company_admin' || profile?.role === 'manager'
  const canEdit = profile?.role === 'company_admin' || profile?.role === 'manager'
  // Paying a supplier is now open to every role that can reach this page.
  const canPay = ['company_admin', 'manager', 'sales_user'].includes(profile?.role)

  const { purchases, loading, refresh } = usePurchases()
  const { products, categories, refresh: refreshProducts } = useProducts()
  const [newOpen, setNewOpen] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [scannedDraft, setScannedDraft] = useState(null)
  const [paymentTarget, setPaymentTarget] = useState(null)

  const totalDue = purchases.reduce((s, p) => s + p.balanceDue, 0)
  const company = profile?.companies

  const handleDownload = async (purchase) => {
    try {
      await reprintPurchase(purchase, company)
    } catch {
      toast.error('Could not generate PDF')
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Purchases</h1>
        {canAdd && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setScanOpen(true)}>
              <ScanLine className="h-4 w-4" /> Scan purchase bill
            </Button>
            <Button onClick={() => { setScannedDraft(null); setNewOpen(true) }}>
              <Plus className="h-4 w-4" /> New purchase
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Purchase history</CardTitle>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total owed to suppliers</p>
            <p className="text-xl font-bold text-destructive">{formatCurrency(totalDue)}</p>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Purchase #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">No purchases recorded yet.</TableCell>
                  </TableRow>
                )}
                {purchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.purchase_number || '—'}</TableCell>
                    <TableCell>{new Date(p.purchase_date).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell>
                      {p.supplier_name}
                      {p.source === 'scanned' && <Badge variant="secondary" className="ml-2">Scanned</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.reference_no || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={p.payment_status === 'paid' ? 'success' : p.payment_status === 'partial' ? 'warning' : 'destructive'} className="capitalize">
                        {p.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(p.grand_total)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.totalPaid)}</TableCell>
                    <TableCell className="text-right font-semibold">{p.balanceDue > 0 ? formatCurrency(p.balanceDue) : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleDownload(p)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        {canEdit && (
                          <Button variant="ghost" size="icon" onClick={() => setEditingPurchase(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canPay && p.balanceDue > 0 && (
                          <Button size="sm" variant="outline" onClick={() => setPaymentTarget(p)}>Pay supplier</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canAdd && (
        <NewPurchaseDialog
          open={newOpen}
          onOpenChange={setNewOpen}
          products={products}
          categories={categories}
          initialItems={scannedDraft?.items}
          initialSupplierName={scannedDraft?.supplierNameGuess}
          initialSupplierPhone={scannedDraft?.supplierPhoneGuess}
          source={scannedDraft ? 'scanned' : 'manual'}
          onSaved={refresh}
          onProductsChanged={refreshProducts}
        />
      )}
      {canEdit && (
        <NewPurchaseDialog
          open={!!editingPurchase}
          onOpenChange={(v) => !v && setEditingPurchase(null)}
          products={products}
          categories={categories}
          purchase={editingPurchase}
          onSaved={refresh}
          onProductsChanged={refreshProducts}
        />
      )}
      {scanOpen && (
        <Suspense fallback={null}>
          <ScanPurchaseBillDialog
            open={scanOpen}
            onOpenChange={setScanOpen}
            onScanned={(draft) => {
              setScannedDraft(draft)
              setNewOpen(true)
            }}
          />
        </Suspense>
      )}
      {canPay && (
        <RecordPurchasePaymentDialog purchase={paymentTarget} open={!!paymentTarget} onOpenChange={(v) => !v && setPaymentTarget(null)} onRecorded={refresh} />
      )}
    </div>
  )
}

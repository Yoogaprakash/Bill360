import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import BillsTable from '@/components/bills/BillsTable'
import EditBillDialog from '@/components/bills/EditBillDialog'
import { useBills } from '@/hooks/useBills'
import { useAuthStore } from '@/store/authStore'

export default function AllBills() {
  const { bills, loading, refresh } = useBills()
  const profile = useAuthStore((s) => s.profile)
  const gstEnabled = profile?.companies?.gst_enabled ?? true
  const canEdit = profile?.role === 'company_admin' || profile?.role === 'manager'
  const [editingBill, setEditingBill] = useState(null)

  return (
    <div className="p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>All Bills</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <BillsTable bills={bills} showCashier onEdit={canEdit ? setEditingBill : undefined} />
          )}
        </CardContent>
      </Card>

      <EditBillDialog
        bill={editingBill}
        open={!!editingBill}
        onOpenChange={(v) => !v && setEditingBill(null)}
        gstEnabled={gstEnabled}
        onSaved={refresh}
      />
    </div>
  )
}

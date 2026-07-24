import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import BillsTable from '@/components/bills/BillsTable'
import { useBills } from '@/hooks/useBills'

export default function MyBills() {
  const { bills, loading } = useBills({ mineOnly: true })

  return (
    <div className="p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>My Bills</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground">Loading…</p> : <BillsTable bills={bills} />}
        </CardContent>
      </Card>
    </div>
  )
}

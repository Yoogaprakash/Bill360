import { useState } from 'react'
import { Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency } from '@/lib/utils'
import { useCreditBills } from '@/hooks/useCreditBills'
import { exportCreditReport } from '@/lib/exportCreditReport'
import RecordPaymentDialog from '@/components/credit/RecordPaymentDialog'
import { useAuthStore } from '@/store/authStore'

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

export default function CreditReport() {
  const profile = useAuthStore((s) => s.profile)
  // Recording a payment is now open to every role that can reach this page
  // (company_admin, manager, sales_user) — RLS still scopes a sales_user to
  // only the bills they personally created.
  const canRecordPayment = ['company_admin', 'manager', 'sales_user'].includes(profile?.role)
  const [from, setFrom] = useState(isoDate(new Date(Date.now() - 89 * 86400000)))
  const [to, setTo] = useState(isoDate(new Date()))
  const [status, setStatus] = useState('outstanding') // outstanding | all | pending | partial | paid
  const [search, setSearch] = useState('')
  const [paymentTarget, setPaymentTarget] = useState(null)

  const { bills, loading, refresh } = useCreditBills({
    from,
    to,
    status: status === 'outstanding' || status === 'all' ? 'all' : status,
    search,
  })
  const visibleBills = status === 'outstanding' ? bills.filter((b) => b.balanceDue > 0) : bills

  const totalDue = visibleBills.reduce((s, b) => s + b.balanceDue, 0)

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Credit Report</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={visibleBills.length === 0}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportCreditReport(visibleBills, 'csv', profile.company_id)}>CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportCreditReport(visibleBills, 'xlsx', profile.company_id)}>Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportCreditReport(visibleBills, 'pdf', profile.company_id)}>PDF</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-4">
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="outstanding">Outstanding only</SelectItem>
                <SelectItem value="all">All bills</SelectItem>
                <SelectItem value="pending">Pending (unpaid)</SelectItem>
                <SelectItem value="partial">Partially paid</SelectItem>
                <SelectItem value="paid">Fully paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label>Search customer / phone / bill no</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. 98765..." />
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-muted-foreground">Total balance due</p>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(totalDue)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bills ({visibleBills.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleBills.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No matching bills.</TableCell>
                  </TableRow>
                )}
                {visibleBills.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.bill_number}</TableCell>
                    <TableCell>{new Date(b.created_at).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell>
                      <div>{b.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{b.customer_phone}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={b.payment_status === 'paid' ? 'success' : b.payment_status === 'partial' ? 'warning' : 'destructive'} className="capitalize">
                        {b.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(b.grand_total)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(b.totalPaid)}</TableCell>
                    <TableCell className="text-right font-semibold">{b.balanceDue > 0 ? formatCurrency(b.balanceDue) : '—'}</TableCell>
                    <TableCell className="text-right">
                      {canRecordPayment && b.balanceDue > 0 && (
                        <Button size="sm" variant="outline" onClick={() => setPaymentTarget(b)}>Record payment</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canRecordPayment && (
        <RecordPaymentDialog bill={paymentTarget} open={!!paymentTarget} onOpenChange={(v) => !v && setPaymentTarget(null)} onRecorded={refresh} />
      )}
    </div>
  )
}

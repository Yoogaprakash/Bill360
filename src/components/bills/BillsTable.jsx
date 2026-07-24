import { Download, Pencil } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { reprintBill } from '@/lib/reprintBill'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'

export default function BillsTable({ bills, showCashier = false, onEdit }) {
  const company = useAuthStore((s) => s.profile?.companies)

  const handleReprint = async (bill) => {
    try {
      await reprintBill(bill, company)
    } catch {
      toast.error('Could not regenerate PDF')
    }
  }

  const colCount = (showCashier ? 7 : 6) + (onEdit ? 1 : 0)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Bill #</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Customer</TableHead>
          {showCashier && <TableHead>Cashier</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">PDF</TableHead>
          {onEdit && <TableHead className="text-right">Edit</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {bills.length === 0 && (
          <TableRow>
            <TableCell colSpan={colCount} className="py-8 text-center text-muted-foreground">
              No bills yet.
            </TableCell>
          </TableRow>
        )}
        {bills.map((b) => (
          <TableRow key={b.id}>
            <TableCell className="font-medium">{b.bill_number}</TableCell>
            <TableCell>{new Date(b.created_at).toLocaleString('en-IN')}</TableCell>
            <TableCell>
              <div>{b.customer_name}</div>
              <div className="text-xs text-muted-foreground">{b.customer_phone}</div>
            </TableCell>
            {showCashier && <TableCell className="text-xs text-muted-foreground">{b.created_by?.slice(0, 8)}</TableCell>}
            <TableCell>
              <Badge variant={b.payment_status === 'paid' ? 'success' : b.payment_status === 'partial' ? 'warning' : 'destructive'} className="capitalize">
                {b.payment_status}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-semibold">{formatCurrency(b.grand_total)}</TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="icon" onClick={() => handleReprint(b)}>
                <Download className="h-4 w-4" />
              </Button>
            </TableCell>
            {onEdit && (
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => onEdit(b)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

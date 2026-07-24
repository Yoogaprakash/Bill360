import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, formatCurrency } from '@/lib/utils'
import { useCreditDebitLedger } from '@/hooks/useCreditDebitLedger'
import { exportLedger } from '@/lib/exportLedger'

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

export default function CreditDebitLedger() {
  const [from, setFrom] = useState(isoDate(new Date(Date.now() - 29 * 86400000)))
  const [to, setTo] = useState(isoDate(new Date()))
  const [type, setType] = useState('all') // all | credit | debit
  const [refSearch, setRefSearch] = useState('')
  const [nameSearch, setNameSearch] = useState('')
  const [phoneSearch, setPhoneSearch] = useState('')

  const { entries, loading } = useCreditDebitLedger({ from, to })

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (type !== 'all' && e.type !== type) return false
      if (refSearch && !e.referenceNo.toLowerCase().includes(refSearch.toLowerCase())) return false
      if (nameSearch && !e.partyName.toLowerCase().includes(nameSearch.toLowerCase())) return false
      if (phoneSearch && !e.partyPhone.includes(phoneSearch)) return false
      return true
    })
  }, [entries, type, refSearch, nameSearch, phoneSearch])

  // Newest first for display, but each entry keeps the running balance
  // computed chronologically in the hook.
  const display = [...filtered].reverse()

  const totalCredit = filtered.filter((e) => e.type === 'credit').reduce((s, e) => s + e.amount, 0)
  const totalDebit = filtered.filter((e) => e.type === 'debit').reduce((s, e) => s + e.amount, 0)
  const closingBalance = filtered.length ? filtered[filtered.length - 1].balance : 0

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Credit &amp; Debit</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportLedger(filtered, 'xlsx')}>Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportLedger(filtered, 'pdf')}>PDF</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-4">
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
                <SelectItem value="debit">Debit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Bill / Ref No</Label>
            <Input value={refSearch} onChange={(e) => setRefSearch(e.target.value)} placeholder="INV-0001…" className="w-36" />
          </div>
          <div className="space-y-1.5">
            <Label>Customer / Supplier</Label>
            <Input value={nameSearch} onChange={(e) => setNameSearch(e.target.value)} placeholder="Name…" className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label>Mobile No</Label>
            <Input value={phoneSearch} onChange={(e) => setPhoneSearch(e.target.value)} placeholder="98765…" className="w-36" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Credit</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalCredit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Debit</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalDebit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Closing Balance</p>
            <p className={cn('text-xl font-bold', closingBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
              {formatCurrency(closingBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Ledger ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Bill / Ref No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Mobile No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {display.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No entries match these filters.</TableCell>
                  </TableRow>
                )}
                {display.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <span className={cn('font-semibold', e.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                        {e.type === 'credit' ? 'Credit' : 'Debit'}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{e.referenceNo}</TableCell>
                    <TableCell>{e.partyName}</TableCell>
                    <TableCell className="text-muted-foreground">{e.partyPhone}</TableCell>
                    <TableCell>{new Date(e.date).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell className="text-muted-foreground">{e.method}</TableCell>
                    <TableCell className={cn('text-right font-medium', e.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                      {e.type === 'credit' ? '+' : '−'}{formatCurrency(e.amount)}
                    </TableCell>
                    <TableCell className={cn('text-right font-semibold', e.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                      {formatCurrency(e.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

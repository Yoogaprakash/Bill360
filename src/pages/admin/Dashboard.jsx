import { useEffect, useMemo, useState } from 'react'
import { IndianRupee, ShoppingBag, TrendingUp, Wallet, HandCoins, AlertTriangle } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import StatCard from '@/components/dashboard/StatCard'
import { useAdminAnalytics } from '@/hooks/useAdminAnalytics'
import { useLowStockProducts } from '@/hooks/useLowStockProducts'
import { useProducts } from '@/hooks/useProducts'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

export default function Dashboard() {
  const profile = useAuthStore((s) => s.profile)
  const { products } = useProducts()
  const { products: lowStock } = useLowStockProducts()

  const [from, setFrom] = useState(isoDate(new Date(Date.now() - 29 * 86400000)))
  const [to, setTo] = useState(isoDate(new Date()))
  const [productFilter, setProductFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [customerFilter, setCustomerFilter] = useState('')
  const [suppliers, setSuppliers] = useState([])

  useEffect(() => {
    if (!profile?.company_id) return
    supabase
      .from('suppliers')
      .select('id, name')
      .eq('company_id', profile.company_id)
      .order('name')
      .then(({ data }) => setSuppliers(data || []))
  }, [profile])

  const { bills, purchases, creditReceivable, creditPayable, loading } = useAdminAnalytics({ from, to })

  const filteredBillLines = useMemo(() => {
    const q = customerFilter.trim().toLowerCase()
    return bills
      .filter((b) => !q || b.customer_name.toLowerCase().includes(q) || b.customer_phone.includes(q))
      .flatMap((b) =>
        (b.bill_items || [])
          .filter((i) => productFilter === 'all' || i.product_id === productFilter)
          .map((i) => ({ ...i, date: b.created_at }))
      )
  }, [bills, customerFilter, productFilter])

  const filteredPurchaseLines = useMemo(() => {
    return purchases
      .filter((p) => supplierFilter === 'all' || p.supplier_id === supplierFilter)
      .flatMap((p) =>
        (p.purchase_items || [])
          .filter((i) => productFilter === 'all' || i.product_id === productFilter)
          .map((i) => ({ ...i, date: p.purchase_date }))
      )
  }, [purchases, supplierFilter, productFilter])

  const totalSales = filteredBillLines.reduce((s, l) => s + Number(l.line_total), 0)
  const totalPurchases = filteredPurchaseLines.reduce((s, l) => s + Number(l.line_total), 0)
  const grossProfit = totalSales - totalPurchases

  const chartData = useMemo(() => {
    const dayKeyOf = (d) => (typeof d === 'string' ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10))
    const byDay = new Map()
    for (const l of filteredBillLines) {
      const key = dayKeyOf(l.date)
      const row = byDay.get(key) || { sales: 0, purchases: 0 }
      row.sales += Number(l.line_total)
      byDay.set(key, row)
    }
    for (const l of filteredPurchaseLines) {
      const key = dayKeyOf(l.date)
      const row = byDay.get(key) || { sales: 0, purchases: 0 }
      row.purchases += Number(l.line_total)
      byDay.set(key, row)
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, v]) => ({ day: day.slice(5), sales: Math.round(v.sales), purchases: Math.round(v.purchases) }))
  }, [filteredBillLines, filteredPurchaseLines])

  const productBreakdown = useMemo(() => {
    const map = new Map()
    for (const l of filteredBillLines) {
      const row = map.get(l.name) || { name: l.name, qtySold: 0, revenue: 0, qtyPurchased: 0, cost: 0 }
      row.qtySold += Number(l.qty)
      row.revenue += Number(l.line_total)
      map.set(l.name, row)
    }
    for (const l of filteredPurchaseLines) {
      const row = map.get(l.name) || { name: l.name, qtySold: 0, revenue: 0, qtyPurchased: 0, cost: 0 }
      row.qtyPurchased += Number(l.qty)
      row.cost += Number(l.line_total)
      map.set(l.name, row)
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 15)
  }, [filteredBillLines, filteredPurchaseLines])

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

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
            <Label>Product</Label>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Supplier</Label>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All suppliers</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-40 flex-1 space-y-1.5">
            <Label>Customer name / phone</Label>
            <Input value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} placeholder="Search…" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Sales (period)" value={formatCurrency(totalSales)} icon={IndianRupee} tone="success" />
        <StatCard label="Purchases (period)" value={formatCurrency(totalPurchases)} icon={ShoppingBag} />
        <StatCard label="Gross Profit (period)" value={formatCurrency(grossProfit)} icon={TrendingUp} tone={grossProfit >= 0 ? 'success' : 'warning'} />
        <StatCard label="Credit Receivable" value={formatCurrency(creditReceivable)} icon={Wallet} tone="warning" />
        <StatCard label="Credit Payable" value={formatCurrency(creditPayable)} icon={HandCoins} tone="warning" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sales vs Purchases</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="sales" name="Sales" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="purchases" name="Purchases" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-foreground" /> Low stock alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStock.length === 0 && <p className="text-sm text-muted-foreground">Everything is well stocked.</p>}
            {lowStock.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{p.name}</span>
                <span className={p.stock_qty <= 0 ? 'font-medium text-destructive' : 'font-medium text-warning-foreground'}>
                  {p.stock_qty} left
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product-wise breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Qty Purchased</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productBreakdown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No activity in this range.</TableCell>
                </TableRow>
              )}
              {productBreakdown.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right">{row.qtySold || '—'}</TableCell>
                  <TableCell className="text-right">{row.revenue ? formatCurrency(row.revenue) : '—'}</TableCell>
                  <TableCell className="text-right">{row.qtyPurchased || '—'}</TableCell>
                  <TableCell className="text-right">{row.cost ? formatCurrency(row.cost) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

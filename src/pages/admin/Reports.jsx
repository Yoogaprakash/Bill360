import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/lib/utils'

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

export default function Reports() {
  const profile = useAuthStore((s) => s.profile)
  const [from, setFrom] = useState(isoDate(new Date(Date.now() - 29 * 86400000)))
  const [to, setTo] = useState(isoDate(new Date()))
  const [bills, setBills] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!profile?.company_id) return
      setLoading(true)
      const fromTs = new Date(from + 'T00:00:00').toISOString()
      const toTs = new Date(to + 'T23:59:59').toISOString()

      const { data: billsData } = await supabase
        .from('bills')
        .select('id, grand_total, created_at')
        .eq('company_id', profile.company_id)
        .gte('created_at', fromTs)
        .lte('created_at', toTs)
        .order('created_at')

      const ids = (billsData || []).map((b) => b.id)
      let itemsData = []
      if (ids.length > 0) {
        const { data } = await supabase.from('bill_items').select('name, qty, line_total, bill_id').in('bill_id', ids)
        itemsData = data || []
      }

      setBills(billsData || [])
      setItems(itemsData)
      setLoading(false)
    }
    load()
  }, [profile, from, to])

  const dailyRevenue = useMemo(() => {
    const map = {}
    for (const b of bills) {
      const day = b.created_at.slice(0, 10)
      map[day] = (map[day] || 0) + Number(b.grand_total)
    }
    return Object.entries(map).map(([day, revenue]) => ({ day: day.slice(5), revenue: Math.round(revenue) }))
  }, [bills])

  const topProducts = useMemo(() => {
    const map = {}
    for (const i of items) {
      if (!map[i.name]) map[i.name] = { name: i.name, qty: 0, revenue: 0 }
      map[i.name].qty += Number(i.qty)
      map[i.name].revenue += Number(i.line_total)
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  }, [items])

  const totalRevenue = bills.reduce((sum, b) => sum + Number(b.grand_total), 0)

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold">Reports</h1>

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
          <div className="ml-auto text-right">
            <p className="text-xs text-muted-foreground">Total revenue in range</p>
            <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Revenue trend</CardTitle></CardHeader>
          <CardContent className="h-72">
            {loading ? <p className="text-muted-foreground">Loading…</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="revenue" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top products</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-right">{p.qty}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

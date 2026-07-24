import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useProducts } from '@/hooks/useProducts'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export default function Stock() {
  const profile = useAuthStore((s) => s.profile)
  const { products, loading, refresh } = useProducts()
  const [adjustments, setAdjustments] = useState({})
  const [movements, setMovements] = useState([])

  useEffect(() => {
    async function loadMovements() {
      const { data } = await supabase
        .from('stock_movements')
        .select('*, products(name)')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(20)
      setMovements(data || [])
    }
    if (profile?.company_id) loadMovements()
  }, [profile])

  const handleAdjust = async (product) => {
    const delta = Number(adjustments[product.id])
    if (!delta) return
    const { error: prodErr } = await supabase
      .from('products')
      .update({ stock_qty: Number(product.stock_qty) + delta })
      .eq('id', product.id)
    if (prodErr) return toast.error(prodErr.message)

    await supabase.from('stock_movements').insert({
      company_id: profile.company_id,
      product_id: product.id,
      change_qty: delta,
      reason: 'adjustment',
      created_by: profile.id,
    })

    toast.success(`${product.name} stock updated`)
    setAdjustments((prev) => ({ ...prev, [product.id]: '' }))
    refresh()
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold">Stock Management</h1>

      <Card>
        <CardHeader>
          <CardTitle>Adjust stock</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Current stock</TableHead>
                  <TableHead className="text-right">Adjust by</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  const threshold = p.low_stock_threshold ?? 5
                  const low = p.stock_qty <= threshold
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={p.stock_qty <= 0 ? 'destructive' : low ? 'warning' : 'secondary'}>{p.stock_qty}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className="ml-auto h-8 w-24 text-right"
                          placeholder="+/-"
                          value={adjustments[p.id] || ''}
                          onChange={(e) => setAdjustments((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleAdjust(p)}>Apply</Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent stock movements</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.products?.name}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{m.reason}</TableCell>
                  <TableCell className={`text-right font-medium ${m.change_qty < 0 ? 'text-destructive' : 'text-success'}`}>
                    {m.change_qty > 0 ? `+${m.change_qty}` : m.change_qty}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(m.created_at).toLocaleString('en-IN')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

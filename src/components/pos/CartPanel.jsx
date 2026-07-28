import { useMemo } from 'react'
import { Minus, Plus, Trash2, PlusCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency, round2 } from '@/lib/utils'
import { useCartStore, computeTotals } from '@/store/cartStore'

export default function CartPanel({ gstEnabled, onCheckout, onAddCustom, onClear }) {
  const items = useCartStore((s) => s.items)
  const { lines, subtotal, discountTotal, gstTotal, grandTotal } = useMemo(
    () => computeTotals(items, gstEnabled),
    [items, gstEnabled]
  )
  const updateQty = useCartStore((s) => s.updateQty)
  const updateDiscount = useCartStore((s) => s.updateDiscount)
  const removeItem = useCartStore((s) => s.removeItem)

  // Custom items have no stockQty (null) and aren't capped. Catalog items are
  // capped at their available stock, whether changed via +/- or typed in directly.
  const handleQtyChange = (item, requestedQty) => {
    const qty = round2(Math.max(0, requestedQty))
    if (item.stockQty != null && qty > item.stockQty) {
      toast.error(`Only ${item.stockQty} ${item.uom} in stock`)
      updateQty(item.key, item.stockQty)
      return
    }
    updateQty(item.key, qty)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="font-semibold">Current Bill ({lines.length})</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onAddCustom}>
            <PlusCircle className="h-4 w-4" />
            Custom item
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear} disabled={lines.length === 0}>
            Clear
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {lines.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <p>Cart is empty</p>
            <p className="mt-1 text-xs">Tap a product to add it to the bill</p>
          </div>
        )}
        <ul className="space-y-3">
          {lines.map((item) => (
            <li key={item.key} className="rounded-lg border p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(item.unitPrice)}/{item.uom} × {item.qty} {item.uom}
                    {gstEnabled && item.gstRate > 0 ? ` · GST ${item.gstRate}%` : ''}
                  </p>
                </div>
                <button onClick={() => removeItem(item.key)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleQtyChange(item, item.qty - item.qtyStep)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="number"
                    value={item.qty}
                    min={0}
                    max={item.stockQty ?? undefined}
                    step={item.qtyStep}
                    onChange={(e) => handleQtyChange(item, Number(e.target.value))}
                    className="h-7 w-16 text-center"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={item.stockQty != null && item.qty >= item.stockQty}
                    onClick={() => handleQtyChange(item, item.qty + item.qtyStep)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">Disc%</span>
                  <Input
                    type="number"
                    value={item.discountPct}
                    min={0}
                    max={100}
                    onChange={(e) => updateDiscount(item.key, e.target.value)}
                    className="h-7 w-14 text-center"
                  />
                </div>

                <span className="w-20 text-right text-sm font-semibold">{formatCurrency(item.total)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1.5 border-t p-3 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {discountTotal > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Discount</span>
            <span>-{formatCurrency(discountTotal)}</span>
          </div>
        )}
        {gstEnabled && (
          <div className="flex justify-between text-muted-foreground">
            <span>GST</span>
            <span>{formatCurrency(gstTotal)}</span>
          </div>
        )}
        <div className="flex justify-between border-t pt-1.5 text-base font-bold">
          <span>Total</span>
          <span>{formatCurrency(grandTotal)}</span>
        </div>
        <Button className="mt-2 w-full" size="lg" disabled={lines.length === 0} onClick={onCheckout}>
          Generate Bill <kbd className="ml-2 rounded bg-black/10 px-1.5 text-[10px] font-normal">Ctrl+Enter</kbd>
        </Button>
      </div>
    </div>
  )
}

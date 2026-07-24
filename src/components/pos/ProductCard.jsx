import { Plus, ImageOff, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { formatCurrency, cn } from '@/lib/utils'

function stockPill(outOfStock, lowStock) {
  if (outOfStock) return 'border-red-500 text-red-600 dark:border-red-400 dark:text-red-400'
  if (lowStock) return 'border-amber-500 text-amber-600 dark:border-amber-400 dark:text-amber-400'
  return 'border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
}

export default function ProductCard({ product, onAdd }) {
  const threshold = product.low_stock_threshold ?? 5
  const outOfStock = product.stock_qty <= 0
  const lowStock = !outOfStock && product.stock_qty <= threshold
  const uom = product.unit_type === 'weight' ? product.weight_unit || 'kg' : 'pcs'

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => !outOfStock && onAdd(product)}
      onKeyDown={(e) => e.key === 'Enter' && !outOfStock && onAdd(product)}
      className={cn(
        'group relative flex cursor-pointer flex-col gap-0 overflow-hidden rounded-2xl border p-0 transition-all hover:-translate-y-0.5 hover:shadow-lg',
        outOfStock && 'cursor-not-allowed opacity-70 hover:translate-y-0 hover:shadow-none'
      )}
    >
      {/* Stock pill — outlined style, color-coded: red (out) / orange (at/under limit) / green (healthy) */}
      <div className="flex items-center justify-between gap-1 px-2 pt-2">
        <span className={cn('rounded-full border bg-background px-2 py-0.5 text-[11px] font-semibold', stockPill(outOfStock, lowStock))}>
          {product.stock_qty} {uom}
        </span>
        {product.batchWarning && (
          <span className="flex items-center gap-0.5 rounded-full border border-red-500 bg-background px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:border-red-400 dark:text-red-400">
            <AlertTriangle className="h-3 w-3" />
          </span>
        )}
      </div>

      <div className="relative mt-1.5 aspect-square w-full overflow-hidden bg-muted">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
        {!outOfStock && (
          <div
            onClick={(e) => { e.stopPropagation(); onAdd(product) }}
            className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-md transition-transform active:scale-90"
          >
            <Plus className="h-4.5 w-4.5" />
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <span className="rounded-md bg-foreground/80 px-2 py-1 text-xs font-semibold text-background">Out of stock</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-0.5 p-3">
        {product.brand && <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{product.brand}</p>}
        <p className="line-clamp-2 text-sm font-medium leading-tight">{product.name}</p>
        <div className="mt-auto pt-1.5">
          <span className="text-base font-bold text-brand">
            {formatCurrency(product.unit_price)}
            {product.unit_type === 'weight' && <span className="text-xs font-normal text-muted-foreground">/{uom}</span>}
          </span>
        </div>
      </div>
    </Card>
  )
}

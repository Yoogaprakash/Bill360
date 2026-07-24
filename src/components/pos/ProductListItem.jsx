import { Plus, ImageOff, AlertTriangle } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

function stockPill(outOfStock, lowStock) {
  if (outOfStock) return 'border-red-500 text-red-600 dark:border-red-400 dark:text-red-400'
  if (lowStock) return 'border-amber-500 text-amber-600 dark:border-amber-400 dark:text-amber-400'
  return 'border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
}

export default function ProductListItem({ product, onAdd }) {
  const threshold = product.low_stock_threshold ?? 5
  const outOfStock = product.stock_qty <= 0
  const lowStock = !outOfStock && product.stock_qty <= threshold
  const uom = product.unit_type === 'weight' ? product.weight_unit || 'kg' : 'pcs'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !outOfStock && onAdd(product)}
      onKeyDown={(e) => e.key === 'Enter' && !outOfStock && onAdd(product)}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-2 transition-colors hover:bg-accent/50',
        outOfStock && 'cursor-not-allowed opacity-70 hover:bg-card'
      )}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageOff className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {product.brand && <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{product.brand}</p>}
        <p className="truncate text-sm font-medium leading-tight">{product.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-bold text-brand">
            {formatCurrency(product.unit_price)}
            {product.unit_type === 'weight' && <span className="text-xs font-normal text-muted-foreground">/{uom}</span>}
          </span>
          <span className={cn('rounded-full border px-1.5 py-0 text-[10px] font-semibold', stockPill(outOfStock, lowStock))}>
            {product.stock_qty} {uom}
          </span>
          {product.batchWarning && <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />}
        </div>
      </div>

      {!outOfStock && (
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(product) }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-sm active:scale-90"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

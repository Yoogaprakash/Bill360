import { useEffect, useMemo, useRef, useState } from 'react'
import { ShoppingCart, ChevronDown, GripHorizontal } from 'lucide-react'
import { useCartStore, computeTotals } from '@/store/cartStore'
import { formatCurrency } from '@/lib/utils'
import CartPanel from '@/components/pos/CartPanel'

const DRAG_THRESHOLD = 6 // px of movement before a pointer-down counts as a drag, not a tap

// Mobile-only floating cart: collapses to a draggable pill you can park out of
// the way of the product grid, expands to a bottom sheet with the full
// CartPanel. Desktop keeps the static side panel (rendered separately in POS).
export default function FloatingCart({ gstEnabled, onCheckout, onAddCustom, onClear }) {
  const items = useCartStore((s) => s.items)
  const { lines, grandTotal } = useMemo(() => computeTotals(items, gstEnabled), [items, gstEnabled])

  const [expanded, setExpanded] = useState(false)
  const [pos, setPos] = useState({ x: 16, y: 16 }) // offset from bottom-right, in px
  const dragState = useRef(null)
  // Mobile browsers can fire a synthetic "ghost click" ~shortly after a touch
  // ends, at the same screen coordinates — which, once expanded, land right on
  // the full-width Generate Bill button (it now occupies the same bottom-right
  // corner the FAB was just tapped at). Ignoring taps on it for a beat after
  // opening filters that out without needing the user to notice anything.
  const openedAtRef = useRef(0)

  useEffect(() => {
    // Snap into view if the viewport shrinks below the current offset (e.g. rotation).
    const clamp = () => {
      setPos((p) => ({
        x: Math.min(p.x, window.innerWidth - 80),
        y: Math.min(p.y, window.innerHeight - 80),
      }))
    }
    window.addEventListener('resize', clamp)
    return () => window.removeEventListener('resize', clamp)
  }, [])

  const handlePointerDown = (e) => {
    // Suppresses the browser's compatibility mouse/click events that would
    // otherwise follow this touch — see the ghost-click note on openedAtRef above.
    e.preventDefault()
    dragState.current = { startX: e.clientX, startY: e.clientY, origin: { ...pos }, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e) => {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) dragState.current.moved = true
    if (!dragState.current.moved) return
    setPos({
      x: Math.min(Math.max(8, dragState.current.origin.x - dx), window.innerWidth - 72),
      y: Math.min(Math.max(8, dragState.current.origin.y - dy), window.innerHeight - 72),
    })
  }

  const handlePointerUp = () => {
    const wasDrag = dragState.current?.moved
    dragState.current = null
    if (!wasDrag) {
      openedAtRef.current = Date.now()
      setExpanded(true)
    }
  }

  // Belt-and-suspenders guard for the ghost-click above: even if one slips
  // through, ignore a Generate Bill tap in the first instant after opening —
  // a real tap on that button always happens well after the sheet is visible.
  const guardedCheckout = () => {
    if (Date.now() - openedAtRef.current < 400) return
    onCheckout()
  }

  if (expanded) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col justify-end lg:hidden">
        <div className="absolute inset-0 bg-black/30" onClick={() => setExpanded(false)} />
        <div className="relative z-10 flex h-[75vh] flex-col rounded-t-2xl border bg-background shadow-2xl">
          <button
            onClick={() => setExpanded(false)}
            className="flex w-full shrink-0 items-center justify-center gap-1 border-b py-2 text-xs text-muted-foreground"
          >
            <GripHorizontal className="h-4 w-4" /> Minimize <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {/* flex-1 gives this a definite height so CartPanel's own h-full/flex-1
              scroll region works and the Generate Bill footer stays pinned & visible
              instead of being pushed off-screen and clipped by overflow-hidden. */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <CartPanel gstEnabled={gstEnabled} onCheckout={guardedCheckout} onAddCustom={onAddCustom} onClear={onClear} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ right: pos.x, bottom: pos.y }}
      className="fixed z-40 flex touch-none items-center gap-2 rounded-full bg-brand px-4 py-3 text-brand-foreground shadow-lg active:scale-95 lg:hidden"
    >
      <span className="relative">
        <ShoppingCart className="h-5 w-5" />
        {lines.length > 0 && (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {lines.length}
          </span>
        )}
      </span>
      {lines.length > 0 && <span className="text-sm font-semibold">{formatCurrency(grandTotal)}</span>}
    </button>
  )
}

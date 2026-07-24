import { create } from 'zustand'
import { round2 } from '@/lib/utils'

let customIdCounter = 0
const nextCustomId = () => `custom-${Date.now()}-${customIdCounter++}`

function computeLine(item, gstEnabled) {
  const base = round2(item.qty * item.unitPrice)
  const discountAmt = round2(base * (item.discountPct / 100))
  const taxable = round2(base - discountAmt)
  const gstAmt = gstEnabled ? round2(taxable * (item.gstRate / 100)) : 0
  const total = round2(taxable + gstAmt)
  return { base, discountAmt, taxable, gstAmt, total }
}

// Pure function so components can wrap it in useMemo(() => computeTotals(items, gstEnabled), [items, gstEnabled])
// instead of calling it inside a Zustand selector — a selector that returns a
// freshly-built object every call makes useSyncExternalStore see a "changed"
// snapshot on every render, which is an infinite render loop.
export function computeTotals(items, gstEnabled = true) {
  let subtotal = 0
  let discountTotal = 0
  let gstTotal = 0
  let grandTotal = 0
  const lines = items.map((item) => {
    const line = computeLine(item, gstEnabled)
    subtotal += line.base
    discountTotal += line.discountAmt
    gstTotal += line.gstAmt
    grandTotal += line.total
    return { ...item, ...line }
  })
  return {
    lines,
    subtotal: round2(subtotal),
    discountTotal: round2(discountTotal),
    gstTotal: round2(gstTotal),
    grandTotal: round2(grandTotal),
  }
}

export const useCartStore = create((set, get) => ({
  items: [], // { key, productId, name, unitPrice, qty, discountPct, gstRate, stockQty, isCustom, unitType, uom, qtyStep }

  addProduct: (product) => {
    const isWeight = product.unit_type === 'weight'
    const weightUnit = product.weight_unit || 'kg'
    // Weight items step in small fractions (0.25kg / 50g) rather than whole units per click.
    const qtyStep = isWeight ? (weightUnit === 'g' ? 50 : 0.25) : 1
    const uom = isWeight ? weightUnit : 'pcs'

    set((state) => {
      const existing = state.items.find((i) => i.productId === product.id)
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === product.id ? { ...i, qty: round2(i.qty + qtyStep) } : i
          ),
        }
      }
      return {
        items: [
          ...state.items,
          {
            key: product.id,
            productId: product.id,
            name: product.name,
            unitPrice: Number(product.unit_price),
            qty: qtyStep,
            discountPct: 0,
            gstRate: Number(product.gst_rate) || 0,
            stockQty: Number(product.stock_qty),
            isCustom: false,
            unitType: isWeight ? 'weight' : 'unit',
            uom,
            qtyStep,
          },
        ],
      }
    })
  },

  addCustomItem: ({ name, unitPrice, gstRate = 0, qty = 1 }) => {
    set((state) => ({
      items: [
        ...state.items,
        {
          key: nextCustomId(),
          productId: null,
          name,
          unitPrice: Number(unitPrice) || 0,
          qty: Number(qty) || 1,
          discountPct: 0,
          gstRate: Number(gstRate) || 0,
          stockQty: null,
          isCustom: true,
          unitType: 'unit',
          uom: 'pcs',
          qtyStep: 1,
        },
      ],
    }))
  },

  updateQty: (key, qty) => {
    set((state) => ({
      items: state.items
        .map((i) => (i.key === key ? { ...i, qty: round2(Math.max(0, qty)) } : i))
        .filter((i) => i.qty > 0),
    }))
  },

  updateDiscount: (key, discountPct) => {
    const pct = Math.min(100, Math.max(0, Number(discountPct) || 0))
    set((state) => ({
      items: state.items.map((i) => (i.key === key ? { ...i, discountPct: pct } : i)),
    }))
  },

  removeItem: (key) => {
    set((state) => ({ items: state.items.filter((i) => i.key !== key) }))
  },

  clearCart: () => set({ items: [] }),

  // Fully replaces the cart with an already-shaped item list — used when
  // converting a quotation to a bill (loads its lines in, then CheckoutModal
  // opens straight to the payment step, reusing the normal checkout path).
  replaceItems: (items) => set({ items }),

  // Non-reactive convenience for use inside event handlers (e.g. checkout submit),
  // where a fresh computed object each call is fine. Do NOT call this inside a
  // Zustand selector in a component body — see computeTotals() above for that.
  getTotals: (gstEnabled = true) => computeTotals(get().items, gstEnabled),
}))

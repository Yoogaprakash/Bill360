import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Search, ScanLine, LayoutGrid, List } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import ProductCard from '@/components/pos/ProductCard'
import ProductListItem from '@/components/pos/ProductListItem'
import CartPanel from '@/components/pos/CartPanel'
import FloatingCart from '@/components/pos/FloatingCart'
import CustomItemDialog from '@/components/pos/CustomItemDialog'
import CheckoutModal from '@/components/pos/CheckoutModal'
import { useProducts } from '@/hooks/useProducts'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { toast } from 'sonner'

// html5-qrcode is only needed once a user actually opens the scanner —
// keep it out of the POS page's initial bundle.
const ScanProductDialog = lazy(() => import('@/components/pos/ScanProductDialog'))

export default function POS() {
  const { products, categories, loading, refresh } = useProducts()
  const profile = useAuthStore((s) => s.profile)
  const gstEnabled = profile?.companies?.gst_enabled ?? true
  const items = useCartStore((s) => s.items)
  const addProduct = useCartStore((s) => s.addProduct)
  const clearCart = useCartStore((s) => s.clearCart)

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [customOpen, setCustomOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('bill360-pos-view') || 'grid')
  const searchRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('bill360-pos-view', viewMode)
  }, [viewMode])

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = activeCategory === 'all' || p.category_id === activeCategory
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [products, activeCategory, search])

  const handleAdd = (product) => {
    const inCart = items.find((i) => i.productId === product.id)
    const qtyInCart = inCart?.qty || 0
    const isWeight = product.unit_type === 'weight'
    const step = isWeight ? (product.weight_unit === 'g' ? 50 : 0.25) : 1
    const uom = isWeight ? product.weight_unit || 'kg' : 'pcs'
    if (qtyInCart + step > product.stock_qty) {
      toast.error(`Only ${product.stock_qty} ${uom} in stock`)
      return
    }
    addProduct(product)
  }

  const handleClear = () => {
    if (items.length === 0) return
    if (confirm('Clear the current bill?')) clearCart()
  }

  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        if (items.length > 0) setCheckoutOpen(true)
      } else if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Backspace') {
        e.preventDefault()
        handleClear()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [items])

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Product listing */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-col gap-3 border-b bg-background p-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products… (press / to focus)"
                className="pl-9"
              />
            </div>
            <Button type="button" variant="outline" onClick={() => setScanOpen(true)}>
              <ScanLine className="h-4 w-4" /> Scan
            </Button>
            <div className="flex shrink-0 items-center gap-0.5 rounded-md border p-0.5">
              <button
                type="button"
                title="Grid view"
                onClick={() => setViewMode('grid')}
                className={cn('flex h-7 w-7 items-center justify-center rounded', viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="List view"
                onClick={() => setViewMode('list')}
                className={cn('flex h-7 w-7 items-center justify-center rounded', viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              {categories.map((c) => (
                <TabsTrigger key={c.id} value={c.id}>
                  {c.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="p-8 text-center text-muted-foreground">Loading products…</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">No products found.</p>
          ) : viewMode === 'list' ? (
            <div className="space-y-2">
              {filtered.map((p) => (
                <ProductListItem key={p.id} product={p} onAdd={handleAdd} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} onAdd={handleAdd} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart panel — static side panel on desktop, floating/draggable sheet on mobile */}
      <div className="hidden shrink-0 border-l bg-background lg:block lg:w-96">
        <CartPanel
          gstEnabled={gstEnabled}
          onCheckout={() => setCheckoutOpen(true)}
          onAddCustom={() => setCustomOpen(true)}
          onClear={handleClear}
        />
      </div>
      <FloatingCart
        gstEnabled={gstEnabled}
        onCheckout={() => setCheckoutOpen(true)}
        onAddCustom={() => setCustomOpen(true)}
        onClear={handleClear}
      />

      <CustomItemDialog open={customOpen} onOpenChange={setCustomOpen} gstEnabled={gstEnabled} />
      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        gstEnabled={gstEnabled}
        onComplete={refresh}
      />
      {scanOpen && (
        <Suspense fallback={null}>
          <ScanProductDialog open={scanOpen} onOpenChange={setScanOpen} products={products} onScan={handleAdd} />
        </Suspense>
      )}
    </div>
  )
}

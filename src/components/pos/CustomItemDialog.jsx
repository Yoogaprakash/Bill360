import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCartStore } from '@/store/cartStore'

export default function CustomItemDialog({ open, onOpenChange, gstEnabled }) {
  const addCustomItem = useCartStore((s) => s.addCustomItem)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [qty, setQty] = useState('1')
  const [gstRate, setGstRate] = useState('0')

  const reset = () => {
    setName('')
    setPrice('')
    setQty('1')
    setGstRate('0')
  }

  const handleAdd = () => {
    if (!name.trim() || Number(price) <= 0) return
    addCustomItem({ name: name.trim(), unitPrice: Number(price), qty: Number(qty) || 1, gstRate: Number(gstRate) || 0 })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add custom item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Item name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gift wrapping" autoFocus />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Price</Label>
              <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Qty</Label>
              <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            {gstEnabled && (
              <div className="space-y-1.5">
                <Label>GST %</Label>
                <Input type="number" min="0" value={gstRate} onChange={(e) => setGstRate(e.target.value)} />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd}>Add to bill</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

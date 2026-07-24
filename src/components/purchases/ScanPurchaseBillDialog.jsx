import { useState } from 'react'
import { createWorker } from 'tesseract.js'
import { toast } from 'sonner'
import { ScanLine } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { parsePurchaseBillText } from '@/lib/parsePurchaseBillText'

export default function ScanPurchaseBillDialog({ open, onOpenChange, onScanned }) {
  const [image, setImage] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [rawText, setRawText] = useState('')
  const [parsedCount, setParsedCount] = useState(null)

  const reset = () => {
    setImage(null)
    setScanning(false)
    setProgress(0)
    setRawText('')
    setParsedCount(null)
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(URL.createObjectURL(file))
    setScanning(true)
    setRawText('')
    setParsedCount(null)
    try {
      const worker = await createWorker('eng', undefined, {
        logger: (m) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100))
        },
      })
      const { data } = await worker.recognize(file)
      await worker.terminate()
      setRawText(data.text)
      const { items } = parsePurchaseBillText(data.text)
      setParsedCount(items.length)
    } catch {
      toast.error('OCR failed — you can still type the raw text below manually, or cancel and enter items by hand.')
    } finally {
      setScanning(false)
    }
  }

  const handleUseText = () => {
    const { supplierNameGuess, items } = parsePurchaseBillText(rawText)
    if (items.length === 0) {
      toast.error('Couldn’t detect any item lines — try a clearer photo, or continue and add items manually.')
    }
    onScanned({ supplierNameGuess, items })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5" /> Scan purchase bill</DialogTitle>
          <DialogDescription>
            Photograph or upload a supplier's bill. OCR runs entirely in your browser — nothing is uploaded anywhere.
            This is a best-effort draft: always review the extracted items before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Bill photo</Label>
            <Input type="file" accept="image/*" capture="environment" onChange={handleFile} disabled={scanning} />
          </div>

          {image && <img src={image} alt="Purchase bill" className="max-h-48 w-full rounded-md border object-contain" />}

          {scanning && (
            <p className="text-sm text-muted-foreground">Reading text… {progress}%</p>
          )}

          {!scanning && rawText && (
            <div className="space-y-1.5">
              <Label>
                Extracted text {parsedCount !== null && `— detected ${parsedCount} possible item line(s)`}
              </Label>
              <Textarea value={rawText} onChange={(e) => setRawText(e.target.value)} rows={6} className="font-mono text-xs" />
              <p className="text-xs text-muted-foreground">
                You can edit this text before continuing — item detection re-runs on whatever text is here.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>Cancel</Button>
          <Button onClick={handleUseText} disabled={scanning || !rawText}>
            Continue to review items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

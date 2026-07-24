import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const READER_ID = 'bill360-qr-reader'
const MAX_ELEMENT_WAIT_MS = 2000

function describeCameraError(err) {
  if (!window.isSecureContext) {
    return 'Camera access needs a secure connection (https://, or localhost during development). This page was loaded over an insecure connection.'
  }
  const name = err?.name || ''
  if (name === 'NotAllowedError') return 'Camera permission was denied. Allow camera access for this site in your browser settings and try again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No usable camera was found on this device.'
  if (name === 'NotReadableError') return 'The camera is already in use by another app.'
  return err?.message || 'Could not access the camera.'
}

// Waits for the reader <div> to actually exist in the DOM before handing it
// to html5-qrcode — its constructor does a synchronous getElementById and
// throws (uncaught, outside any promise) if the element isn't there yet,
// which can happen the instant this dialog mounts inside a Suspense/Radix
// Portal boundary.
function waitForElement(id, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      const el = document.getElementById(id)
      if (el) return resolve(el)
      if (Date.now() - start > timeoutMs) return reject(new Error('Scanner UI did not mount in time.'))
      requestAnimationFrame(check)
    }
    check()
  })
}

// Product QR/barcode labels (see ProductQrDialog) encode the product's SKU,
// falling back to its id if no SKU is set — this looks that value up against
// the currently loaded product list and adds it to the cart on a match.
export default function ScanProductDialog({ open, onOpenChange, products, onScan }) {
  const scannerRef = useRef(null)
  const handledRef = useRef(false)
  const [status, setStatus] = useState('starting') // 'starting' | 'live' | 'error'
  const [errorMessage, setErrorMessage] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open) return
    handledRef.current = false
    setStatus('starting')
    setErrorMessage('')

    let cancelled = false

    waitForElement(READER_ID, MAX_ELEMENT_WAIT_MS)
      .then((el) => {
        if (cancelled) return
        let scanner
        try {
          scanner = new Html5Qrcode(el.id)
        } catch (err) {
          setStatus('error')
          setErrorMessage(describeCameraError(err))
          return
        }
        scannerRef.current = scanner

        scanner
          .start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              if (handledRef.current) return
              const value = decodedText.trim()
              const product = products.find((p) => p.sku === value || p.id === value)
              if (!product) {
                toast.error(`No product matches "${value}"`)
                return
              }
              handledRef.current = true
              onScan(product)
              onOpenChange(false)
            },
            () => {} // per-frame "no code found" callback — silently ignore
          )
          .then(() => {
            if (!cancelled) setStatus('live')
          })
          .catch((err) => {
            if (cancelled) return
            setStatus('error')
            setErrorMessage(describeCameraError(err))
          })
      })
      .catch((err) => {
        if (cancelled) return
        setStatus('error')
        setErrorMessage(err.message || 'Could not start the scanner.')
      })

    return () => {
      cancelled = true
      const scanner = scannerRef.current
      scannerRef.current = null
      if (scanner) {
        scanner.stop().then(() => scanner.clear()).catch(() => {})
      }
    }
  }, [open, attempt])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scan product</DialogTitle>
          <DialogDescription>
            {status === 'error' ? 'Camera unavailable' : 'Point the camera at a product’s QR/barcode label — it adds to the cart automatically.'}
          </DialogDescription>
        </DialogHeader>

        <div id={READER_ID} className="h-72 w-full overflow-hidden rounded-md bg-black" />

        {status === 'starting' && (
          <p className="text-center text-sm text-muted-foreground">Starting camera…</p>
        )}
        {status === 'error' && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-destructive">{errorMessage}</p>
            <Button variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)}>
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

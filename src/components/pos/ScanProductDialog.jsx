import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { toast } from 'sonner'
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { playBeep, playDuplicateBeep } from '@/lib/beep'
import { cn } from '@/lib/utils'

const READER_ID = 'bill360-qr-reader'
const MAX_ELEMENT_WAIT_MS = 2000
// How long the "added"/"already scanned" overlay stays up before the scanner
// is ready to catch the next code.
const FEEDBACK_MS = 900
// A held product stays in frame for way longer than one decode — without this,
// the same barcode gets re-added every ~1s as long as it's in view. Any repeat
// read of the *same* code within this window is treated as "still the same
// item, don't add it again", not a fresh scan.
const DUPLICATE_COOLDOWN_MS = 2500

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
// Stays open after each match (instead of closing) so several items can be
// scanned back-to-back — the camera keeps running between adds.
export default function ScanProductDialog({ open, onOpenChange, products, onScan }) {
  const scannerRef = useRef(null)
  const handledRef = useRef(false)
  const feedbackTimerRef = useRef(null)
  const lastScannedRef = useRef({ value: null, ts: 0 })
  const [status, setStatus] = useState('starting') // 'starting' | 'live' | 'error'
  const [errorMessage, setErrorMessage] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [lastAdded, setLastAdded] = useState(null) // { id, name, ts, duplicate }
  const [scanCount, setScanCount] = useState(0)

  useEffect(() => {
    if (!open) return
    handledRef.current = false
    lastScannedRef.current = { value: null, ts: 0 }
    setStatus('starting')
    setErrorMessage('')
    setLastAdded(null)
    setScanCount(0)

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
              const product = products.find((p) => p.qr_code === value || p.sku === value || p.id === value)
              if (!product) {
                toast.error(`No product matches "${value}"`)
                return
              }

              const now = Date.now()
              const isDuplicate = lastScannedRef.current.value === value && now - lastScannedRef.current.ts < DUPLICATE_COOLDOWN_MS
              handledRef.current = true
              lastScannedRef.current = { value, ts: now }

              if (isDuplicate) {
                playDuplicateBeep()
                setLastAdded({ id: product.id, name: product.name, ts: now, duplicate: true })
              } else {
                playBeep()
                onScan(product)
                setScanCount((n) => n + 1)
                setLastAdded({ id: product.id, name: product.name, ts: now, duplicate: false })
              }

              clearTimeout(feedbackTimerRef.current)
              feedbackTimerRef.current = setTimeout(() => {
                handledRef.current = false
                setLastAdded(null)
              }, FEEDBACK_MS)
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
      clearTimeout(feedbackTimerRef.current)
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
          <DialogTitle>
            Scan product
            {scanCount > 0 && (
              <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand align-middle">
                {scanCount} added
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {status === 'error'
              ? 'Camera unavailable'
              : 'Point the camera at a product’s QR/barcode label — it adds to the cart automatically. Move to the next item after each scan; the same label held in view won’t be added twice.'}
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-72 w-full overflow-hidden rounded-md bg-black">
          <div id={READER_ID} className="h-full w-full" />

          {lastAdded && (
            <div
              key={lastAdded.ts}
              className={cn(
                'absolute inset-0 flex flex-col items-center justify-center gap-2 text-white animate-in fade-in-0 zoom-in-95 duration-150',
                lastAdded.duplicate ? 'bg-amber-600/90' : 'bg-emerald-600/90'
              )}
            >
              {lastAdded.duplicate ? <AlertTriangle className="h-12 w-12" /> : <CheckCircle2 className="h-12 w-12" />}
              <p className="px-4 text-center text-sm font-semibold">
                {lastAdded.duplicate ? `${lastAdded.name} already added` : `${lastAdded.name} added`}
              </p>
              {lastAdded.duplicate && (
                <p className="px-4 text-center text-xs text-white/85">Move to the next product to scan again</p>
              )}
            </div>
          )}
        </div>

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

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

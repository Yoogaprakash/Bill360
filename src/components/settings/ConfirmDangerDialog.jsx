import { useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Requires typing an exact phrase before the destructive action is enabled. */
export default function ConfirmDangerDialog({ open, onOpenChange, title, description, confirmPhrase, onConfirm }) {
  const [typed, setTyped] = useState('')
  const [running, setRunning] = useState(false)

  const handleConfirm = async () => {
    setRunning(true)
    try {
      await onConfirm()
      onOpenChange(false)
      setTyped('')
    } catch (err) {
      toast.error(err.message || 'Action failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setTyped('') }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>
            Type <span className="font-mono font-semibold">{confirmPhrase}</span> to confirm
          </Label>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={typed !== confirmPhrase || running} onClick={handleConfirm}>
            {running ? 'Deleting…' : title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import ConfirmDangerDialog from '@/components/settings/ConfirmDangerDialog'

export default function CompanySettings() {
  const profile = useAuthStore((s) => s.profile)
  const loadProfile = useAuthStore((s) => s.loadProfile)
  const [form, setForm] = useState(null)
  const [logoFile, setLogoFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dangerAction, setDangerAction] = useState(null) // 'bills' | 'purchases' | 'products'

  useEffect(() => {
    if (profile?.companies) setForm(profile.companies)
  }, [profile])

  const clearAllBills = async () => {
    const { error } = await supabase.from('bills').delete().eq('company_id', profile.company_id)
    if (error) throw error
    toast.success('All bills cleared')
  }

  const clearAllPurchases = async () => {
    const { error } = await supabase.from('purchases').delete().eq('company_id', profile.company_id)
    if (error) throw error
    toast.success('All purchases cleared')
  }

  const clearAllProducts = async () => {
    const { error } = await supabase.from('products').delete().eq('company_id', profile.company_id)
    if (error) throw error
    toast.success('All products cleared')
  }

  if (!form) return <div className="p-6 text-muted-foreground">Loading…</div>

  const set = (key) => (e) => setForm({ ...form, [key]: e.target?.value ?? e })

  const handleSave = async () => {
    setSaving(true)
    try {
      let logoUrl = form.logo_url
      if (logoFile) {
        const path = `${form.id}/${Date.now()}-${logoFile.name}`
        const { error: uploadErr } = await supabase.storage.from('company-logos').upload(path, logoFile)
        if (uploadErr) throw uploadErr
        logoUrl = supabase.storage.from('company-logos').getPublicUrl(path).data.publicUrl
      }

      const { error } = await supabase
        .from('companies')
        .update({
          name: form.name,
          legal_name: form.legal_name,
          address: form.address,
          phone: form.phone,
          email: form.email,
          gst_number: form.gst_number,
          gst_enabled: form.gst_enabled,
          default_gst_rate: Number(form.default_gst_rate) || 0,
          bill_series: form.bill_series,
          upi_id: form.upi_id,
          footer_note: form.footer_note,
          low_stock_threshold: Number(form.low_stock_threshold) || 5,
          logo_url: logoUrl || null,
        })
        .eq('id', form.id)
      if (error) throw error
      toast.success('Company settings saved')
      setLogoFile(null)
      loadProfile()
    } catch (err) {
      toast.error(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold">Company Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Business details</CardTitle>
          <CardDescription>Shown on generated invoices.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            {form.logo_url && (
              <img src={form.logo_url} alt="Company logo" className="h-14 w-14 rounded object-cover" />
            )}
            <div className="flex-1 space-y-1.5">
              <Label>Company logo</Label>
              <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input value={form.name || ''} onChange={set('name')} />
            </div>
            <div className="space-y-1.5">
              <Label>Legal name</Label>
              <Input value={form.legal_name || ''} onChange={set('legal_name')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Textarea value={form.address || ''} onChange={set('address')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone || ''} onChange={set('phone')} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email || ''} onChange={set('email')} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>GST</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Enable GST on bills</Label>
            <Switch checked={!!form.gst_enabled} onCheckedChange={(v) => setForm({ ...form, gst_enabled: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>GSTIN</Label>
              <Input value={form.gst_number || ''} onChange={set('gst_number')} />
            </div>
            <div className="space-y-1.5">
              <Label>Default GST rate %</Label>
              <Input type="number" value={form.default_gst_rate ?? ''} onChange={set('default_gst_rate')} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing &amp; payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bill series prefix</Label>
              <Input value={form.bill_series || ''} onChange={set('bill_series')} placeholder="INV" />
            </div>
            <div className="space-y-1.5">
              <Label>UPI ID (for QR codes)</Label>
              <Input value={form.upi_id || ''} onChange={set('upi_id')} placeholder="shop@okhdfcbank" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Additional notes to customer (invoice footer)</Label>
            <Textarea value={form.footer_note || ''} onChange={set('footer_note')} />
          </div>
          <div className="space-y-1.5">
            <Label>Default low stock threshold</Label>
            <Input type="number" className="w-40" value={form.low_stock_threshold ?? ''} onChange={set('low_stock_threshold')} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>
            These permanently delete records for this company. They do not undo stock changes those records caused.
            There is no way to recover deleted data — export anything you need first (Reports, Credit Report, PDFs).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'bills', label: 'Clear all bills', desc: 'Deletes every bill, its line items, and any recorded credit payments.' },
            { key: 'purchases', label: 'Clear all purchases', desc: 'Deletes every purchase record, its line items, and supplier payments.' },
            { key: 'products', label: 'Clear all products', desc: 'Deletes the entire product catalog, including batches and stock history.' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 p-3">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setDangerAction(item.key)}>
                <Trash2 className="h-4 w-4" /> Clear
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <ConfirmDangerDialog
        open={dangerAction === 'bills'}
        onOpenChange={(v) => !v && setDangerAction(null)}
        title="Clear all bills"
        description="This permanently deletes every bill and its line items for this company. Product stock levels are left as-is — they will not be restored."
        confirmPhrase="DELETE ALL BILLS"
        onConfirm={clearAllBills}
      />
      <ConfirmDangerDialog
        open={dangerAction === 'purchases'}
        onOpenChange={(v) => !v && setDangerAction(null)}
        title="Clear all purchases"
        description="This permanently deletes every purchase record and its line items for this company. Product stock levels are left as-is — they will not be reduced back."
        confirmPhrase="DELETE ALL PURCHASES"
        onConfirm={clearAllPurchases}
      />
      <ConfirmDangerDialog
        open={dangerAction === 'products'}
        onOpenChange={(v) => !v && setDangerAction(null)}
        title="Clear all products"
        description="This permanently deletes your entire product catalog, including batches. Past bills and purchases keep their recorded line-item details, but will no longer link to a live product."
        confirmPhrase="DELETE ALL PRODUCTS"
        onConfirm={clearAllProducts}
      />
    </div>
  )
}

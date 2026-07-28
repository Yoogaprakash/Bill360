import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const LIMIT_FIELDS = [
  { key: 'user_limit', label: 'Users' },
  { key: 'product_limit', label: 'Products' },
  { key: 'sales_bill_limit', label: 'Sales bills / month' },
  { key: 'purchase_bill_limit', label: 'Purchase bills / month' },
  { key: 'bill_print_limit', label: 'Bill prints / month' },
  { key: 'report_print_limit', label: 'Report prints / month' },
]

/** values: { [limitKey]: number|null|'' }. Blank/empty means unlimited. */
export default function LimitFields({ values, onChange, placeholderSource }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {LIMIT_FIELDS.map(({ key, label }) => (
        <div key={key} className="space-y-1.5">
          <Label className="text-xs">{label}</Label>
          <Input
            type="number"
            min="0"
            value={values[key] ?? ''}
            onChange={(e) => onChange(key, e.target.value === '' ? null : Number(e.target.value))}
            placeholder={placeholderSource ? String(placeholderSource[key] ?? '∞') : '∞ unlimited'}
          />
        </div>
      ))}
    </div>
  )
}

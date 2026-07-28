// Best-effort heuristic parser for OCR'd purchase-bill text. Purchase bills
// vary wildly in layout, so this is deliberately conservative: it only
// pulls out lines that look like "<item name> ... <qty> <price>" and leaves
// everything else for the user to fix in the editable items table that
// follows — this is a starting draft, not a reliable structured extraction.
const NUMBER_RE = /-?\d+(?:[.,]\d+)?/g
// Indian mobile numbers, optionally with +91/0 prefix, optionally labeled.
const PHONE_RE = /(?:\+?91[-\s]?|0)?([6-9]\d{9})\b/

export function parsePurchaseBillText(rawText) {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const supplierNameGuess = lines[0]?.slice(0, 80) || ''

  let supplierPhoneGuess = ''
  for (const line of lines) {
    const match = line.match(PHONE_RE)
    if (match) {
      supplierPhoneGuess = match[1]
      break
    }
  }

  const items = []
  for (const line of lines) {
    const numbers = line.match(NUMBER_RE)
    if (!numbers || numbers.length < 2) continue

    // Strip trailing numeric tokens off the line to get a name; skip lines
    // that are almost entirely numeric (likely a totals/date/GSTIN line).
    const name = line.replace(NUMBER_RE, '').replace(/[.,;:\-x×@=]+/g, ' ').trim()
    if (name.length < 3) continue
    if (/total|subtotal|gst|tax|amount|balance|invoice|date|gstin|phone|mobile|contact|tel\.?\s*:|no\.?\s*:/i.test(name)) continue

    const nums = numbers.map((n) => Number(n.replace(',', '')))
    const last = nums[nums.length - 1]
    const secondLast = nums[nums.length - 2]
    // Heuristic: a small-ish whole-ish number just before the price is probably qty.
    const looksLikeQty = secondLast > 0 && secondLast < 1000
    const qty = looksLikeQty ? secondLast : 1
    const unitPrice = last

    if (unitPrice <= 0) continue

    items.push({
      key: Math.random().toString(36).slice(2),
      product_id: '',
      name,
      hsn_code: '',
      qty,
      unit_price: unitPrice,
      gst_rate: 0,
    })
  }

  return { supplierNameGuess, supplierPhoneGuess, items }
}

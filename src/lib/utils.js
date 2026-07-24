import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount || 0)
}

// jsPDF's built-in fonts (Helvetica etc.) only support WinAnsiEncoding, which
// has no glyph for ₹ — rendering it doesn't just drop the symbol, it corrupts
// the whole string. Use this ASCII-only variant ("INR 1,000.00") anywhere
// text gets drawn onto a PDF; keep formatCurrency() for on-screen UI.
export function formatCurrencyForPdf(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    currencyDisplay: 'code',
    maximumFractionDigits: 2,
  })
    .format(amount || 0)
    .replace('INR', 'Rs.')
}

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

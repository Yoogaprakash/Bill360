import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLowStockProducts } from '@/hooks/useLowStockProducts'

export default function LowStockBell() {
  const { products } = useLowStockProducts()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {products.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {products.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Low stock alerts</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {products.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">All products well stocked</div>
        )}
        {products.slice(0, 8).map((p) => (
          <DropdownMenuItem key={p.id} className="flex items-center justify-between gap-2">
            <span className="truncate">{p.name}</span>
            <Badge variant={p.stock_qty <= 0 ? 'destructive' : 'warning'}>{p.stock_qty} left</Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

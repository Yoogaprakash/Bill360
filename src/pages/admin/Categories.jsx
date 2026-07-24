import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useProducts } from '@/hooks/useProducts'

export default function Categories() {
  const profile = useAuthStore((s) => s.profile)
  const { categories, refresh } = useProducts()
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [selected, setSelected] = useState(new Set())

  const allSelected = categories.length > 0 && categories.every((c) => selected.has(c.id))
  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(categories.map((c) => c.id)))

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    const { error } = await supabase.from('categories').insert({ company_id: profile.company_id, name: name.trim() })
    if (error) return toast.error(error.message)
    setName('')
    refresh()
  }

  const handleRename = async (id) => {
    const { error } = await supabase.from('categories').update({ name: editingName }).eq('id', id)
    if (error) return toast.error(error.message)
    setEditingId(null)
    refresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this category? Products keep their data but lose the category tag.')) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) return toast.error(error.message)
    refresh()
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} selected categor${selected.size === 1 ? 'y' : 'ies'}? Products keep their data but lose the category tag.`)) return
    const { error } = await supabase.from('categories').delete().in('id', [...selected])
    if (error) return toast.error(error.message)
    toast.success(`Deleted ${selected.size} categor${selected.size === 1 ? 'y' : 'ies'}`)
    setSelected(new Set())
    refresh()
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold">Categories</h1>
      <Card>
        <CardHeader>
          <CardTitle>Add category</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Beverages" />
            <Button type="submit">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>All categories</CardTitle>
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4" /> Delete selected ({selected.size})
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
                  </TableCell>
                  <TableCell>
                    {editingId === c.id ? (
                      <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="h-8 w-56" />
                    ) : (
                      c.name
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editingId === c.id ? (
                      <Button size="sm" onClick={() => handleRename(c.id)}>Save</Button>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingId(c.id); setEditingName(c.name) }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

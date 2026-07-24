import { AlertTriangle } from 'lucide-react'

export default function SetupRequired() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-lg space-y-4 rounded-xl border bg-background p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/20 text-warning-foreground">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold">Supabase isn't configured yet</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Bill360 needs a Supabase project to talk to. Create <code className="rounded bg-muted px-1 py-0.5">.env</code> in
          the project root (copy <code className="rounded bg-muted px-1 py-0.5">.env.example</code>) and fill in:
        </p>
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
{`VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key`}
        </pre>
        <p className="text-sm text-muted-foreground">
          Then restart <code className="rounded bg-muted px-1 py-0.5">npm run dev</code>. See the README for how to run{' '}
          <code className="rounded bg-muted px-1 py-0.5">supabase/schema.sql</code> and create your first Super Admin.
        </p>
      </div>
    </div>
  )
}

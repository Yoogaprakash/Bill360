import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Receipt } from 'lucide-react'

export default function Login() {
  const session = useAuthStore((s) => s.session)
  const signIn = useAuthStore((s) => s.signIn)
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset)
  const [mode, setMode] = useState('signin') // 'signin' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  if (session) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signIn(email, password)
      toast.success('Welcome back!')
    } catch (err) {
      toast.error(err.message || 'Could not sign in')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await sendPasswordReset(email)
      setResetSent(true)
    } catch (err) {
      toast.error(err.message || 'Could not send reset email')
    } finally {
      setLoading(false)
    }
  }

  const backToSignIn = () => {
    setMode('signin')
    setResetSent(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <Receipt className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl">{mode === 'signin' ? 'Sign in to Bill360' : 'Reset your password'}</CardTitle>
          <CardDescription>
            {mode === 'signin' ? 'Billing & POS for your business' : 'We’ll email you a link to set a new password.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === 'signin' ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button type="button" onClick={() => setMode('forgot')} className="text-xs text-brand hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Accounts are created by your Company Admin or Super Admin.
              </p>
            </>
          ) : resetSent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                If an account exists for <span className="font-medium text-foreground">{email}</span>, a reset link is on its way. Check your inbox (and spam folder).
              </p>
              <Button variant="outline" className="w-full" onClick={backToSignIn}>Back to sign in</Button>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">Email</Label>
                <Input id="reset-email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={backToSignIn}>Back to sign in</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

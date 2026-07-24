import { useState } from 'react'
import { toast } from 'sonner'
import { User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export default function Profile() {
  const profile = useAuthStore((s) => s.profile)
  const loadProfile = useAuthStore((s) => s.loadProfile)

  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [avatarFile, setAvatarFile] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      let avatarUrl = profile.avatar_url
      if (avatarFile) {
        const path = `${profile.id}/${Date.now()}-${avatarFile.name}`
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, avatarFile)
        if (uploadErr) throw uploadErr
        avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      }

      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim(), avatar_url: avatarUrl })
        .eq('id', profile.id)
      if (error) throw error

      toast.success('Profile updated')
      setAvatarFile(null)
      loadProfile()
    } catch (err) {
      toast.error(err.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) return toast.error(error.message)
    toast.success('Password updated')
    setNewPassword('')
    setConfirmPassword('')
  }

  if (!profile) return null

  return (
    <div className="max-w-xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold">My Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
          <CardDescription>{profile.companies?.name ? `${profile.companies.name} · ` : ''}<span className="capitalize">{profile.role?.replace('_', ' ')}</span></CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <User className="h-7 w-7" />
              </div>
            )}
            <div className="flex-1 space-y-1.5">
              <Label>Profile photo</Label>
              <Input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>New password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm password</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={savingPassword}>{savingPassword ? 'Updating…' : 'Update password'}</Button>
        </CardContent>
      </Card>
    </div>
  )
}

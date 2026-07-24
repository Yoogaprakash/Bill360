import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export default function ProtectedRoute({ roles }) {
  const session = useAuthStore((s) => s.session)
  const profile = useAuthStore((s) => s.profile)

  if (!session) return <Navigate to="/login" replace />
  if (!profile) return null // profile still loading

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/pos" replace />
  }

  return <Outlet />
}

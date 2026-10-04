import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-session'
import InfrastructureDashboard from '@/components/infrastructure-dashboard'
import { SessionGuard } from '@/components/session-guard'

export const metadata = { title: 'Panel Administrador' }

export default async function HomePage() {
  if (!(await getAdminSession())) redirect('/login')
  return (
    <>
      <SessionGuard />
      <InfrastructureDashboard />
    </>
  )
}

import { redirect } from 'next/navigation'
import { ClientsDashboard } from '@/components/clients-dashboard'
import { SessionGuard } from '@/components/session-guard'
import { getAdminSession } from '@/lib/admin-session'

export const metadata = { title: 'Clientes' }

export default async function ClientsPage() {
  if (!(await getAdminSession())) redirect('/login')
  return (
    <>
      <SessionGuard />
      <ClientsDashboard />
    </>
  )
}

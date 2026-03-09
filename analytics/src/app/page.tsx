import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export default async function Root() {
  const cookieStore = cookies()
  const token = cookieStore.get('kyns_analytics_token')?.value
  if (token && (await verifyToken(token))) {
    redirect('/dashboard')
  }
  redirect('/login')
}

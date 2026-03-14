import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyTokenPayload } from '@/lib/auth'

export default async function Root() {
  const cookieStore = cookies()
  const token = cookieStore.get('kyns_analytics_token')?.value
  if (token && (await verifyTokenPayload(token))) {
    redirect('/dashboard')
  }
  redirect('/login')
}

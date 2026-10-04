'use client'

import { useEffect } from 'react'
import { LogOut } from 'lucide-react'

export const TAB_MARKER = 'admin-tab-active'
const LOGOUT_URL = '/login'
const HEARTBEAT_MS = 60_000

export async function endSession() {
  try {
    await fetch('/api/admin/logout', { method: 'POST', keepalive: true })
  } finally {
    sessionStorage.removeItem(TAB_MARKER)
    window.location.replace(LOGOUT_URL)
  }
}

export function SessionGuard() {
  useEffect(() => {
    // sessionStorage is private to a tab and wiped when it closes, so a missing marker means a new tab or a returning browser.
    if (!sessionStorage.getItem(TAB_MARKER)) {
      fetch('/api/admin/logout', { method: 'POST', keepalive: true }).finally(() => window.location.replace('/login'))
      return
    }

    async function renew() {
      try {
        const response = await fetch('/api/admin/session', { method: 'POST' })
        if (response.status === 401) window.location.replace('/login')
      } catch {
        // Network hiccup: the next beat retries and the session lapses on its own if it never recovers.
      }
    }

    function onVisible() {
      if (document.visibilityState === 'visible') renew()
    }
    function onPageHide() {
      navigator.sendBeacon('/api/admin/session/closing')
    }
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) renew()
    }

    renew()
    const timer = window.setInterval(renew, HEARTBEAT_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])

  return null
}

export function LogoutButton({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={endSession}
      className={`inline-flex h-11 items-center gap-2 rounded-full border border-brand-foreground/20 px-4 text-sm font-bold hover:bg-brand-foreground/10 ${className}`}
    >
      <LogOut className="size-4" aria-hidden="true" />
      Cerrar sesión
    </button>
  )
}

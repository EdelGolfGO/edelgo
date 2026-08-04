"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"

const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const WARNING_BEFORE_MS = 60 * 1000 // show a warning 60 seconds before signing out

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"]

export default function IdleSessionManager() {
  const router = useRouter()
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(60)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let mounted = true
    let isAuthenticated = false

    function clearAllTimers() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }

    async function handleSignOut() {
      clearAllTimers()
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push("/auth/login?reason=idle_timeout")
    }

    function startCountdown() {
      setShowWarning(true)
      setSecondsLeft(Math.floor(WARNING_BEFORE_MS / 1000))
      countdownRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            handleSignOut()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    function resetTimers() {
      clearAllTimers()
      setShowWarning(false)
      if (!isAuthenticated) return
      idleTimerRef.current = setTimeout(startCountdown, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS)
    }

    function handleActivity() {
      // Ignore activity events while the warning is showing — only the
      // explicit "Stay signed in" button should reset the timer at that
      // point, so a stray mouse twitch doesn't silently extend a session
      // someone meant to let expire.
      if (showWarning) return
      resetTimers()
    }

    async function init() {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      isAuthenticated = !!data.session
      if (isAuthenticated) {
        resetTimers()
        ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, handleActivity))
      }
    }

    init()

    // Re-check auth state on sign-in/sign-out so the timer arms or disarms
    // without needing a full page reload.
    const supabase = createClient()
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      isAuthenticated = !!session
      if (isAuthenticated) {
        resetTimers()
      } else {
        clearAllTimers()
        setShowWarning(false)
      }
    })

    return () => {
      mounted = false
      clearAllTimers()
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, handleActivity))
      authListener?.subscription.unsubscribe()
    }
  }, [showWarning, router])

  function handleStaySignedIn() {
    setShowWarning(false)
    // Re-trigger the effect's reset by clearing state; the effect's cleanup +
    // re-run handles clearing old timers and starting fresh ones.
  }

  if (!showWarning) return null

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ background: "#2B3038", border: "0.5px solid rgba(255,255,255,0.14)", borderTop: "2px solid #C4A93A", padding: "32px", width: "400px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "20px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: "0 0 12px" }}>
          Session Expiring
        </h2>
        <p style={{ fontSize: "13px", color: "#B5BAC2", fontFamily: "'Barlow', sans-serif", margin: "0 0 20px" }}>
          You've been inactive for a while. For security, you'll be signed out in
        </p>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "36px", fontWeight: 700, color: "#C4A93A", margin: "0 0 24px" }}>
          {secondsLeft}s
        </p>
        <button onClick={handleStaySignedIn} style={{ width: "100%", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", background: "#A91E22", border: "none", padding: "12px", cursor: "pointer" }}>
          Stay Signed In
        </button>
      </div>
    </div>
  )
}
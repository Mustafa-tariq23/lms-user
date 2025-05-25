"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Loader2 } from "lucide-react"

export default function HomePage() {
  const { user, userData, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (user && userData) {
        if (userData.role === "user") {
          router.push("/dashboard")
        } else {
          router.push("/login")
        }
      } else {
        router.push("/login")
      }
    }
  }, [user, userData, loading, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  )
}

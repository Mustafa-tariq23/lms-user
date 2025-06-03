"use client"

import type React from "react"

import { useAuth } from "@/contexts/auth-context"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import { Loader2 } from "lucide-react"
import { logger } from "@/lib/logger"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, userData, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Log unauthorized access attempt
        logger.logUnauthorizedAccess(pathname, "page_access", "User not authenticated")
        router.push("/login")
      } else if (userData && userData.role !== "user") {
        // Log unauthorized access attempt for wrong role
        logger.logUnauthorizedAccess(pathname, "page_access", "Invalid role for user portal", user.uid)
        router.push("/login")
      }
    }
  }, [user, userData, loading, router, pathname])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user || !userData || userData.role !== "user") {
    return null
  }

  return <>{children}</>
}

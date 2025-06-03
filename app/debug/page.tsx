"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { Navbar } from "@/components/navbar"
import { DebugLogger } from "@/components/debug-logger"

export default function DebugPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-8">Debug Logging</h1>
          <DebugLogger />
        </div>
      </div>
    </ProtectedRoute>
  )
}

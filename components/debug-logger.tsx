"use client"

import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { logger } from "@/lib/logger"

export function DebugLogger() {
  const { user } = useAuth()

  const testLogs = async () => {
    if (!user) {
      console.log("No user logged in")
      return
    }

    console.log("Current user ID:", user.uid)
    console.log("Testing logs...")

    try {
      // Test different types of logs
      await logger.logPageView("Debug Test", "/debug", user.uid)
      console.log("✅ Page view logged")

      await logger.logBookSearch("test search", { genre: "fiction" }, 5, user.uid)
      console.log("✅ Book search logged")

      await logger.logFilterChange("books", "genre", "fiction", user.uid, "all", 5)
      console.log("✅ Filter change logged")

      await logger.logUserInteraction("click", "test_button", "debug", user.uid, "debug-btn")
      console.log("✅ User interaction logged")

      await logger.logBookView("test-book-id", "Test Book", user.uid, "browse")
      console.log("✅ Book view logged")

      console.log("All test logs completed. Check Firestore at: users/" + user.uid + "/logs")
    } catch (error) {
      console.error("Error testing logs:", error)
    }
  }

  if (!user) {
    return (
      <Card className="m-4">
        <CardHeader>
          <CardTitle>Debug Logger</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please log in to test logging functionality.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>Debug Logger</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>
          <strong>Current User ID:</strong> {user.uid}
        </p>
        <p>
          <strong>Expected log location:</strong> users/{user.uid}/logs
        </p>
        <Button onClick={testLogs}>Test Logging</Button>
        <div className="text-sm text-gray-600">
          <p>After clicking "Test Logging":</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Check the browser console for log messages</li>
            <li>Go to Firestore → users → {user.uid} → logs (subcollection)</li>
            <li>You should see test log entries there</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}

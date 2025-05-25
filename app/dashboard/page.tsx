"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { ProtectedRoute } from "@/components/protected-route"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Book, Clock, AlertTriangle, CheckCircle } from "lucide-react"
import { format, isAfter } from "date-fns"

interface Borrowing {
  id: string
  bookTitle: string
  requestDate: any
  dueDate?: any
  status: string
  type: string
}

export default function DashboardPage() {
  const { user, userData } = useAuth()
  const [borrowings, setBorrowings] = useState<Borrowing[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    activeBorrowings: 0,
    pendingRequests: 0,
    overdueBooks: 0,
  })

  // Add these helper functions at the top of the component
  const formatDate = (date: any) => {
    if (!date) return "N/A"

    // Handle Firestore Timestamp
    if (date.toDate && typeof date.toDate === "function") {
      return format(date.toDate(), "MMM dd, yyyy")
    }

    // Handle regular Date object
    if (date instanceof Date) {
      return format(date, "MMM dd, yyyy")
    }

    // Handle date string
    if (typeof date === "string") {
      return format(new Date(date), "MMM dd, yyyy")
    }

    return "N/A"
  }

  const isOverdue = (dueDate: any) => {
    if (!dueDate) return false

    let dateToCheck: Date

    // Handle Firestore Timestamp
    if (dueDate.toDate && typeof dueDate.toDate === "function") {
      dateToCheck = dueDate.toDate()
    }
    // Handle regular Date object
    else if (dueDate instanceof Date) {
      dateToCheck = dueDate
    }
    // Handle date string
    else if (typeof dueDate === "string") {
      dateToCheck = new Date(dueDate)
    } else {
      return false
    }

    return isAfter(new Date(), dateToCheck)
  }

  // Update the getStatusBadge function
  const getStatusBadge = (status: string, dueDate?: any) => {
    if (status === "approved" && isOverdue(dueDate)) {
      return <Badge variant="destructive">Overdue</Badge>
    }

    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>
      case "approved":
        return <Badge variant="default">Approved</Badge>
      case "returned":
        return <Badge variant="outline">Returned</Badge>
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  useEffect(() => {
    if (user) {
      fetchBorrowings()
    }
  }, [user])

  const fetchBorrowings = async () => {
    if (!user) return

    try {
      // Simple query without orderBy to avoid composite index requirement
      const q = query(collection(db, "borrowings"), where("userId", "==", user.uid))

      const querySnapshot = await getDocs(q)
      const borrowingsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Borrowing[]

      // Sort on the client side instead
      borrowingsData.sort((a, b) => {
        const dateA = a.requestDate?.toDate?.() || new Date(a.requestDate)
        const dateB = b.requestDate?.toDate?.() || new Date(b.requestDate)
        return dateB.getTime() - dateA.getTime()
      })

      setBorrowings(borrowingsData)

      // Calculate stats
      const activeBorrowings = borrowingsData.filter((b) => b.status === "approved" && b.type === "borrow")

      const pendingRequests = borrowingsData.filter((b) => b.status === "pending")

      // Update the stats calculation in fetchBorrowings
      const overdueBooks = activeBorrowings.filter((b) => isOverdue(b.dueDate))

      setStats({
        activeBorrowings: activeBorrowings.length,
        pendingRequests: pendingRequests.length,
        overdueBooks: overdueBooks.length,
      })
    } catch (error) {
      console.error("Error fetching borrowings:", error)
    } finally {
      setLoading(false)
    }
  }

  const activeBorrowings = borrowings.filter((b) => b.status === "approved" && b.type === "borrow")

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Welcome back, {userData?.name}!</h1>
            <p className="text-gray-600 mt-2">Here's an overview of your library activity</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Borrowings</CardTitle>
                <Book className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeBorrowings}</div>
                <p className="text-xs text-muted-foreground">Currently borrowed books</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingRequests}</div>
                <p className="text-xs text-muted-foreground">Awaiting approval</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue Books</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.overdueBooks}</div>
                <p className="text-xs text-muted-foreground">Need to be returned</p>
              </CardContent>
            </Card>
          </div>

          {/* Active Borrowings */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Currently Borrowed Books</CardTitle>
              <CardDescription>Books you have borrowed and their due dates</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : activeBorrowings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Book className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active borrowings</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Update the borrowing display sections to use formatDate */}
                  {activeBorrowings.map((borrowing) => (
                    <div key={borrowing.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium">{borrowing.bookTitle}</h3>
                        <p className="text-sm text-muted-foreground">Borrowed on {formatDate(borrowing.requestDate)}</p>
                        {borrowing.dueDate && (
                          <p className="text-sm text-muted-foreground">Due: {formatDate(borrowing.dueDate)}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(borrowing.status, borrowing.dueDate)}
                        {isOverdue(borrowing.dueDate) && <AlertTriangle className="h-4 w-4 text-red-500" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your recent borrowing requests and returns</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : borrowings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No activity yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Update the recent activity section */}
                  {borrowings.slice(0, 5).map((borrowing) => (
                    <div key={borrowing.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium">{borrowing.bookTitle}</h3>
                        <p className="text-sm text-muted-foreground">
                          {borrowing.type === "borrow" ? "Borrow request" : "Return request"} •{" "}
                          {formatDate(borrowing.requestDate)}
                        </p>
                      </div>
                      {getStatusBadge(borrowing.status, borrowing.dueDate)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}

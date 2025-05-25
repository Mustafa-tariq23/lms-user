"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { ProtectedRoute } from "@/components/protected-route"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { collection, query, where, getDocs, addDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { format, isAfter } from "date-fns"
import { Clock, CheckCircle, XCircle, RotateCcw, AlertTriangle, BookOpen } from "lucide-react"

interface Borrowing {
  id: string
  bookId: string
  bookTitle: string
  requestDate: any
  dueDate?: any
  status: string
  type: string
  originalBorrowingId?: string
}

export default function BorrowingsPage() {
  const { user, userData } = useAuth()
  const [borrowings, setBorrowings] = useState<Borrowing[]>([])
  const [loading, setLoading] = useState(true)
  const [submittingReturn, setSubmittingReturn] = useState<string | null>(null)
  const { toast } = useToast()

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
    } catch (error) {
      console.error("Error fetching borrowings:", error)
      toast({
        title: "Error",
        description: "Failed to fetch borrowing history",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReturnRequest = async (borrowing: Borrowing) => {
    if (!user || !userData) return

    setSubmittingReturn(borrowing.id)
    try {
      await addDoc(collection(db, "borrowings"), {
        userId: user.uid,
        userName: userData.name,
        bookId: borrowing.bookId,
        bookTitle: borrowing.bookTitle,
        requestDate: new Date(),
        type: "return",
        status: "pending",
        originalBorrowingId: borrowing.id,
      })

      toast({
        title: "Return Request Submitted",
        description: "Your return request has been submitted successfully.",
      })

      // Refresh borrowings
      fetchBorrowings()
    } catch (error: any) {
      console.error("Error submitting return request:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to submit return request",
        variant: "destructive",
      })
    } finally {
      setSubmittingReturn(null)
    }
  }

  // Replace the format calls with this safer function
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

  // Replace the isAfter check with this safer function
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
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
      case "approved":
        return (
          <Badge variant="default">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        )
      case "returned":
        return (
          <Badge variant="outline">
            <RotateCcw className="w-3 h-3 mr-1" />
            Returned
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />
      case "approved":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "returned":
        return <RotateCcw className="h-5 w-5 text-blue-500" />
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  const pendingBorrowings = borrowings.filter((b) => b.status === "pending")
  const approvedBorrowings = borrowings.filter((b) => b.status === "approved" && b.type === "borrow")
  const returnedBorrowings = borrowings.filter((b) => b.status === "returned" || b.type === "return")

  // Check if there's already a pending return request for a borrowing
  const hasPendingReturn = (borrowingId: string) => {
    return borrowings.some(
      (b) => b.originalBorrowingId === borrowingId && b.type === "return" && b.status === "pending",
    )
  }

  // Update the BorrowingCard component
  const BorrowingCard = ({
    borrowing,
    showReturnButton = false,
  }: { borrowing: Borrowing; showReturnButton?: boolean }) => (
    <Card className="mb-4">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              {getStatusIcon(borrowing.status)}
              <h3 className="font-semibold text-lg">{borrowing.bookTitle}</h3>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-medium">Request Date:</span> {formatDate(borrowing.requestDate)}
              </p>

              {borrowing.dueDate && (
                <p>
                  <span className="font-medium">Due Date:</span> {formatDate(borrowing.dueDate)}
                  {isOverdue(borrowing.dueDate) && (
                    <span className="ml-2 text-red-500 font-medium">
                      <AlertTriangle className="inline h-4 w-4 mr-1" />
                      Overdue
                    </span>
                  )}
                </p>
              )}

              <p>
                <span className="font-medium">Type:</span>{" "}
                {borrowing.type === "borrow" ? "Borrow Request" : "Return Request"}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end space-y-2">
            {getStatusBadge(borrowing.status, borrowing.dueDate)}

            {showReturnButton && borrowing.status === "approved" && !hasPendingReturn(borrowing.id) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReturnRequest(borrowing)}
                disabled={submittingReturn === borrowing.id}
              >
                {submittingReturn === borrowing.id ? "Submitting..." : "Request Return"}
              </Button>
            )}

            {showReturnButton && hasPendingReturn(borrowing.id) && <Badge variant="secondary">Return Pending</Badge>}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const EmptyState = ({ title, description, icon: Icon }: { title: string; description: string; icon: any }) => (
    <div className="text-center py-12">
      <Icon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Borrowings</h1>
            <p className="text-gray-600">Track your borrowing requests and manage returns</p>
          </div>

          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">Pending ({pendingBorrowings.length})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({approvedBorrowings.length})</TabsTrigger>
              <TabsTrigger value="history">History ({returnedBorrowings.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Requests</CardTitle>
                  <CardDescription>Requests awaiting admin approval</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : pendingBorrowings.length === 0 ? (
                    <EmptyState
                      title="No pending requests"
                      description="You don't have any pending borrowing requests"
                      icon={Clock}
                    />
                  ) : (
                    <div>
                      {pendingBorrowings.map((borrowing) => (
                        <BorrowingCard key={borrowing.id} borrowing={borrowing} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="approved" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Approved Borrowings</CardTitle>
                  <CardDescription>Books you have borrowed and their due dates</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : approvedBorrowings.length === 0 ? (
                    <EmptyState
                      title="No approved borrowings"
                      description="You don't have any approved borrowings"
                      icon={CheckCircle}
                    />
                  ) : (
                    <div>
                      {approvedBorrowings.map((borrowing) => (
                        <BorrowingCard key={borrowing.id} borrowing={borrowing} showReturnButton={true} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Borrowing History</CardTitle>
                  <CardDescription>Your complete borrowing and return history</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : returnedBorrowings.length === 0 ? (
                    <EmptyState
                      title="No history yet"
                      description="Your borrowing history will appear here"
                      icon={BookOpen}
                    />
                  ) : (
                    <div>
                      {returnedBorrowings.map((borrowing) => (
                        <BorrowingCard key={borrowing.id} borrowing={borrowing} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ProtectedRoute>
  )
}

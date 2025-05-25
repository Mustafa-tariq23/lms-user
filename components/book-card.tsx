"use client"

import { useState } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { collection, addDoc, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Loader2, Book, User, Calendar } from "lucide-react"

interface BookCardProps {
  book: {
    id: string
    title: string
    author: string
    genre: string
    description: string
    availableCopies: number
    totalCopies: number
    imageUrl: string
    publicationYear: number
  }
}

export function BookCard({ book }: BookCardProps) {
  const [loading, setLoading] = useState(false)
  const [alreadyRequested, setAlreadyRequested] = useState(false)
  const { user, userData } = useAuth()
  const { toast } = useToast()

  const checkExistingRequest = async () => {
    if (!user) return

    try {
      const q = query(
        collection(db, "borrowings"),
        where("userId", "==", user.uid),
        where("bookId", "==", book.id),
        where("status", "in", ["pending", "approved"]),
      )

      const querySnapshot = await getDocs(q)
      setAlreadyRequested(!querySnapshot.empty)
    } catch (error) {
      console.error("Error checking existing request:", error)
    }
  }

  useState(() => {
    checkExistingRequest()
  })

  const handleBorrowRequest = async () => {
    if (!user || !userData) return

    setLoading(true)
    try {
      // Check again before creating request
      await checkExistingRequest()
      if (alreadyRequested) {
        toast({
          title: "Already Requested",
          description: "You have already requested this book or it's currently borrowed by you.",
          variant: "destructive",
        })
        return
      }

      await addDoc(collection(db, "borrowings"), {
        userId: user.uid,
        userName: userData.name,
        bookId: book.id,
        bookTitle: book.title,
        requestDate: new Date(),
        type: "borrow",
        status: "pending",
      })

      setAlreadyRequested(true)
      toast({
        title: "Request Submitted",
        description: "Your borrow request has been submitted successfully.",
      })
    } catch (error: any) {
      console.error("Error submitting borrow request:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to submit borrow request",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <div className="aspect-[3/4] relative overflow-hidden rounded-t-lg">
        <img
          src={book.imageUrl || "/placeholder.svg?height=400&width=300"}
          alt={book.title}
          className="object-cover w-full h-full"
        />
        <div className="absolute top-2 right-2">
          <Badge variant={book.availableCopies > 0 ? "default" : "destructive"}>
            {book.availableCopies > 0 ? "Available" : "Not Available"}
          </Badge>
        </div>
      </div>

      <CardContent className="flex-1 p-4">
        <h3 className="font-semibold text-lg mb-2 line-clamp-2">{book.title}</h3>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>{book.author}</span>
          </div>

          <div className="flex items-center gap-2">
            <Book className="h-4 w-4" />
            <span>{book.genre}</span>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{book.publicationYear}</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{book.description}</p>

        <div className="mt-3 text-sm">
          <span className="font-medium">
            {book.availableCopies} of {book.totalCopies} copies available
          </span>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button
          onClick={handleBorrowRequest}
          disabled={loading || book.availableCopies === 0 || alreadyRequested}
          className="w-full"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {alreadyRequested ? "Already Requested" : book.availableCopies === 0 ? "Not Available" : "Request to Borrow"}
        </Button>
      </CardFooter>
    </Card>
  )
}

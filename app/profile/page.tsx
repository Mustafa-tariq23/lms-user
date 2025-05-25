"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { ProtectedRoute } from "@/components/protected-route"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { User, Mail, Calendar, BookOpen, Loader2 } from "lucide-react"
import { format } from "date-fns"

export default function ProfilePage() {
  const { user, userData } = useAuth()
  const [name, setName] = useState(userData?.name || "")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !userData) return

    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Name cannot be empty",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: name.trim(),
      })

      toast({
        title: "Success",
        description: "Profile updated successfully",
      })
    } catch (error: any) {
      console.error("Error updating profile:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile</h1>
            <p className="text-gray-600">Manage your account information and preferences</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profile Information */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your personal details here</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateProfile} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          id="name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="pl-10"
                          placeholder="Enter your full name"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          id="email"
                          type="email"
                          value={userData?.email || ""}
                          disabled
                          className="pl-10 bg-gray-50"
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">Email address cannot be changed</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Account Type</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input value="User" disabled className="pl-10 bg-gray-50" />
                      </div>
                    </div>

                    <Button type="submit" disabled={loading || name === userData?.name}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Update Profile
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Account Summary */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Account Summary</CardTitle>
                  <CardDescription>Overview of your library account</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Active Borrowings</span>
                    </div>
                    <span className="font-medium">{userData?.activeBorrowings || 0}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Member Since</span>
                    </div>
                    <span className="font-medium">
                      {userData?.createdAt ? format(userData.createdAt.toDate(), "MMM yyyy") : "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Account Status</span>
                    </div>
                    <span className="font-medium text-green-600">Active</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="/books">
                      <BookOpen className="mr-2 h-4 w-4" />
                      Browse Books
                    </a>
                  </Button>

                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="/borrowings">
                      <Calendar className="mr-2 h-4 w-4" />
                      View Borrowings
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

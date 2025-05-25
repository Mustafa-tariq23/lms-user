"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import {
  type User,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from "firebase/auth"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"

interface UserData {
  name: string
  email: string
  role: "admin" | "user"
  activeBorrowings: number
  createdAt: any
}

interface AuthContextType {
  user: User | null
  userData: UserData | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  signup: (email: string, password: string, name: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid))
          if (userDoc.exists()) {
            setUserData(userDoc.data() as UserData)
          }
        } catch (error) {
          console.error("Error fetching user data:", error)
          toast({
            title: "Error",
            description: "Failed to fetch user data",
            variant: "destructive",
          })
        }
      } else {
        setUserData(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [toast])

  const login = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      const userDoc = await getDoc(doc(db, "users", result.user.uid))

      if (!userDoc.exists()) {
        await signOut(auth)
        throw new Error("User data not found")
      }

      const userData = userDoc.data() as UserData

      if (userData.role !== "user") {
        await signOut(auth)
        throw new Error("Access denied. This portal is for users only.")
      }

      toast({
        title: "Success",
        description: "Logged in successfully",
      })
    } catch (error: any) {
      console.error("Login error:", error)
      throw new Error(error.message || "Failed to login")
    }
  }

  const signup = async (email: string, password: string, name: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)

      await setDoc(doc(db, "users", result.user.uid), {
        name,
        email,
        role: "user",
        activeBorrowings: 0,
        createdAt: new Date(),
      })

      toast({
        title: "Success",
        description: "Account created successfully",
      })
    } catch (error: any) {
      console.error("Signup error:", error)
      throw new Error(error.message || "Failed to create account")
    }
  }

  const logout = async () => {
    try {
      await signOut(auth)
      toast({
        title: "Success",
        description: "Logged out successfully",
      })
    } catch (error: any) {
      console.error("Logout error:", error)
      throw new Error(error.message || "Failed to logout")
    }
  }

  const value = {
    user,
    userData,
    loading,
    login,
    logout,
    signup,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

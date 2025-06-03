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
import { logger } from "@/lib/logger"

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
            const userData = userDoc.data() as UserData
            setUserData(userData)

            // Log successful session restoration
            await logger.logLogin(true, user.email || undefined, user.uid, userData.role)
            
            // Now that we're authenticated, log the session start
            await logger.logSessionStart();
            
            // Process any pending logs now that we're authenticated
            await logger.processPendingLogs(user.uid);
            
            // Check for pending session log from localStorage
            if (typeof window !== "undefined" && localStorage.getItem("pendingSessionLog")) {
              try {
                localStorage.removeItem("pendingSessionLog");
              } catch (e) {
                console.error("Error handling pending session log:", e);
              }
            }
          }
        } catch (error: any) {
          console.error("Error fetching user data:", error)
          await logger.logSystemError(
            "Failed to fetch user data during auth state change",
            "AuthProvider",
            user.uid,
            error.stack,
          )
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
    const startTime = Date.now()

    try {
      // Log the login attempt first - this will be queued if permissions fail
      await logger.logLogin(false, email, undefined, undefined, "Login attempt");
      
      const result = await signInWithEmailAndPassword(auth, email, password)
      const userDoc = await getDoc(doc(db, "users", result.user.uid))

      if (!userDoc.exists()) {
        await signOut(auth)
        await logger.logLogin(false, email, result.user.uid, undefined, "User data not found")
        throw new Error("User data not found")
      }

      const userData = userDoc.data() as UserData

      if (userData.role !== "user") {
        await signOut(auth)
        await logger.logUnauthorizedAccess(
          "/login",
          "user_portal_access",
          "Invalid role for user portal",
          result.user.uid,
        )
        throw new Error("Access denied. This portal is for users only.")
      }

      // Log successful login
      await logger.logLogin(true, email, result.user.uid, userData.role)

      // Log API request timing
      await logger.logApiRequest("/auth/login", "POST", Date.now() - startTime, 200, result.user.uid, { email })

      toast({
        title: "Success",
        description: "Logged in successfully",
      })
    } catch (error: any) {
      console.error("Login error:", error)

      // Log failed login - this will be queued if permissions fail
      await logger.logLogin(false, email, undefined, undefined, error.message)

      // Log API request timing for failed login - this will be queued if permissions fail
      await logger.logApiRequest("/auth/login", "POST", Date.now() - startTime, 401, undefined, { email })

      throw new Error(error.message || "Failed to login")
    }
  }

  const signup = async (email: string, password: string, name: string) => {
    const startTime = Date.now()

    try {
      // Log the signup attempt first - this will be queued if permissions fail
      await logger.logLogin(false, email, undefined, undefined, "Signup attempt");
      
      const result = await createUserWithEmailAndPassword(auth, email, password)

      await setDoc(doc(db, "users", result.user.uid), {
        name,
        email,
        role: "user",
        activeBorrowings: 0,
        createdAt: new Date(),
      })

      // Log successful signup
      await logger.logLogin(true, email, result.user.uid, "user")

      // Log API request timing
      await logger.logApiRequest("/auth/signup", "POST", Date.now() - startTime, 201, result.user.uid, { email, name })

      toast({
        title: "Success",
        description: "Account created successfully",
      })
    } catch (error: any) {
      console.error("Signup error:", error)

      // Log failed signup - this will be queued if permissions fail
      await logger.logLogin(false, email, undefined, undefined, error.message)

      // Log API request timing for failed signup - this will be queued if permissions fail
      await logger.logApiRequest("/auth/signup", "POST", Date.now() - startTime, 400, undefined, { email, name })

      throw new Error(error.message || "Failed to create account")
    }
  }

  const logout = async () => {
    try {
      if (user && userData) {
        // Log logout before signing out
        await logger.logLogout(user.uid, userData.role)
      }

      await signOut(auth)

      toast({
        title: "Success",
        description: "Logged out successfully",
      })
    } catch (error: any) {
      console.error("Logout error:", error)
      await logger.logSystemError("Failed to logout", "AuthProvider", user?.uid, error.stack)
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

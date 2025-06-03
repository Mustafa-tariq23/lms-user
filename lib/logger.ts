import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

export interface BaseLog {
  timestamp: any
  userId?: string
  userRole?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
}

export interface LoginLog extends BaseLog {
  type: "login" | "logout"
  success: boolean
  email?: string
  errorMessage?: string
  loginMethod?: string
}

export interface SessionLog extends BaseLog {
  type: "session_start" | "session_end"
  sessionDuration?: number
}

export interface UnauthorizedAccessLog extends BaseLog {
  type: "unauthorized_access"
  targetPath: string
  attemptedAction: string
  denialReason: string
}

export interface SystemErrorLog extends BaseLog {
  type: "system_error"
  errorMessage: string
  stackTrace?: string
  component: string
  errorCode?: string
}

export interface ApiRequestLog extends BaseLog {
  type: "api_request"
  endpoint: string
  method: string
  payload?: any
  responseTime: number
  statusCode: number
  success: boolean
}

export interface PageViewLog extends BaseLog {
  type: "page_view"
  pageName: string
  pageUrl: string
  referrer?: string
  timeSpent?: number
}

export interface BookSearchLog extends BaseLog {
  type: "book_search"
  searchQuery?: string
  filters: {
    genre?: string
    availability?: string
  }
  resultsCount: number
}

export interface FilterChangeLog extends BaseLog {
  type: "filter_change"
  section: "books" | "borrowings"
  filterType: "genre" | "availability" | "status" | "search"
  filterValue: string
  previousValue?: string
  resultsCount?: number
}

export interface BookViewLog extends BaseLog {
  type: "book_view"
  bookId: string
  bookTitle: string
  viewDuration?: number
  source?: "search" | "browse" | "direct"
}

export interface BorrowRequestLog extends BaseLog {
  type: "borrow_request"
  bookId: string
  bookTitle: string
  requestStatus: "submitted" | "failed" | "already_requested"
  errorReason?: string
}

export interface ReturnRequestLog extends BaseLog {
  type: "return_request"
  bookId: string
  bookTitle: string
  originalBorrowingId: string
  isOverdue: boolean
  daysPastDue?: number
  requestStatus: "submitted" | "failed"
}

export interface ViewHistoryLog extends BaseLog {
  type: "view_history"
  historyType: "borrowings" | "profile" | "dashboard"
}

export interface TabSwitchLog extends BaseLog {
  type: "tab_switch"
  section: "borrowings"
  fromTab: string
  toTab: string
  timeSpentOnPreviousTab?: number
}

export interface UserInteractionLog extends BaseLog {
  type: "user_interaction"
  action: "click" | "hover" | "scroll" | "focus"
  element: string
  elementId?: string
  section: string
  additionalData?: Record<string, any>
}

export type LogEntry =
  | LoginLog
  | SessionLog
  | UnauthorizedAccessLog
  | SystemErrorLog
  | ApiRequestLog
  | PageViewLog
  | BookSearchLog
  | FilterChangeLog
  | BookViewLog
  | BorrowRequestLog
  | ReturnRequestLog
  | ViewHistoryLog
  | TabSwitchLog
  | UserInteractionLog

class Logger {
  private sessionId: string
  private sessionStartTime: number
  private pendingLogs: Array<{ logEntry: LogEntry; userId?: string }> = []
  private isProcessingPendingLogs = false
  private pageStartTime: number = Date.now()
  private currentPage = ""

  constructor() {
    this.sessionId = this.generateSessionId()
    this.sessionStartTime = Date.now()

    // Load any pending logs from localStorage
    this.loadPendingLogs()
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async getClientInfo() {
    const userAgent = typeof window !== "undefined" ? window.navigator.userAgent : "Unknown"

    // Try to get IP address (this is limited in browsers for privacy)
    let ipAddress = "Unknown"
    try {
      // This is a simple approach - in production you might want to use a service
      const response = await fetch("https://api.ipify.org?format=json")
      const data = await response.json()
      ipAddress = data.ip
    } catch (error) {
      // Fallback - IP will remain 'Unknown'
    }

    return { userAgent, ipAddress }
  }

  // Helper method to recursively remove undefined values from objects
  private cleanUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return null
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.cleanUndefinedValues(item)).filter((item) => item !== undefined)
    }

    if (typeof obj === "object") {
      const cleaned: any = {}
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          const cleanedValue = this.cleanUndefinedValues(value)
          if (cleanedValue !== undefined) {
            cleaned[key] = cleanedValue
          }
        }
      }
      return cleaned
    }

    return obj
  }

  // Load pending logs from localStorage
  private loadPendingLogs() {
    if (typeof window !== "undefined") {
      try {
        const pendingLogsStr = localStorage.getItem("pendingLogs")
        if (pendingLogsStr) {
          this.pendingLogs = JSON.parse(pendingLogsStr)
        }
      } catch (error) {
        console.error("Failed to load pending logs:", error)
      }
    }
  }

  // Save pending logs to localStorage
  private savePendingLogs() {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pendingLogs", JSON.stringify(this.pendingLogs))
      } catch (error) {
        console.error("Failed to save pending logs:", error)
      }
    }
  }

  // Process any pending logs when user is authenticated
  async processPendingLogs(userId: string) {
    if (this.isProcessingPendingLogs) return

    this.isProcessingPendingLogs = true

    try {
      const logs = [...this.pendingLogs]
      this.pendingLogs = []
      this.savePendingLogs()

      for (const { logEntry, userId: logUserId } of logs) {
        // Use the provided userId if the log doesn't have one
        await this.writeLog(logEntry, logUserId || userId, false)
      }
    } catch (error) {
      console.error("Failed to process pending logs:", error)
    } finally {
      this.isProcessingPendingLogs = false
    }
  }

  private async writeLog(logEntry: LogEntry, userId?: string, allowQueue = true) {
    try {
      // Skip logging if we're not in a browser environment
      if (typeof window === "undefined") return

      const clientInfo = await this.getClientInfo()

      const logData = {
        ...logEntry,
        timestamp: serverTimestamp(),
        sessionId: this.sessionId,
        userAgent: clientInfo.userAgent,
        ipAddress: clientInfo.ipAddress,
      }

      // Only add userId if it's defined
      if (userId || logEntry.userId) {
        logData.userId = userId || logEntry.userId
      }

      // Determine the collection path based on log type and user
      let collectionPath: string

      if (logEntry.type === "login" || logEntry.type === "logout") {
        // Authentication logs go to authLogs collection
        collectionPath = "authLogs"
      } else if (logEntry.type === "system_error" || logEntry.type === "unauthorized_access") {
        // System logs go to systemLogs collection
        collectionPath = "systemLogs"
      } else if (logData.userId) {
        // User-specific logs go to users/{userId}/logs subcollection
        collectionPath = `users/${logData.userId}/logs`
      } else {
        // Fallback to systemLogs for logs without userId
        collectionPath = "systemLogs"
      }

      try {
        // Remove any undefined values from the log data, including nested objects
        const cleanedLogData = this.cleanUndefinedValues(logData)

        console.log(`📝 Writing log to: ${collectionPath}`, cleanedLogData)

        // Try to write to Firestore
        const docRef = await addDoc(collection(db, collectionPath), cleanedLogData)
        console.log(`✅ Log written successfully with ID: ${docRef.id}`)
      } catch (error) {
        console.error(`❌ Failed to write log to ${collectionPath}:`, error)

        // If we get a permission error and queueing is allowed, queue the log for later
        if (
          allowQueue &&
          error instanceof Error &&
          (error.message.includes("permission") || error.message.includes("unauthorized"))
        ) {
          console.log(`📦 Queueing log for later: ${logEntry.type}`)
          this.pendingLogs.push({ logEntry, userId })
          this.savePendingLogs()
        }
      }
    } catch (error) {
      console.error("Failed to prepare log:", error)
      // Don't throw error to avoid breaking the main application flow
    }
  }

  // Authentication Logs
  async logLogin(success: boolean, email?: string, userId?: string, userRole?: string, errorMessage?: string) {
    const logEntry: LoginLog = {
      type: "login",
      success,
      email,
      userId,
      userRole,
      errorMessage,
      loginMethod: "email_password",
      timestamp: serverTimestamp(),
    }
    await this.writeLog(logEntry, userId)
  }

  async logLogout(userId: string, userRole?: string) {
    const sessionDuration = Date.now() - this.sessionStartTime

    // Log session end
    const sessionLog: SessionLog = {
      type: "session_end",
      userId,
      userRole,
      sessionDuration,
      timestamp: serverTimestamp(),
    }
    await this.writeLog(sessionLog, userId)

    // Log logout
    const logoutLog: LoginLog = {
      type: "logout",
      success: true,
      userId,
      userRole,
      timestamp: serverTimestamp(),
    }
    await this.writeLog(logoutLog, userId)
  }

  // Update the logSessionStart method to handle authentication state
  async logSessionStart() {
    // Only log if we have a userId
    if (typeof window !== "undefined") {
      const sessionLog: SessionLog = {
        type: "session_start",
        timestamp: serverTimestamp(),
      }
      await this.writeLog(sessionLog)
    }
  }

  // Security Logs
  async logUnauthorizedAccess(targetPath: string, attemptedAction: string, denialReason: string, userId?: string) {
    const logEntry: UnauthorizedAccessLog = {
      type: "unauthorized_access",
      targetPath,
      attemptedAction,
      denialReason,
      timestamp: serverTimestamp(),
    }

    // Only add userId to logEntry if it's defined
    if (userId) {
      logEntry.userId = userId
    }

    await this.writeLog(logEntry, userId)
  }

  // Error Logs
  async logSystemError(
    errorMessage: string,
    component: string,
    userId?: string,
    stackTrace?: string,
    errorCode?: string,
  ) {
    const logEntry: SystemErrorLog = {
      type: "system_error",
      errorMessage,
      component,
      timestamp: serverTimestamp(),
    }

    // Only add optional fields if they're defined
    if (userId) logEntry.userId = userId
    if (stackTrace) logEntry.stackTrace = stackTrace
    if (errorCode) logEntry.errorCode = errorCode

    await this.writeLog(logEntry, userId)
  }

  // API Logs
  async logApiRequest(
    endpoint: string,
    method: string,
    responseTime: number,
    statusCode: number,
    userId?: string,
    payload?: any,
  ) {
    const logEntry: ApiRequestLog = {
      type: "api_request",
      endpoint,
      method,
      responseTime,
      statusCode,
      success: statusCode >= 200 && statusCode < 300,
      timestamp: serverTimestamp(),
    }

    // Only add optional fields if they're defined
    if (userId) logEntry.userId = userId
    if (payload !== undefined) logEntry.payload = payload

    await this.writeLog(logEntry, userId)
  }

  // Page Navigation Logs
  async logPageView(pageName: string, pageUrl: string, userId: string, referrer?: string) {
    // Log time spent on previous page if there was one
    if (this.currentPage && this.pageStartTime) {
      const timeSpent = Date.now() - this.pageStartTime
      // Don't log if time spent is too short (likely a redirect)
      if (timeSpent > 1000) {
        const previousPageLog: PageViewLog = {
          type: "page_view",
          pageName: this.currentPage,
          pageUrl: this.currentPage,
          timeSpent,
          userId,
          timestamp: serverTimestamp(),
        }
        await this.writeLog(previousPageLog, userId)
      }
    }

    // Log new page view
    const logEntry: PageViewLog = {
      type: "page_view",
      pageName,
      pageUrl,
      referrer,
      userId,
      timestamp: serverTimestamp(),
    }

    this.currentPage = pageName
    this.pageStartTime = Date.now()

    await this.writeLog(logEntry, userId)
  }

  // User Activity Logs
  async logBookSearch(
    searchQuery: string,
    filters: { genre?: string; availability?: string },
    resultsCount: number,
    userId: string,
  ) {
    // Clean the filters to remove undefined values
    const cleanedFilters: { genre?: string; availability?: string } = {}
    if (filters.genre !== undefined && filters.genre !== "all") {
      cleanedFilters.genre = filters.genre
    }
    if (filters.availability !== undefined && filters.availability !== "all") {
      cleanedFilters.availability = filters.availability
    }

    const logEntry: BookSearchLog = {
      type: "book_search",
      searchQuery: searchQuery || "",
      filters: cleanedFilters,
      resultsCount,
      userId,
      timestamp: serverTimestamp(),
    }
    await this.writeLog(logEntry, userId)
  }

  async logFilterChange(
    section: "books" | "borrowings",
    filterType: "genre" | "availability" | "status" | "search",
    filterValue: string,
    userId: string,
    previousValue?: string,
    resultsCount?: number,
  ) {
    const logEntry: FilterChangeLog = {
      type: "filter_change",
      section,
      filterType,
      filterValue,
      previousValue,
      resultsCount,
      userId,
      timestamp: serverTimestamp(),
    }
    await this.writeLog(logEntry, userId)
  }

  async logBookView(bookId: string, bookTitle: string, userId: string, source?: "search" | "browse" | "direct") {
    const logEntry: BookViewLog = {
      type: "book_view",
      bookId,
      bookTitle,
      source,
      userId,
      timestamp: serverTimestamp(),
    }
    await this.writeLog(logEntry, userId)
  }

  async logBorrowRequest(
    bookId: string,
    bookTitle: string,
    requestStatus: "submitted" | "failed" | "already_requested",
    userId: string,
    errorReason?: string,
  ) {
    const logEntry: BorrowRequestLog = {
      type: "borrow_request",
      bookId,
      bookTitle,
      requestStatus,
      errorReason,
      userId,
      timestamp: serverTimestamp(),
    }
    await this.writeLog(logEntry, userId)
  }

  async logReturnRequest(
    bookId: string,
    bookTitle: string,
    originalBorrowingId: string,
    isOverdue: boolean,
    userId: string,
    requestStatus: "submitted" | "failed" = "submitted",
    daysPastDue?: number,
  ) {
    const logEntry: ReturnRequestLog = {
      type: "return_request",
      bookId,
      bookTitle,
      originalBorrowingId,
      isOverdue,
      daysPastDue,
      requestStatus,
      userId,
      timestamp: serverTimestamp(),
    }
    await this.writeLog(logEntry, userId)
  }

  async logViewHistory(historyType: "borrowings" | "profile" | "dashboard", userId: string) {
    const logEntry: ViewHistoryLog = {
      type: "view_history",
      historyType,
      userId,
      timestamp: serverTimestamp(),
    }
    await this.writeLog(logEntry, userId)
  }

  async logTabSwitch(
    section: "borrowings",
    fromTab: string,
    toTab: string,
    userId: string,
    timeSpentOnPreviousTab?: number,
  ) {
    const logEntry: TabSwitchLog = {
      type: "tab_switch",
      section,
      fromTab,
      toTab,
      timeSpentOnPreviousTab,
      userId,
      timestamp: serverTimestamp(),
    }
    await this.writeLog(logEntry, userId)
  }

  async logUserInteraction(
    action: "click" | "hover" | "scroll" | "focus",
    element: string,
    section: string,
    userId: string,
    elementId?: string,
    additionalData?: Record<string, any>,
  ) {
    const logEntry: UserInteractionLog = {
      type: "user_interaction",
      action,
      element,
      elementId,
      section,
      additionalData,
      userId,
      timestamp: serverTimestamp(),
    }
    await this.writeLog(logEntry, userId)
  }
}

// Create a singleton instance
export const logger = new Logger()

// Error boundary helper
export const withErrorLogging = (component: string) => {
  return (error: Error, userId?: string) => {
    logger.logSystemError(error.message, component, userId, error.stack, error.name)
  }
}

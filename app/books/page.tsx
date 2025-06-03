"use client"

import { useState, useEffect, useRef } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { Navbar } from "@/components/navbar"
import { BookCard } from "@/components/book-card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { collection, getDocs, query } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Search, Filter, BookOpen } from 'lucide-react'
import { logger, withErrorLogging } from "@/lib/logger"
import { useAuth } from "@/contexts/auth-context"

interface Book {
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

export default function BooksPage() {
  const { user } = useAuth()
  const [books, setBooks] = useState<Book[]>([])
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedGenre, setSelectedGenre] = useState("all")
  const [availabilityFilter, setAvailabilityFilter] = useState("all")
  const [genres, setGenres] = useState<string[]>([])
  
  // For tracking filter changes
  const previousFilters = useRef({
    searchTerm: "",
    selectedGenre: "all",
    availabilityFilter: "all"
  })

  const logError = withErrorLogging("BooksPage")

  useEffect(() => {
    fetchBooks()
    
    // Log page view
    if (user) {
      logger.logPageView("Browse Books", "/books", user.uid, document.referrer)
    }
  }, [user])

  useEffect(() => {
    filterBooks()
  }, [books, searchTerm, selectedGenre, availabilityFilter])

  // Log search and filter changes with debouncing
  useEffect(() => {
    if (user && books.length > 0) {
      const timeoutId = setTimeout(() => {
        // Log search if search term changed
        if (searchTerm !== previousFilters.current.searchTerm) {
          logger.logFilterChange(
            "books",
            "search",
            searchTerm,
            user.uid,
            previousFilters.current.searchTerm,
            filteredBooks.length
          )
          previousFilters.current.searchTerm = searchTerm
        }

        // Log genre filter change
        if (selectedGenre !== previousFilters.current.selectedGenre) {
          logger.logFilterChange(
            "books",
            "genre",
            selectedGenre,
            user.uid,
            previousFilters.current.selectedGenre,
            filteredBooks.length
          )
          previousFilters.current.selectedGenre = selectedGenre
        }

        // Log availability filter change
        if (availabilityFilter !== previousFilters.current.availabilityFilter) {
          logger.logFilterChange(
            "books",
            "availability",
            availabilityFilter,
            user.uid,
            previousFilters.current.availabilityFilter,
            filteredBooks.length
          )
          previousFilters.current.availabilityFilter = availabilityFilter
        }

        // Log overall search with current filters
        logger.logBookSearch(
          searchTerm,
          {
            genre: selectedGenre !== "all" ? selectedGenre : undefined,
            availability: availabilityFilter !== "all" ? availabilityFilter : undefined,
          },
          filteredBooks.length,
          user.uid,
        )
      }, 1000) // Debounce search logging

      return () => clearTimeout(timeoutId)
    }
  }, [searchTerm, selectedGenre, availabilityFilter, filteredBooks.length, user, books.length])

  const fetchBooks = async () => {
    const startTime = Date.now()

    try {
      // Simple query without orderBy to avoid composite index requirement
      const q = query(collection(db, "books"))
      const querySnapshot = await getDocs(q)
      const booksData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Book[]

      // Sort on the client side instead
      booksData.sort((a, b) => a.title.localeCompare(b.title))

      setBooks(booksData)

      // Extract unique genres
      const uniqueGenres = [...new Set(booksData.map((book) => book.genre))]
      setGenres(uniqueGenres)

      // Log successful API request
      if (user) {
        await logger.logApiRequest("/api/books", "GET", Date.now() - startTime, 200, user.uid)
      }
    } catch (error: any) {
      console.error("Error fetching books:", error)
      logError(error, user?.uid)

      // Log failed API request
      if (user) {
        await logger.logApiRequest("/api/books", "GET", Date.now() - startTime, 500, user.uid)
      }
    } finally {
      setLoading(false)
    }
  }

  const filterBooks = () => {
    let filtered = books

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (book) =>
          book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
          book.description.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Genre filter
    if (selectedGenre !== "all") {
      filtered = filtered.filter((book) => book.genre === selectedGenre)
    }

    // Availability filter
    if (availabilityFilter === "available") {
      filtered = filtered.filter((book) => book.availableCopies > 0)
    } else if (availabilityFilter === "unavailable") {
      filtered = filtered.filter((book) => book.availableCopies === 0)
    }

    setFilteredBooks(filtered)
  }

  const clearFilters = () => {
    // Log clear filters action
    if (user) {
      logger.logUserInteraction("click", "clear_filters_button", "books", user.uid, "clear-filters-btn")
    }

    setSearchTerm("")
    setSelectedGenre("all")
    setAvailabilityFilter("all")
  }

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    
    // Log immediate search interaction
    if (user) {
      logger.logUserInteraction("focus", "search_input", "books", user.uid, "search-input", {
        searchLength: value.length,
        hasValue: value.length > 0
      })
    }
  }

  const handleGenreChange = (value: string) => {
    if (user) {
      logger.logUserInteraction("click", "genre_select", "books", user.uid, "genre-select", {
        selectedGenre: value
      })
    }
    setSelectedGenre(value)
  }

  const handleAvailabilityChange = (value: string) => {
    if (user) {
      logger.logUserInteraction("click", "availability_select", "books", user.uid, "availability-select", {
        selectedAvailability: value
      })
    }
    setAvailabilityFilter(value)
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Browse Books</h1>
            <p className="text-gray-600">Discover and request books from our library collection</p>
          </div>

          {/* Search and Filters */}
          <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="search-input"
                  placeholder="Search books, authors..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={selectedGenre} onValueChange={handleGenreChange}>
                <SelectTrigger id="genre-select">
                  <SelectValue placeholder="Select genre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genres</SelectItem>
                  {genres.map((genre) => (
                    <SelectItem key={genre} value={genre}>
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={availabilityFilter} onValueChange={handleAvailabilityChange}>
                <SelectTrigger id="availability-select">
                  <SelectValue placeholder="Availability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Books</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="unavailable">Not Available</SelectItem>
                </SelectContent>
              </Select>

              <Button id="clear-filters-btn" variant="outline" onClick={clearFilters}>
                <Filter className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Results */}
          <div className="mb-6">
            <p className="text-gray-600">
              Showing {filteredBooks.length} of {books.length} books
            </p>
          </div>

          {/* Books Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
                  <div className="aspect-[3/4] bg-gray-200 rounded-lg mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No books found</h3>
              <p className="text-gray-600 mb-4">Try adjusting your search criteria or clear the filters</p>
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredBooks.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

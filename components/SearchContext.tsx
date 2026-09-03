'use client'

// Общее состояние поиска главной: поле живёт в шапке (Navbar, десктоп),
// читает его лента контента (HomeFeed). Мобильное поле — тот же контекст.

import { createContext, useContext, useState } from 'react'

interface SearchState {
  query: string
  setQuery: (q: string) => void
}

const SearchContext = createContext<SearchState>({ query: '', setQuery: () => {} })

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('')
  return <SearchContext.Provider value={{ query, setQuery }}>{children}</SearchContext.Provider>
}

export function useSearch() {
  return useContext(SearchContext)
}
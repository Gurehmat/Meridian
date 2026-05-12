import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import type { GraphNode } from '../types'

type NavbarProps = {
  nodes: GraphNode[]
  onSearchAndFocusNode: (node: GraphNode) => void
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 20 20">
      <path
        d="m14.5 14.5 3 3M8.75 15.5a6.75 6.75 0 1 1 0-13.5 6.75 6.75 0 0 1 0 13.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.75"
      />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 20 20">
      <path
        d="M6 7.5a4 4 0 1 1 8 0c0 4 1.5 5 1.5 5h-11s1.5-1 1.5-5ZM8.5 15.5h3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 20 20">
      <path
        d="M10 12.75A2.75 2.75 0 1 0 10 7.25a2.75 2.75 0 0 0 0 5.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M16.5 11.25v-2.5l-2.04-.35a5.8 5.8 0 0 0-.48-1.17l1.2-1.7-1.77-1.76-1.7 1.2a5.8 5.8 0 0 0-1.16-.48L10.2 2.5H7.7l-.35 2.04c-.41.12-.8.28-1.17.48l-1.7-1.2-1.76 1.77 1.2 1.7c-.2.36-.36.75-.48 1.16L1.5 8.8v2.5l2.04.35c.12.41.28.8.48 1.17l-1.2 1.7 1.77 1.76 1.7-1.2c.36.2.75.36 1.16.48l.35 1.94h2.5l.35-2.04c.41-.12.8-.28 1.17-.48l1.7 1.2 1.76-1.77-1.2-1.7c.2-.36.36-.75.48-1.16l1.94-.3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  )
}

function getUserInitial(displayName?: string | null, email?: string | null) {
  const label = displayName?.trim() || email?.trim() || '?'

  return label.charAt(0).toUpperCase()
}

function nodeTypeLabel(node: GraphNode) {
  return node.type ?? 'concept'
}

export function Navbar({ nodes, onSearchAndFocusNode }: NavbarProps) {
  const navigate = useNavigate()
  const { signOut, user } = useAuth()
  const searchRef = useRef<HTMLDivElement | null>(null)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const userLabel = user?.displayName || user?.email || 'User'
  const userInitial = getUserInitial(user?.displayName, user?.email)
  const trimmedQuery = query.trim()
  const matchingNodes = useMemo(() => {
    if (!trimmedQuery) {
      return []
    }

    const normalizedQuery = trimmedQuery.toLowerCase()

    return nodes
      .filter((node) => node.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 8)
  }, [nodes, trimmedQuery])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!searchRef.current?.contains(event.target as Node)) {
        setIsSearchOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  async function handleSignOut() {
    await signOut()
    setIsUserMenuOpen(false)
    navigate('/')
  }

  function handleResultClick(node: GraphNode) {
    setQuery(node.name)
    setIsSearchOpen(false)
    onSearchAndFocusNode(node)
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e7e5e4] bg-white px-6">
      <div className="text-[18px] font-bold leading-none text-[#0c0a09]">Meridian</div>

      <div className="relative block w-[320px] text-[#57534e]" ref={searchRef}>
        <span className="absolute left-3 top-1/2 -translate-y-1/2">
          <SearchIcon />
        </span>
        <input
          aria-label="Search nodes"
          className="h-9 w-full rounded-lg border border-[#d6d3d1] bg-white pl-9 pr-3 text-[14px] text-[#1c1917] outline-none placeholder:text-[#a8a29e] focus:border-[#4338ca] focus:ring-2 focus:ring-[#4338ca]/15"
          onChange={(event) => {
            setQuery(event.target.value)
            setIsSearchOpen(true)
          }}
          onFocus={() => setIsSearchOpen(Boolean(trimmedQuery))}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setIsSearchOpen(false)
            }
          }}
          placeholder="Search nodes..."
          type="search"
          value={query}
        />
        {isSearchOpen && trimmedQuery ? (
          <div className="absolute left-0 top-11 z-30 w-full overflow-hidden rounded-lg border border-[#e7e5e4] bg-white py-2 shadow-md">
            {matchingNodes.length === 0 ? (
              <div className="px-3 py-2 text-[13px] text-[#a8a29e]">No nodes found</div>
            ) : null}
            {matchingNodes.map((node) => (
              <button
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[#f5f5f4] focus:bg-[#f5f5f4] focus:outline-none"
                key={node.id}
                onClick={() => handleResultClick(node)}
                type="button"
              >
                <span className="truncate text-[14px] leading-5 text-[#1c1917]">
                  {node.name}
                </span>
                <span className="shrink-0 text-[11px] uppercase leading-4 text-[#a8a29e]">
                  {nodeTypeLabel(node)}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-4 text-[#57534e]">
        <button
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[#f5f5f4]"
          type="button"
        >
          <BellIcon />
        </button>
        <button
          aria-label="Settings"
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[#f5f5f4]"
          type="button"
        >
          <SettingsIcon />
        </button>
        <div className="relative">
          <button
            aria-expanded={isUserMenuOpen}
            aria-label="Account menu"
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#4338ca] text-[14px] font-semibold text-white hover:ring-2 hover:ring-[#4338ca]/20"
            onClick={() => setIsUserMenuOpen((isOpen) => !isOpen)}
            title={userLabel}
            type="button"
          >
            {user?.photoURL ? (
              <img
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
                src={user.photoURL}
              />
            ) : (
              userInitial
            )}
          </button>

          {isUserMenuOpen ? (
            <div className="absolute right-0 top-11 z-30 w-48 rounded-lg border border-[#e7e5e4] bg-white py-2 text-[#1c1917] shadow-md">
              <div className="truncate px-3 pb-2 text-[12px] text-[#78716c]" title={userLabel}>
                {userLabel}
              </div>
              <button
                className="w-full px-3 py-2 text-left text-[14px] text-[#1c1917] hover:bg-[#f5f5f4]"
                onClick={() => void handleSignOut()}
                type="button"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}

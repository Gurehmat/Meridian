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

export function Navbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e7e5e4] bg-white px-6">
      <div className="text-[18px] font-bold leading-none text-[#0c0a09]">Meridian</div>

      <label className="relative block w-[320px] text-[#57534e]">
        <span className="absolute left-3 top-1/2 -translate-y-1/2">
          <SearchIcon />
        </span>
        <input
          className="h-9 w-full rounded-lg border border-[#d6d3d1] bg-white pl-9 pr-3 text-[14px] text-[#1c1917] outline-none placeholder:text-[#a8a29e] focus:border-[#4338ca] focus:ring-2 focus:ring-[#4338ca]/15"
          placeholder="Search nodes..."
          type="search"
        />
      </label>

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
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4338ca] text-[14px] font-semibold text-white">
          G
        </div>
      </div>
    </header>
  )
}

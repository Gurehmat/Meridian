import { useNavigate } from 'react-router-dom'

function Landing() {
  const navigate = useNavigate()

  return (
    <main className="flex min-h-svh items-center justify-center bg-[#fafaf9] bg-[radial-gradient(circle,#e7e5e4_1px,transparent_1px)] [background-size:24px_24px] px-6 py-8 text-[#0c0a09]">
      <section className="flex w-full max-w-[400px] flex-col items-center rounded-[12px] border border-[#e7e5e4] bg-white px-10 py-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#4338ca] text-white">
          <svg
            aria-hidden="true"
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 32 32"
          >
            <path
              d="M10 9v14h12"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
            />
            <rect fill="currentColor" height="6" rx="1.2" width="6" x="7" y="6" />
            <rect fill="currentColor" height="6" rx="1.2" width="6" x="7" y="13" />
            <rect fill="currentColor" height="6" rx="1.2" width="6" x="7" y="20" />
            <rect fill="currentColor" height="6" rx="1.2" width="6" x="20" y="20" />
          </svg>
        </div>

        <h1 className="mt-6 text-[32px] font-bold leading-[1.15] text-[#0c0a09]">
          Meridian
        </h1>
        <p className="mt-3 text-[16px] font-normal leading-6 text-[#57534e]">
          Map your mind. Find what conflicts.
        </p>

        <button
          className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#4338ca] text-[14px] font-medium text-white transition-colors hover:bg-[#3730a3] focus:outline-none focus:ring-2 focus:ring-[#4338ca] focus:ring-offset-2"
          onClick={() => navigate('/app')}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 16 16"
          >
            <path
              d="M3 8h9m0 0L8.5 4.5M12 8l-3.5 3.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
            />
          </svg>
          Sign in with Google
        </button>

        <a
          className="mt-5 text-[14px] font-normal leading-5 text-[#4338ca] hover:text-[#3730a3]"
          href="#create-account"
        >
          Create an account
        </a>

        <p className="mt-8 max-w-[280px] text-center text-[12px] font-normal leading-5 text-[#a8a29e]">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </section>
    </main>
  )
}

export default Landing

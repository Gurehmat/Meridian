import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Connection, Contradiction, GraphNode, IngestResponse } from '../types'

export type SidebarTab = 'insights' | 'input'

type LeftSidebarProps = {
  activeTab: SidebarTab
  connections: Connection[]
  contradictions: Contradiction[]
  graphNodes: GraphNode[]
  isIngesting: boolean
  onActiveTabChange: (tab: SidebarTab) => void
  onIngestText: (content: string) => Promise<IngestResponse>
  onNodeSelect: (node: GraphNode) => void
}

function MeridianMark() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4338ca] text-white">
      <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 32 32">
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
  )
}

function WarningIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path
        d="M8 2 14.5 13H1.5L8 2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path d="M8 6v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      <path d="M8 11.5h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path
        d="M6.5 9.5 9.5 6.5M6.25 5.25l.5-.5a3 3 0 0 1 4.24 4.24l-.5.5M9.75 10.75l-.5.5a3 3 0 1 1-4.24-4.24l.5-.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function ArchiveIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path
        d="M3 5.5h10v7H3v-7ZM2.5 3.5h11v2h-11v-2ZM6.5 8h3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path
        d="M3 4.5h10M6.5 2.5h3M5 4.5l.5 9h5l.5-9M7 7v4M9 7v4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  )
}

function stripMarkdownEmphasis(text: string) {
  return text.replace(/\*/g, '')
}

function isSelfComparison(conceptA: string, conceptB: string) {
  return conceptA.trim().toLowerCase() === conceptB.trim().toLowerCase()
}

function normalizeConceptName(name: string) {
  return name.trim().toLowerCase()
}

function PatternCard({
  accentClass,
  children,
  description,
  isExpanded,
  onClick,
  title,
}: {
  accentClass: string
  children: ReactNode
  description: string
  isExpanded: boolean
  onClick: () => void
  title: string
}) {
  return (
    <button
      aria-expanded={isExpanded}
      className={`w-full rounded-lg border border-[#e7e5e4] border-l-4 bg-white p-4 text-left shadow-sm transition-colors hover:bg-[#fafaf9] focus:outline-none focus:ring-2 focus:ring-[#4338ca] focus:ring-offset-2 ${accentClass}`}
      onClick={onClick}
      type="button"
    >
      <h3 className="flex items-center gap-2 text-[14px] font-bold leading-5 text-[#1c1917]">
        {children}
        {title}
      </h3>
      <p
        className={`mt-2 text-[13px] leading-5 text-[#57534e] ${
          isExpanded
            ? ''
            : 'overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]'
        }`}
      >
        {stripMarkdownEmphasis(description)}
      </p>
    </button>
  )
}

export function LeftSidebar({
  activeTab,
  connections,
  contradictions,
  graphNodes,
  isIngesting,
  onActiveTabChange,
  onIngestText,
  onNodeSelect,
}: LeftSidebarProps) {
  const [content, setContent] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [expandedPatternKey, setExpandedPatternKey] = useState<string | null>(null)
  const visibleContradictions = contradictions.filter(
    (contradiction) =>
      !isSelfComparison(contradiction.concept_a, contradiction.concept_b),
  )
  const visibleConnections = connections.filter(
    (connection) => !isSelfComparison(connection.concept_a, connection.concept_b),
  )

  useEffect(() => {
    if (!successMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null)
    }, 3000)

    return () => window.clearTimeout(timeoutId)
  }, [successMessage])

  async function handleSubmit() {
    if (isIngesting) {
      return
    }

    const trimmedContent = content.trim()

    if (!trimmedContent) {
      setInputError('Add text before sending it to the graph.')
      return
    }

    setInputError(null)
    setSuccessMessage(null)

    try {
      const result = await onIngestText(trimmedContent)
      setContent('')
      setSuccessMessage(`Added ${result.concepts_added} concepts`)
    } catch {
      setInputError('Processing failed. Try again.')
    }
  }

  function selectRelatedNode(conceptA: string, conceptB: string, patternKey: string) {
    setExpandedPatternKey((currentKey) => (currentKey === patternKey ? null : patternKey))

    const matchingNode = graphNodes.find((node) => {
      const nodeName = normalizeConceptName(node.name)

      return nodeName === normalizeConceptName(conceptA) || nodeName === normalizeConceptName(conceptB)
    })

    if (matchingNode) {
      onNodeSelect(matchingNode)
    }
  }

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-r border-[#e7e5e4] bg-white">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
        <div className="flex items-center gap-3">
          <MeridianMark />
          <div>
            <div className="text-[15px] font-bold leading-5 text-[#0c0a09]">Meridian</div>
            <div className="text-[13px] leading-5 text-[#a8a29e]">Map your mind</div>
          </div>
        </div>

        <div className="mt-6 flex border-b border-[#e7e5e4]" role="tablist">
          <button
            aria-selected={activeTab === 'insights'}
            className={`h-10 flex-1 border-b-2 text-[14px] font-medium ${
              activeTab === 'insights'
                ? 'border-[#4338ca] text-[#4338ca]'
                : 'border-transparent text-[#57534e]'
            }`}
            onClick={() => onActiveTabChange('insights')}
            role="tab"
            type="button"
          >
            Insights
          </button>
          <button
            aria-selected={activeTab === 'input'}
            className={`h-10 flex-1 border-b-2 text-[14px] font-medium ${
              activeTab === 'input'
                ? 'border-[#4338ca] text-[#4338ca]'
                : 'border-transparent text-[#57534e]'
            }`}
            onClick={() => onActiveTabChange('input')}
            role="tab"
            type="button"
          >
            Input
          </button>
        </div>

        {activeTab === 'insights' ? (
          <div className="mt-6 space-y-6">
            {visibleContradictions.length === 0 && visibleConnections.length === 0 ? (
              <p className="text-[13px] leading-5 text-[#a8a29e]">
                Add more knowledge to discover patterns
              </p>
            ) : null}
            <section className="space-y-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[#a8a29e]">
                CONTRADICTIONS
              </h2>
              {visibleContradictions.length === 0 ? (
                <p className="text-[13px] leading-5 text-[#a8a29e]">
                  No contradictions found yet.
                </p>
              ) : null}
              {visibleContradictions.map((contradiction) => {
                const patternKey =
                  contradiction.id ??
                  contradiction._id ??
                  `contradiction-${contradiction.concept_a}-${contradiction.concept_b}`

                return (
                  <PatternCard
                    accentClass="border-l-[#e11d48]"
                    description={contradiction.explanation}
                    isExpanded={expandedPatternKey === patternKey}
                    key={patternKey}
                    onClick={() =>
                      selectRelatedNode(
                        contradiction.concept_a,
                        contradiction.concept_b,
                        patternKey,
                      )
                    }
                    title={`${contradiction.concept_a} vs ${contradiction.concept_b}`}
                  >
                    <span className="text-[#e11d48]">
                      <WarningIcon />
                    </span>
                  </PatternCard>
                )
              })}
            </section>
            <section className="space-y-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[#a8a29e]">
                CONNECTIONS
              </h2>
              {visibleConnections.length === 0 ? (
                <p className="text-[13px] leading-5 text-[#a8a29e]">
                  No connections found yet.
                </p>
              ) : null}
              {visibleConnections.map((connection) => {
                const patternKey =
                  connection.id ??
                  connection._id ??
                  `connection-${connection.concept_a}-${connection.concept_b}`

                return (
                  <PatternCard
                    accentClass="border-l-[#059669]"
                    description={connection.explanation}
                    isExpanded={expandedPatternKey === patternKey}
                    key={patternKey}
                    onClick={() =>
                      selectRelatedNode(connection.concept_a, connection.concept_b, patternKey)
                    }
                    title={`${connection.concept_a} + ${connection.concept_b}`}
                  >
                    <span className="text-[#059669]">
                      <LinkIcon />
                    </span>
                  </PatternCard>
                )
              })}
            </section>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <textarea
              className="h-[120px] w-full resize-none rounded-lg border border-[#d6d3d1] bg-white p-3 text-[14px] leading-5 text-[#1c1917] outline-none placeholder:text-[#a8a29e] focus:border-[#4338ca] focus:ring-2 focus:ring-[#4338ca]/15"
              disabled={isIngesting}
              onChange={(event) => {
                setContent(event.target.value)
                setInputError(null)
              }}
              placeholder="Paste text, ideas, or notes..."
              value={content}
            />
            <button
              className="flex h-20 w-full items-center justify-center rounded-lg border-2 border-dashed border-[#d6d3d1] px-4 text-center text-[13px] leading-5 text-[#a8a29e] hover:border-[#a8a29e]"
              type="button"
            >
              Drop a PDF here or click to upload
            </button>
            {inputError ? (
              <p className="text-[13px] leading-5 text-[#e11d48]">{inputError}</p>
            ) : null}
            {successMessage ? (
              <p className="text-[13px] leading-5 text-[#059669]">{successMessage}</p>
            ) : null}
            <button
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#4338ca] text-[14px] font-medium text-white transition-colors hover:bg-[#3730a3] focus:outline-none focus:ring-2 focus:ring-[#4338ca] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#a8a29e]"
              disabled={isIngesting}
              onClick={handleSubmit}
              type="button"
            >
              {isIngesting ? (
                <>
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
                  />
                  Processing...
                </>
              ) : (
                'Add to Graph'
              )}
            </button>
          </div>
        )}
      </div>

      <nav className="space-y-1 border-t border-[#e7e5e4] p-5">
        <a
          className="flex h-9 items-center gap-3 rounded-lg px-2 text-[14px] text-[#57534e] hover:bg-[#f5f5f4]"
          href="#archive"
        >
          <ArchiveIcon />
          Archive
        </a>
        <a
          className="flex h-9 items-center gap-3 rounded-lg px-2 text-[14px] text-[#57534e] hover:bg-[#f5f5f4]"
          href="#trash"
        >
          <TrashIcon />
          Trash
        </a>
      </nav>
    </aside>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, ReactNode } from 'react'
import type {
  BeliefShift,
  Connection,
  Contradiction,
  Entry,
  GraphNode,
  IngestResponse,
} from '../types'

export type SidebarTab = 'insights' | 'input' | 'timeline' | 'entries'

type LeftSidebarProps = {
  activeTab: SidebarTab
  connections: Connection[]
  contradictions: Contradiction[]
  entries: Entry[]
  graphNodes: GraphNode[]
  isIngesting: boolean
  onActiveTabChange: (tab: SidebarTab) => void
  onIngestPDF: (file: File) => Promise<IngestResponse>
  onIngestText: (content: string) => Promise<IngestResponse>
  onNodeSelect: (node: GraphNode) => void
  selectedNodeId?: string | null
  timeline: BeliefShift[]
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

function stripMarkdownEmphasis(text: string) {
  return text.replace(/\*/g, '')
}

function previewInputText(text: string) {
  return text.length > 40 ? `${text.slice(0, 40)}...` : text
}

function previewEntryText(text: string) {
  return text.length > 80 ? `${text.slice(0, 80)}...` : text
}

function isSelfComparison(conceptA: string, conceptB: string) {
  return conceptA.trim().toLowerCase() === conceptB.trim().toLowerCase()
}

function normalizeConceptName(name: string) {
  return name.trim().toLowerCase()
}

function formatTimestamp(timestamp?: string) {
  if (!timestamp) {
    return 'Unknown time'
  }

  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown time'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatEntryDate(timestamp?: string) {
  if (!timestamp) {
    return 'Unknown date'
  }

  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date'
  }

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
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

function TimelineCard({ shift }: { shift: BeliefShift }) {
  return (
    <article className="rounded-lg border border-[#e7e5e4] border-l-4 border-l-[#8b5cf6] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-bold leading-5 text-[#1c1917]">
          {shift.concept_name}
        </h3>
        <span className="rounded-full bg-[#f5f3ff] px-2 py-1 text-[11px] font-medium leading-4 text-[#6d28d9]">
          evolved
        </span>
      </div>
      <div className="mt-3 space-y-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#a8a29e]">
            Before
          </div>
          <p className="mt-1 text-[13px] leading-5 text-[#78716c]">
            {shift.previous_description}
          </p>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#a8a29e]">
            After
          </div>
          <p className="mt-1 text-[13px] leading-5 text-[#1c1917]">
            {shift.new_description}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-5 text-[#57534e]">
        {shift.shift_explanation}
      </p>
      <time className="mt-3 block text-[11px] leading-4 text-[#a8a29e]">
        {formatTimestamp(shift.created_at)}
      </time>
    </article>
  )
}

function EntryCard({
  entry,
  isSelected,
  matchingNode,
  onNodeSelect,
}: {
  entry: Entry
  isSelected: boolean
  matchingNode?: GraphNode
  onNodeSelect: (node: GraphNode) => void
}) {
  return (
    <button
      className={`w-full rounded-lg border bg-white px-4 py-3 text-left transition-all hover:border-[#4338ca] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4338ca] focus:ring-offset-2 ${
        isSelected
          ? 'border-[#e7e5e4] border-l-4 border-l-[#4338ca]'
          : 'border-[#e7e5e4]'
      } cursor-pointer`}
      onClick={() => {
        if (matchingNode) {
          onNodeSelect(matchingNode)
        }
      }}
      type="button"
    >
      <p className="text-[13px] leading-5 text-[#1c1917]">
        {previewEntryText(entry.content)}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <time className="text-[11px] leading-4 text-[#a8a29e]">
          {formatEntryDate(entry.created_at)}
        </time>
        <span className="shrink-0 rounded-full bg-[#4338ca] px-2 py-1 text-[11px] font-medium leading-4 text-white">
          {entry.concept_count} concepts
        </span>
      </div>
    </button>
  )
}

export function LeftSidebar({
  activeTab,
  connections,
  contradictions,
  entries,
  graphNodes,
  isIngesting,
  onActiveTabChange,
  onIngestPDF,
  onIngestText,
  onNodeSelect,
  selectedNodeId,
  timeline,
}: LeftSidebarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [content, setContent] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [expandedPatternKey, setExpandedPatternKey] = useState<string | null>(null)
  const [isDraggingPDF, setIsDraggingPDF] = useState(false)
  const visibleContradictions = contradictions.filter(
    (contradiction) =>
      !isSelfComparison(contradiction.concept_a, contradiction.concept_b),
  )
  const visibleConnections = connections.filter(
    (connection) => !isSelfComparison(connection.concept_a, connection.concept_b),
  )
  const inputNodeById = useMemo(
    () =>
      new Map(
        graphNodes
          .filter((node) => node.type === 'input')
          .map((node) => [node.id, node]),
      ),
    [graphNodes],
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
      setSuccessMessage(
        `Added: ${previewInputText(trimmedContent)} with ${
          result.concepts_extracted ?? result.concepts_added
        } concepts extracted`,
      )
    } catch {
      setInputError('Processing failed. Try again.')
    }
  }

  async function handlePDFFile(file: File) {
    if (isIngesting) {
      return
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setInputError('Upload a PDF file.')
      setSuccessMessage(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    setInputError(null)
    setSuccessMessage(null)

    try {
      const result = await onIngestPDF(file)
      setSuccessMessage(
        `Added: ${file.name} with ${
          result.concepts_extracted ?? result.concepts_added
        } concepts extracted`,
      )
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch {
      setInputError('PDF processing failed. Try again.')
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (file) {
      void handlePDFFile(file)
    }
  }

  function handlePDFDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()

    if (!isIngesting) {
      setIsDraggingPDF(true)
    }
  }

  function handlePDFDragLeave(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setIsDraggingPDF(false)
  }

  function handlePDFDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setIsDraggingPDF(false)

    const file = event.dataTransfer.files?.[0]

    if (file) {
      void handlePDFFile(file)
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
            className={`h-10 flex-1 border-b-2 text-[13px] font-medium ${
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
            className={`h-10 flex-1 border-b-2 text-[13px] font-medium ${
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
          <button
            aria-selected={activeTab === 'timeline'}
            className={`h-10 flex-1 border-b-2 text-[13px] font-medium ${
              activeTab === 'timeline'
                ? 'border-[#4338ca] text-[#4338ca]'
                : 'border-transparent text-[#57534e]'
            }`}
            onClick={() => onActiveTabChange('timeline')}
            role="tab"
            type="button"
          >
            Timeline
          </button>
          <button
            aria-selected={activeTab === 'entries'}
            className={`h-10 flex-1 border-b-2 text-[13px] font-medium ${
              activeTab === 'entries'
                ? 'border-[#4338ca] text-[#4338ca]'
                : 'border-transparent text-[#57534e]'
            }`}
            onClick={() => onActiveTabChange('entries')}
            role="tab"
            type="button"
          >
            Entries
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
        ) : activeTab === 'timeline' ? (
          <div className="mt-6 space-y-4">
            {timeline.length === 0 ? (
              <p className="text-[13px] leading-5 text-[#a8a29e]">
                No belief changes recorded yet.
              </p>
            ) : null}
            {timeline.map((shift) => (
              <TimelineCard
                key={shift.id ?? `${shift.concept_name}-${shift.created_at}`}
                shift={shift}
              />
            ))}
          </div>
        ) : activeTab === 'entries' ? (
          <div className="mt-6 space-y-3">
            {entries.length === 0 ? (
              <p className="text-[13px] leading-5 text-[#a8a29e]">
                No entries yet. Add text in the Input tab to get started.
              </p>
            ) : null}
            {entries.map((entry) => {
              const matchingNode = inputNodeById.get(entry.id)

              return (
                <EntryCard
                  entry={entry}
                  isSelected={selectedNodeId === entry.id}
                  key={entry.id}
                  matchingNode={matchingNode}
                  onNodeSelect={onNodeSelect}
                />
              )
            })}
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
            <input
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={isIngesting}
              onChange={handleFileInputChange}
              ref={fileInputRef}
              type="file"
            />
            <button
              className={`flex h-20 w-full items-center justify-center rounded-lg border-2 border-dashed px-4 text-center text-[13px] leading-5 transition-colors focus:outline-none focus:ring-2 focus:ring-[#4338ca] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#f5f5f4] ${
                isDraggingPDF
                  ? 'border-[#4338ca] text-[#4338ca]'
                  : 'border-[#d6d3d1] text-[#a8a29e] hover:border-[#a8a29e]'
              }`}
              disabled={isIngesting}
              onClick={() => fileInputRef.current?.click()}
              onDragLeave={handlePDFDragLeave}
              onDragOver={handlePDFDragOver}
              onDrop={handlePDFDrop}
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

    </aside>
  )
}

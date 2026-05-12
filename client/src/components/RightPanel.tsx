import { useState } from 'react'
import type { BeliefShift, Connection, Contradiction, GraphNode } from '../types'

type RightPanelProps = {
  connections?: Connection[]
  contradictions?: Contradiction[]
  graphNodes?: GraphNode[]
  node?: GraphNode | null
  onClose: () => void
  onDeleteNode: (node: GraphNode) => Promise<void>
  onNodeSelect: (node: GraphNode) => void
  timeline?: BeliefShift[]
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path
        d="m4 4 8 8M12 4l-8 8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.75"
      />
    </svg>
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

function normalizeConceptName(name?: string | null) {
  return (name ?? '').trim().toLowerCase()
}

function matchesNodeName(conceptName?: string | null, nodeName?: string | null) {
  return normalizeConceptName(conceptName) === normalizeConceptName(nodeName)
}

function isInputNode(node?: GraphNode | null) {
  return node?.type === 'input'
}

function truncateText(text: string | undefined, maxLength: number) {
  if (!text) {
    return ''
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
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

export function RightPanel({
  connections,
  contradictions,
  graphNodes,
  node,
  onClose,
  onDeleteNode,
  onNodeSelect,
  timeline,
}: RightPanelProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const safeConnections = connections ?? []
  const safeContradictions = contradictions ?? []
  const safeGraphNodes = graphNodes ?? []
  const safeTimeline = timeline ?? []
  const nodeId = node?.id ?? ''
  const nodeName = node?.name ?? 'Untitled node'
  const nodeDescription = node?.description ?? ''
  const nodeType = node?.type ?? 'concept'
  const isInput = nodeType === 'input'
  const relatedContradictions = safeContradictions.filter(
    (contradiction) =>
      matchesNodeName(contradiction?.concept_a, nodeName) ||
      matchesNodeName(contradiction?.concept_b, nodeName),
  )
  const relatedConnections = safeConnections.filter(
    (connection) =>
      matchesNodeName(connection?.concept_a, nodeName) ||
      matchesNodeName(connection?.concept_b, nodeName),
  )
  const beliefHistory = [...safeTimeline]
    .filter((shift) => matchesNodeName(shift?.concept_name, nodeName))
    .sort((firstShift, secondShift) => {
      const firstTime = new Date(firstShift?.created_at ?? '').getTime()
      const secondTime = new Date(secondShift?.created_at ?? '').getTime()

      return firstTime - secondTime
    })
  const extractedConcepts = safeGraphNodes
    .filter((graphNode) => !isInputNode(graphNode) && graphNode?.source_input_id === nodeId)
    .sort((firstNode, secondNode) =>
      (firstNode?.name ?? '').localeCompare(secondNode?.name ?? ''),
    )
  const sourceInput = isInput
    ? undefined
    : safeGraphNodes.find(
        (graphNode) => isInputNode(graphNode) && graphNode?.id === node?.source_input_id,
      )
  const sourcePreview = sourceInput?.description
    ? truncateText(sourceInput.description, 60)
    : sourceInput?.name ?? 'Untitled input'

  async function handleDeleteConfirm() {
    if (!node?.id) {
      return
    }

    setDeleteError(null)
    setIsDeleting(true)

    try {
      await onDeleteNode(node)
    } catch {
      setDeleteError('Delete failed. Try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-l border-[#e7e5e4] bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#a8a29e]">
              {isInput ? 'SOURCE INPUT' : 'SELECTED NODE'}
            </div>
            <h2 className="mt-2 text-[24px] font-bold leading-8 text-[#0c0a09]">{nodeName}</h2>
          </div>
          <button
            aria-label="Close details"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#57534e] hover:bg-[#f5f5f4]"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        {isInput ? (
          <>
            <section className="mt-8">
              <h3 className="text-[14px] font-bold leading-5 text-[#1c1917]">Original Text</h3>
              <p className="mt-2 whitespace-pre-wrap text-[14px] leading-6 text-[#57534e]">
                {nodeDescription || 'No text available.'}
              </p>
            </section>

            <section className="mt-7">
              <h3 className="text-[14px] font-bold leading-5 text-[#1c1917]">
                Concepts extracted
              </h3>
              {extractedConcepts.length === 0 ? (
                <p className="mt-3 text-[13px] leading-5 text-[#a8a29e]">
                  No concepts are linked to this input.
                </p>
              ) : null}
              <div className="mt-3 space-y-2">
                {extractedConcepts.map((concept) => (
                  <button
                    className="w-full rounded-lg border border-[#e7e5e4] bg-white p-3 text-left text-[13px] font-medium leading-5 text-[#1c1917] shadow-sm transition-colors hover:bg-[#fafaf9] focus:outline-none focus:ring-2 focus:ring-[#4338ca] focus:ring-offset-2"
                    key={concept.id}
                    onClick={() => onNodeSelect(concept)}
                    type="button"
                  >
                    {concept.name ?? 'Untitled node'}
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-7">
              <h3 className="text-[14px] font-bold leading-5 text-[#1c1917]">Added</h3>
              <time className="mt-2 block text-[13px] leading-5 text-[#57534e]">
                {formatTimestamp(node?.created_at)}
              </time>
            </section>
          </>
        ) : (
          <>
            <section className="mt-8">
              <h3 className="text-[14px] font-bold leading-5 text-[#1c1917]">Description</h3>
              <p className="mt-2 text-[14px] leading-6 text-[#57534e]">
                {nodeDescription || 'No description available.'}
              </p>
            </section>

            <section className="mt-7">
              <h3 className="text-[14px] font-bold leading-5 text-[#1c1917]">Source</h3>
              {sourceInput ? (
                <button
                  className="mt-3 w-full rounded-lg border border-[#e7e5e4] bg-white p-3 text-left text-[13px] leading-5 text-[#57534e] shadow-sm transition-colors hover:bg-[#fafaf9] focus:outline-none focus:ring-2 focus:ring-[#4338ca] focus:ring-offset-2"
                  onClick={() => onNodeSelect(sourceInput)}
                  type="button"
                >
                  {sourcePreview}
                </button>
              ) : (
                <p className="mt-3 text-[13px] leading-5 text-[#a8a29e]">
                  No source input found for this concept.
                </p>
              )}
            </section>

            <section className="mt-7">
          <h3 className="flex items-center gap-2 text-[14px] font-bold leading-5 text-[#1c1917]">
            <span className="text-[#e11d48]">
              <WarningIcon />
            </span>
            Related Contradictions
          </h3>
          {relatedContradictions.length === 0 ? (
            <p className="mt-3 text-[13px] leading-5 text-[#a8a29e]">
              No contradictions found for this node.
            </p>
          ) : null}
          {relatedContradictions.map((contradiction) => {
            const otherConcept =
              matchesNodeName(contradiction?.concept_a, nodeName)
                ? contradiction?.concept_b
                : contradiction?.concept_a

            return (
              <article
                className="mt-3 rounded-lg border border-[#e7e5e4] border-l-4 border-l-[#e11d48] bg-white p-4 shadow-sm"
                key={contradiction?.id ?? `${contradiction?.concept_a}-${contradiction?.concept_b}`}
              >
                <h4 className="text-[14px] font-bold leading-5 text-[#1c1917]">
                  vs. {otherConcept}
                </h4>
                <p className="mt-2 text-[13px] leading-5 text-[#57534e]">
                  {contradiction.explanation}
                </p>
              </article>
            )
          })}
            </section>
            <section className="mt-7">
          <h3 className="flex items-center gap-2 text-[14px] font-bold leading-5 text-[#1c1917]">
            <span className="text-[#059669]">
              <LinkIcon />
            </span>
            Related Connections
          </h3>
          {relatedConnections.length === 0 ? (
            <p className="mt-3 text-[13px] leading-5 text-[#a8a29e]">
              No connections found for this node.
            </p>
          ) : null}
          {relatedConnections.map((connection) => {
            const otherConcept = matchesNodeName(connection?.concept_a, nodeName)
              ? connection?.concept_b
              : connection?.concept_a

            return (
              <article
                className="mt-3 rounded-lg border border-[#e7e5e4] border-l-4 border-l-[#059669] bg-white p-4 shadow-sm"
                key={connection?.id ?? `${connection?.concept_a}-${connection?.concept_b}`}
              >
                <h4 className="text-[14px] font-bold leading-5 text-[#1c1917]">
                  {otherConcept}
                </h4>
                <p className="mt-2 text-[13px] leading-5 text-[#57534e]">
                  {connection.explanation}
                </p>
              </article>
            )
          })}
            </section>
            <section className="mt-7">
          <h3 className="text-[14px] font-bold leading-5 text-[#1c1917]">
            Belief History
          </h3>
          {beliefHistory.length === 0 ? (
            <p className="mt-3 text-[13px] leading-5 text-[#a8a29e]">
              No belief changes recorded for this concept.
            </p>
          ) : null}
          {beliefHistory.map((shift) => (
            <article
              className="mt-3 rounded-lg border border-[#e7e5e4] border-l-4 border-l-[#8b5cf6] bg-white p-4 shadow-sm"
              key={shift?.id ?? `${shift?.concept_name}-${shift?.created_at}`}
            >
              <time className="text-[11px] leading-4 text-[#a8a29e]">
                {formatTimestamp(shift?.created_at)}
              </time>
              <div className="mt-3 space-y-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#a8a29e]">
                    Before
                  </div>
                  <p className="mt-1 text-[13px] leading-5 text-[#78716c]">
                    {shift?.previous_description ?? 'Unknown'}
                  </p>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#a8a29e]">
                    After
                  </div>
                  <p className="mt-1 text-[13px] leading-5 text-[#1c1917]">
                    {shift?.new_description ?? 'Unknown'}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[13px] leading-5 text-[#57534e]">
                {shift?.shift_explanation ?? 'No explanation available.'}
              </p>
            </article>
          ))}
            </section>
          </>
        )}
      </div>
      <div className="border-t border-[#e7e5e4] p-5">
        {isConfirmingDelete ? (
          <div className="space-y-3">
            {deleteError ? (
              <p className="text-[13px] leading-5 text-[#e11d48]">{deleteError}</p>
            ) : null}
            <p className="text-[13px] leading-5 text-[#57534e]">
              Delete this node? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                className="flex h-9 flex-1 items-center justify-center rounded-lg border border-[#d6d3d1] text-[13px] font-medium text-[#57534e] hover:bg-[#f5f5f4] focus:outline-none focus:ring-2 focus:ring-[#4338ca] focus:ring-offset-2"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteError(null)
                  setIsConfirmingDelete(false)
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="flex h-9 flex-1 items-center justify-center rounded-lg bg-[#e11d48] text-[13px] font-medium text-white hover:bg-[#be123c] focus:outline-none focus:ring-2 focus:ring-[#e11d48] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#fda4af]"
                disabled={isDeleting}
                onClick={() => void handleDeleteConfirm()}
                type="button"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#e7e5e4] text-[13px] font-medium text-[#57534e] hover:border-[#e11d48] hover:text-[#e11d48] focus:outline-none focus:ring-2 focus:ring-[#e11d48] focus:ring-offset-2"
            onClick={() => {
              setDeleteError(null)
              setIsConfirmingDelete(true)
            }}
            type="button"
          >
            <TrashIcon />
            {isInput ? 'Delete Input and Concepts' : 'Delete Concept'}
          </button>
        )}
      </div>
    </aside>
  )
}

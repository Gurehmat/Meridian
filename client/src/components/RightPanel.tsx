import type { Contradiction, GraphNode } from '../types'

type RightPanelProps = {
  contradictions: Contradiction[]
  node: GraphNode
  onClose: () => void
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

export function RightPanel({ contradictions, node, onClose }: RightPanelProps) {
  const relatedContradictions = contradictions.filter(
    (contradiction) =>
      contradiction.concept_a === node.name || contradiction.concept_b === node.name,
  )

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-l border-[#e7e5e4] bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#a8a29e]">
              SELECTED NODE
            </div>
            <h2 className="mt-2 text-[24px] font-bold leading-8 text-[#0c0a09]">{node.name}</h2>
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

        <section className="mt-8">
          <h3 className="text-[14px] font-bold leading-5 text-[#1c1917]">Description</h3>
          <p className="mt-2 text-[14px] leading-6 text-[#57534e]">
            {node.description || 'No description available.'}
          </p>
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
              contradiction.concept_a === node.name
                ? contradiction.concept_b
                : contradiction.concept_a

            return (
              <article
                className="mt-3 rounded-lg border border-[#e7e5e4] border-l-4 border-l-[#e11d48] bg-white p-4 shadow-sm"
                key={contradiction.id ?? `${contradiction.concept_a}-${contradiction.concept_b}`}
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
      </div>
    </aside>
  )
}

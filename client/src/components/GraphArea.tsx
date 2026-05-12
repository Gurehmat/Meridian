import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { ForceGraphMethods } from 'react-force-graph-2d'
import type {
  Connection,
  Contradiction,
  GraphData,
  GraphFocusRequest,
  GraphLink,
  GraphNode,
} from '../types'

type GraphAreaProps = {
  connections: Connection[]
  focusRequest?: GraphFocusRequest | null
  contradictions: Contradiction[]
  graphData: GraphData
  isLoading: boolean
  isRefreshing: boolean
  onOpenInput: () => void
  onNodeSelect: (node: GraphNode) => void
}

type Dimensions = {
  height: number
  width: number
}

const DEFAULT_DIMENSIONS: Dimensions = { height: 600, width: 600 }
const CONTRADICTION_COLOR = '#e11d48'
const CONNECTION_LINK_COLOR = 'rgba(5,150,105,0.8)'
const REGULAR_LINK_COLOR = 'rgba(214,211,209,0.4)'
const EXTRACTED_LINK_COLOR = 'rgba(214,211,209,0.2)'

type AdjustableForce = {
  distance?: (value: number | ((link: GraphLink) => number)) => unknown
  strength?: (value: number) => unknown
}

type ZoomTransform = {
  k: number
}

function insightKey(conceptA?: string | null, conceptB?: string | null) {
  return [(conceptA ?? '').trim().toLowerCase(), (conceptB ?? '').trim().toLowerCase()]
    .sort()
    .join('::')
}

function normalizeConceptName(name?: string | null) {
  return (name ?? '').trim().toLowerCase()
}

function endpointValue(endpoint: string | GraphNode) {
  return typeof endpoint === 'string' ? endpoint : endpoint?.id ?? ''
}

function isInputNode(node: GraphNode) {
  return node.type === 'input'
}

function isExtractionRelationship(link: GraphLink) {
  return link.relationship_type === 'extracted_from' || link.type === 'extracted_from'
}

export function GraphArea({
  connections,
  contradictions,
  focusRequest,
  graphData,
  isLoading,
  isRefreshing,
  onOpenInput,
  onNodeSelect,
}: GraphAreaProps) {
  const containerRef = useRef<HTMLElement | null>(null)
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined)
  const [dimensions, setDimensions] = useState<Dimensions>(DEFAULT_DIMENSIONS)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [currentZoom, setCurrentZoom] = useState(1)

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) {
        return
      }

      setDimensions({
        height: Math.max(240, Math.floor(entry.contentRect.height)),
        width: Math.max(240, Math.floor(entry.contentRect.width)),
      })
    })

    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [])

  const graphModel = useMemo(() => {
    const safeNodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
    const safeLinks = Array.isArray(graphData?.links) ? graphData.links : []

    console.log('Contradictions:', contradictions)
    console.log('Connections:', connections)
    console.log('Graph links before merge:', safeLinks.length)

    const nodeById = new Map(safeNodes.map((node) => [node.id, node]))
    const nodeByName = new Map(
      safeNodes
        .filter((node) => !isInputNode(node))
        .map((node) => [normalizeConceptName(node.name), node]),
    )

    function resolveNodeReference(endpoint: string | GraphNode) {
      if (typeof endpoint !== 'string') {
        return {
          id: endpoint.id,
          name: endpoint.name,
        }
      }

      const node = nodeById.get(endpoint) ?? nodeByName.get(normalizeConceptName(endpoint))

      return {
        id: node?.id ?? endpoint,
        name: node?.name ?? endpoint,
      }
    }

    const validNodeIds = new Set(safeNodes.map((n) => n.id))

    const relationshipLinks = safeLinks.map((link) => {
      const source = resolveNodeReference(link.source)
      const target = resolveNodeReference(link.target)

      return {
        ...link,
        source: source.id,
        sourceName: source.name,
        target: target.id,
        targetName: target.name,
        type: link.type ?? link.relationship_type,
      }
    })

    const validRelationshipLinks = relationshipLinks.filter(
      (l) => validNodeIds.has(l.source as string) && validNodeIds.has(l.target as string),
    )

    const contradictionLinks = contradictions.flatMap((contradiction, index) => {
      const source = nodeByName.get(normalizeConceptName(contradiction.concept_a))
      const target = nodeByName.get(normalizeConceptName(contradiction.concept_b))

      if (!source || !target || source.id === target.id) {
        return []
      }

      return [
        {
          id: `contradiction-${contradiction.id ?? contradiction._id ?? index}`,
          source: source.id,
          sourceName: source.name,
          target: target.id,
          targetName: target.name,
          type: 'contradiction',
          relationship_type: 'contradiction',
        },
      ]
    })

    const connectionLinks = connections.flatMap((connection, index) => {
      const source = nodeByName.get(normalizeConceptName(connection.concept_a))
      const target = nodeByName.get(normalizeConceptName(connection.concept_b))

      if (!source || !target || source.id === target.id) {
        return []
      }

      return [
        {
          id: `connection-${connection.id ?? connection._id ?? index}`,
          source: source.id,
          sourceName: source.name,
          target: target.id,
          targetName: target.name,
          type: 'connection',
          relationship_type: 'connection',
        },
      ]
    })

    const mergedLinks = [...validRelationshipLinks, ...contradictionLinks, ...connectionLinks]
    console.log('Graph links after merge:', mergedLinks.length)

    return {
      graph: {
        nodes: safeNodes.map((n) => ({ ...n })),
        links: mergedLinks,
      },
    }
  }, [connections, contradictions, graphData])

  useEffect(() => {
    const graphInstance = graphRef.current

    if (!graphInstance) {
      return
    }

    const chargeForce = graphInstance.d3Force('charge') as AdjustableForce | undefined
    const linkForce = graphInstance.d3Force('link') as AdjustableForce | undefined
    const centerForce = graphInstance.d3Force('center') as AdjustableForce | undefined

    chargeForce?.strength?.(-200)
    linkForce?.distance?.((link: GraphLink) => (isExtractionRelationship(link) ? 50 : 80))
    centerForce?.strength?.(0.05)
    graphInstance.d3ReheatSimulation()
  }, [graphModel.graph.nodes.length, graphModel.graph.links.length])

  useEffect(() => {
    if (graphModel.graph.nodes.length === 0) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      graphRef.current?.zoomToFit(400, 60)
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [graphModel.graph.nodes.length, graphModel.graph.links.length])

  useEffect(() => {
    if (!focusRequest) {
      return
    }

    let timeoutId: number | undefined
    const requestedNodeId = focusRequest.nodeId

    function focusNode(attempt: number) {
      const node = graphModel.graph.nodes.find((graphNode) => graphNode.id === requestedNodeId)

      if (!node) {
        return
      }

      if (typeof node.x === 'number' && typeof node.y === 'number') {
        graphRef.current?.centerAt(node.x, node.y, 300)
        graphRef.current?.zoom(2.2, 300)
        return
      }

      if (attempt < 6) {
        timeoutId = window.setTimeout(() => focusNode(attempt + 1), 100)
      }
    }

    focusNode(0)

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [focusRequest, graphModel.graph.nodes])

  const contradictionKeys = useMemo(
    () =>
      new Set(
        contradictions.map((contradiction) =>
          insightKey(contradiction.concept_a, contradiction.concept_b),
        ),
      ),
    [contradictions],
  )
  const connectionKeys = useMemo(
    () =>
      new Set(
        connections.map((connection) => insightKey(connection.concept_a, connection.concept_b)),
      ),
    [connections],
  )

  function linkKey(link: GraphLink) {
    const sourceName = link.sourceName ?? endpointValue(link.source)
    const targetName = link.targetName ?? endpointValue(link.target)
    return insightKey(sourceName, targetName)
  }

  function isContradictionLink(link: GraphLink) {
    return (
      link.type === 'contradiction' ||
      link.relationship_type === 'contradiction' ||
      contradictionKeys.has(linkKey(link))
    )
  }

  function isConnectionLink(link: GraphLink) {
    return (
      link.type === 'connection' ||
      link.relationship_type === 'connection' ||
      connectionKeys.has(linkKey(link))
    )
  }

  function isExtractionLink(link: GraphLink) {
    return isExtractionRelationship(link)
  }

  function zoomBy(multiplier: number) {
    const nextZoom = Math.max(0.2, Math.min(8, currentZoom * multiplier))
    graphRef.current?.zoom(nextZoom, 300)
  }

  function fitGraph() {
    graphRef.current?.zoomToFit(400, 60)
  }

  return (
    <main
      className="relative min-w-0 flex-1 overflow-hidden bg-[#fafaf9] bg-[radial-gradient(circle,#e7e5e4_1px,transparent_1px)] [background-size:24px_24px]"
      ref={containerRef}
    >
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center text-[14px] text-[#57534e]">
          Loading graph...
        </div>
      ) : graphModel.graph.nodes.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center text-[14px] text-[#57534e]">
          <p>Add text to start building your graph.</p>
          <button
            className="h-10 rounded-lg bg-[#4338ca] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#3730a3] focus:outline-none focus:ring-2 focus:ring-[#4338ca] focus:ring-offset-2"
            onClick={onOpenInput}
            type="button"
          >
            Add to Graph
          </button>
        </div>
      ) : (
        <ForceGraph2D<GraphNode, GraphLink>
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={100}
          enableNodeDrag
          graphData={graphModel.graph}
          height={dimensions.height}
          linkColor={(link) => {
            if (isExtractionLink(link)) {
              return EXTRACTED_LINK_COLOR
            }

            if (isContradictionLink(link)) {
              return CONTRADICTION_COLOR
            }

            if (isConnectionLink(link)) {
              return CONNECTION_LINK_COLOR
            }

            return REGULAR_LINK_COLOR
          }}
          linkLineDash={(link) => {
            if (isContradictionLink(link)) {
              return [6, 4]
            }

            return isExtractionLink(link) ? [2, 3] : null
          }}
          linkWidth={(link) => {
            if (isExtractionLink(link)) {
              return 0.5
            }

            if (isContradictionLink(link)) {
              return 2.5
            }

            if (isConnectionLink(link)) {
              return 2
            }

            return 0.8
          }}
          d3AlphaDecay={0.05}
          d3VelocityDecay={0.3}
          nodeCanvasObject={(node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const label = node.name || ''
            const isInput = node.type === 'input'
            const isHovered = hoveredNodeId === node.id

            const baseRadius = isInput ? 7 : 5
            const radius = baseRadius + (isHovered ? 1 : 0)

            const x = node.x || 0
            const y = node.y || 0

            ctx.beginPath()
            ctx.arc(x, y, radius, 0, 2 * Math.PI)
            ctx.fillStyle = isInput ? '#78716c' : '#4338ca'
            ctx.fill()

            const fontSize = 10 / globalScale
            ctx.font = `${fontSize}px Inter, sans-serif`
            ctx.textAlign = 'left'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = '#44403c'

            const maxLabelLength = 18
            const displayLabel =
              label.length > maxLabelLength ? `${label.substring(0, maxLabelLength)}...` : label

            ctx.fillText(displayLabel, x + radius + 4, y)
          }}
          nodeId="id"
          nodeLabel="name"
          nodePointerAreaPaint={(
            node: GraphNode,
            color: string,
            ctx: CanvasRenderingContext2D,
          ) => {
            const radius = node.type === 'input' ? 9 : 7
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(node.x || 0, node.y || 0, radius + 8, 0, 2 * Math.PI)
            ctx.fill()
          }}
          nodeRelSize={1}
          onNodeClick={(node) => {
            console.log('Clicked node:', node)
            if (node) setTimeout(() => onNodeSelect(node), 0)
          }}
          onNodeHover={(node) => {
            setTimeout(() => setHoveredNodeId(node?.id ? String(node.id) : null), 0)
          }}
          onZoom={(transform) => setCurrentZoom((transform as ZoomTransform).k)}
          ref={graphRef}
          showPointerCursor={(object) => Boolean(object && 'name' in object)}
          warmupTicks={50}
          width={dimensions.width}
        />
      )}

      {isRefreshing && !isLoading ? (
        <div className="absolute right-4 top-4 rounded-lg border border-[#e7e5e4] bg-white px-3 py-2 text-[12px] text-[#57534e] shadow-sm">
          Refreshing...
        </div>
      ) : null}
      {!isLoading && graphModel.graph.nodes.length > 0 ? (
        <div className="absolute bottom-4 right-4 z-10 flex flex-col overflow-hidden rounded-lg border border-[#d6d3d1] bg-white shadow-sm">
          <button
            aria-label="Zoom in"
            className="flex h-8 w-8 items-center justify-center border-b border-[#e7e5e4] text-[18px] leading-none text-[#57534e] hover:bg-[#f5f5f4] focus:outline-none focus:ring-2 focus:ring-[#4338ca] focus:ring-inset"
            onClick={() => zoomBy(1.25)}
            type="button"
          >
            +
          </button>
          <button
            aria-label="Zoom out"
            className="flex h-8 w-8 items-center justify-center border-b border-[#e7e5e4] text-[18px] leading-none text-[#57534e] hover:bg-[#f5f5f4] focus:outline-none focus:ring-2 focus:ring-[#4338ca] focus:ring-inset"
            onClick={() => zoomBy(0.8)}
            type="button"
          >
            -
          </button>
          <button
            aria-label="Fit graph"
            className="flex h-8 w-8 items-center justify-center text-[#57534e] hover:bg-[#f5f5f4] focus:outline-none focus:ring-2 focus:ring-[#4338ca] focus:ring-inset"
            onClick={fitGraph}
            type="button"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
              <path
                d="M3.5 5.5v-2h2M10.5 3.5h2v2M12.5 10.5v2h-2M5.5 12.5h-2v-2"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        </div>
      ) : null}
    </main>
  )
}

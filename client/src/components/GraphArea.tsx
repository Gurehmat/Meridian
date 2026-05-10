import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { ForceGraphMethods } from 'react-force-graph-2d'
import type { Connection, Contradiction, GraphData, GraphLink, GraphNode } from '../types'

type GraphAreaProps = {
  connections: Connection[]
  contradictions: Contradiction[]
  graphData: GraphData
  isLoading: boolean
  isRefreshing: boolean
  onOpenInput: () => void
  onNodeSelect: (node: GraphNode) => void
  selectedNodeId?: string
}

type Dimensions = {
  height: number
  width: number
}

const DEFAULT_DIMENSIONS: Dimensions = { height: 600, width: 600 }
const NODE_RADIUS = 8
const HOVER_NODE_RADIUS = 10
const SELECTED_NODE_RADIUS = 12

type AdjustableForce = {
  distance?: (value: number) => unknown
  strength?: (value: number) => unknown
}

function insightKey(conceptA: string, conceptB: string) {
  return [conceptA.trim().toLowerCase(), conceptB.trim().toLowerCase()].sort().join('::')
}

function normalizeConceptName(name: string) {
  return name.trim().toLowerCase()
}

function endpointValue(endpoint: string | GraphNode) {
  return typeof endpoint === 'string' ? endpoint : endpoint.id
}

function drawNode(
  node: GraphNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  isHovered: boolean,
  isSelected: boolean,
) {
  const x = node.x ?? 0
  const y = node.y ?? 0
  const radius = isSelected ? SELECTED_NODE_RADIUS : isHovered ? HOVER_NODE_RADIUS : NODE_RADIUS
  const label = node.name || 'Untitled'
  const fontSize = 12 / globalScale
  const labelX = x + radius + 7 / globalScale

  ctx.save()
  ctx.shadowColor = 'rgba(255,255,255,0.95)'
  ctx.shadowBlur = 10 / globalScale
  ctx.beginPath()
  ctx.arc(x, y, radius + 4 / globalScale, 0, 2 * Math.PI)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, 2 * Math.PI)
  ctx.fillStyle = isSelected ? '#3730a3' : '#4338ca'
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 4 / globalScale
  ctx.shadowColor = '#ffffff'
  ctx.shadowBlur = 4 / globalScale
  ctx.strokeStyle = '#ffffff'
  ctx.strokeText(label, labelX, y)
  ctx.fillStyle = '#1c1917'
  ctx.fillText(label, labelX, y)
  ctx.restore()
}

function paintNodePointerArea(
  node: GraphNode,
  color: string,
  ctx: CanvasRenderingContext2D,
) {
  const x = node.x ?? 0
  const y = node.y ?? 0

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, 14, 0, 2 * Math.PI)
  ctx.fill()
}

export function GraphArea({
  connections,
  contradictions,
  graphData,
  isLoading,
  isRefreshing,
  onOpenInput,
  onNodeSelect,
  selectedNodeId,
}: GraphAreaProps) {
  const containerRef = useRef<HTMLElement | null>(null)
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined)
  const [dimensions, setDimensions] = useState<Dimensions>(DEFAULT_DIMENSIONS)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

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

  const graph = useMemo(() => {
    const nodeById = new Map(graphData.nodes.map((node) => [node.id, node]))
    const nodeByName = new Map(
      graphData.nodes.map((node) => [normalizeConceptName(node.name), node]),
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

    const relationshipLinks = graphData.links.map((link) => {
      const source = resolveNodeReference(link.source)
      const target = resolveNodeReference(link.target)

      return {
        ...link,
        source: source.id,
        sourceName: source.name,
        target: target.id,
        targetName: target.name,
      }
    })

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
          relationship_type: 'connection',
        },
      ]
    })

    return {
      nodes: graphData.nodes,
      links: [...relationshipLinks, ...contradictionLinks, ...connectionLinks],
    }
  }, [connections, contradictions, graphData])

  useEffect(() => {
    const graphInstance = graphRef.current

    if (!graphInstance) {
      return
    }

    const chargeForce = graphInstance.d3Force('charge') as AdjustableForce | undefined
    const linkForce = graphInstance.d3Force('link') as AdjustableForce | undefined

    chargeForce?.strength?.(-260)
    linkForce?.distance?.(90)
    graphInstance.d3ReheatSimulation()
  }, [graph.nodes.length, graph.links.length])

  useEffect(() => {
    if (graph.nodes.length === 0) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      graphRef.current?.zoomToFit(500, 80)
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [graph.nodes.length])

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
    return link.relationship_type === 'contradiction' || contradictionKeys.has(linkKey(link))
  }

  function isConnectionLink(link: GraphLink) {
    return link.relationship_type === 'connection' || connectionKeys.has(linkKey(link))
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
      ) : graph.nodes.length === 0 ? (
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
          graphData={graph}
          height={dimensions.height}
          linkColor={(link) => {
            if (isContradictionLink(link)) {
              return '#e11d48'
            }

            if (isConnectionLink(link)) {
              return '#059669'
            }

            return '#d6d3d1'
          }}
          linkLineDash={(link) => (isContradictionLink(link) ? [6, 6] : null)}
          linkWidth={(link) => {
            if (isContradictionLink(link)) {
              return 2
            }

            if (isConnectionLink(link)) {
              return 1.5
            }

            return 1
          }}
          nodeCanvasObject={(node, ctx, globalScale) =>
            drawNode(
              node,
              ctx,
              globalScale,
              hoveredNodeId === node.id,
              selectedNodeId === node.id,
            )
          }
          nodeId="id"
          nodeLabel="name"
          nodePointerAreaPaint={paintNodePointerArea}
          onNodeClick={(node) => onNodeSelect(node)}
          onNodeHover={(node) => setHoveredNodeId(node?.id ? String(node.id) : null)}
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
    </main>
  )
}

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
  onNodeSelect: (node: GraphNode) => void
}

type Dimensions = {
  height: number
  width: number
}

const DEFAULT_DIMENSIONS: Dimensions = { height: 600, width: 600 }
const NODE_RADIUS = 7
const HOVER_NODE_RADIUS = 9

type AdjustableForce = {
  distance?: (value: number) => unknown
  strength?: (value: number) => unknown
}

function insightKey(conceptA: string, conceptB: string) {
  return [conceptA.trim().toLowerCase(), conceptB.trim().toLowerCase()].sort().join('::')
}

function endpointValue(endpoint: string | GraphNode) {
  return typeof endpoint === 'string' ? endpoint : endpoint.id
}

function drawNode(
  node: GraphNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  isHovered: boolean,
) {
  const x = node.x ?? 0
  const y = node.y ?? 0
  const radius = isHovered ? HOVER_NODE_RADIUS : NODE_RADIUS
  const label = node.name || 'Untitled'
  const fontSize = 12 / globalScale

  ctx.beginPath()
  ctx.arc(x, y, radius, 0, 2 * Math.PI)
  ctx.fillStyle = '#4338ca'
  ctx.fill()

  ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`
  ctx.fillStyle = '#1c1917'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + radius + 5 / globalScale, y)
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
  onNodeSelect,
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
    const nodeIdByName = new Map(graphData.nodes.map((node) => [node.name, node.id]))

    return {
      nodes: graphData.nodes,
      links: graphData.links.map((link) => {
        const source = endpointValue(link.source)
        const target = endpointValue(link.target)
        const sourceName = typeof link.source === 'string' ? link.source : link.source.name
        const targetName = typeof link.target === 'string' ? link.target : link.target.name

        return {
          ...link,
          source: nodeIdByName.get(source) ?? source,
          sourceName,
          target: nodeIdByName.get(target) ?? target,
          targetName,
        }
      }),
    }
  }, [graphData])

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
    return contradictionKeys.has(linkKey(link))
  }

  function isConnectionLink(link: GraphLink) {
    return connectionKeys.has(linkKey(link))
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
        <div className="absolute inset-0 flex items-center justify-center text-center text-[14px] text-[#57534e]">
          Add text to start building your graph.
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
            drawNode(node, ctx, globalScale, hoveredNodeId === node.id)
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

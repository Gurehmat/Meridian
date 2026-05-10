import { useCallback, useEffect, useState } from 'react'
import { GraphArea } from './components/GraphArea'
import { LeftSidebar } from './components/LeftSidebar'
import type { SidebarTab } from './components/LeftSidebar'
import { Navbar } from './components/Navbar'
import { RightPanel } from './components/RightPanel'
import {
  fetchConnections,
  fetchContradictions,
  fetchGraph,
  ingestText,
} from './lib/api'
import type { Connection, Contradiction, GraphData, GraphNode } from './types'

const userId = 'test_user_1'
const emptyGraph: GraphData = { nodes: [], links: [] }

async function fetchWorkspaceData() {
  const [nextGraph, nextContradictions, nextConnections] = await Promise.all([
    fetchGraph(userId),
    fetchContradictions(userId),
    fetchConnections(userId),
  ])

  return { nextConnections, nextContradictions, nextGraph }
}

function App() {
  const [graphData, setGraphData] = useState<GraphData>(emptyGraph)
  const [contradictions, setContradictions] = useState<Contradiction[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isIngesting, setIsIngesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('insights')

  const applyWorkspaceData = useCallback(
    ({
      nextConnections,
      nextContradictions,
      nextGraph,
    }: Awaited<ReturnType<typeof fetchWorkspaceData>>) => {
      setGraphData(nextGraph)
      setContradictions(nextContradictions)
      setConnections(nextConnections)
      setSelectedNode((currentNode) => {
        if (!currentNode) {
          return null
        }

        return nextGraph.nodes.find((node) => node.id === currentNode.id) ?? null
      })
    },
    [],
  )

  const loadWorkspaceData = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)

    try {
      applyWorkspaceData(await fetchWorkspaceData())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load workspace data')
      setGraphData(emptyGraph)
      setContradictions([])
      setConnections([])
      setSelectedNode(null)
    } finally {
      setIsRefreshing(false)
    }
  }, [applyWorkspaceData])

  useEffect(() => {
    let isMounted = true

    async function loadInitialWorkspaceData() {
      try {
        const workspaceData = await fetchWorkspaceData()

        if (!isMounted) {
          return
        }

        applyWorkspaceData(workspaceData)
      } catch (loadError) {
        if (!isMounted) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Unable to load workspace data')
        setGraphData(emptyGraph)
        setContradictions([])
        setConnections([])
        setSelectedNode(null)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadInitialWorkspaceData()

    return () => {
      isMounted = false
    }
  }, [applyWorkspaceData])

  async function handleIngestText(content: string) {
    setIsIngesting(true)
    setError(null)

    try {
      const response = await ingestText(content, userId)
      await loadWorkspaceData()
      return response
    } catch (ingestError) {
      setError(ingestError instanceof Error ? ingestError.message : 'Unable to ingest text')
      throw ingestError
    } finally {
      setIsIngesting(false)
    }
  }

  return (
    <div className="h-screen min-w-[900px] overflow-hidden bg-[#fafaf9] font-sans text-[#1c1917]">
      <Navbar />
      <div className="flex h-[calc(100vh-56px)] min-h-0">
        <LeftSidebar
          activeTab={sidebarTab}
          connections={connections}
          contradictions={contradictions}
          graphNodes={graphData.nodes}
          isIngesting={isIngesting}
          onActiveTabChange={setSidebarTab}
          onIngestText={handleIngestText}
          onNodeSelect={setSelectedNode}
        />
        <GraphArea
          connections={connections}
          contradictions={contradictions}
          graphData={graphData}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          onOpenInput={() => setSidebarTab('input')}
          onNodeSelect={setSelectedNode}
          selectedNodeId={selectedNode?.id}
        />
        {selectedNode ? (
          <RightPanel
            connections={connections}
            contradictions={contradictions}
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        ) : null}
      </div>
      {error ? (
        <div className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-[#e7e5e4] bg-white px-4 py-3 text-[13px] text-[#57534e] shadow-md">
          {error}
        </div>
      ) : null}
    </div>
  )
}

export default App

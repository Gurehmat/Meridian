import { Component, useCallback, useEffect, useMemo, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { GraphArea } from './components/GraphArea'
import { LeftSidebar } from './components/LeftSidebar'
import type { SidebarTab } from './components/LeftSidebar'
import { Navbar } from './components/Navbar'
import { RightPanel } from './components/RightPanel'
import { useAuth } from './contexts/useAuth'
import {
  deleteConcept,
  deleteInput,
  fetchConnections,
  fetchContradictions,
  fetchEntries,
  fetchGraph,
  fetchTimeline,
  ingestPDF,
  ingestText,
} from './lib/api'
import type {
  BeliefShift,
  Connection,
  Contradiction,
  Entry,
  GraphData,
  GraphFocusRequest,
  GraphNode,
} from './types'

const emptyGraph: GraphData = { nodes: [], links: [] }

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  hasError: boolean
}

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App render error', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen min-w-[900px] items-center justify-center bg-[#fafaf9] p-8 font-sans text-[#1c1917]">
          <div className="max-w-md rounded-lg border border-[#e7e5e4] bg-white p-5 shadow-sm">
            <h1 className="text-[18px] font-bold leading-6 text-[#0c0a09]">
              Unable to render the workspace
            </h1>
            <p className="mt-2 text-[14px] leading-6 text-[#57534e]">
              Refresh the page to reload the graph. Your saved workspace data is still available.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

class RightPanelErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RightPanel render error', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <aside className="flex h-full w-[300px] shrink-0 flex-col border-l border-[#e7e5e4] bg-white p-5">
          <div className="rounded-lg border border-[#e7e5e4] bg-[#fafaf9] p-4 text-[14px] leading-6 text-[#57534e]">
            Error loading details
          </div>
        </aside>
      )
    }

    return this.props.children
  }
}

async function fetchWorkspaceData(userId: string) {
  const [nextGraph, nextContradictions, nextConnections, nextTimeline, nextEntries] =
    await Promise.all([
      fetchGraph(userId),
      fetchContradictions(userId),
      fetchConnections(userId),
      fetchTimeline(userId),
      fetchEntries(userId),
    ])

  return { nextConnections, nextContradictions, nextEntries, nextGraph, nextTimeline }
}

function App() {
  const { user } = useAuth()
  const userId = user?.uid ?? ''
  const [graphData, setGraphData] = useState<GraphData>(emptyGraph)
  const [contradictions, setContradictions] = useState<Contradiction[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [timeline, setTimeline] = useState<BeliefShift[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isIngesting, setIsIngesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('insights')
  const [focusRequest, setFocusRequest] = useState<GraphFocusRequest | null>(null)
  const graphNodes = useMemo(() => graphData?.nodes ?? [], [graphData])
  const selectedGraphNode = selectedNode
    ? graphNodes.find((node) => node?.id === selectedNode.id) ?? null
    : null

  const applyWorkspaceData = useCallback(
    ({
      nextConnections,
      nextContradictions,
      nextEntries,
      nextGraph,
      nextTimeline,
    }: Awaited<ReturnType<typeof fetchWorkspaceData>>) => {
      setGraphData(nextGraph)
      setContradictions(nextContradictions)
      setConnections(nextConnections)
      setEntries(nextEntries)
      setTimeline(nextTimeline)
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
    if (!userId) {
      return
    }

    setIsRefreshing(true)
    setError(null)

    try {
      applyWorkspaceData(await fetchWorkspaceData(userId))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load workspace data')
      setGraphData(emptyGraph)
      setContradictions([])
      setConnections([])
      setEntries([])
      setTimeline([])
      setSelectedNode(null)
    } finally {
      setIsRefreshing(false)
    }
  }, [applyWorkspaceData, userId])

  useEffect(() => {
    if (!userId) {
      return
    }

    let isMounted = true

    async function loadInitialWorkspaceData() {
      try {
        const workspaceData = await fetchWorkspaceData(userId)

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
        setEntries([])
        setTimeline([])
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
  }, [applyWorkspaceData, userId])

  async function handleIngestText(content: string) {
    if (!userId) {
      throw new Error('Sign in to ingest text')
    }

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

  async function handleIngestPDF(file: File) {
    if (!userId) {
      throw new Error('Sign in to ingest PDFs')
    }

    setIsIngesting(true)
    setError(null)

    try {
      const response = await ingestPDF(file, userId)

      await loadWorkspaceData()

      return response
    } catch (ingestError) {
      setError(ingestError instanceof Error ? ingestError.message : 'Unable to ingest PDF')
      throw ingestError
    } finally {
      setIsIngesting(false)
    }
  }

  const handleNodeSelect = useCallback(
    (node: GraphNode | null | undefined) => {
      try {
        if (!node?.id) {
          setSelectedNode(null)
          return
        }

        const currentNode = graphNodes.find((graphNode) => graphNode?.id === node.id)
        setSelectedNode(currentNode ?? null)
      } catch (selectError) {
        console.error('Unable to select node', selectError)
        setSelectedNode(null)
        setError('Unable to select node')
      }
    },
    [graphNodes],
  )

  const searchAndFocusNode = useCallback((node: GraphNode) => {
    handleNodeSelect(node)
    setFocusRequest((currentRequest) => ({
      nodeId: node.id,
      requestId: (currentRequest?.requestId ?? 0) + 1,
    }))
  }, [handleNodeSelect])

  async function handleDeleteNode(node: GraphNode) {
    if (!userId) {
      throw new Error('Sign in to delete nodes')
    }

    setError(null)

    try {
      if (node.type === 'input') {
        await deleteInput(node.id, userId)
      } else {
        await deleteConcept(node.id, userId)
      }

      setSelectedNode(null)
      setFocusRequest(null)
      await loadWorkspaceData()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete node')
      throw deleteError
    }
  }

  if (!user) {
    return <Navigate replace to="/" />
  }

  return (
    <AppErrorBoundary>
    <div className="h-screen min-w-[900px] overflow-hidden bg-[#fafaf9] font-sans text-[#1c1917]">
      <Navbar nodes={graphNodes} onSearchAndFocusNode={searchAndFocusNode} />
      <div className="flex h-[calc(100vh-56px)] min-h-0">
        <LeftSidebar
          activeTab={sidebarTab}
          connections={connections}
          contradictions={contradictions}
          entries={entries}
          graphNodes={graphNodes}
          isIngesting={isIngesting}
          onActiveTabChange={setSidebarTab}
          onIngestPDF={handleIngestPDF}
          onIngestText={handleIngestText}
          onNodeSelect={searchAndFocusNode}
          selectedNodeId={selectedGraphNode?.id ?? null}
          timeline={timeline}
        />
        <GraphArea
          connections={connections}
          contradictions={contradictions}
          graphData={graphData}
          focusRequest={focusRequest}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          onOpenInput={() => setSidebarTab('input')}
          onNodeSelect={handleNodeSelect}
        />
        {selectedGraphNode ? (
          <RightPanelErrorBoundary key={selectedGraphNode.id}>
            <RightPanel
              connections={connections}
              contradictions={contradictions}
              graphNodes={graphNodes}
              node={selectedGraphNode}
              onClose={() => setSelectedNode(null)}
              onDeleteNode={handleDeleteNode}
              onNodeSelect={handleNodeSelect}
              timeline={timeline}
            />
          </RightPanelErrorBoundary>
        ) : null}
      </div>
      {error ? (
        <div className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-[#e7e5e4] bg-white px-4 py-3 text-[13px] text-[#57534e] shadow-md">
          {error}
        </div>
      ) : null}
    </div>
    </AppErrorBoundary>
  )
}

export default App

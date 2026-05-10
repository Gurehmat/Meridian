export type GraphNode = {
  id: string
  name: string
  description?: string
  source_input_id?: string
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number
  fy?: number
}

export type GraphLink = {
  id?: string
  source: string | GraphNode
  sourceName?: string
  target: string | GraphNode
  targetName?: string
  relationship_type?: string
  description?: string
}

export type GraphData = {
  nodes: GraphNode[]
  links: GraphLink[]
}

export type Contradiction = {
  id?: string
  _id?: string
  concept_a: string
  concept_b: string
  explanation: string
  user_id?: string
  created_at?: string
  resolved?: boolean
}

export type Connection = {
  id?: string
  _id?: string
  concept_a: string
  concept_b: string
  explanation: string
  user_id?: string
  created_at?: string
}

export type IngestResponse = {
  status: string
  concepts_added: number
  contradictions_found: number
  connections_found: number
}

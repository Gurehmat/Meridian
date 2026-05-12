export type GraphNode = {
  id: string
  name: string
  description?: string
  type?: 'concept' | 'input'
  source_input_id?: string
  created_at?: string
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
  type?: string
  relationship_type?: string
  description?: string
}

export type GraphData = {
  nodes: GraphNode[]
  links: GraphLink[]
}

export type GraphFocusRequest = {
  nodeId: string
  requestId: number
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

export type BeliefShift = {
  id?: string
  _id?: string
  concept_name: string
  previous_description: string
  new_description: string
  shift_explanation: string
  source_input_id: string
  user_id?: string
  created_at?: string
}

export type Entry = {
  id: string
  content: string
  content_type: string
  created_at?: string
  concept_count: number
}

export type IngestResponse = {
  status: string
  concepts_added: number
  concepts_extracted?: number
  contradictions_found: number
  connections_found: number
}

export type DeleteResponse = {
  status: string
  deleted_count: number
}

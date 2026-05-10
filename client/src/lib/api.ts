import type {
  Connection,
  Contradiction,
  GraphData,
  IngestResponse,
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8080'

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function fetchGraph(userId: string): Promise<GraphData> {
  return requestJson<GraphData>(`/graph/${encodeURIComponent(userId)}`)
}

export function fetchContradictions(userId: string): Promise<Contradiction[]> {
  return requestJson<Contradiction[]>(`/contradictions/${encodeURIComponent(userId)}`)
}

export function fetchConnections(userId: string): Promise<Connection[]> {
  return requestJson<Connection[]>(`/connections/${encodeURIComponent(userId)}`)
}

export function ingestText(content: string, userId: string): Promise<IngestResponse> {
  return requestJson<IngestResponse>('/ingest/text', {
    body: JSON.stringify({ content, user_id: userId }),
    method: 'POST',
  })
}

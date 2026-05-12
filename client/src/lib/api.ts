import type {
  BeliefShift,
  Connection,
  Contradiction,
  DeleteResponse,
  Entry,
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

export function fetchTimeline(userId: string): Promise<BeliefShift[]> {
  return requestJson<BeliefShift[]>(`/timeline/${encodeURIComponent(userId)}`)
}

export function fetchEntries(userId: string): Promise<Entry[]> {
  return requestJson<Entry[]>(`/entries/${encodeURIComponent(userId)}`)
}

export function fetchConceptTimeline(
  userId: string,
  conceptName: string,
): Promise<BeliefShift[]> {
  return requestJson<BeliefShift[]>(
    `/timeline/${encodeURIComponent(userId)}/${encodeURIComponent(conceptName)}`,
  )
}

export function deleteConcept(conceptId: string, userId: string): Promise<DeleteResponse> {
  return requestJson<DeleteResponse>(
    `/concept/${encodeURIComponent(conceptId)}?user_id=${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
    },
  )
}

export function deleteInput(inputId: string, userId: string): Promise<DeleteResponse> {
  return requestJson<DeleteResponse>(
    `/input/${encodeURIComponent(inputId)}?user_id=${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
    },
  )
}

export function ingestText(content: string, userId: string): Promise<IngestResponse> {
  return requestJson<IngestResponse>('/ingest/text', {
    body: JSON.stringify({ content, user_id: userId }),
    method: 'POST',
  })
}

export async function ingestPDF(file: File, userId: string): Promise<IngestResponse> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('user_id', userId)

  const response = await fetch(`${API_BASE_URL}/ingest/pdf`, {
    body: formData,
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`)
  }

  return response.json() as Promise<IngestResponse>
}

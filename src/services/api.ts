import type { Board, Card, CardInput, CardUpdate, Column, Comment, User, AuditLog, UserRole } from '../types'

class ApiError extends Error {
  status: number
  data?: unknown
  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(endpoint, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  let body: unknown
  const contentType = res.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    body = await res.json()
  } else {
    body = await res.text()
  }

  if (!res.ok) {
    const errorMsg = (typeof body === 'object' && body && 'error' in body)
      ? String((body as { error: string }).error)
      : `Request failed with status ${res.status}`
    throw new ApiError(errorMsg, res.status, body)
  }

  return body as T
}

export const api = {
  // Auth
  async getMe(): Promise<{ user: User | null }> {
    return request<{ user: User | null }>('/api/auth/me')
  },

  async login(username: string, password: string): Promise<{ user: User }> {
    return request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  },

  async logout(): Promise<void> {
    await request('/api/auth/logout', { method: 'POST' })
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await request('/api/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  },

  // Board
  async getBoard(): Promise<Board> {
    return request<Board>('/api/board')
  },

  async createColumn(title: string): Promise<Column> {
    return request<Column>('/api/board/columns', {
      method: 'POST',
      body: JSON.stringify({ title }),
    })
  },

  async renameColumn(id: string, title: string): Promise<Column> {
    return request<Column>(`/api/board/columns/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    })
  },

  async deleteColumn(id: string): Promise<void> {
    await request(`/api/board/columns/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },

  async reorderColumns(columnIds: string[]): Promise<void> {
    await request('/api/board/columns/reorder', {
      method: 'PUT',
      body: JSON.stringify({ columnIds }),
    })
  },

  async createCard(input: CardInput): Promise<Card> {
    return request<Card>('/api/board/cards', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  async updateCard(id: string, update: CardUpdate): Promise<Card> {
    return request<Card>(`/api/board/cards/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    })
  },

  async moveCard(id: string, toColumnId: string, toIndex: number): Promise<void> {
    await request(`/api/board/cards/${encodeURIComponent(id)}/move`, {
      method: 'PUT',
      body: JSON.stringify({ toColumnId, toIndex }),
    })
  },

  async deleteCard(id: string): Promise<void> {
    await request(`/api/board/cards/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },

  async createLabel(name: string): Promise<{ name: string }> {
    return request<{ name: string }>('/api/board/labels', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  },

  async renameLabel(oldName: string, newName: string): Promise<void> {
    await request(`/api/board/labels/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      body: JSON.stringify({ newName }),
    })
  },

  async deleteLabel(name: string): Promise<void> {
    await request(`/api/board/labels/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    })
  },

  async importBoard(board: Board): Promise<void> {
    await request('/api/board/import', {
      method: 'POST',
      body: JSON.stringify(board),
    })
  },

  // Comments
  async getComments(cardId: string): Promise<{ comments: Comment[] }> {
    return request<{ comments: Comment[] }>(`/api/cards/${encodeURIComponent(cardId)}/comments`)
  },

  async addComment(cardId: string, content: string): Promise<Comment> {
    return request<Comment>(`/api/cards/${encodeURIComponent(cardId)}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
  },

  async deleteComment(cardId: string, commentId: string): Promise<void> {
    await request(`/api/cards/${encodeURIComponent(cardId)}/comments/${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
    })
  },

  // User Management
  async getUsers(): Promise<{ users: User[] }> {
    return request<{ users: User[] }>('/api/users')
  },

  async createUser(
    username: string,
    password: string,
    displayName: string,
    role: UserRole,
    labels: string[] = [],
    mustChangePassword = true,
  ): Promise<User> {
    return request<User>('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, displayName, role, labels, mustChangePassword }),
    })
  },

  async updateUserLabels(userId: string, labels: string[]): Promise<{ id: string; labels: string[] }> {
    return request<{ id: string; labels: string[] }>(`/api/users/${encodeURIComponent(userId)}/labels`, {
      method: 'PUT',
      body: JSON.stringify({ labels }),
    })
  },

  async resetUserPassword(userId: string, newPassword: string): Promise<void> {
    await request(`/api/users/${encodeURIComponent(userId)}/password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword }),
    })
  },

  async changeUserRole(userId: string, role: UserRole): Promise<void> {
    await request(`/api/users/${encodeURIComponent(userId)}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    })
  },

  async deleteUser(userId: string): Promise<void> {
    await request(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    })
  },

  // Audit Logs
  async getAuditLogs(limit = 50): Promise<{ logs: AuditLog[] }> {
    return request<{ logs: AuditLog[] }>(`/api/audit-logs?limit=${limit}`)
  },
}

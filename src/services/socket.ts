import type { ConnectionStatus, PresenceUser } from '../types'

export type SocketEventHandler = (event: { type: string; payload: unknown; senderId?: string }) => void

class SocketService {
  private ws: WebSocket | null = null
  private status: ConnectionStatus = 'disconnected'
  private statusListeners = new Set<(status: ConnectionStatus) => void>()
  private presenceListeners = new Set<(users: PresenceUser[], count: number) => void>()
  private eventListeners = new Set<SocketEventHandler>()
  private onlineUsers: PresenceUser[] = []
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private backoffMs = 1000
  private shouldConnect = false
  private pingInterval: ReturnType<typeof setInterval> | null = null

  public connect(): void {
    if (typeof window === 'undefined') return
    this.shouldConnect = true

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    this.setStatus('reconnecting')
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/ws`

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        this.setStatus('connected')
        this.backoffMs = 1000
        this.startHeartbeat()
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'PRESENCE_UPDATE') {
            this.onlineUsers = (data.payload.users || []) as PresenceUser[]
            this.presenceListeners.forEach((fn) => fn(this.onlineUsers, data.payload.count || this.onlineUsers.length))
          } else {
            this.eventListeners.forEach((fn) => fn(data))
          }
        } catch {
          // ignore non-json
        }
      }

      this.ws.onclose = () => {
        this.cleanup()
        if (this.shouldConnect) {
          this.setStatus('reconnecting')
          this.scheduleReconnect()
        } else {
          this.setStatus('disconnected')
        }
      }

      this.ws.onerror = () => {
        this.cleanup()
        if (this.shouldConnect) {
          this.setStatus('reconnecting')
          this.scheduleReconnect()
        }
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  public disconnect(): void {
    this.shouldConnect = false
    this.cleanup()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.setStatus('disconnected')
    this.onlineUsers = []
  }

  public send(type: string, payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }))
    }
  }

  public onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener)
    listener(this.status)
    return () => this.statusListeners.delete(listener)
  }

  public onPresenceChange(listener: (users: PresenceUser[], count: number) => void): () => void {
    this.presenceListeners.add(listener)
    listener(this.onlineUsers, this.onlineUsers.length)
    return () => this.presenceListeners.delete(listener)
  }

  public onEvent(listener: SocketEventHandler): () => void {
    this.eventListeners.add(listener)
    return () => this.eventListeners.delete(listener)
  }

  public getStatus(): ConnectionStatus {
    return this.status
  }

  public getOnlineUsers(): PresenceUser[] {
    return this.onlineUsers
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status
    this.statusListeners.forEach((fn) => fn(status))
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.pingInterval = setInterval(() => {
      this.send('PING', null)
    }, 20000)
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private cleanup(): void {
    this.stopHeartbeat()
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout || !this.shouldConnect) return
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null
      this.backoffMs = Math.min(this.backoffMs * 1.5, 10000)
      this.connect()
    }, this.backoffMs)
  }
}

export const socket = new SocketService()

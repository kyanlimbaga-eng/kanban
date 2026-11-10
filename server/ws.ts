import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage, Server } from 'node:http'
import { getSessionUser, type AuthenticatedUser } from './auth'

export interface ConnectedClient {
  ws: WebSocket
  user: AuthenticatedUser
  isAlive: boolean
}

export interface WsEvent {
  type: string
  payload: unknown
  senderId?: string
}

let wss: WebSocketServer | null = null
const clients = new Map<WebSocket, ConnectedClient>()

function parseCookies(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {}
  if (!header) return result
  for (const item of header.split(';')) {
    const [key, ...vals] = item.trim().split('=')
    if (key) result[key] = decodeURIComponent(vals.join('='))
  }
  return result
}

export function initWebSocketServer(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const cookies = parseCookies(req.headers.cookie)
    const sessionId = cookies.flowboard_session
    const user = getSessionUser(sessionId)

    if (!user) {
      ws.close(4001, 'Unauthorized')
      return
    }

    const client: ConnectedClient = { ws, user, isAlive: true }
    clients.set(ws, client)

    ws.on('pong', () => {
      client.isAlive = true
    })

    ws.on('close', () => {
      clients.delete(ws)
      broadcastPresence()
    })

    ws.on('error', () => {
      clients.delete(ws)
      broadcastPresence()
    })

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        // Handle client ping or typing notifications
        if (msg.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG' }))
        } else if (msg.type === 'CARD_TYPING' || msg.type === 'CARD_FOCUS') {
          // Broadcast typing/presence activity on cards
          broadcastWsEvent({
            type: msg.type,
            payload: { ...msg.payload, user: client.user },
            senderId: client.user.id,
          })
        }
      } catch {
        // Ignore malformed client frames
      }
    })

    // Welcome event with current user info & presence
    ws.send(JSON.stringify({
      type: 'INIT',
      payload: { user: client.user },
    }))

    broadcastPresence()
  })

  // Heartbeat interval
  const interval = setInterval(() => {
    for (const [ws, client] of clients.entries()) {
      if (!client.isAlive) {
        ws.terminate()
        clients.delete(ws)
        continue
      }
      client.isAlive = false
      ws.ping()
    }
  }, 30000)
  interval.unref()

  wss.on('close', () => {
    clearInterval(interval)
  })

  return wss
}

export function broadcastPresence(): void {
  const activeUsers: Array<{ id: string; username: string; displayName: string; role: string }> = []
  const seenUserIds = new Set<string>()

  for (const client of clients.values()) {
    if (!seenUserIds.has(client.user.id)) {
      seenUserIds.add(client.user.id)
      activeUsers.push(client.user)
    }
  }

  const message = JSON.stringify({
    type: 'PRESENCE_UPDATE',
    payload: {
      users: activeUsers,
      count: seenUserIds.size,
    },
  })

  for (const { ws } of clients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message)
    }
  }
}

export function broadcastWsEvent(event: WsEvent, excludeSender = false): void {
  const message = JSON.stringify(event)

  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (excludeSender && event.senderId && client.user.id === event.senderId) {
        continue
      }
      client.ws.send(message)
    }
  }
}

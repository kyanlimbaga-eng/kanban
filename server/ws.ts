import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage, Server } from 'node:http'
import { getSessionUser, type AuthenticatedUser } from './auth'
import { canSeeCardAs, parseCardLabels } from './access'
import { db } from './db'

export interface ConnectedClient {
  ws: WebSocket
  user: AuthenticatedUser
  isAlive: boolean
}

export interface WsEvent {
  type: string
  payload: unknown
  senderId?: string
  /**
   * When set, the event describes a card carrying these labels and is only
   * delivered to clients whose assigned labels allow them to see it
   * (administrators always receive it).
   */
  cardLabels?: string[]
  /** When true, the event is only delivered to administrators. */
  adminOnly?: boolean
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
          const cardId = typeof msg.payload?.cardId === 'string' ? msg.payload.cardId : ''
          const cardRow = cardId
            ? db.prepare('SELECT labels FROM cards WHERE id = ?').get(cardId) as { labels: string } | undefined
            : undefined
          if (!cardRow) return

          // Only relay card activity for cards the sender can see, and only
          // to clients that are allowed to see that card.
          const cardLabels = parseCardLabels(cardRow.labels)
          if (!canSeeCardAs(client.user.id, client.user.role, cardLabels)) return

          broadcastWsEvent({
            type: msg.type,
            payload: {
              ...msg.payload,
              // Identity only — an account's assigned labels are access scope
              // and must not be broadcast to other clients.
              user: {
                id: client.user.id,
                username: client.user.username,
                displayName: client.user.displayName,
                role: client.user.role,
              },
            },
            senderId: client.user.id,
            cardLabels,
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
      // Presence carries identity only — an account's assigned labels are
      // access-control scope and are not broadcast to other clients.
      activeUsers.push({
        id: client.user.id,
        username: client.user.username,
        displayName: client.user.displayName,
        role: client.user.role,
      })
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

export function broadcastWsEvent(event: WsEvent, excludeSender = false): boolean {
  const message = JSON.stringify(event)
  let delivered = false

  for (const client of clients.values()) {
    if (client.ws.readyState !== WebSocket.OPEN) continue
    if (excludeSender && event.senderId && client.user.id === event.senderId) continue
    // Label-based access control applies to real-time events too, so hidden
    // card data is never pushed to accounts that must not see it.
    if (event.adminOnly && client.user.role !== 'admin') continue
    if (event.cardLabels && !canSeeCardAs(client.user.id, client.user.role, event.cardLabels)) continue

    client.ws.send(message)
    delivered = true
  }

  return delivered
}

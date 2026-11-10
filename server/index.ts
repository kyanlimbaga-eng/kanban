import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import express, { type Request, type Response, type NextFunction } from 'express'
import cookieParser from 'cookie-parser'
import { authenticate, lanFilter } from './auth'
import { authRouter } from './routes/auth'
import { boardRouter } from './routes/board'
import { commentsRouter } from './routes/comments'
import { usersRouter } from './routes/users'
import { auditRouter } from './routes/audit'
import { initWebSocketServer } from './ws'

const app = express()

// Security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  next()
})

app.use(express.json({ limit: '5mb' }))
app.use(cookieParser())

// LAN IP restriction check
app.use(lanFilter)

// Session authentication check
app.use(authenticate)

// API routes
app.use('/api/auth', authRouter)
app.use('/api/board', boardRouter)
app.use('/api/cards', commentsRouter)
app.use('/api/users', usersRouter)
app.use('/api/audit-logs', auditRouter)

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve production static frontend if available
const distPath = path.join(process.cwd(), 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
}

// Fallback routing: 404 for unknown /api routes, SPA index.html for other paths
app.use((req: Request, res: Response) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'Endpoint not found' })
    return
  }
  if (fs.existsSync(distPath)) {
    res.sendFile(path.join(distPath, 'index.html'))
    return
  }
  res.status(404).send('Not Found')
})

const server = http.createServer(app)

// Mount WebSocket server
initWebSocketServer(server)

const PORT = parseInt(process.env.PORT || '8091', 10)
const HOST = process.env.HOST || '0.0.0.0'

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, HOST, () => {
    console.log(`Flowboard server running at http://${HOST}:${PORT}`)
    console.log(`WebSocket server listening at ws://${HOST}:${PORT}/ws`)
  })
}

export { app, server }

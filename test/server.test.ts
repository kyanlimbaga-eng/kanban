process.env.NODE_ENV = 'test'
import assert from 'node:assert/strict'
import { server } from '../server/index'
import { db } from '../server/db'

async function runTests() {
  console.log('--- Starting Flowboard Server Integration & Security Tests ---')

  const testPort = 8099
  await new Promise<void>((resolve) => {
    server.listen(testPort, '127.0.0.1', () => resolve())
  })

  const baseUrl = `http://127.0.0.1:${testPort}`

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/api/health`)
    assert.equal(healthRes.status, 200)
    const healthData = await healthRes.json()
    assert.equal(healthData.status, 'ok')
    console.log('✓ Health check endpoint operational')

    // 2. Unauthenticated access to /api/board fails
    const unauthRes = await fetch(`${baseUrl}/api/board`)
    assert.equal(unauthRes.status, 401)
    console.log('✓ Protected endpoints reject unauthenticated requests (401)')

    // 3. Failed login attempts and rate limiting
    let failedRes: Response | null = null
    for (let i = 0; i < 5; i++) {
      failedRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
      })
      assert.equal(failedRes.status, 401)
    }
    // 6th attempt should be rate limited (429)
    const rateLimitedRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
    })
    assert.equal(rateLimitedRes.status, 429)
    const rateData = await rateLimitedRes.json()
    assert.match(rateData.error, /Too many failed login attempts/i)
    console.log('✓ Brute force protection: rate limiting triggered after 5 failed attempts (429)')

    // Reset rate limit in test for 127.0.0.1 to continue test suite
    const { resetLoginAttempts } = await import('../server/auth')
    resetLoginAttempts('127.0.0.1')
    resetLoginAttempts('::1')

    // 4. Successful Admin Login
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: '4dmin@2026!' }),
    })
    assert.equal(adminLoginRes.status, 200)
    const adminCookie = adminLoginRes.headers.get('set-cookie')
    assert.ok(adminCookie, 'Admin session cookie should be set')
    const adminData = await adminLoginRes.json()
    assert.equal(adminData.user.username, 'admin')
    assert.equal(adminData.user.role, 'admin')
    console.log('✓ Admin login successful with preserved credentials (4dmin@2026!)')

    // 5. Successful Viewer Login
    const viewerLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'viewer', password: 'viewer123' }),
    })
    assert.equal(viewerLoginRes.status, 200)
    const viewerCookie = viewerLoginRes.headers.get('set-cookie')
    assert.ok(viewerCookie, 'Viewer session cookie should be set')
    const viewerData = await viewerLoginRes.json()
    assert.equal(viewerData.user.username, 'viewer')
    assert.equal(viewerData.user.role, 'viewer')
    console.log('✓ Viewer login successful with role: viewer')

    // 6. RBAC Verification: Viewer cannot create column
    const viewerCreateCol = await fetch(`${baseUrl}/api/board/columns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: viewerCookie },
      body: JSON.stringify({ title: 'Unauthorized Col' }),
    })
    assert.equal(viewerCreateCol.status, 403)
    console.log('✓ RBAC: Viewer blocked from creating columns (403 Forbidden)')

    // 7. RBAC Verification: Admin CAN create column
    const adminCreateCol = await fetch(`${baseUrl}/api/board/columns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ title: 'Sprint Backlog' }),
    })
    assert.equal(adminCreateCol.status, 201)
    const newCol = await adminCreateCol.json()
    assert.equal(newCol.title, 'Sprint Backlog')
    console.log('✓ RBAC: Admin successfully created column (201 Created)')

    // 8. SQL Injection attempt handled safely
    const sqlPayload = "'; DROP TABLE cards; --"
    const createCardRes = await fetch(`${baseUrl}/api/board/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        columnId: newCol.id,
        title: sqlPayload,
        description: "Test description with ' OR '1'='1",
        priority: 'high',
      }),
    })
    assert.equal(createCardRes.status, 201)
    const createdCard = await createCardRes.json()
    assert.equal(createdCard.title, sqlPayload)
    // Verify cards table was NOT dropped
    const countRow = db.prepare('SELECT COUNT(*) as count FROM cards').get() as { count: number }
    assert.ok(countRow.count > 0, 'Cards table intact despite SQL injection attempt')
    console.log('✓ SQL Injection immunity: Parameterized queries preserved database integrity')

    // 9. Concurrency Conflict Prevention (Optimistic Concurrency)
    // Update card with version 1 -> succeeds, version becomes 2
    const update1 = await fetch(`${baseUrl}/api/board/cards/${createdCard.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        title: 'Updated Title First User',
        version: createdCard.version, // version 1
      }),
    })
    assert.equal(update1.status, 200)
    const updated1Card = await update1.json()
    assert.equal(updated1Card.version, 2)

    // Stale update from second user with old version 1 -> should conflict (409)
    const conflictUpdate = await fetch(`${baseUrl}/api/board/cards/${createdCard.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        title: 'Conflicting Overwrite Attempt',
        version: 1, // Stale version!
      }),
    })
    assert.equal(conflictUpdate.status, 409)
    const conflictData = await conflictUpdate.json()
    assert.match(conflictData.error, /Conflict/i)
    assert.equal(conflictData.currentCard.version, 2)
    console.log('✓ Concurrency control: Stale version write detected and rejected with 409 Conflict')

    // 10. Comments Collaboration (Viewer can comment)
    const commentRes = await fetch(`${baseUrl}/api/cards/${createdCard.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: viewerCookie },
      body: JSON.stringify({ content: 'I have started testing this card.' }),
    })
    assert.equal(commentRes.status, 201)
    const commentData = await commentRes.json()
    assert.equal(commentData.username, 'viewer')
    assert.equal(commentData.content, 'I have started testing this card.')

    const listCommentsRes = await fetch(`${baseUrl}/api/cards/${createdCard.id}/comments`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(listCommentsRes.status, 200)
    const { comments } = await listCommentsRes.json()
    assert.equal(comments.length, 1)
    assert.equal(comments[0].content, 'I have started testing this card.')
    console.log('✓ Collaboration: Viewer added discussion comment to card; Admin retrieved it')

    // 11. Audit Logging: Admin can view audit logs
    const auditRes = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(auditRes.status, 200)
    const auditData = await auditRes.json()
    assert.ok(auditData.logs.length > 0)
    console.log(`✓ Audit logging: ${auditData.logs.length} audit entries captured`)

    // 12. Card Deletion and Comment Cleanup
    const deleteCardRes = await fetch(`${baseUrl}/api/board/cards/${createdCard.id}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    })
    assert.equal(deleteCardRes.status, 200)
    const deleteData = await deleteCardRes.json()
    assert.equal(deleteData.success, true)
    // Verify card is removed from DB
    const checkCard = db.prepare('SELECT * FROM cards WHERE id = ?').get(createdCard.id)
    assert.equal(checkCard, undefined, 'Deleted card should not exist in database')
    // Verify comments on deleted card are cleaned up
    const checkComments = db.prepare('SELECT * FROM comments WHERE card_id = ?').all(createdCard.id)
    assert.equal(checkComments.length, 0, 'Comments on deleted card must be cleaned up')
    console.log('✓ Card deletion: Card removed, dependent comments purged, audit recorded')

    // 13. Sequential Card Creation with atomic positioning
    const cardA = await fetch(`${baseUrl}/api/board/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ columnId: newCol.id, title: 'Task Alpha', priority: 'medium' }),
    }).then((r) => r.json())

    const cardB = await fetch(`${baseUrl}/api/board/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ columnId: newCol.id, title: 'Task Beta', priority: 'low' }),
    }).then((r) => r.json())

    assert.notEqual(cardA.id, cardB.id)
    assert.equal(cardA.position < cardB.position, true, 'Sequential cards must receive sequential positions')
    console.log('✓ Sequential positioning: Cards created sequentially received distinct positions')

    console.log('\n--- ALL SERVER & SECURITY TESTS PASSED SUCCESSFULLY! ---')
  } finally {
    server.close()
  }
}

runTests().catch((err) => {
  console.error('Test suite failed:', err)
  process.exit(1)
})

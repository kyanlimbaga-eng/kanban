process.env.NODE_ENV = 'test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { WebSocket } from 'ws'
import { PLAN_LABELS } from '../shared/planLabels'

// Run against an isolated database so the suite never touches the
// development data in ./data (test accounts and cards stay out of the board).
const testDbPath = path.join(os.tmpdir(), 'flowboard-test.db')
for (const suffix of ['', '-wal', '-shm']) {
  fs.rmSync(`${testDbPath}${suffix}`, { force: true })
}
process.env.DB_PATH = testDbPath
process.env.DATA_DIR = path.dirname(testDbPath)

const { server } = await import('../server/index')
const { db } = await import('../server/db')

async function runTests() {
  console.log('--- Starting Flowboard Server Integration & Security Tests ---')

  const testPort = 8099
  await new Promise<void>((resolve) => {
    server.listen(testPort, '127.0.0.1', () => resolve())
  })

  const baseUrl = `http://127.0.0.1:${testPort}`

  // The SQLite file persists between runs, so remove artifacts created by
  // previous executions of this suite to keep assertions deterministic.
  for (const username of ['adds.ctu', 'pki.ctu', 'bad.ctu', 'temp.ctu', 'direct.ctu']) {
    const stale = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: string } | undefined
    if (stale) db.prepare('DELETE FROM users WHERE id = ?').run(stale.id)
  }
  db.prepare(`DELETE FROM labels WHERE name LIKE 'Temp Scope%'`).run()

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

    // 7b. Column rename and reorder (route precedence regression: the static
    // '/columns/reorder' route must not be swallowed by '/columns/:id')
    const renameColRes = await fetch(`${baseUrl}/api/board/columns/${newCol.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ title: 'Sprint Backlog v2' }),
    })
    assert.equal(renameColRes.status, 200, 'Renaming a column must work')
    const renamedCol = await renameColRes.json() as { title: string }
    assert.equal(renamedCol.title, 'Sprint Backlog v2', 'Renamed title must be returned')

    const boardBeforeReorder = await fetch(`${baseUrl}/api/board`, { headers: { Cookie: adminCookie } })
      .then((r) => r.json()) as { columns: Array<{ id: string }> }
    const reversedColumnIds = boardBeforeReorder.columns.map((c) => c.id).reverse()
    const reorderColRes = await fetch(`${baseUrl}/api/board/columns/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ columnIds: reversedColumnIds }),
    })
    assert.equal(reorderColRes.status, 200, 'Reordering columns must work')
    const boardAfterReorder = await fetch(`${baseUrl}/api/board`, { headers: { Cookie: adminCookie } })
      .then((r) => r.json()) as { columns: Array<{ id: string }> }
    assert.deepEqual(
      boardAfterReorder.columns.map((c) => c.id),
      reversedColumnIds,
      'The new column order must be persisted',
    )
    console.log('✓ Columns: rename and reorder both work (route precedence intact)')

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
        labels: ['Design'],
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

    // 9b. Label-based access control: admin assigns labels to an existing account
    const userListRes = await fetch(`${baseUrl}/api/users`, { headers: { Cookie: adminCookie } })
    assert.equal(userListRes.status, 200)
    const userListData = await userListRes.json() as { users: Array<{ id: string; username: string; labels: string[] }> }
    const viewerAccount = userListData.users.find((u) => u.username === 'viewer')
    assert.ok(viewerAccount, 'Viewer account should exist')
    assert.ok(Array.isArray(viewerAccount.labels), 'User list should include assigned labels')

    const assignLabelsRes = await fetch(`${baseUrl}/api/users/${viewerAccount.id}/labels`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ labels: ['Design'] }),
    })
    assert.equal(assignLabelsRes.status, 200)
    console.log('✓ Label assignment: admin assigned labels to an existing account')

    // 10. Comments Collaboration (Viewer can comment on a card within their label scope)
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

    // ---------------------------------------------------------------
    // Label-based task visibility (Plan labels & account scoping)
    // ---------------------------------------------------------------
    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

    // 14. The fixed Plan label set exists and is protected from deletion
    const adminBoardRes = await fetch(`${baseUrl}/api/board`, { headers: { Cookie: adminCookie } })
    const adminBoard = await adminBoardRes.json() as { labels: string[]; cards: Array<{ id: string; labels: string[] }> }
    for (const planLabel of PLAN_LABELS) {
      assert.ok(adminBoard.labels.includes(planLabel), `Plan label "${planLabel}" should be seeded`)
    }
    assert.ok(adminBoard.cards.length > 0, 'Admin should see every card')

    const protectedDeleteRes = await fetch(`${baseUrl}/api/board/labels/${encodeURIComponent('AD DS')}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    })
    assert.equal(protectedDeleteRes.status, 409, 'Plan labels must not be deletable')
    console.log('✓ Plan labels seeded and protected from deletion (409)')

    // 15. Creating accounts with assigned labels
    const addsCreateRes = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ username: 'adds.ctu', password: 'adds1234', displayName: 'AD DS Account', role: 'viewer', labels: ['AD DS'], mustChangePassword: false }),
    })
    assert.equal(addsCreateRes.status, 201)
    const addsUser = await addsCreateRes.json() as { id: string; labels: string[] }
    assert.deepEqual(addsUser.labels, ['AD DS'])

    const pkiCreateRes = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ username: 'pki.ctu', password: 'pki12345', displayName: 'PKI Account', role: 'viewer', labels: ['PKI'], mustChangePassword: false }),
    })
    assert.equal(pkiCreateRes.status, 201)
    const pkiUser = await pkiCreateRes.json() as { id: string; labels: string[] }
    assert.deepEqual(pkiUser.labels, ['PKI'])

    const badLabelRes = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ username: 'bad.ctu', password: 'bad12345', role: 'viewer', labels: ['Not A Real Label'] }),
    })
    assert.equal(badLabelRes.status, 400, 'Unknown labels must be rejected')
    console.log('✓ Accounts created with label assignments; unknown labels rejected (400)')

    // 16. Cards in different label scopes
    const adsCard = await fetch(`${baseUrl}/api/board/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ columnId: newCol.id, title: 'Provision AD DS lab', priority: 'high', labels: ['AD DS'] }),
    }).then((r) => r.json()) as { id: string }
    const pkiCard = await fetch(`${baseUrl}/api/board/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ columnId: newCol.id, title: 'Renew enterprise CA certificate', priority: 'medium', labels: ['PKI'] }),
    }).then((r) => r.json()) as { id: string }
    const bareCard = await fetch(`${baseUrl}/api/board/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ columnId: newCol.id, title: 'Uncategorized task', priority: 'low' }),
    }).then((r) => r.json()) as { id: string }

    // 17. A restricted account only receives its own label scope
    const addsLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'adds.ctu', password: 'adds1234' }),
    })
    assert.equal(addsLoginRes.status, 200)
    const addsCookie = addsLoginRes.headers.get('set-cookie') || ''
    const addsLoginData = await addsLoginRes.json() as { user: { labels: string[] } }
    assert.deepEqual(addsLoginData.user.labels, ['AD DS'])

    const addsBoardRes = await fetch(`${baseUrl}/api/board`, { headers: { Cookie: addsCookie } })
    const addsBoard = await addsBoardRes.json() as { cards: Array<{ id: string; labels: string[] }>; labels: string[] }
    assert.ok(addsBoard.cards.some((c) => c.id === adsCard.id), 'AD DS account should see the AD DS card')
    assert.ok(!addsBoard.cards.some((c) => c.id === pkiCard.id), 'AD DS account must not see the PKI card')
    assert.ok(!addsBoard.cards.some((c) => c.id === bareCard.id), 'AD DS account must not see unlabeled cards')
    assert.ok(
      addsBoard.cards.every((c) => c.labels.some((l) => l.toLowerCase() === 'ad ds')),
      'Every visible card must carry the assigned label',
    )
    assert.deepEqual(addsBoard.labels, ['AD DS'], 'Label list must be scoped to the account')

    // The PKI account sees the opposite scope
    const pkiLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'pki.ctu', password: 'pki12345' }),
    })
    assert.equal(pkiLoginRes.status, 200)
    const pkiCookie = pkiLoginRes.headers.get('set-cookie') || ''
    const pkiBoard = await fetch(`${baseUrl}/api/board`, { headers: { Cookie: pkiCookie } }).then((r) => r.json()) as {
      cards: Array<{ id: string }>; labels: string[]
    }
    assert.ok(pkiBoard.cards.some((c) => c.id === pkiCard.id), 'PKI account should see the PKI card')
    assert.ok(!pkiBoard.cards.some((c) => c.id === adsCard.id), 'PKI account must not see the AD DS card')
    assert.deepEqual(pkiBoard.labels, ['PKI'], 'PKI account label list is scoped')
    console.log('✓ Backend filtering: each account only receives cards of its assigned label')

    // 18. Comments follow card visibility (hidden cards are not discoverable)
    const hiddenCommentsRes = await fetch(`${baseUrl}/api/cards/${pkiCard.id}/comments`, { headers: { Cookie: addsCookie } })
    assert.equal(hiddenCommentsRes.status, 404, 'Hidden card comments must return 404')
    const hiddenPostRes = await fetch(`${baseUrl}/api/cards/${pkiCard.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: addsCookie },
      body: JSON.stringify({ content: 'peeking at hidden card' }),
    })
    assert.equal(hiddenPostRes.status, 404, 'Posting to a hidden card must return 404')

    const visiblePostRes = await fetch(`${baseUrl}/api/cards/${adsCard.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: addsCookie },
      body: JSON.stringify({ content: 'AD DS work started' }),
    })
    assert.equal(visiblePostRes.status, 201, 'Commenting on a visible card stays allowed')
    const visibleComments = await fetch(`${baseUrl}/api/cards/${adsCard.id}/comments`, { headers: { Cookie: addsCookie } })
      .then((r) => r.json()) as { comments: Array<{ content: string }> }
    assert.equal(visibleComments.comments.length, 1)
    console.log('✓ Comments: hidden cards return 404, visible cards stay usable')

    // 19. Label accounts cannot edit card content or reach admin endpoints
    const addsWriteRes = await fetch(`${baseUrl}/api/board/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: addsCookie },
      body: JSON.stringify({ columnId: newCol.id, title: 'sneaky create', labels: ['AD DS'] }),
    })
    assert.equal(addsWriteRes.status, 403, 'Label accounts must not create cards')
    const addsEditRes = await fetch(`${baseUrl}/api/board/cards/${adsCard.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: addsCookie },
      body: JSON.stringify({ title: 'hijacked title' }),
    })
    assert.equal(addsEditRes.status, 403, 'Label accounts must not edit card details')
    const addsDeleteRes = await fetch(`${baseUrl}/api/board/cards/${adsCard.id}`, {
      method: 'DELETE',
      headers: { Cookie: addsCookie },
    })
    assert.equal(addsDeleteRes.status, 403, 'Label accounts must not delete cards')
    const addsLabelAdminRes = await fetch(`${baseUrl}/api/board/labels/${encodeURIComponent('GPO')}`, {
      method: 'DELETE',
      headers: { Cookie: addsCookie },
    })
    assert.equal(addsLabelAdminRes.status, 403, 'Label accounts must not manage labels')
    const addsUsersRes = await fetch(`${baseUrl}/api/users`, { headers: { Cookie: addsCookie } })
    assert.equal(addsUsersRes.status, 403, 'Label accounts must not list users')
    console.log('✓ Read-only enforcement: label accounts cannot create, edit, delete or reach admin endpoints (403)')

    // 19b. Label accounts may move the cards inside their own label scope
    const doneColumn = db.prepare("SELECT id FROM columns WHERE title = 'Done'").get() as { id: string }
    assert.ok(doneColumn, 'Board should have a Done column')

    const moveOwnRes = await fetch(`${baseUrl}/api/board/cards/${adsCard.id}/move`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: addsCookie },
      body: JSON.stringify({ toColumnId: doneColumn.id, toIndex: 0 }),
    })
    assert.equal(moveOwnRes.status, 200, 'Label accounts may move cards within their own label scope')
    const movedRow = db.prepare('SELECT column_id FROM cards WHERE id = ?').get(adsCard.id) as { column_id: string }
    assert.equal(movedRow.column_id, doneColumn.id, 'The moved card should land in the target column')

    const moveHiddenRes = await fetch(`${baseUrl}/api/board/cards/${pkiCard.id}/move`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: addsCookie },
      body: JSON.stringify({ toColumnId: doneColumn.id, toIndex: 0 }),
    })
    assert.equal(moveHiddenRes.status, 403, 'Label accounts must not move cards outside their label scope')
    const untouchedRow = db.prepare('SELECT column_id FROM cards WHERE id = ?').get(pkiCard.id) as { column_id: string }
    assert.equal(untouchedRow.column_id, newCol.id, 'An out-of-scope card must not move')

    const moveUnlabelledRes = await fetch(`${baseUrl}/api/board/cards/${bareCard.id}/move`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: addsCookie },
      body: JSON.stringify({ toColumnId: doneColumn.id, toIndex: 0 }),
    })
    assert.equal(moveUnlabelledRes.status, 403, 'Unlabelled cards stay administrator-only')
    console.log('✓ Scoped moves: label accounts move their own cards, out-of-scope cards stay locked (403)')

    // 20. Administrators retain full access
    const adminBoardAgain = await fetch(`${baseUrl}/api/board`, { headers: { Cookie: adminCookie } })
      .then((r) => r.json()) as { cards: Array<{ id: string }> }
    for (const card of [adsCard, pkiCard, bareCard]) {
      assert.ok(adminBoardAgain.cards.some((c) => c.id === card.id), 'Admin must see every card')
    }

    // 21. Changing an account's labels changes what it can see
    let assignRes = await fetch(`${baseUrl}/api/users/${addsUser.id}/labels`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ labels: ['AD DS', 'PKI'] }),
    })
    assert.equal(assignRes.status, 200)
    let scopedBoard = await fetch(`${baseUrl}/api/board`, { headers: { Cookie: addsCookie } }).then((r) => r.json()) as {
      cards: Array<{ id: string }>
    }
    assert.ok(scopedBoard.cards.some((c) => c.id === pkiCard.id), 'Account should see the PKI card after being assigned PKI')

    assignRes = await fetch(`${baseUrl}/api/users/${addsUser.id}/labels`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ labels: [] }),
    })
    assert.equal(assignRes.status, 200)
    scopedBoard = await fetch(`${baseUrl}/api/board`, { headers: { Cookie: addsCookie } }).then((r) => r.json()) as {
      cards: Array<{ id: string }>
    }
    assert.equal(scopedBoard.cards.length, 0, 'An account with no labels sees no cards')

    assignRes = await fetch(`${baseUrl}/api/users/${addsUser.id}/labels`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ labels: ['AD DS'] }),
    })
    assert.equal(assignRes.status, 200)
    console.log('✓ Changing account labels immediately changes task visibility')

    // 22. Renaming a label cascades to account assignments
    const tempLabelRes = await fetch(`${baseUrl}/api/board/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ name: 'Temp Scope' }),
    })
    assert.equal(tempLabelRes.status, 201)
    assignRes = await fetch(`${baseUrl}/api/users/${addsUser.id}/labels`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ labels: ['Temp Scope'] }),
    })
    assert.equal(assignRes.status, 200)

    const renameRes = await fetch(`${baseUrl}/api/board/labels/${encodeURIComponent('Temp Scope')}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ newName: 'Temp Scope Renamed' }),
    })
    assert.equal(renameRes.status, 200)

    const usersAfterRename = await fetch(`${baseUrl}/api/users`, { headers: { Cookie: adminCookie } })
      .then((r) => r.json()) as { users: Array<{ id: string; labels: string[] }> }
    const addsAfterRename = usersAfterRename.users.find((u) => u.id === addsUser.id)
    assert.ok(addsAfterRename, 'Account should still exist after rename')
    assert.deepEqual(addsAfterRename.labels, ['Temp Scope Renamed'], 'Account assignment must follow the rename')

    const renamedCatalog = await fetch(`${baseUrl}/api/board`, { headers: { Cookie: addsCookie } })
      .then((r) => r.json()) as { labels: string[] }
    assert.deepEqual(renamedCatalog.labels, ['Temp Scope Renamed'], 'Scoped catalog must show the renamed label')

    const tempDeleteRes = await fetch(`${baseUrl}/api/board/labels/${encodeURIComponent('Temp Scope Renamed')}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    })
    assert.equal(tempDeleteRes.status, 200, 'Non-Plan labels stay deletable')
    assignRes = await fetch(`${baseUrl}/api/users/${addsUser.id}/labels`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ labels: ['AD DS'] }),
    })
    assert.equal(assignRes.status, 200)
    console.log('✓ Label renames cascade to account assignments; deletions drop assignments')

    // 23. WebSocket events respect label scoping
    const wsAdds = new WebSocket(`ws://127.0.0.1:${testPort}/ws`, { headers: { Cookie: addsCookie } })
    await new Promise<void>((resolve, reject) => {
      wsAdds.once('open', () => resolve())
      wsAdds.once('error', reject)
    })
    const wsReceived: Array<{ type: string; id?: string }> = []
    wsAdds.on('message', (data) => {
      try {
        const event = JSON.parse(data.toString()) as { type: string; payload?: { id?: string } }
        if (event.type === 'CARD_CREATED' || event.type === 'CARD_UPDATED') {
          wsReceived.push({ type: event.type, id: event.payload?.id })
        }
      } catch {
        // Ignore malformed frames
      }
    })

    const wsHiddenCard = await fetch(`${baseUrl}/api/board/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ columnId: newCol.id, title: 'Hidden from WS', priority: 'low', labels: ['PKI'] }),
    }).then((r) => r.json()) as { id: string }
    await sleep(400)
    assert.ok(
      !wsReceived.some((event) => event.id === wsHiddenCard.id),
      'WebSocket must not push cards outside the account label scope',
    )

    const wsVisibleCard = await fetch(`${baseUrl}/api/board/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ columnId: newCol.id, title: 'Visible via WS', priority: 'low', labels: ['AD DS'] }),
    }).then((r) => r.json()) as { id: string }
    await sleep(400)
    assert.ok(
      wsReceived.some((event) => event.id === wsVisibleCard.id),
      'WebSocket must push cards within the account label scope',
    )
    wsAdds.close()

    // 24. First-login password change (temporary password issued by an admin)
    const tempCreateRes = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ username: 'temp.ctu', password: 'temp1234', displayName: 'Temp Account', role: 'viewer' }),
    })
    assert.equal(tempCreateRes.status, 201)
    const tempUser = await tempCreateRes.json() as { id: string; mustChangePassword: boolean }
    assert.equal(tempUser.mustChangePassword, true, 'New accounts must change their password at first sign-in')

    const tempLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'temp.ctu', password: 'temp1234' }),
    })
    assert.equal(tempLoginRes.status, 200)
    const tempCookie = tempLoginRes.headers.get('set-cookie') || ''
    const tempLoginData = await tempLoginRes.json() as { user: { mustChangePassword: boolean } }
    assert.equal(tempLoginData.user.mustChangePassword, true, 'The account is flagged after signing in')

    const tempBoardRes = await fetch(`${baseUrl}/api/board`, { headers: { Cookie: tempCookie } })
    assert.equal(tempBoardRes.status, 403, 'A temporary-password account must not reach the board')
    const tempBlocked = await tempBoardRes.json() as { code?: string }
    assert.equal(tempBlocked.code, 'PASSWORD_CHANGE_REQUIRED', 'The block should be reported as a password change request')

    const tempUsersRes = await fetch(`${baseUrl}/api/users`, { headers: { Cookie: tempCookie } })
    assert.equal(tempUsersRes.status, 403, 'A temporary-password account must not reach account management')

    const tempMeRes = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: tempCookie } })
    assert.equal(tempMeRes.status, 200, 'A temporary-password account may still read its own session')

    const wrongTempPassRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: tempCookie },
      body: JSON.stringify({ currentPassword: 'not-the-password', newPassword: 'brandnew1' }),
    })
    assert.equal(wrongTempPassRes.status, 400, 'The current password must be verified')

    const changeTempPassRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: tempCookie },
      body: JSON.stringify({ currentPassword: 'temp1234', newPassword: 'brandnew1' }),
    })
    assert.equal(changeTempPassRes.status, 200, 'The password can be changed with the temporary one')

    const tempBoardAfterRes = await fetch(`${baseUrl}/api/board`, { headers: { Cookie: tempCookie } })
    assert.equal(tempBoardAfterRes.status, 200, 'The board unlocks once the password is changed')

    const staleLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'temp.ctu', password: 'temp1234' }),
    })
    assert.equal(staleLoginRes.status, 401, 'The temporary password stops working after the change')

    const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'temp.ctu', password: 'brandnew1' }),
    })
    assert.equal(newLoginRes.status, 200, 'The new password works')
    const newLoginData = await newLoginRes.json() as { user: { mustChangePassword: boolean } }
    assert.equal(newLoginData.user.mustChangePassword, false, 'The flag is cleared after the change')

    // Accounts created without the requirement keep working right away
    const directCreateRes = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ username: 'direct.ctu', password: 'direct1234', role: 'viewer', mustChangePassword: false }),
    })
    assert.equal(directCreateRes.status, 201)
    const directLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'direct.ctu', password: 'direct1234' }),
    })
    assert.equal(directLoginRes.status, 200)
    const directCookie = directLoginRes.headers.get('set-cookie') || ''
    const directBoardRes = await fetch(`${baseUrl}/api/board`, { headers: { Cookie: directCookie } })
    assert.equal(directBoardRes.status, 200, 'An account without the requirement reaches the board immediately')
    console.log('✓ First login: temporary-password accounts are blocked until they set their own password')
    console.log('✓ WebSocket: card events are filtered per account label scope')

    console.log('\n--- ALL SERVER & SECURITY TESTS PASSED SUCCESSFULLY! ---')
  } finally {
    server.close()
    try {
      db.close()
    } catch {
      // The connection may already be gone
    }
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        fs.rmSync(`${testDbPath}${suffix}`, { force: true })
      } catch {
        // Windows may keep the file locked for a moment; a leftover temp file is harmless
      }
    }
  }
}

runTests().catch((err) => {
  console.error('Test suite failed:', err)
  process.exit(1)
})

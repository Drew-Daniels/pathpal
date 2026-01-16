import { test } from 'node:test'
import { strictEqual, ok, deepStrictEqual } from 'node:assert'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createPathPal } from '../src/index.js'

const testDir = join(process.cwd(), 'test-batch-temp')

test('Setup test fixtures for batch operations', async () => {
  await rm(testDir, { recursive: true, force: true })
  await mkdir(testDir, { recursive: true })
  await mkdir(join(testDir, 'logs'), { recursive: true })
  await mkdir(join(testDir, 'config'), { recursive: true })
  await writeFile(join(testDir, 'logs', 'app.log'), 'log content')
  await writeFile(join(testDir, 'config', 'database.json'), '{"host":"localhost"}')
  await writeFile(join(testDir, 'config', 'app.json'), '{"name":"myapp"}')
})

test('PathPal - resolvePaths resolves multiple paths', () => {
  const pal = createPathPal({
    root: testDir,
    directories: { logs: 'logs', config: 'config' },
  })

  const paths = pal.resolvePaths([
    ['logs', 'app.log'],
    ['config', 'database.json'],
    ['config', 'app.json'],
  ])

  strictEqual(paths.length, 3)
  ok(paths[0].endsWith('logs/app.log') || paths[0].endsWith('logs\\app.log'))
  ok(paths[1].endsWith('config/database.json') || paths[1].endsWith('config\\database.json'))
  ok(paths[2].endsWith('config/app.json') || paths[2].endsWith('config\\app.json'))
})

test('PathPal - resolvePaths with non-existent directory', () => {
  const pal = createPathPal({
    root: testDir,
    directories: { logs: 'logs' },
  })

  const paths = pal.resolvePaths([
    ['logs', 'app.log'],
    ['other', 'file.txt'], // 'other' not in directories
  ])

  strictEqual(paths.length, 2)
  ok(paths[0].includes('logs'))
  ok(paths[1].includes('other'))
})

test('PathPal - existsBatch checks multiple paths in parallel', async () => {
  const pal = createPathPal({
    root: testDir,
    directories: { logs: 'logs', config: 'config' },
  })

  const results = await pal.existsBatch([
    ['logs', 'app.log'], // exists
    ['logs', 'nonexistent.log'], // doesn't exist
    ['config', 'database.json'], // exists
    ['config', 'missing.json'], // doesn't exist
  ])

  deepStrictEqual(results, [true, false, true, false])
})

test('PathPal - batch with path operation', async () => {
  const pal = createPathPal({
    root: testDir,
    directories: { logs: 'logs', config: 'config' },
  })

  const results = await pal.batch([
    { op: 'path', dir: 'logs', paths: ['app.log'] },
    { op: 'path', dir: 'config', paths: ['database.json'] },
  ])

  strictEqual(results.length, 2)
  ok(typeof results[0] === 'string')
  ok(typeof results[1] === 'string')
  ok(results[0].includes('logs'))
  ok(results[1].includes('config'))
})

test('PathPal - batch with exists operation', async () => {
  const pal = createPathPal({
    root: testDir,
    directories: { logs: 'logs', config: 'config' },
  })

  const results = await pal.batch([
    { op: 'exists', dir: 'logs', paths: ['app.log'] },
    { op: 'exists', dir: 'logs', paths: ['nonexistent.log'] },
    { op: 'exists', dir: 'config', paths: ['database.json'] },
  ])

  deepStrictEqual(results, [true, false, true])
})

test('PathPal - batch with isFile operation', async () => {
  const pal = createPathPal({
    root: testDir,
    directories: { logs: 'logs', config: 'config' },
  })

  const results = await pal.batch([
    { op: 'isFile', dir: 'logs', paths: ['app.log'] },
    { op: 'isFile', dir: 'logs', paths: [] }, // Directory itself
  ])

  strictEqual(results[0], true) // app.log is a file
  strictEqual(results[1], false) // logs directory is not a file
})

test('PathPal - batch with isDirectory operation', async () => {
  const pal = createPathPal({
    root: testDir,
    directories: { logs: 'logs', config: 'config' },
  })

  const results = await pal.batch([
    { op: 'isDirectory', dir: 'logs', paths: [] },
    { op: 'isDirectory', dir: 'logs', paths: ['app.log'] },
  ])

  strictEqual(results[0], true) // logs is a directory
  strictEqual(results[1], false) // app.log is not a directory
})

test('PathPal - batch with read operation', async () => {
  const pal = createPathPal({
    root: testDir,
    directories: { logs: 'logs', config: 'config' },
  })

  const results = await pal.batch([
    { op: 'read', dir: 'logs', paths: ['app.log'], encoding: 'utf-8' },
    { op: 'read', dir: 'config', paths: ['database.json'], encoding: 'utf-8' },
  ])

  strictEqual(results[0], 'log content')
  strictEqual(results[1], '{"host":"localhost"}')
})

test('PathPal - batch with mixed operations', async () => {
  const pal = createPathPal({
    root: testDir,
    directories: { logs: 'logs', config: 'config' },
  })

  const results = await pal.batch([
    { op: 'path', dir: 'logs', paths: ['app.log'] },
    { op: 'exists', dir: 'logs', paths: ['app.log'] },
    { op: 'isFile', dir: 'logs', paths: ['app.log'] },
    { op: 'read', dir: 'logs', paths: ['app.log'], encoding: 'utf-8' },
  ])

  strictEqual(results.length, 4)
  ok(typeof results[0] === 'string') // path
  strictEqual(results[1], true) // exists
  strictEqual(results[2], true) // isFile
  strictEqual(results[3], 'log content') // read
})

test('PathPal - batch throws error for unknown operation', async () => {
  const pal = createPathPal({
    root: testDir,
    directories: { logs: 'logs' },
  })

  try {
    await pal.batch([{ op: 'invalid' as any, dir: 'logs', paths: ['app.log'] }])
    ok(false, 'Should have thrown error')
  } catch (error: any) {
    ok(error.message.includes('Unknown operation'))
  }
})

test('PathPal - batch throws error for non-existent directory', async () => {
  const pal = createPathPal({
    root: testDir,
    directories: { logs: 'logs' },
  })

  try {
    await pal.batch([{ op: 'path', dir: 'nonexistent', paths: ['file.txt'] }])
    ok(false, 'Should have thrown error')
  } catch (error: any) {
    ok(error.message.includes('Directory'))
    ok(error.message.includes('not found'))
  }
})

test('PathPal - readBatch reads multiple files in parallel', async () => {
  const pal = createPathPal({
    root: testDir,
    directories: { config: 'config' },
  })

  const contents = await pal.readBatch(
    [
      ['config', 'database.json'],
      ['config', 'app.json'],
    ],
    'utf-8',
  )

  strictEqual(contents.length, 2)
  strictEqual(contents[0], '{"host":"localhost"}')
  strictEqual(contents[1], '{"name":"myapp"}')
})

test('PathPal - readBatch without encoding returns buffers', async () => {
  const pal = createPathPal({
    root: testDir,
    directories: { config: 'config' },
  })

  const contents = await pal.readBatch([
    ['config', 'database.json'],
    ['config', 'app.json'],
  ])

  strictEqual(contents.length, 2)
  ok(Buffer.isBuffer(contents[0]))
  ok(Buffer.isBuffer(contents[1]))
})

test('PathPal - batch operations work with cache', async () => {
  const pal = createPathPal({
    root: testDir,
    directories: { logs: 'logs', config: 'config' },
    cache: true,
  })

  // First batch - cache misses
  await pal.batch([
    { op: 'path', dir: 'logs', paths: ['app.log'] },
    { op: 'path', dir: 'config', paths: ['database.json'] },
  ])

  let stats = pal.getCacheStats()
  strictEqual(stats.misses, 2)
  strictEqual(stats.hits, 0)

  // Second batch - cache hits
  await pal.batch([
    { op: 'path', dir: 'logs', paths: ['app.log'] },
    { op: 'path', dir: 'config', paths: ['database.json'] },
  ])

  stats = pal.getCacheStats()
  strictEqual(stats.misses, 2)
  strictEqual(stats.hits, 2)
})

test('PathPal - resolvePaths is fast for repeated calls', () => {
  const pal = createPathPal({
    root: testDir,
    directories: { logs: 'logs', config: 'config' },
    cache: true,
  })

  const requests = Array.from(
    { length: 100 },
    (_, i) => ['logs', `file${i}.log`] as [string, string],
  )

  // First call
  const start1 = Date.now()
  pal.resolvePaths(requests)
  const time1 = Date.now() - start1

  // Second call (cached)
  const start2 = Date.now()
  pal.resolvePaths(requests)
  const time2 = Date.now() - start2

  // Cached should be faster or same (allowing for timing variance)
  ok(time2 <= time1 + 5) // +5ms tolerance for timing variance
})

test('PathPal - existsBatch handles empty array', async () => {
  const pal = createPathPal({
    root: testDir,
    directories: { logs: 'logs' },
  })

  const results = await pal.existsBatch([])
  deepStrictEqual(results, [])
})

test('PathPal - batch handles empty array', async () => {
  const pal = createPathPal({
    root: testDir,
    directories: { logs: 'logs' },
  })

  const results = await pal.batch([])
  deepStrictEqual(results, [])
})

test('PathPal - readBatch handles empty array', async () => {
  const pal = createPathPal({
    root: testDir,
    directories: { logs: 'logs' },
  })

  const results = await pal.readBatch([], 'utf-8')
  deepStrictEqual(results, [])
})

test('PathPal - batch operations are truly parallel', async () => {
  const pal = createPathPal({
    root: testDir,
    directories: { config: 'config' },
  })

  // Create large number of operations
  const requests = Array.from({ length: 50 }, () => ({
    op: 'exists' as const,
    dir: 'config',
    paths: ['database.json'],
  }))

  const start = Date.now()
  await pal.batch(requests)
  const duration = Date.now() - start

  // Should complete quickly due to parallelization
  // If sequential, 50 operations would take much longer
  ok(duration < 1000) // Should complete in less than 1 second
})

test('Cleanup test fixtures for batch operations', async () => {
  await rm(testDir, { recursive: true, force: true })
})

import { test } from 'node:test'
import { strictEqual, ok } from 'node:assert'
import { createPathPal } from '../src/index.js'

test('PathPal - cache disabled by default', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs' },
  })

  const stats = pal.getCacheStats()
  strictEqual(stats.hits, 0)
  strictEqual(stats.misses, 0)
  strictEqual(stats.size, 0)
  strictEqual(pal.getCacheSize(), 0)
})

test('PathPal - cache enabled with boolean', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs' },
    cache: true,
  })

  const stats = pal.getCacheStats()
  strictEqual(stats.hits, 0)
  strictEqual(stats.misses, 0)
  strictEqual(stats.size, 0)
  strictEqual(stats.maxSize, 1000) // Default max size
})

test('PathPal - cache enabled with custom config', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs' },
    cache: {
      enabled: true,
      maxSize: 500,
      ttl: 60000,
    },
  })

  const stats = pal.getCacheStats()
  strictEqual(stats.maxSize, 500)
})

test('PathPal - cache hit on repeated path access', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs' },
    cache: true,
  })

  // First call - cache miss
  const path1 = pal.logsPath('app.log')
  let stats = pal.getCacheStats()
  strictEqual(stats.misses, 1)
  strictEqual(stats.hits, 0)
  strictEqual(stats.size, 1)

  // Second call - cache hit
  const path2 = pal.logsPath('app.log')
  stats = pal.getCacheStats()
  strictEqual(stats.misses, 1)
  strictEqual(stats.hits, 1)
  strictEqual(stats.size, 1)

  // Paths should be identical
  strictEqual(path1, path2)
})

test('PathPal - cache hit rate calculation', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs' },
    cache: true,
  })

  // 1 miss
  pal.logsPath('app.log')

  // 3 hits
  pal.logsPath('app.log')
  pal.logsPath('app.log')
  pal.logsPath('app.log')

  const stats = pal.getCacheStats()
  strictEqual(stats.hits, 3)
  strictEqual(stats.misses, 1)
  strictEqual(stats.hitRate, 0.75) // 3/4 = 0.75
})

test('PathPal - cache stores different paths separately', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs' },
    cache: true,
  })

  const path1 = pal.logsPath('app.log')
  const path2 = pal.logsPath('error.log')
  const path3 = pal.logsPath('debug.log')

  const stats = pal.getCacheStats()
  strictEqual(stats.size, 3)
  strictEqual(stats.misses, 3)
  strictEqual(stats.hits, 0)

  // Verify paths are different
  ok(path1 !== path2)
  ok(path2 !== path3)
  ok(path1 !== path3)
})

test('PathPal - clearCache clears all entries', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs', config: 'config' },
    cache: true,
  })

  pal.logsPath('app.log')
  pal.configPath('database.json')

  let stats = pal.getCacheStats()
  strictEqual(stats.size, 2)

  pal.clearCache()

  stats = pal.getCacheStats()
  strictEqual(stats.size, 0)
  strictEqual(stats.hits, 0)
  strictEqual(stats.misses, 0)
})

test('PathPal - clearCache with directory parameter', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs', config: 'config' },
    cache: true,
  })

  pal.logsPath('app.log')
  pal.logsPath('error.log')
  pal.configPath('database.json')

  let stats = pal.getCacheStats()
  strictEqual(stats.size, 3)

  // Clear only logs cache
  pal.clearCache('logs')

  stats = pal.getCacheStats()
  strictEqual(stats.size, 1) // config path should remain

  // Config path should still be cached (hit)
  pal.configPath('database.json')
  stats = pal.getCacheStats()
  strictEqual(stats.hits, 1)
})

test('PathPal - isCached returns correct status', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs' },
    cache: true,
  })

  // Not cached initially
  strictEqual(pal.isCached('logs', 'app.log'), false)

  // Access the path
  pal.logsPath('app.log')

  // Now it should be cached
  strictEqual(pal.isCached('logs', 'app.log'), true)
})

test('PathPal - LRU eviction when maxSize exceeded', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs' },
    cache: {
      enabled: true,
      maxSize: 3,
    },
  })

  // Fill cache to capacity
  pal.logsPath('file1.log')
  pal.logsPath('file2.log')
  pal.logsPath('file3.log')

  let stats = pal.getCacheStats()
  strictEqual(stats.size, 3)
  strictEqual(stats.evictions, 0)

  // Access file1 and file2 to increase their access count
  pal.logsPath('file1.log')
  pal.logsPath('file2.log')

  // Add a new file - should evict file3 (least accessed)
  pal.logsPath('file4.log')

  stats = pal.getCacheStats()
  strictEqual(stats.size, 3) // Still at max size
  strictEqual(stats.evictions, 1) // One eviction occurred

  // file3 should no longer be cached
  strictEqual(pal.isCached('logs', 'file3.log'), false)

  // file1 and file2 should still be cached
  strictEqual(pal.isCached('logs', 'file1.log'), true)
  strictEqual(pal.isCached('logs', 'file2.log'), true)
})

test('PathPal - cache with templates', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs' },
    cache: true,
    templates: {
      date: () => '2024-01-14',
    },
  })

  // First access - cache miss
  const path1 = pal.logsPath('${date}/app.log')

  // Second access - cache hit
  const path2 = pal.logsPath('${date}/app.log')

  const stats = pal.getCacheStats()
  strictEqual(stats.hits, 1)
  strictEqual(stats.misses, 1)
  strictEqual(path1, path2)
  ok(path1.includes('2024-01-14'))
})

test('PathPal - cache with patterns', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs' },
    cache: true,
    builtInPatterns: false,
    patterns: {
      timestamp: () => '1234567890',
    },
  })

  const timestamp = pal.pattern('timestamp')

  // First access
  pal.logsPath(timestamp + '.log')

  // Second access with same pattern
  pal.logsPath(timestamp + '.log')

  const stats = pal.getCacheStats()
  strictEqual(stats.hits, 1)
  strictEqual(stats.misses, 1)
})

test('PathPal - getCacheSize returns correct count', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs' },
    cache: true,
  })

  strictEqual(pal.getCacheSize(), 0)

  pal.logsPath('file1.log')
  strictEqual(pal.getCacheSize(), 1)

  pal.logsPath('file2.log')
  strictEqual(pal.getCacheSize(), 2)

  pal.logsPath('file1.log') // Hit, no size change
  strictEqual(pal.getCacheSize(), 2)
})

test('PathPal - getMemoryUsage provides estimates', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs', config: 'config' },
    cache: true,
  })

  pal.logsPath('app.log')
  pal.configPath('database.json')

  const usage = pal.getMemoryUsage()

  ok(usage.helperCount > 0)
  strictEqual(usage.cacheSize, 2)
  ok(usage.estimatedBytes > 0)
})

test('PathPal - cache works with makePath directly', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: {},
    cache: true,
  })

  const path1 = pal.makePath('logs', 'app.log')
  const path2 = pal.makePath('logs', 'app.log')

  const stats = pal.getCacheStats()
  strictEqual(stats.hits, 1)
  strictEqual(stats.misses, 1)
  strictEqual(path1, path2)
})

test('PathPal - cache with multiple path segments', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs' },
    cache: true,
  })

  const path1 = pal.logsPath('2024', '01', '14', 'app.log')
  const path2 = pal.logsPath('2024', '01', '14', 'app.log')

  const stats = pal.getCacheStats()
  strictEqual(stats.hits, 1)
  strictEqual(stats.misses, 1)
  strictEqual(path1, path2)
})

test('PathPal - cache disabled returns zero stats', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs' },
    cache: false,
  })

  pal.logsPath('app.log')
  pal.logsPath('app.log')

  const stats = pal.getCacheStats()
  strictEqual(stats.hits, 0)
  strictEqual(stats.misses, 0)
  strictEqual(stats.size, 0)
  strictEqual(stats.hitRate, 0)
  strictEqual(stats.evictions, 0)
})

test('PathPal - clearCache on non-existent directory does nothing', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs' },
    cache: true,
  })

  pal.logsPath('app.log')

  const sizeBefore = pal.getCacheSize()
  pal.clearCache('nonexistent')
  const sizeAfter = pal.getCacheSize()

  strictEqual(sizeBefore, sizeAfter)
})

test('PathPal - isCached returns false for non-existent directory', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs' },
    cache: true,
  })

  strictEqual(pal.isCached('nonexistent', 'app.log'), false)
})

test('PathPal - cache with TTL expiration', async () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs' },
    cache: {
      enabled: true,
      ttl: 50, // 50ms TTL
    },
  })

  // First access
  pal.logsPath('app.log')
  strictEqual(pal.isCached('logs', 'app.log'), true)

  // Wait for TTL to expire
  await new Promise((resolve) => setTimeout(resolve, 60))

  // Should no longer be cached
  strictEqual(pal.isCached('logs', 'app.log'), false)

  // Accessing again should be a miss
  pal.logsPath('app.log')
  const stats = pal.getCacheStats()
  strictEqual(stats.misses, 2) // Initial miss + expired entry miss
})

test('PathPal - cache configuration with includeTemplates', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs' },
    cache: {
      enabled: true,
      includeTemplates: true,
    },
    templates: {
      date: () => '2024-01-14',
    },
  })

  const path = pal.logsPath('${date}/app.log')
  ok(path.includes('2024-01-14'))

  const stats = pal.getCacheStats()
  strictEqual(stats.size, 1)
})

test('PathPal - cache configuration with includePatterns', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs' },
    cache: {
      enabled: true,
      includePatterns: true,
    },
  })

  const timestamp = pal.pattern('timestamp')
  pal.logsPath(timestamp + '.log')

  const stats = pal.getCacheStats()
  strictEqual(stats.size, 1)
})

test('PathPal - cache survives multiple operations', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: { logs: 'logs', config: 'config' },
    cache: true,
  })

  // Perform many operations
  for (let i = 0; i < 100; i++) {
    pal.logsPath('app.log')
    pal.configPath('database.json')
  }

  const stats = pal.getCacheStats()
  strictEqual(stats.size, 2)
  strictEqual(stats.misses, 2)
  strictEqual(stats.hits, 198) // 100 * 2 - 2 misses
  strictEqual(stats.hitRate, 0.99) // 198/200
})

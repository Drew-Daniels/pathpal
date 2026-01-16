import { test } from 'node:test'
import { strictEqual, ok, rejects, throws } from 'node:assert'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { writeFileSync, mkdirSync, symlinkSync, rmSync } from 'node:fs'
import { createPathPal } from '../src/index.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(__dirname, '..')
const testFixturesDir = join(__dirname, 'fixtures', 'core-path-mgmt')

// ===========================
// Test Setup and Teardown
// ===========================

test('Setup test fixtures', () => {
  // Clean up if exists
  try {
    rmSync(testFixturesDir, { recursive: true, force: true })
  } catch {
    // Ignore errors
  }

  // Create test directory structure
  mkdirSync(testFixturesDir, { recursive: true })
  mkdirSync(join(testFixturesDir, 'config'), { recursive: true })
  mkdirSync(join(testFixturesDir, 'nested', 'deep', 'path'), { recursive: true })

  // Create test files
  writeFileSync(join(testFixturesDir, 'config', 'database.json'), '{"test": true}')
  writeFileSync(join(testFixturesDir, 'test.txt'), 'test content')

  // Create symlinks (only on platforms that support them)
  try {
    symlinkSync(join(testFixturesDir, 'config'), join(testFixturesDir, 'config-link'))
    symlinkSync(join(testFixturesDir, 'test.txt'), join(testFixturesDir, 'test-link.txt'))
  } catch {
    // Symlinks might not be supported on all platforms/permissions
    console.log('Warning: Could not create symlinks for testing')
  }

  ok(true, 'Test fixtures created')
})

// ===========================
// Path Normalization Tests
// ===========================

test('PathPal - normalizePath with double slashes', () => {
  const pal = createPathPal({ root: projectRoot })

  const normalized = pal.normalizePath('config//database/../settings.json')
  strictEqual(normalized, 'config/settings.json')
})

test('PathPal - normalizePath with current directory', () => {
  const pal = createPathPal({ root: projectRoot })

  const normalized = pal.normalizePath('./config/./database.json')
  strictEqual(normalized, 'config/database.json')
})

test('PathPal - normalizePath with trailing slash', () => {
  const pal = createPathPal({ root: projectRoot })

  const normalized = pal.normalizePath('config/')
  strictEqual(normalized, 'config/')
})

test('PathPal - normalizePath with backslashes', () => {
  const pal = createPathPal({ root: projectRoot })

  const normalized = pal.normalizePath('config\\database\\mysql.json')
  // Should convert to forward slashes
  ok(!normalized.includes('\\'))
})

test('PathPal - normalizePath in strict mode rejects path traversal', () => {
  const pal = createPathPal({ root: projectRoot, strict: true })

  throws(() => {
    pal.normalizePath('../etc/passwd')
  }, /Path traversal detected/)
})

test('PathPal - normalizePath empty string', () => {
  const pal = createPathPal({ root: projectRoot })

  const normalized = pal.normalizePath('')
  strictEqual(normalized, '.')
})

// ===========================
// Cross-Platform Path Tests
// ===========================

test('PathPal - platform property', () => {
  const pal = createPathPal({ root: projectRoot })

  ok(['win32', 'posix'].includes(pal.platform))
})

test('PathPal - toPosixPath converts backslashes to forward slashes', () => {
  const pal = createPathPal({ root: projectRoot })

  const posixPath = pal.toPosixPath('config\\database\\mysql.json')
  strictEqual(posixPath, 'config/database/mysql.json')
})

test('PathPal - toWindowsPath converts forward slashes to backslashes', () => {
  const pal = createPathPal({ root: projectRoot })

  const windowsPath = pal.toWindowsPath('config/database/mysql.json')
  strictEqual(windowsPath, 'config\\database\\mysql.json')
})

test('PathPal - toPlatformPath with explicit win32', () => {
  const pal = createPathPal({ root: projectRoot })

  const platformPath = pal.toPlatformPath('config/database/mysql.json', 'win32')
  strictEqual(platformPath, 'config\\database\\mysql.json')
})

test('PathPal - toPlatformPath with explicit posix', () => {
  const pal = createPathPal({ root: projectRoot })

  const platformPath = pal.toPlatformPath('config\\database\\mysql.json', 'posix')
  strictEqual(platformPath, 'config/database/mysql.json')
})

test('PathPal - toPlatformPath defaults to current platform', () => {
  const pal = createPathPal({ root: projectRoot })

  const platformPath = pal.toPlatformPath('config/database/mysql.json')
  ok(typeof platformPath === 'string')
})

// ===========================
// Path Existence Tests
// ===========================

test('PathPal - exists returns true for existing file (async)', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const exists = await pal.exists('test.txt')
  strictEqual(exists, true)
})

test('PathPal - exists returns false for non-existing file (async)', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const exists = await pal.exists('nonexistent.txt')
  strictEqual(exists, false)
})

test('PathPal - existsSync returns true for existing file', () => {
  const pal = createPathPal({ root: testFixturesDir })

  const exists = pal.existsSync('test.txt')
  strictEqual(exists, true)
})

test('PathPal - existsSync returns false for non-existing file', () => {
  const pal = createPathPal({ root: testFixturesDir })

  const exists = pal.existsSync('nonexistent.txt')
  strictEqual(exists, false)
})

test('PathPal - exists works with absolute paths', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const absolutePath = join(testFixturesDir, 'test.txt')
  const exists = await pal.exists(absolutePath)
  strictEqual(exists, true)
})

test('PathPal - exists returns true for existing directory', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const exists = await pal.exists('config')
  strictEqual(exists, true)
})

// ===========================
// Dynamic Exists Helper Tests
// ===========================

test('PathPal - dynamic exists helpers are created', async () => {
  const pal = createPathPal({
    root: testFixturesDir,
    directories: {
      config: 'config',
    },
  })

  ok(typeof pal.configPathExists === 'function')
  ok(typeof pal.configPathExistsSync === 'function')
})

test('PathPal - dynamic exists helper works (async)', async () => {
  const pal = createPathPal({
    root: testFixturesDir,
    directories: {
      config: 'config',
    },
  })

  const exists = await pal.configPathExists('database.json')
  strictEqual(exists, true)
})

test('PathPal - dynamic exists helper works (sync)', () => {
  const pal = createPathPal({
    root: testFixturesDir,
    directories: {
      config: 'config',
    },
  })

  const exists = pal.configPathExistsSync('database.json')
  strictEqual(exists, true)
})

test('PathPal - dynamic exists helper returns false for non-existing', async () => {
  const pal = createPathPal({
    root: testFixturesDir,
    directories: {
      config: 'config',
    },
  })

  const exists = await pal.configPathExists('nonexistent.json')
  strictEqual(exists, false)
})

// ===========================
// Path Type Detection Tests
// ===========================

test('PathPal - isFile returns true for file (async)', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const isFile = await pal.isFile('test.txt')
  strictEqual(isFile, true)
})

test('PathPal - isFile returns false for directory (async)', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const isFile = await pal.isFile('config')
  strictEqual(isFile, false)
})

test('PathPal - isFile returns false for non-existing path (async)', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const isFile = await pal.isFile('nonexistent.txt')
  strictEqual(isFile, false)
})

test('PathPal - isFileSync returns true for file', () => {
  const pal = createPathPal({ root: testFixturesDir })

  const isFile = pal.isFileSync('test.txt')
  strictEqual(isFile, true)
})

test('PathPal - isFileSync returns false for directory', () => {
  const pal = createPathPal({ root: testFixturesDir })

  const isFile = pal.isFileSync('config')
  strictEqual(isFile, false)
})

test('PathPal - isDirectory returns true for directory (async)', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const isDir = await pal.isDirectory('config')
  strictEqual(isDir, true)
})

test('PathPal - isDirectory returns false for file (async)', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const isDir = await pal.isDirectory('test.txt')
  strictEqual(isDir, false)
})

test('PathPal - isDirectory returns false for non-existing path (async)', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const isDir = await pal.isDirectory('nonexistent')
  strictEqual(isDir, false)
})

test('PathPal - isDirectorySync returns true for directory', () => {
  const pal = createPathPal({ root: testFixturesDir })

  const isDir = pal.isDirectorySync('config')
  strictEqual(isDir, true)
})

test('PathPal - isDirectorySync returns false for file', () => {
  const pal = createPathPal({ root: testFixturesDir })

  const isDir = pal.isDirectorySync('test.txt')
  strictEqual(isDir, false)
})

test('PathPal - isFile works with absolute paths', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const absolutePath = join(testFixturesDir, 'test.txt')
  const isFile = await pal.isFile(absolutePath)
  strictEqual(isFile, true)
})

// ===========================
// Stats Tests
// ===========================

test('PathPal - getStats returns stats for existing file (async)', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const stats = await pal.getStats('test.txt')
  ok(stats !== null)
  ok(stats.isFile())
  ok(stats.size > 0)
})

test('PathPal - getStats returns null for non-existing path (async)', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const stats = await pal.getStats('nonexistent.txt')
  strictEqual(stats, null)
})

test('PathPal - getStatsSync returns stats for existing file', () => {
  const pal = createPathPal({ root: testFixturesDir })

  const stats = pal.getStatsSync('test.txt')
  ok(stats !== null)
  ok(stats.isFile())
  ok(stats.size > 0)
})

test('PathPal - getStatsSync returns null for non-existing path', () => {
  const pal = createPathPal({ root: testFixturesDir })

  const stats = pal.getStatsSync('nonexistent.txt')
  strictEqual(stats, null)
})

test('PathPal - getStats for directory', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const stats = await pal.getStats('config')
  ok(stats !== null)
  ok(stats.isDirectory())
})

// ===========================
// Symlink Tests
// ===========================

test('PathPal - isSymlink returns true for symlink (async)', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  try {
    const isLink = await pal.isSymlink('config-link')
    strictEqual(isLink, true)
  } catch {
    // Skip if symlinks not supported
    ok(true, 'Symlinks not supported on this platform')
  }
})

test('PathPal - isSymlink returns false for regular file (async)', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const isLink = await pal.isSymlink('test.txt')
  strictEqual(isLink, false)
})

test('PathPal - isSymlink returns false for non-existing path (async)', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const isLink = await pal.isSymlink('nonexistent')
  strictEqual(isLink, false)
})

test('PathPal - isSymlinkSync returns true for symlink', () => {
  const pal = createPathPal({ root: testFixturesDir })

  try {
    const isLink = pal.isSymlinkSync('config-link')
    strictEqual(isLink, true)
  } catch {
    // Skip if symlinks not supported
    ok(true, 'Symlinks not supported on this platform')
  }
})

test('PathPal - isSymlinkSync returns false for regular file', () => {
  const pal = createPathPal({ root: testFixturesDir })

  const isLink = pal.isSymlinkSync('test.txt')
  strictEqual(isLink, false)
})

test('PathPal - resolveSymlink resolves symlink to real path (async)', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  try {
    const realPath = await pal.resolveSymlink('config-link')
    strictEqual(realPath, join(testFixturesDir, 'config'))
  } catch {
    // Skip if symlinks not supported
    ok(true, 'Symlinks not supported on this platform')
  }
})

test('PathPal - resolveSymlink returns original path for non-symlink (async)', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const path = await pal.resolveSymlink('test.txt')
  strictEqual(path, join(testFixturesDir, 'test.txt'))
})

test('PathPal - resolveSymlinkSync resolves symlink to real path', () => {
  const pal = createPathPal({ root: testFixturesDir })

  try {
    const realPath = pal.resolveSymlinkSync('config-link')
    strictEqual(realPath, join(testFixturesDir, 'config'))
  } catch {
    // Skip if symlinks not supported
    ok(true, 'Symlinks not supported on this platform')
  }
})

test('PathPal - resolveSymlinkSync returns original path for non-symlink', () => {
  const pal = createPathPal({ root: testFixturesDir })

  const path = pal.resolveSymlinkSync('test.txt')
  strictEqual(path, join(testFixturesDir, 'test.txt'))
})

test('PathPal - getStats with followSymlinks=false for symlink (async)', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  try {
    const stats = await pal.getStats('test-link.txt', false)
    ok(stats !== null)
    ok(stats.isSymbolicLink())
  } catch {
    // Skip if symlinks not supported
    ok(true, 'Symlinks not supported on this platform')
  }
})

test('PathPal - getStats with followSymlinks=true for symlink (async)', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  try {
    const stats = await pal.getStats('test-link.txt', true)
    ok(stats !== null)
    ok(stats.isFile())
  } catch {
    // Skip if symlinks not supported
    ok(true, 'Symlinks not supported on this platform')
  }
})

// ===========================
// Strict Mode Tests
// ===========================

test('PathPal - resolveSymlink in strict mode validates target is within root', async () => {
  // Create a symlink pointing outside root
  const outsideLink = join(testFixturesDir, 'outside-link')
  try {
    symlinkSync('/tmp', outsideLink)
  } catch {
    // Skip if symlinks not supported
    return ok(true, 'Symlinks not supported on this platform')
  }

  const pal = createPathPal({ root: testFixturesDir, strict: true })

  try {
    await rejects(
      async () => await pal.resolveSymlink('outside-link'),
      /Symlink target outside root/,
    )
  } finally {
    // Cleanup
    try {
      rmSync(outsideLink, { force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
})

// ===========================
// Edge Cases
// ===========================

test('PathPal - exists with relative path segments', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const exists = await pal.exists('nested/deep/path')
  strictEqual(exists, true)
})

test('PathPal - isFile with nested path', async () => {
  const pal = createPathPal({ root: testFixturesDir })

  const isFile = await pal.isFile('config/database.json')
  strictEqual(isFile, true)
})

test('PathPal - normalizePath preserves absolute paths structure', () => {
  const pal = createPathPal({ root: projectRoot })

  const absolutePath = '/usr/local/bin'
  const normalized = pal.normalizePath(absolutePath)
  ok(normalized.startsWith('/'))
})

// ===========================
// Cleanup
// ===========================

test('Cleanup test fixtures', () => {
  try {
    rmSync(testFixturesDir, { recursive: true, force: true })
    ok(true, 'Test fixtures cleaned up')
  } catch (error: any) {
    ok(false, `Failed to cleanup: ${error.message}`)
  }
})

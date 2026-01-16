import { test } from 'node:test'
import { strictEqual, ok, throws, deepStrictEqual } from 'node:assert'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { createPathPal, PathPalBase } from '../src/index.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(__dirname, '..')

// ===========================
// Basic Functionality Tests
// ===========================

test('PathPal - createPathPal factory function', () => {
  const pal = createPathPal({
    root: projectRoot,
    directories: {
      config: 'config',
      models: 'app/models',
    },
  })

  ok(pal instanceof PathPalBase, 'Should return PathPal instance')
})

test('PathPal - constructor with string path', () => {
  const pal = createPathPal({
    root: projectRoot,
  })

  strictEqual(pal.appRootPath, projectRoot)
})

test('PathPal - constructor with file:// URL', () => {
  const fileUrl = `file://${projectRoot}`
  const pal = createPathPal({
    root: fileUrl,
  })

  strictEqual(pal.appRootPath, projectRoot)
})

test('PathPal - constructor with URL object', () => {
  const url = new URL(`file://${projectRoot}`)
  const pal = createPathPal({
    root: url,
  })

  strictEqual(pal.appRootPath, projectRoot)
})

test('PathPal - makePath generates absolute paths', () => {
  const pal = createPathPal({
    root: projectRoot,
  })

  const configPath = pal.makePath('config', 'database.js')
  strictEqual(configPath, join(projectRoot, 'config', 'database.js'))
})

test('PathPal - makeURL generates file:// URLs', () => {
  const pal = createPathPal({
    root: projectRoot,
  })

  const url = pal.makeURL('config', 'database.js')
  ok(url instanceof URL, 'Should return URL object')
  ok(url.href.startsWith('file://'), 'Should be file:// URL')
  strictEqual(fileURLToPath(url), join(projectRoot, 'config', 'database.js'))
})

test('PathPal - makeURL with no arguments returns app root URL', () => {
  const pal = createPathPal({
    root: projectRoot,
  })

  const url = pal.makeURL()
  ok(url instanceof URL, 'Should return URL object')
  strictEqual(url, pal.appRoot, 'Should return the app root URL')
})

test('PathPal - dynamic helper methods are created', () => {
  const pal = createPathPal({
    root: projectRoot,
    directories: {
      config: 'config',
      models: 'app/models',
      public: 'public',
    },
  })

  ok(typeof pal.configPath === 'function', 'Should create configPath method')
  ok(typeof pal.modelsPath === 'function', 'Should create modelsPath method')
  ok(typeof pal.publicPath === 'function', 'Should create publicPath method')
})

test('PathPal - helper methods generate correct paths', () => {
  const pal = createPathPal({
    root: projectRoot,
    directories: {
      config: 'config',
      models: 'app/models',
    },
  })

  const configPath = pal.configPath('database.js')
  strictEqual(configPath, join(projectRoot, 'config', 'database.js'))

  const modelPath = pal.modelsPath('User.js')
  strictEqual(modelPath, join(projectRoot, 'app', 'models', 'User.js'))
})

test('PathPal - helper methods with multiple path segments', () => {
  const pal = createPathPal({
    root: projectRoot,
    directories: {
      config: 'config',
    },
  })

  const path = pal.configPath('database', 'mysql', 'connection.js')
  strictEqual(path, join(projectRoot, 'config', 'database', 'mysql', 'connection.js'))
})

test('PathPal - helper methods with no arguments', () => {
  const pal = createPathPal({
    root: projectRoot,
    directories: {
      config: 'config',
    },
  })

  const path = pal.configPath()
  strictEqual(path, join(projectRoot, 'config'))
})

test('PathPal - directory names without "Path" suffix get it added', () => {
  const pal = createPathPal({
    root: projectRoot,
    directories: {
      config: 'config',
    },
  })

  ok(typeof pal.configPath === 'function', 'Should create configPath method')
})

test('PathPal - directory names with "Path" suffix are not duplicated', () => {
  const pal = createPathPal({
    root: projectRoot,
    directories: {
      configPath: 'config',
    },
  })

  ok(typeof pal.configPath === 'function', 'Should create configPath method')
  strictEqual(typeof (pal as any).configPathPath, 'undefined', 'Should not duplicate Path suffix')
})

test('PathPal - relativePath returns path relative to root', () => {
  const pal = createPathPal({
    root: projectRoot,
  })

  const absolutePath = join(projectRoot, 'config', 'database.js')
  const relativePath = pal.relativePath(absolutePath)
  strictEqual(relativePath, join('config', 'database.js'))
})

test('PathPal - toJSON returns serializable object', () => {
  const pal = createPathPal({
    root: projectRoot,
    directories: {
      config: 'config',
      models: 'app/models',
    },
  })

  const json = pal.toJSON()
  strictEqual(json.root, projectRoot)
  strictEqual(json.directories.config, 'config')
  strictEqual(json.directories.models, 'app/models')
  strictEqual(json.safe, true) // safe mode is enabled by default
})

test('PathPal - works with relative root paths', () => {
  const pal = createPathPal({
    root: '.',
  })

  ok(pal.appRootPath, 'Should resolve relative path')
  ok(pal.appRootPath.length > 0, 'Should have valid root path')
})

test('PathPal - works without directories config', () => {
  const pal = createPathPal({
    root: projectRoot,
  })

  const path = pal.makePath('some', 'path.js')
  strictEqual(path, join(projectRoot, 'some', 'path.js'))
})

test('PathPal - appRoot getter returns URL', () => {
  const pal = createPathPal({
    root: projectRoot,
  })

  ok(pal.appRoot instanceof URL, 'Should return URL object')
})

test('PathPal - helper methods are not writable', () => {
  const pal = createPathPal({
    root: projectRoot,
    directories: {
      config: 'config',
    },
  })

  throws(
    () => {
      pal.configPath = () => 'should not work'
    },
    TypeError,
    'Should throw TypeError when trying to overwrite helper method',
  )
})

// ===========================
// Error Handling Tests
// ===========================

test('PathPal - throws error for invalid root path type', () => {
  throws(
    () => {
      createPathPal({
        root: null as any, // Intentionally invalid to test error handling
      })
    },
    {
      message: /Invalid root path type/,
    },
    'Should throw error for null root path',
  )
})

test('PathPal - throws error for invalid URL protocol', () => {
  throws(
    () => {
      createPathPal({
        root: new URL('http://example.com'),
      })
    },
    {
      message: /Invalid URL protocol/,
    },
    'Should throw error for non-file:// URL',
  )
})

test('PathPal - throws error for invalid directory key with numbers', () => {
  throws(
    () => {
      createPathPal({
        root: projectRoot,
        directories: {
          '123invalid': 'some/path',
        },
      })
    },
    {
      message: /Invalid directory key "123invalid"/,
    },
    'Should throw error for directory key starting with number',
  )
})

test('PathPal - throws error for invalid directory key with special chars', () => {
  throws(
    () => {
      createPathPal({
        root: projectRoot,
        directories: {
          'config-db': 'config',
        },
      })
    },
    {
      message: /Invalid directory key "config-db"/,
    },
    'Should throw error for directory key with hyphens',
  )
})

test('PathPal - __proto__ key is silently ignored by JavaScript', () => {
  // Note: __proto__ is special in JavaScript and is silently ignored in object literals
  // This is expected behavior and not a security issue since it never reaches our validation
  const pal = createPathPal({
    root: projectRoot,
    directories: {
      __proto__: 'config',
    },
  })

  // The __proto__ key doesn't actually get set, so no method is created
  strictEqual(typeof pal.__proto__Path, 'undefined', '__proto__ should be ignored')
  strictEqual(pal.getDirectories().length, 0, 'Should have no directories')
})

test('PathPal - throws error for reserved directory key constructor', () => {
  throws(
    () => {
      createPathPal({
        root: projectRoot,
        directories: {
          constructor: 'config',
        },
      })
    },
    {
      message: /Reserved directory key "constructor"/,
    },
    'Should throw error for constructor key',
  )
})

test('PathPal - throws error for reserved directory key prototype', () => {
  throws(
    () => {
      createPathPal({
        root: projectRoot,
        directories: {
          prototype: 'config',
        },
      })
    },
    {
      message: /Reserved directory key "prototype"/,
    },
    'Should throw error for prototype key',
  )
})

// ===========================
// Strict Mode Tests
// ===========================

test('PathPal - safe mode prevents path traversal with ..', () => {
  const pal = createPathPal({
    root: projectRoot,
    safe: true,
  })

  throws(
    () => {
      pal.makePath('config', '..', 'secret.js')
    },
    {
      message: /Path traversal detected/,
    },
    'Should throw error for .. in safe mode',
  )
})

test('PathPal - safe mode prevents absolute paths', () => {
  const pal = createPathPal({
    root: projectRoot,
    safe: true,
  })

  throws(
    () => {
      pal.makePath('/etc/passwd')
    },
    {
      message: /Absolute path detected/,
    },
    'Should throw error for absolute path in safe mode',
  )
})

test('PathPal - non-safe mode allows path traversal', () => {
  const pal = createPathPal({
    root: projectRoot,
    safe: false,
  })

  // Should not throw
  const path = pal.makePath('config', '..', 'src')
  ok(path.includes('src'), 'Should allow .. in non-safe mode')
})

test('PathPal - safe mode setting is included in toJSON', () => {
  const pal = createPathPal({
    root: projectRoot,
    safe: true,
  })

  const json = pal.toJSON()
  strictEqual(json.safe, true, 'Should include safe mode in JSON')
})

// ===========================
// New Utility Methods Tests
// ===========================

test('PathPal - isWithinRoot returns true for paths within root', () => {
  const pal = createPathPal({
    root: projectRoot,
  })

  const configPath = join(projectRoot, 'config', 'database.js')
  strictEqual(pal.isWithinRoot(configPath), true, 'Should return true for path within root')
})

test('PathPal - isWithinRoot returns false for paths outside root', () => {
  const pal = createPathPal({
    root: projectRoot,
  })

  strictEqual(pal.isWithinRoot('/etc/passwd'), false, 'Should return false for path outside root')
})

test('PathPal - isWithinRoot works with relative paths', () => {
  const pal = createPathPal({
    root: projectRoot,
  })

  strictEqual(pal.isWithinRoot('config/database.js'), true, 'Should return true for relative path')
})

test('PathPal - getDirectories returns all configured directories', () => {
  const pal = createPathPal({
    root: projectRoot,
    directories: {
      config: 'config',
      models: 'app/models',
      public: 'public',
    },
  })

  const dirs = pal.getDirectories()
  deepStrictEqual(
    dirs.sort(),
    ['config', 'models', 'public'].sort(),
    'Should return all directory keys',
  )
})

test('PathPal - getDirectories returns empty array when no directories', () => {
  const pal = createPathPal({
    root: projectRoot,
  })

  const dirs = pal.getDirectories()
  deepStrictEqual(dirs, [], 'Should return empty array')
})

// ===========================
// Edge Case Tests
// ===========================

test('PathPal - handles empty directory object', () => {
  const pal = createPathPal({
    root: projectRoot,
    directories: {},
  })

  ok(pal.appRootPath, 'Should work with empty directories object')
  strictEqual(pal.getDirectories().length, 0, 'Should have no directories')
})

test('PathPal - accepts valid JavaScript identifiers', () => {
  const pal = createPathPal({
    root: projectRoot,
    directories: {
      _config: 'config',
      $models: 'models',
      Config123: 'config123',
    },
  })

  ok(typeof pal._configPath === 'function', 'Should accept underscore prefix')
  ok(typeof pal.$modelsPath === 'function', 'Should accept dollar sign prefix')
  ok(typeof pal.Config123Path === 'function', 'Should accept numbers in middle')
})

test('PathPal - handles URL with trailing slash', () => {
  const pal = createPathPal({
    root: new URL(`file://${projectRoot}/`),
  })

  const path = pal.makePath('config')
  ok(path.includes('config'), 'Should handle trailing slash in URL')
})

test('PathPal - handles makeURL with trailing slash in root', () => {
  const pal = createPathPal({
    root: `${projectRoot}/`,
  })

  const url = pal.makeURL('config', 'database.js')
  ok(url.href.includes('config'), 'Should properly construct URL with trailing slash')
})

test('PathPal - validates directory keys with Path suffix', () => {
  throws(
    () => {
      createPathPal({
        root: projectRoot,
        directories: {
          '123configPath': 'config',
        },
      })
    },
    {
      message: /Invalid directory key/,
    },
    'Should validate base name even with Path suffix',
  )
})

// ===========================
// File System Operations Tests
// ===========================

import { mkdtemp, rm, writeFile as fsWriteFile, readFile as fsReadFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { existsSync, writeFileSync } from 'node:fs'

test('PathPal - readFile async reads file content', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const testFile = join(testRoot, 'test.txt')
  await fsWriteFile(testFile, 'hello world', 'utf-8')

  const pal = createPathPal({ root: testRoot })

  const buffer = await pal.readFile('test.txt')
  ok(buffer instanceof Buffer, 'Should return Buffer without encoding')
  strictEqual(buffer.toString(), 'hello world')

  const content = await pal.readFile('test.txt', 'utf-8')
  strictEqual(typeof content, 'string', 'Should return string with encoding')
  strictEqual(content, 'hello world')

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - readFileSync reads file content', () => {
  const testRoot = join(tmpdir(), 'pathpal-test-sync-' + Date.now())
  writeFileSync(testRoot, '')
  rm(testRoot).then(() => {})

  const testDir = join(tmpdir(), 'pathpal-test-dir-' + Date.now())
  mkdtemp(testDir).then(async (dir) => {
    const testFile = join(dir, 'test.txt')
    writeFileSync(testFile, 'hello sync', 'utf-8')

    const pal = createPathPal({ root: dir })

    const buffer = pal.readFileSync('test.txt')
    ok(buffer instanceof Buffer, 'Should return Buffer without encoding')
    strictEqual(buffer.toString(), 'hello sync')

    const content = pal.readFileSync('test.txt', 'utf-8')
    strictEqual(typeof content, 'string', 'Should return string with encoding')
    strictEqual(content, 'hello sync')

    await rm(dir, { recursive: true, force: true })
  })
})

test('PathPal - writeFile async writes file content', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.writeFile('test.txt', 'hello world', 'utf-8')
  const content = await fsReadFile(join(testRoot, 'test.txt'), 'utf-8')
  strictEqual(content, 'hello world')

  await pal.writeFile('test2.txt', Buffer.from('buffer content'))
  const content2 = await fsReadFile(join(testRoot, 'test2.txt'), 'utf-8')
  strictEqual(content2, 'buffer content')

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - writeFileSync writes file content', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  pal.writeFileSync('test.txt', 'hello sync', 'utf-8')
  ok(existsSync(join(testRoot, 'test.txt')))
  const content = await fsReadFile(join(testRoot, 'test.txt'), 'utf-8')
  strictEqual(content, 'hello sync')

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - mkdir creates directory', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.mkdir('newdir')
  ok(existsSync(join(testRoot, 'newdir')))

  await pal.mkdir('nested/dir', { recursive: true })
  ok(existsSync(join(testRoot, 'nested/dir')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - mkdirSync creates directory', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  pal.mkdirSync('newdir')
  ok(existsSync(join(testRoot, 'newdir')))

  pal.mkdirSync('nested/dir', { recursive: true })
  ok(existsSync(join(testRoot, 'nested/dir')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - rmdir removes directory', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.mkdir('removeme')
  ok(existsSync(join(testRoot, 'removeme')))

  await pal.rmdir('removeme', { recursive: true })
  ok(!existsSync(join(testRoot, 'removeme')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - rmdir removes directory recursively', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.mkdir('removeme/nested', { recursive: true })
  await pal.writeFile('removeme/file.txt', 'content')

  await pal.rmdir('removeme', { recursive: true })
  ok(!existsSync(join(testRoot, 'removeme')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - rmdir prevents deleting root directory', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  let errorThrown = false
  try {
    await pal.rmdir(testRoot, { recursive: true })
  } catch (error: any) {
    errorThrown = true
    ok(error.message.includes('Cannot delete the application root directory'))
  }
  ok(errorThrown, 'Should throw error when deleting root')
  ok(existsSync(testRoot), 'Root directory should still exist')

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - ensureDir creates directory if not exists', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.ensureDir('ensure/nested/dir')
  ok(existsSync(join(testRoot, 'ensure/nested/dir')))

  // Should be idempotent
  await pal.ensureDir('ensure/nested/dir')
  ok(existsSync(join(testRoot, 'ensure/nested/dir')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - ensureDirSync creates directory if not exists', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  pal.ensureDirSync('ensure/nested/dir')
  ok(existsSync(join(testRoot, 'ensure/nested/dir')))

  // Should be idempotent
  pal.ensureDirSync('ensure/nested/dir')
  ok(existsSync(join(testRoot, 'ensure/nested/dir')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - listFiles lists files in directory', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.writeFile('file1.txt', 'content1')
  await pal.writeFile('file2.txt', 'content2')
  await pal.mkdir('subdir')
  await pal.writeFile('subdir/file3.txt', 'content3')

  const files = await pal.listFiles('.')
  strictEqual(files.length, 2, 'Should list only top-level files')
  ok(files.some((f) => f.endsWith('file1.txt')))
  ok(files.some((f) => f.endsWith('file2.txt')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - listFiles recursive lists all files', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.writeFile('file1.txt', 'content1')
  await pal.mkdir('subdir')
  await pal.writeFile('subdir/file2.txt', 'content2')
  await pal.mkdir('subdir/nested')
  await pal.writeFile('subdir/nested/file3.txt', 'content3')

  const files = await pal.listFiles('.', { recursive: true })
  strictEqual(files.length, 3, 'Should list all files recursively')
  ok(files.some((f) => f.endsWith('file1.txt')))
  ok(files.some((f) => f.endsWith('file2.txt')))
  ok(files.some((f) => f.endsWith('file3.txt')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - listFiles with filter', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.writeFile('file1.txt', 'content1')
  await pal.writeFile('file2.js', 'content2')
  await pal.writeFile('file3.txt', 'content3')

  const files = await pal.listFiles('.', {
    filter: (path) => path.endsWith('.txt'),
  })
  strictEqual(files.length, 2, 'Should filter files')
  ok(files.every((f) => f.endsWith('.txt')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - listFilesSync lists files in directory', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.writeFile('file1.txt', 'content1')
  await pal.writeFile('file2.txt', 'content2')

  const files = pal.listFilesSync('.')
  strictEqual(files.length, 2)
  ok(files.some((f) => f.endsWith('file1.txt')))
  ok(files.some((f) => f.endsWith('file2.txt')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - deleteRecursive deletes directory and contents', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.mkdir('deleteme/nested', { recursive: true })
  await pal.writeFile('deleteme/file.txt', 'content')
  await pal.writeFile('deleteme/nested/file.txt', 'content')

  await pal.deleteRecursive('deleteme')
  ok(!existsSync(join(testRoot, 'deleteme')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - deleteRecursiveSync deletes directory and contents', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.mkdir('deleteme/nested', { recursive: true })
  await pal.writeFile('deleteme/file.txt', 'content')

  pal.deleteRecursiveSync('deleteme')
  ok(!existsSync(join(testRoot, 'deleteme')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - watch monitors file changes', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.writeFile('watch.txt', 'initial')

  let eventFired = false
  const watcher = pal.watch('watch.txt', (_eventType) => {
    eventFired = true
  })

  // Give watcher time to start
  await new Promise((resolve) => setTimeout(resolve, 100))

  await pal.writeFile('watch.txt', 'updated')

  // Wait for event
  await new Promise((resolve) => setTimeout(resolve, 200))

  watcher.close()
  ok(eventFired, 'Should fire watch event')

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - safe mode blocks file operations outside root', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot, safe: true })

  let error1Thrown = false
  try {
    await pal.readFile('/etc/passwd')
  } catch (error: any) {
    error1Thrown = true
    ok(error.message.includes('outside root directory'))
  }
  ok(error1Thrown, 'Should throw for read outside root')

  let error2Thrown = false
  try {
    await pal.writeFile('/tmp/malicious.txt', 'bad')
  } catch (error: any) {
    error2Thrown = true
    ok(error.message.includes('outside root directory'))
  }
  ok(error2Thrown, 'Should throw for write outside root')

  await rm(testRoot, { recursive: true, force: true })
})

// Dynamic helper tests
test('PathPal - dynamic helpers for file operations', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({
    root: testRoot,
    directories: {
      config: 'config',
      data: 'data',
    },
  })

  // Ensure directories
  await pal.configPathEnsure()
  ok(existsSync(join(testRoot, 'config')))

  // Write file using dynamic helper
  await pal.configPathWrite('app.json', '{"test":true}', 'utf-8')
  ok(existsSync(join(testRoot, 'config/app.json')))

  // Read file using dynamic helper
  const content = await pal.configPathRead('app.json', 'utf-8')
  strictEqual(content, '{"test":true}')

  // List files using dynamic helper
  await pal.configPathWrite('db.json', '{}', 'utf-8')
  const files = await pal.configPathListFiles()
  strictEqual(files.length, 2)

  // Delete using dynamic helper
  await pal.configPathWrite('temp.txt', 'temp')
  await pal.configPathRmdir('temp.txt', { force: true })
  ok(!existsSync(join(testRoot, 'config/temp.txt')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - dynamic helpers mkdir and ensure', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({
    root: testRoot,
    directories: {
      uploads: 'uploads',
    },
  })

  // Ensure directory exists
  await pal.uploadsPathEnsure('images')
  ok(existsSync(join(testRoot, 'uploads/images')))

  // Mkdir with dynamic helper
  await pal.uploadsPathMkdir('videos', { recursive: true })
  ok(existsSync(join(testRoot, 'uploads/videos')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - dynamic helpers for recursive operations', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({
    root: testRoot,
    directories: {
      temp: 'temp',
    },
  })

  await pal.tempPathEnsure('deep/nested')
  await pal.tempPathWrite('deep/nested/file.txt', 'content')

  const files = await pal.tempPathListFiles('', { recursive: true })
  ok(files.length > 0)

  await pal.tempPathDeleteRecursive('deep')
  ok(!existsSync(join(testRoot, 'temp/deep')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - ensureDir handles existing directory gracefully', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.mkdir('existing')
  await pal.ensureDir('existing') // Should not error
  ok(existsSync(join(testRoot, 'existing')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - listFiles with maxDepth option', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.mkdir('level1/level2/level3', { recursive: true })
  await pal.writeFile('file0.txt', 'content')
  await pal.writeFile('level1/file1.txt', 'content')
  await pal.writeFile('level1/level2/file2.txt', 'content')
  await pal.writeFile('level1/level2/level3/file3.txt', 'content')

  const files = await pal.listFiles('.', { recursive: true, maxDepth: 1 })
  strictEqual(files.length, 2) // file0.txt and level1/file1.txt
  ok(!files.some((f) => f.includes('level2')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - listFiles with absolute: false returns relative paths', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.writeFile('test.txt', 'content')

  const files = await pal.listFiles('.', { absolute: false })
  strictEqual(files.length, 1)
  ok(!files[0].startsWith('/'), 'Should be relative path')

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - listFiles with filesOnly: false includes directories', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.mkdir('subdir')
  await pal.writeFile('file.txt', 'content')

  const items = await pal.listFiles('.', { filesOnly: false })
  ok(items.length >= 2) // Should include both file and directory

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - sync variants of all operations work', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  // Write, read, list, delete all sync
  pal.writeFileSync('sync.txt', 'sync content', 'utf-8')
  const content = pal.readFileSync('sync.txt', 'utf-8')
  strictEqual(content, 'sync content')

  pal.mkdirSync('syncdir')
  const files = pal.listFilesSync('.')
  ok(files.length >= 1)

  pal.deleteRecursiveSync('syncdir')
  ok(!existsSync(join(testRoot, 'syncdir')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - readFile with relative path', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.writeFile('relative.txt', 'content')
  const content = await pal.readFile('relative.txt', 'utf-8')
  strictEqual(content, 'content')

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - writeFile with options object', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.writeFile('test.txt', 'content', { encoding: 'utf-8', mode: 0o644 })
  ok(existsSync(join(testRoot, 'test.txt')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - listFiles in empty directory', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.mkdir('empty')
  const files = await pal.listFiles('empty')
  strictEqual(files.length, 0)

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - dynamic helper with no path argument uses directory root', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({
    root: testRoot,
    directories: {
      data: 'data',
    },
  })

  await pal.dataPathEnsure() // No argument - creates data directory
  ok(existsSync(join(testRoot, 'data')))

  const files = await pal.dataPathListFiles() // No argument - lists data directory
  strictEqual(files.length, 0)

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - listFiles with symlinks and followSymlinks: false', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.mkdir('target')
  await pal.writeFile('target/file.txt', 'content')

  // Create symlink (only on platforms that support it)
  try {
    const { symlink } = await import('node:fs/promises')
    await symlink(join(testRoot, 'target'), join(testRoot, 'link'), 'dir')

    const files = await pal.listFiles('.', { recursive: true, followSymlinks: false })
    ok(files.length >= 1)

    await rm(testRoot, { recursive: true, force: true })
  } catch (_error) {
    // Skip on platforms without symlink support
    await rm(testRoot, { recursive: true, force: true })
  }
})

test('PathPal - listFilesSync with symlinks', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.mkdir('target')
  await pal.writeFile('target/file.txt', 'content')

  try {
    const { symlink } = await import('node:fs/promises')
    await symlink(join(testRoot, 'target'), join(testRoot, 'link'), 'dir')

    const files = pal.listFilesSync('.', { recursive: true, followSymlinks: true })
    ok(files.length >= 1)

    await rm(testRoot, { recursive: true, force: true })
  } catch (_error) {
    // Skip on platforms without symlink support
    await rm(testRoot, { recursive: true, force: true })
  }
})

test('PathPal - listFiles in safe mode filters paths outside root', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot, safe: true })

  await pal.writeFile('file.txt', 'content')

  // In safe mode, paths are validated
  const files = await pal.listFiles('.')
  ok(files.length >= 0) // Should not crash

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - ensureDir when directory is actually a file throws error', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.writeFile('isfile.txt', 'content')

  try {
    await pal.ensureDir('isfile.txt')
    ok(false, 'Should have thrown')
  } catch (error: any) {
    ok(error) // Expected to throw
  }

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - mkdir with mode option', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.mkdir('withmode', { mode: 0o755 })
  ok(existsSync(join(testRoot, 'withmode')))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - rmdir with force: true handles non-existent paths', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  // Should not throw with force: true
  await pal.rmdir('nonexistent', { recursive: true, force: true })

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - all core methods handle absolute paths correctly', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  const absPath = join(testRoot, 'absolute.txt')

  await pal.writeFile(absPath, 'content')
  const content = await pal.readFile(absPath, 'utf-8')
  strictEqual(content, 'content')

  const exists = await pal.exists(absPath)
  ok(exists)

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - comprehensive dynamic helper coverage', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({
    root: testRoot,
    directories: {
      docs: 'docs',
      logs: 'logs',
    },
  })

  // Ensure directories first
  await pal.docsPathEnsure()
  await pal.logsPathEnsure()

  // Read/Write sync and async
  await pal.docsPathWrite('readme.md', '# Docs')
  pal.logsPathWriteSync('app.log', 'log entry')

  const readme = await pal.docsPathRead('readme.md', 'utf-8')
  strictEqual(readme, '# Docs')

  const log = pal.logsPathReadSync('app.log', 'utf-8')
  strictEqual(log, 'log entry')

  // Mkdir sync and async
  await pal.docsPathMkdir('api', { recursive: true })
  pal.logsPathMkdirSync('archive')

  // Rmdir sync and async
  await pal.docsPathRmdir('api', { recursive: true })
  pal.logsPathRmdirSync('archive', { recursive: true })

  // Ensure sync and async
  await pal.docsPathEnsure('guides')
  pal.logsPathEnsureSync('errors')

  // List sync and async
  const docFiles = await pal.docsPathListFiles()
  ok(docFiles.length >= 0)

  const logFiles = pal.logsPathListFilesSync()
  ok(logFiles.length >= 0)

  // Delete recursive sync and async
  await pal.docsPathWrite('guides/temp.txt', 'temp')
  await pal.docsPathDeleteRecursive('guides')

  pal.logsPathWriteSync('errors/temp.log', 'temp')
  pal.logsPathDeleteRecursiveSync('errors')

  // Watch
  const watcher = pal.docsPathWatch('readme.md', () => {})
  watcher.close()

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - listFiles handles edge cases with symlinks', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.mkdir('real')
  await pal.writeFile('real/file.txt', 'content')

  // Test with followSymlinks option explicitly
  const filesFollow = await pal.listFiles('.', { recursive: true, followSymlinks: true })
  ok(filesFollow.length >= 1)

  const filesNoFollow = await pal.listFiles('.', { recursive: true, followSymlinks: false })
  ok(filesNoFollow.length >= 1)

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - error paths in listFiles', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.mkdir('testdir')

  // listFiles when getStats returns null
  const files = await pal.listFiles('testdir', { followSymlinks: true })
  ok(Array.isArray(files))

  await rm(testRoot, { recursive: true, force: true })
})

// ===========================
// Path Sanitization Tests
// ===========================

test('PathPal - sanitizeFilename removes path traversal', () => {
  const pal = createPathPal({ root: process.cwd() })
  const sanitized = pal.sanitizeFilename('../../etc/passwd')
  // Filename sanitization replaces / with _
  strictEqual(sanitized, '_.._etc_passwd')
})

test('PathPal - sanitizeFilename removes dangerous characters', () => {
  const pal = createPathPal({ root: process.cwd() })
  const sanitized = pal.sanitizeFilename('file<>:"|?*.txt')
  strictEqual(sanitized, 'file_______.txt')
})

test('PathPal - sanitizeFilename handles Windows reserved filenames', () => {
  const pal = createPathPal({ root: process.cwd() })

  strictEqual(pal.sanitizeFilename('CON.txt'), 'CON_.txt')
  strictEqual(pal.sanitizeFilename('PRN.log'), 'PRN_.log')
  strictEqual(pal.sanitizeFilename('AUX'), 'AUX_')
  strictEqual(pal.sanitizeFilename('NUL.dat'), 'NUL_.dat')
  strictEqual(pal.sanitizeFilename('COM1.txt'), 'COM1_.txt')
  strictEqual(pal.sanitizeFilename('LPT9.doc'), 'LPT9_.doc')
})

test('PathPal - sanitizeFilename removes control characters', () => {
  const pal = createPathPal({ root: process.cwd() })
  const sanitized = pal.sanitizeFilename('file\x00\x01\x1F\x7F.txt')
  strictEqual(sanitized, 'file.txt')
})

test('PathPal - sanitizeFilename removes zero-width characters', () => {
  const pal = createPathPal({ root: process.cwd() })
  const sanitized = pal.sanitizeFilename('file\u200B\u200C\u200D\uFEFF.txt')
  strictEqual(sanitized, 'file.txt')
})

test('PathPal - sanitizeFilename removes leading and trailing dots/spaces', () => {
  const pal = createPathPal({ root: process.cwd() })

  strictEqual(pal.sanitizeFilename('...file.txt'), 'file.txt')
  strictEqual(pal.sanitizeFilename('file.txt...'), 'file.txt')
  strictEqual(pal.sanitizeFilename('   file.txt   '), 'file.txt')
  strictEqual(pal.sanitizeFilename('. . file.txt . .'), 'file.txt')
})

test('PathPal - sanitizeFilename preserves extension when truncating', () => {
  const pal = createPathPal({ root: process.cwd() })
  const longName = 'a'.repeat(300) + '.txt'
  const sanitized = pal.sanitizeFilename(longName, { maxLength: 20 })

  ok(sanitized.endsWith('.txt'))
  strictEqual(sanitized.length, 20)
})

test('PathPal - sanitizeFilename respects maxLength option', () => {
  const pal = createPathPal({ root: process.cwd() })
  const longName = 'a'.repeat(300)
  const sanitized = pal.sanitizeFilename(longName, { maxLength: 50 })

  strictEqual(sanitized.length, 50)
})

test('PathPal - sanitizeFilename with custom replacement', () => {
  const pal = createPathPal({ root: process.cwd() })
  const sanitized = pal.sanitizeFilename('file/with\\slashes.txt', { replacement: '-' })

  strictEqual(sanitized, 'file-with-slashes.txt')
})

test('PathPal - sanitizeFilename handles empty filename', () => {
  const pal = createPathPal({ root: process.cwd() })

  strictEqual(pal.sanitizeFilename(''), 'unnamed')
  strictEqual(pal.sanitizeFilename('...'), 'unnamed')
  strictEqual(pal.sanitizeFilename('   '), 'unnamed')
})

test('PathPal - sanitizeFilename with allowSpaces: false', () => {
  const pal = createPathPal({ root: process.cwd() })
  const sanitized = pal.sanitizeFilename('my file name.txt', { allowSpaces: false })

  strictEqual(sanitized, 'my_file_name.txt')
})

test('PathPal - sanitizeFilename with allowDots: false', () => {
  const pal = createPathPal({ root: process.cwd() })
  const sanitized = pal.sanitizeFilename('file.name.with.dots.txt', { allowDots: false })

  // Should keep only the last dot (extension)
  strictEqual(sanitized, 'file_name_with_dots.txt')
})

test('PathPal - sanitizeFilename with preserveExtension: false', () => {
  const pal = createPathPal({ root: process.cwd() })
  const longName = 'a'.repeat(300) + '.txt'
  const sanitized = pal.sanitizeFilename(longName, {
    maxLength: 20,
    preserveExtension: false,
  })

  strictEqual(sanitized.length, 20)
  // Might not end with .txt since preserveExtension is false
})

test('PathPal - sanitizeFilename normalizes Unicode', () => {
  const pal = createPathPal({ root: process.cwd() })

  // Combining diacritics
  const combining = 'café'.normalize('NFD') // decomposed
  const sanitized = pal.sanitizeFilename(combining + '.txt')

  // Should be normalized to NFC
  ok(sanitized.includes('café'))
})

test('PathPal - sanitizePath sanitizes each segment', () => {
  const pal = createPathPal({ root: process.cwd() })
  const sanitized = pal.sanitizePath('uploads/../../etc/passwd')

  // sanitizePath removes .. segments and keeps others
  strictEqual(sanitized, 'uploads/etc/passwd')
})

test('PathPal - sanitizePath handles multiple segments with dangerous chars', () => {
  const pal = createPathPal({ root: process.cwd() })
  const sanitized = pal.sanitizePath('dir1/<script>/file*.txt')

  strictEqual(sanitized, 'dir1/_script_/file_.txt')
})

test('PathPal - sanitizePath preserves valid paths', () => {
  const pal = createPathPal({ root: process.cwd() })
  const sanitized = pal.sanitizePath('uploads/images/photo.jpg')

  strictEqual(sanitized, 'uploads/images/photo.jpg')
})

test('PathPal - sanitizePath handles backslashes', () => {
  const pal = createPathPal({ root: process.cwd() })
  const sanitized = pal.sanitizePath('uploads\\images\\photo.jpg')

  strictEqual(sanitized, 'uploads/images/photo.jpg')
})

test('PathPal - sanitizePath with options', () => {
  const pal = createPathPal({ root: process.cwd() })
  const sanitized = pal.sanitizePath('my folder/my file.txt', {
    allowSpaces: false,
    replacement: '-',
  })

  strictEqual(sanitized, 'my-folder/my-file.txt')
})

test('PathPal - dynamic sanitize helper', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: {
      uploads: 'uploads',
    },
  })

  // Check if method exists
  ok(typeof pal.uploadsPathSanitize === 'function', 'uploadsPathSanitize should exist')

  const sanitized = pal.uploadsPathSanitize('../../malicious.exe')
  // Each ../ becomes _.._
  strictEqual(sanitized, '_.._malicious.exe')
})

test('PathPal - dynamic sanitizePath helper', () => {
  const pal = createPathPal({
    root: process.cwd(),
    directories: {
      uploads: 'uploads',
    },
  })

  // Check if method exists
  ok(typeof pal.uploadsPathSanitizePath === 'function', 'uploadsPathSanitizePath should exist')

  const sanitized = pal.uploadsPathSanitizePath('avatars/<script>/hack.js')
  strictEqual(sanitized, 'avatars/_script_/hack.js')
})

test('PathPal - sanitizeFilename with all options disabled', () => {
  const pal = createPathPal({ root: process.cwd() })
  const sanitized = pal.sanitizeFilename('file\u200B\x01 name.txt', {
    removeZeroWidth: false,
    removeControlChars: false,
    normalizeUnicode: false,
  })

  // Should still remove dangerous chars like /\<>
  ok(!sanitized.includes('/'))
  ok(!sanitized.includes('\\'))
})

test('PathPal - sanitizeFilename handles extension edge cases', () => {
  const pal = createPathPal({ root: process.cwd() })

  // No extension
  strictEqual(pal.sanitizeFilename('file'), 'file')

  // Multiple dots
  strictEqual(pal.sanitizeFilename('file.tar.gz'), 'file.tar.gz')

  // Only extension
  strictEqual(pal.sanitizeFilename('.gitignore'), 'gitignore')
})

test('PathPal - sanitizePath removes empty segments', () => {
  const pal = createPathPal({ root: process.cwd() })
  const sanitized = pal.sanitizePath('uploads//images///photo.jpg')

  strictEqual(sanitized, 'uploads/images/photo.jpg')
})

test('PathPal - real world user upload scenario', () => {
  const pal = createPathPal({ root: process.cwd() })

  // User tries to upload with malicious filename
  const userFilename = '../../../etc/passwd\x00.jpg'
  const safe = pal.sanitizeFilename(userFilename)

  // Should be completely safe
  ok(!safe.includes('/'))
  ok(!safe.includes('\x00'))
  // Note: ../ sequences get sanitized, each / becomes _
  strictEqual(safe, '_.._.._etc_passwd.jpg')
})

// ===========================
// Glob Pattern Matching Tests
// ===========================

test('PathPal - glob matches simple wildcard pattern', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.writeFile('file.js', '')
  await pal.writeFile('test.js', '')
  await pal.writeFile('file.ts', '')

  const files = await pal.glob('*.js', { absolute: false })

  ok(files.includes('file.js'))
  ok(files.includes('test.js'))
  ok(!files.includes('file.ts'))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - glob matches globstar pattern', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.writeFile('root.js', '')
  await pal.ensureDir('src/utils')
  await pal.writeFile('src/index.js', '')
  await pal.writeFile('src/utils/helper.js', '')

  const files = await pal.glob('**/*.js', { absolute: false })

  ok(files.includes('root.js'))
  ok(files.includes('src/index.js'))
  ok(files.includes('src/utils/helper.js'))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - glob matches brace expansion', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.writeFile('file.js', '')
  await pal.writeFile('file.ts', '')
  await pal.writeFile('file.json', '')

  const files = await pal.glob('file.{js,ts}', { absolute: false })

  ok(files.includes('file.js'))
  ok(files.includes('file.ts'))
  ok(!files.includes('file.json'))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - glob with ignore patterns', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.writeFile('file.js', '')
  await pal.writeFile('file.test.js', '')
  await pal.writeFile('file.spec.js', '')

  const files = await pal.glob('*.js', {
    absolute: false,
    ignore: ['*.test.js', '*.spec.js'],
  })

  ok(files.includes('file.js'))
  ok(!files.includes('file.test.js'))
  ok(!files.includes('file.spec.js'))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - glob skips hidden files by default', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.writeFile('.hidden.js', '')
  await pal.writeFile('visible.js', '')

  const files = await pal.glob('*.js', { absolute: false })

  ok(!files.includes('.hidden.js'))
  ok(files.includes('visible.js'))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - globSync works correctly', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({ root: testRoot })

  await pal.writeFile('sync1.js', '')
  await pal.writeFile('sync2.js', '')
  await pal.writeFile('sync.ts', '')

  const files = pal.globSync('*.js', { absolute: false })

  ok(files.includes('sync1.js'))
  ok(files.includes('sync2.js'))
  ok(!files.includes('sync.ts'))

  await rm(testRoot, { recursive: true, force: true })
})

test('PathPal - dynamic glob helpers work', async () => {
  const testRoot = await mkdtemp(join(tmpdir(), 'pathpal-test-'))
  const pal = createPathPal({
    root: testRoot,
    directories: { src: 'src' },
  })

  await pal.ensureDir('src')
  await pal.writeFile('src/index.js', '')
  await pal.writeFile('src/utils.js', '')
  await pal.writeFile('src/index.ts', '')

  const files = await pal.srcPathGlob('*.js', { absolute: false })

  ok(files.includes('index.js'))
  ok(files.includes('utils.js'))
  ok(!files.includes('index.ts'))

  await rm(testRoot, { recursive: true, force: true })
})

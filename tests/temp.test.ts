import { test } from 'node:test'
import { strictEqual, ok, rejects } from 'node:assert'
import { access, readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { createPathPal } from '../src/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

test('PathPal - createTemp() creates temporary directory', async () => {
  const pal = createPathPal({
    root: __dirname,
    directories: {
      config: 'config',
      data: 'data',
    },
  })

  const temp = await pal.createTemp()

  ok(temp.tempRoot, 'temp root should be set')
  ok(temp.tempRoot.includes('pathpal-'), 'temp root should have default prefix')
  strictEqual(temp.isCleanedUp, false, 'should not be cleaned up initially')
  ok(typeof temp.cleanup === 'function', 'should have cleanup method')

  // Verify directory exists
  await access(temp.tempRoot)

  // Cleanup
  await temp.cleanup()
  strictEqual(temp.isCleanedUp, true, 'should be marked as cleaned up')
})

test('PathPal - createTemp() creates configured directories', async () => {
  const pal = createPathPal({
    root: __dirname,
    directories: {
      config: 'config',
      data: 'data/files',
    },
  })

  const temp = await pal.createTemp()

  // Verify directories were created
  const configPath = join(temp.tempRoot, 'config')
  const dataPath = join(temp.tempRoot, 'data/files')

  await access(configPath)
  await access(dataPath)

  const configStat = await stat(configPath)
  const dataStat = await stat(dataPath)

  ok(configStat.isDirectory(), 'config should be a directory')
  ok(dataStat.isDirectory(), 'data should be a directory')

  await temp.cleanup()
})

test('PathPal - createTemp() with custom prefix', async () => {
  const pal = createPathPal({
    root: __dirname,
    directories: { config: 'config' },
  })

  const temp = await pal.createTemp({ prefix: 'mytest-' })

  ok(temp.tempRoot.includes('mytest-'), 'should use custom prefix')

  await temp.cleanup()
})

test('PathPal - createTemp() with createDirs: false', async () => {
  const pal = createPathPal({
    root: __dirname,
    directories: {
      config: 'config',
      data: 'data',
    },
  })

  const temp = await pal.createTemp({ createDirs: false })

  // Verify temp root exists
  await access(temp.tempRoot)

  // Verify directories were NOT created
  const configPath = join(temp.tempRoot, 'config')
  await rejects(() => access(configPath), 'config directory should not exist')

  await temp.cleanup()
})

test('PathPal - createTemp() with fixtures', async () => {
  const pal = createPathPal({
    root: __dirname,
    directories: { config: 'config' },
  })

  const temp = await pal.createTemp({
    fixtures: {
      'config/db.json': '{"host":"localhost"}',
      'data/test.txt': 'test content',
      'nested/deep/file.txt': Buffer.from('buffer content'),
    },
  })

  // Verify fixtures were created
  const dbContent = await readFile(join(temp.tempRoot, 'config/db.json'), 'utf8')
  strictEqual(dbContent, '{"host":"localhost"}', 'db.json should have correct content')

  const testContent = await readFile(join(temp.tempRoot, 'data/test.txt'), 'utf8')
  strictEqual(testContent, 'test content', 'test.txt should have correct content')

  const bufferContent = await readFile(join(temp.tempRoot, 'nested/deep/file.txt'), 'utf8')
  strictEqual(bufferContent, 'buffer content', 'buffer file should have correct content')

  await temp.cleanup()
})

test('PathPal - createTemp() inherits directory configuration', async () => {
  const pal = createPathPal({
    root: __dirname,
    directories: {
      config: 'config',
      data: 'data',
    },
  })

  const temp = await pal.createTemp()

  // Verify temp has same directory helpers
  ok(typeof temp.configPath === 'function', 'should have configPath helper')
  ok(typeof temp.dataPath === 'function', 'should have dataPath helper')

  const configPath = temp.configPath('app.json')
  ok(configPath.includes(temp.tempRoot), 'configPath should use temp root')
  ok(configPath.includes('config'), 'configPath should include directory')

  await temp.cleanup()
})

test('PathPal - createTemp() inherits strict mode', async () => {
  const pal = createPathPal({
    root: __dirname,
    directories: { config: 'config' },
    strict: true,
  })

  const temp = await pal.createTemp()

  // In strict mode, should reject paths with .. traversal
  await rejects(
    () => temp.writeFile('../outside.txt', 'test'),
    /Path traversal detected/,
    'should reject paths with path traversal in strict mode',
  )

  await temp.cleanup()
})

test('PathPal - createTemp() cleanup is idempotent', async () => {
  const pal = createPathPal({
    root: __dirname,
    directories: { config: 'config' },
  })

  const temp = await pal.createTemp()
  const tempRoot = temp.tempRoot

  // First cleanup
  await temp.cleanup()
  strictEqual(temp.isCleanedUp, true, 'should be cleaned up after first call')

  // Second cleanup should not throw
  await temp.cleanup()
  strictEqual(temp.isCleanedUp, true, 'should still be cleaned up')

  // Third cleanup should not throw
  await temp.cleanup()
  strictEqual(temp.isCleanedUp, true, 'should still be cleaned up')

  // Verify directory was actually removed
  await rejects(() => access(tempRoot), 'temp directory should be removed')
})

test('PathPal - withTemp() auto-cleans on success', async () => {
  const pal = createPathPal({
    root: __dirname,
    directories: { config: 'config' },
  })

  let capturedTempRoot: string | undefined

  const result = await pal.withTemp(async (temp) => {
    capturedTempRoot = temp.tempRoot

    // Verify directory exists during callback
    await access(temp.tempRoot)

    // Write a file
    await temp.writeFile(temp.configPath('test.json'), '{"test":true}')

    return 'success'
  })

  strictEqual(result, 'success', 'should return callback result')

  // Verify directory was cleaned up
  ok(capturedTempRoot, 'temp root should be captured')
  await rejects(
    () => access(capturedTempRoot!),
    'temp directory should be cleaned up after withTemp',
  )
})

test('PathPal - withTemp() auto-cleans on error', async () => {
  const pal = createPathPal({
    root: __dirname,
    directories: { config: 'config' },
  })

  let capturedTempRoot: string | undefined

  await rejects(
    async () => {
      await pal.withTemp(async (temp) => {
        capturedTempRoot = temp.tempRoot

        // Verify directory exists
        await access(temp.tempRoot)

        // Throw error
        throw new Error('test error')
      })
    },
    /test error/,
    'should propagate error',
  )

  // Verify directory was still cleaned up despite error
  ok(capturedTempRoot, 'temp root should be captured')
  await rejects(
    () => access(capturedTempRoot!),
    'temp directory should be cleaned up even on error',
  )
})

test('PathPal - withTemp() with options', async () => {
  const pal = createPathPal({
    root: __dirname,
    directories: { config: 'config' },
  })

  await pal.withTemp(
    async (temp) => {
      // Verify custom prefix
      ok(temp.tempRoot.includes('custom-'), 'should use custom prefix')

      // Verify fixture
      const content = await readFile(temp.configPath('test.json'), 'utf8')
      strictEqual(content, '{"fixture":true}', 'should have fixture')
    },
    {
      prefix: 'custom-',
      fixtures: {
        'config/test.json': '{"fixture":true}',
      },
    },
  )
})

test('PathPal - multiple temp instances are isolated', async () => {
  const pal = createPathPal({
    root: __dirname,
    directories: { config: 'config' },
  })

  const temp1 = await pal.createTemp()
  const temp2 = await pal.createTemp()

  // Verify different roots
  ok(temp1.tempRoot !== temp2.tempRoot, 'should have different temp roots')

  // Write different files
  await temp1.writeFile(temp1.configPath('file1.txt'), 'temp1')
  await temp2.writeFile(temp2.configPath('file2.txt'), 'temp2')

  // Verify isolation
  const content1 = await readFile(temp1.configPath('file1.txt'), 'utf8')
  strictEqual(content1, 'temp1', 'temp1 should have its own file')

  const content2 = await readFile(temp2.configPath('file2.txt'), 'utf8')
  strictEqual(content2, 'temp2', 'temp2 should have its own file')

  // file1 should not exist in temp2
  await rejects(() => access(temp2.configPath('file1.txt')), 'file1 should not exist in temp2')

  // file2 should not exist in temp1
  await rejects(() => access(temp1.configPath('file2.txt')), 'file2 should not exist in temp1')

  await temp1.cleanup()
  await temp2.cleanup()
})

test('PathPal - temp instance can use all PathPal methods', async () => {
  const pal = createPathPal({
    root: __dirname,
    directories: {
      config: 'config',
      data: 'data',
    },
  })

  const temp = await pal.createTemp({
    fixtures: {
      'config/test.json': '{"key":"value"}',
      'data/file.txt': 'content',
    },
  })

  // Test various methods
  const configExists = await temp.exists(temp.configPath('test.json'))
  strictEqual(configExists, true, 'should detect existing file')

  const isFile = await temp.isFile(temp.configPath('test.json'))
  strictEqual(isFile, true, 'should detect file')

  const isDir = await temp.isDirectory(temp.configPath())
  strictEqual(isDir, true, 'should detect directory')

  const content = await temp.readFile(temp.configPath('test.json'), 'utf8')
  strictEqual(content, '{"key":"value"}', 'should read file content')

  await temp.writeFile(temp.dataPath('new.txt'), 'new content')
  const newContent = await temp.readFile(temp.dataPath('new.txt'), 'utf8')
  strictEqual(newContent, 'new content', 'should write new file')

  await temp.cleanup()
})

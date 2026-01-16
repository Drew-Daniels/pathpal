import { test } from 'node:test'
import { strictEqual, ok, throws } from 'node:assert'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { createPathPal } from '../src/index.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(__dirname, '..')

// ===========================
// Template Tests
// ===========================

test('PathPal - renderTemplate processes template syntax', () => {
  const pal = createPathPal({
    root: projectRoot,
    templates: {
      date: () => '2024-01-14',
      env: () => 'production',
    },
  })

  const result = pal.renderTemplate('logs/${date}/${env}.log')
  strictEqual(result, 'logs/2024-01-14/production.log')
})

test('PathPal - renderTemplate with missing template throws error', () => {
  const pal = createPathPal({ root: projectRoot })

  throws(() => {
    pal.renderTemplate('logs/${missing}/app.log')
  }, /Template "missing" not found/)
})

test('PathPal - renderTemplate with variables', () => {
  const pal = createPathPal({
    root: projectRoot,
    templates: {
      user: (userId) => `user-${userId}`,
    },
  })

  const result = pal.renderTemplate('uploads/${user}/avatar.png', { user: '12345' })
  strictEqual(result, 'uploads/user-12345/avatar.png')
})

test('PathPal - registerTemplate adds a template', () => {
  const pal = createPathPal({ root: projectRoot })

  pal.registerTemplate('test', () => 'testvalue')
  ok(pal.getTemplates().includes('test'))
})

test('PathPal - unregisterTemplate removes a template', () => {
  const pal = createPathPal({
    root: projectRoot,
    templates: {
      test: () => 'value',
    },
  })

  ok(pal.getTemplates().includes('test'))
  pal.unregisterTemplate('test')
  ok(!pal.getTemplates().includes('test'))
})

test('PathPal - getTemplates returns all template names', () => {
  const pal = createPathPal({
    root: projectRoot,
    templates: {
      date: () => '2024-01-14',
      time: () => '12:00:00',
    },
  })

  const templates = pal.getTemplates()
  ok(templates.includes('date'))
  ok(templates.includes('time'))
  strictEqual(templates.length, 2)
})

test('PathPal - templates work in makePath', () => {
  const pal = createPathPal({
    root: projectRoot,
    directories: {
      logs: 'logs',
    },
    templates: {
      date: () => '2024-01-14',
    },
  })

  const path = pal.logsPath('${date}/app.log')
  ok(path.endsWith('logs/2024-01-14/app.log'))
})

test('PathPal - invalid template name throws error', () => {
  const pal = createPathPal({ root: projectRoot })

  throws(() => {
    pal.registerTemplate('123invalid', () => 'test')
  }, /Invalid template name/)
})

test('PathPal - template returning non-string throws error', () => {
  const pal = createPathPal({
    root: projectRoot,
    templates: {
      bad: (() => 123) as any, // Intentionally wrong type to test error handling
    },
  })

  throws(() => {
    pal.renderTemplate('${bad}')
  }, /returned non-string value/)
})

// ===========================
// Pattern Tests
// ===========================

test('PathPal - pattern executes pattern function', () => {
  const pal = createPathPal({
    root: projectRoot,
    patterns: {
      daily: () => '2024-01-14',
    },
  })

  const result = pal.pattern('daily')
  strictEqual(result, '2024-01-14')
})

test('PathPal - pattern with arguments', () => {
  const pal = createPathPal({
    root: projectRoot,
    patterns: {
      userDir: (userId) => `users/${userId}`,
    },
  })

  const result = pal.pattern('userDir', '12345')
  strictEqual(result, 'users/12345')
})

test('PathPal - pattern with missing pattern throws error', () => {
  const pal = createPathPal({ root: projectRoot })

  throws(() => {
    pal.pattern('missing')
  }, /Pattern "missing" not found/)
})

test('PathPal - registerPattern adds a pattern', () => {
  const pal = createPathPal({ root: projectRoot })

  pal.registerPattern('test', () => 'testvalue')
  ok(pal.hasPattern('test'))
})

test('PathPal - unregisterPattern removes a pattern', () => {
  const pal = createPathPal({
    root: projectRoot,
    patterns: {
      test: () => 'value',
    },
  })

  ok(pal.hasPattern('test'))
  pal.unregisterPattern('test')
  ok(!pal.hasPattern('test'))
})

test('PathPal - getPatterns returns all pattern names', () => {
  const pal = createPathPal({
    root: projectRoot,
    patterns: {
      daily: () => '2024-01-14',
      weekly: () => '2024-W02',
    },
  })

  const patterns = pal.getPatterns()
  ok(patterns.includes('daily'))
  ok(patterns.includes('weekly'))
})

test('PathPal - hasPattern checks pattern existence', () => {
  const pal = createPathPal({
    root: projectRoot,
    patterns: {
      test: () => 'value',
    },
  })

  ok(pal.hasPattern('test'))
  ok(!pal.hasPattern('nonexistent'))
})

test('PathPal - built-in patterns are registered by default', () => {
  const pal = createPathPal({ root: projectRoot })

  ok(pal.hasPattern('date'))
  ok(pal.hasPattern('time'))
  ok(pal.hasPattern('timestamp'))
  ok(pal.hasPattern('year'))
  ok(pal.hasPattern('month'))
  ok(pal.hasPattern('day'))
  ok(pal.hasPattern('datetime'))
})

test('PathPal - built-in patterns can be disabled', () => {
  const pal = createPathPal({
    root: projectRoot,
    builtInPatterns: false,
  })

  ok(!pal.hasPattern('date'))
  ok(!pal.hasPattern('time'))
})

test('PathPal - built-in date pattern works', () => {
  const pal = createPathPal({ root: projectRoot })

  const result = pal.pattern('date')
  // Should be YYYY-MM-DD format
  ok(/^\d{4}-\d{2}-\d{2}$/.test(result))
})

test('PathPal - built-in time pattern works', () => {
  const pal = createPathPal({ root: projectRoot })

  const result = pal.pattern('time')
  // Should be HH-MM-SS format
  ok(/^\d{2}-\d{2}-\d{2}$/.test(result))
})

test('PathPal - built-in timestamp pattern works', () => {
  const pal = createPathPal({ root: projectRoot })

  const result = pal.pattern('timestamp')
  ok(/^\d+$/.test(result))
  ok(parseInt(result) > 0)
})

test('PathPal - built-in year pattern works', () => {
  const pal = createPathPal({ root: projectRoot })

  const result = pal.pattern('year')
  ok(/^\d{4}$/.test(result))
})

test('PathPal - invalid pattern name throws error', () => {
  const pal = createPathPal({ root: projectRoot })

  throws(() => {
    pal.registerPattern('123invalid', () => 'test')
  }, /Invalid pattern name/)
})

test('PathPal - pattern returning non-string throws error', () => {
  const pal = createPathPal({
    root: projectRoot,
    patterns: {
      bad: (() => 123) as any, // Intentionally wrong type to test error handling
    },
  })

  throws(() => {
    pal.pattern('bad')
  }, /returned non-string value/)
})

// ===========================
// Integration Tests
// ===========================

test('PathPal - templates and patterns work together', () => {
  const pal = createPathPal({
    root: projectRoot,
    directories: {
      logs: 'logs',
    },
    templates: {
      date: () => '2024-01-14',
    },
    patterns: {
      logLevel: (level: unknown) => String(level).toUpperCase(),
    },
  })

  const pattern = pal.pattern('logLevel', 'error')
  const path = pal.logsPath('${date}', `${pattern}.log`)

  ok(path.endsWith('logs/2024-01-14/ERROR.log'))
})

test('PathPal - pattern can be used within template', () => {
  const pal = createPathPal({
    root: projectRoot,
    directories: {
      logs: 'logs',
    },
    templates: {
      dateLog: () => `${new Date().toISOString().split('T')[0]}/app.log`,
    },
  })

  const path = pal.logsPath('${dateLog}')
  ok(path.includes('/logs/'))
  ok(path.endsWith('/app.log'))
})

test('PathPal - multiple templates in one path', () => {
  const pal = createPathPal({
    root: projectRoot,
    templates: {
      year: () => '2024',
      month: () => '01',
      day: () => '14',
    },
  })

  const result = pal.renderTemplate('logs/${year}/${month}/${day}/app.log')
  strictEqual(result, 'logs/2024/01/14/app.log')
})

test('PathPal - templates work with helper methods', () => {
  const pal = createPathPal({
    root: projectRoot,
    directories: {
      uploads: 'public/uploads',
    },
    templates: {
      user: () => 'user-12345',
    },
  })

  const path = pal.uploadsPath('${user}/avatar.png')
  ok(path.endsWith('public/uploads/user-12345/avatar.png'))
})

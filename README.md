# PathPal

Zero-dependency filesystem path abstraction for Node.js. Define your project's directory structure once, get type-safe path helpers everywhere.

## Features

- **Zero dependencies** - No external packages required
- **Type-safe** - Full TypeScript support with generated helper types
- **Dynamic helpers** - Auto-generated methods for each configured directory
- **File operations** - Read, write, list, watch files with path-aware methods
- **Glob support** - Built-in glob pattern matching without external tools
- **Path sanitization** - Secure filename and path sanitization
- **Strict mode** - Optional path traversal protection
- **Caching** - LRU cache for path computations
- **Temp directories** - Built-in support for temporary test directories

## Installation

```bash
npm install pathpal
```

## Quick Start

```typescript
import { createPathPal } from 'pathpal'

const paths = createPathPal({
  root: import.meta.url,
  directories: {
    config: 'config',
    models: 'src/models',
    uploads: 'storage/uploads',
    logs: 'logs',
  },
})

// Generate paths
paths.configPath('database.json')     // /project/config/database.json
paths.modelsPath('User.ts')           // /project/src/models/User.ts
paths.uploadsPath('images', 'avatar.png')  // /project/storage/uploads/images/avatar.png
```

## API

### Creating an Instance

```typescript
import { createPathPal } from 'pathpal'

const paths = createPathPal({
  // Root directory (string, URL, or file:// URL string)
  root: process.cwd(),

  // Directory mappings
  directories: {
    config: 'config',
    src: 'src',
    tests: '__tests__',
  },

  // Enable strict mode for path traversal protection
  strict: true,

  // Enable path caching
  cache: true,
})
```

### Core Methods

```typescript
// Generate absolute paths
paths.makePath('src', 'index.ts')  // /project/src/index.ts

// Paths can include slashes - these are equivalent:
paths.makePath('src', 'components', 'Button.tsx')
paths.makePath('src/components', 'Button.tsx')
paths.makePath('src/components/Button.tsx')

// Generate file:// URLs
paths.makeURL('config', 'app.json')  // URL { href: 'file:///project/config/app.json' }

// Get relative path from root
paths.relativePath('/project/src/index.ts')  // 'src/index.ts'

// Check if path is within root
paths.isWithinRoot('/etc/passwd')  // false

// Get all configured directory keys
paths.getDirectories()  // ['config', 'src', 'tests']
```

### Dynamic Directory Helpers

For each configured directory, PathPal generates a set of helper methods:

```typescript
const paths = createPathPal({
  root: process.cwd(),
  directories: {
    config: 'config',
    uploads: 'storage/uploads',
  },
})

// Path generation
paths.configPath('database.json')

// File existence
await paths.configPathExists('database.json')
paths.configPathExistsSync('database.json')

// Read files
const data = await paths.configPathRead('database.json', 'utf-8')
const buffer = paths.configPathReadSync('settings.bin')

// Write files
await paths.configPathWrite('settings.json', JSON.stringify(config))
paths.configPathWriteSync('cache.json', data)

// Directory operations
await paths.uploadsPathMkdir('images', { recursive: true })
await paths.uploadsPathEnsure('documents')  // Create if not exists
await paths.uploadsPathRmdir('temp', { recursive: true })

// List files
const files = await paths.uploadsPathListFiles('images', { recursive: true })

// Delete recursively
await paths.uploadsPathDeleteRecursive('temp')

// Watch for changes
const watcher = paths.configPathWatch('settings.json', (event, filename) => {
  console.log(`File ${filename} ${event}`)
})

// Glob pattern matching
const jsFiles = await paths.srcPathGlob('**/*.js')

// Sanitize user input
const safeName = paths.uploadsPathSanitize(userFilename)
```

### File Operations

```typescript
// Read files
const content = await paths.readFile('config/app.json', 'utf-8')
const buffer = paths.readFileSync('data/binary.dat')

// Write files
await paths.writeFile('logs/app.log', 'Log entry')
paths.writeFileSync('cache/data.json', JSON.stringify(data))

// Directory operations
await paths.mkdir('uploads/images', { recursive: true })
await paths.ensureDir('logs')  // Create if not exists
await paths.rmdir('temp', { recursive: true })

// List files
const files = await paths.listFiles('src', {
  recursive: true,
  filter: (path) => path.endsWith('.ts'),
})

// Delete recursively
await paths.deleteRecursive('build')

// Check existence
const exists = await paths.exists('config/app.json')
const isFile = await paths.isFile('config/app.json')
const isDir = await paths.isDirectory('src')

// Watch files
const watcher = paths.watch('config', (event, filename) => {
  console.log(`${event}: ${filename}`)
})
```

### Path Sanitization

Protect against malicious filenames and path traversal:

```typescript
// Sanitize a single filename
paths.sanitizeFilename('../../../etc/passwd')  // '_.._.._etc_passwd'
paths.sanitizeFilename('file<>:"|?*.txt')      // 'file_______.txt'
paths.sanitizeFilename('CON.txt')              // 'CON_.txt' (Windows reserved)

// Sanitize with options
paths.sanitizeFilename(userInput, {
  replacement: '-',      // Character to replace invalid chars
  maxLength: 100,        // Max filename length
  allowSpaces: false,    // Replace spaces
  preserveExtension: true,
})

// Sanitize a full path (each segment)
paths.sanitizePath('uploads/../../../etc/passwd')  // 'uploads/etc/passwd'
```

### Glob Pattern Matching

Built-in glob support without external dependencies:

```typescript
// Simple wildcards
const jsFiles = await paths.glob('*.js')

// Recursive globstar
const allTs = await paths.glob('**/*.ts')

// Brace expansion
const configs = await paths.glob('*.{json,yaml,yml}')

// Character ranges
const logs = await paths.glob('log-[0-9].txt')

// With options
const files = await paths.glob('**/*.ts', {
  ignore: ['**/*.test.ts', '**/*.spec.ts'],
  absolute: false,
  dot: true,  // Include hidden files
  maxDepth: 3,
})

// Sync version
const syncFiles = paths.globSync('src/**/*.js')
```

### Strict Mode

Enable strict mode to prevent path traversal attacks:

```typescript
const paths = createPathPal({
  root: process.cwd(),
  strict: true,
})

// These throw errors in strict mode:
paths.makePath('..', 'etc', 'passwd')  // Error: Path traversal detected
paths.makePath('/etc/passwd')          // Error: Absolute path detected
await paths.readFile('/etc/passwd')    // Error: Path outside root directory
```

### Templates and Patterns

Dynamic path generation with templates:

```typescript
const paths = createPathPal({
  root: process.cwd(),
  templates: {
    date: () => new Date().toISOString().split('T')[0],
    userId: (id: string) => id,
  },
  patterns: {
    daily: () => new Date().toISOString().split('T')[0],
    timestamp: () => Date.now().toString(),
  },
})

// Use patterns in paths
paths.makePath('logs', paths.pattern('daily'), 'app.log')
// /project/logs/2024-01-15/app.log
```

### Caching

Enable LRU caching for frequently accessed paths:

```typescript
const paths = createPathPal({
  root: process.cwd(),
  cache: {
    enabled: true,
    maxSize: 1000,  // Max entries
    ttl: 60000,     // 1 minute TTL
  },
})

// Get cache statistics
const stats = paths.getCacheStats()
// { hits: 150, misses: 50, size: 200, maxSize: 1000, hitRate: 0.75, evictions: 0 }

// Clear cache
paths.clearCache()

// Get memory usage
const memory = paths.getMemoryUsage()
// { helperCount: 10, cacheSize: 200, estimatedBytes: 12400 }
```

#### Benchmarks

Caching provides significant performance improvements for repeated path operations:

```
Path Generation (1,000,000 iterations):
┌─────────────────────┬──────────────┬─────────────┬─────────┐
│ Operation           │ No Cache     │ With Cache  │ Speedup │
├─────────────────────┼──────────────┼─────────────┼─────────┤
│ Simple path         │ 1167ms       │ 87ms        │ 13.4x   │
│ Nested path (3 seg) │ 1485ms       │ 149ms       │ 10.0x   │
│ makePath (3 seg)    │ 1276ms       │ 113ms       │ 11.3x   │
└─────────────────────┴──────────────┴─────────────┴─────────┘
```

Enable caching when:
- Generating the same paths repeatedly in loops
- Using patterns/templates that involve function calls
- Building paths in hot code paths

### Temporary Directories

Create isolated temporary instances for testing:

```typescript
import { createTempPathPal } from 'pathpal'

const temp = await createTempPathPal({
  directories: {
    config: 'config',
    data: 'data',
  },
  fixtures: {
    'config/app.json': '{"debug": true}',
    'data/seed.sql': 'INSERT INTO ...',
  },
})

// Use like a normal PathPal instance
await temp.configPathWrite('new.json', '{}')

// Clean up when done
await temp.cleanup()
```

### Batch Operations

Perform multiple operations efficiently:

```typescript
const results = await paths.batch([
  { op: 'path', dir: 'config', paths: ['database.json'] },
  { op: 'exists', dir: 'config', paths: ['database.json'] },
  { op: 'read', dir: 'config', paths: ['app.json'], encoding: 'utf-8' },
])
```

### Serialization

```typescript
// Serialize to JSON
const json = paths.toJSON()
// { root: '/project', directories: { config: 'config', ... }, strict: false }

// Useful for logging, debugging, or recreating instances
```

## TypeScript Support

PathPal provides full TypeScript support with generated types for all helper methods:

```typescript
import { createPathPal, PathPal } from 'pathpal'

// Type inference works automatically
const paths = createPathPal({
  root: process.cwd(),
  directories: {
    config: 'config',
    models: 'src/models',
  },
})

// These methods are fully typed:
paths.configPath        // (...paths: string[]) => string
paths.configPathRead    // (path: string, encoding?: BufferEncoding) => Promise<Buffer | string>
paths.modelsPathExists  // (...paths: string[]) => Promise<boolean>
```

## Requirements

- Node.js >= 18.0.0

## License

MIT

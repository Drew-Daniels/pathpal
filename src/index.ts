import { fileURLToPath } from 'node:url'
import {
  join,
  isAbsolute,
  resolve,
  relative,
  normalize,
  sep,
  posix,
  win32,
  dirname,
} from 'node:path'
import { tmpdir } from 'node:os'
import {
  access,
  stat,
  lstat,
  realpath,
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  mkdir as fsMkdir,
  rm as fsRm,
  readdir,
  constants,
  mkdtemp,
} from 'node:fs/promises'
import {
  accessSync,
  statSync,
  lstatSync,
  realpathSync,
  readFileSync as fsReadFileSync,
  writeFileSync as fsWriteFileSync,
  mkdirSync as fsMkdirSync,
  rmSync as fsRmSync,
  readdirSync,
  watch as fsWatchSync,
  type FSWatcher,
} from 'node:fs'

/**
 * Template function that returns a string
 */
export type TemplateFunction = (...args: unknown[]) => string

/**
 * Pattern function that returns a string
 */
export type PatternFunction = (...args: unknown[]) => string

/**
 * Configuration options for creating a PathPal instance
 */
export interface PathPalConfig<T extends Record<string, string> = Record<string, string>> {
  /**
   * The root directory of your project.
   * Can be a string path, URL string (file://), or URL object.
   *
   * @example
   * root: process.cwd()
   * root: '/absolute/path/to/project'
   * root: 'file:///absolute/path/to/project'
   * root: import.meta.url
   * root: new URL('.', import.meta.url)
   */
  root: string | URL

  /**
   * Directory structure configuration.
   * Maps helper method names to their relative paths from root.
   *
   * @example
   * directories: {
   *   config: 'config',
   *   models: 'app/models',
   *   public: 'public',
   *   views: 'resources/views'
   * }
   *
   * This creates: configPath(), modelsPath(), publicPath(), viewsPath()
   */
  directories?: T

  /**
   * Enable strict mode for additional path validation.
   * When true, prevents path traversal and ensures paths stay within root.
   *
   * @default false
   */
  strict?: boolean

  /**
   * Template functions for dynamic path generation.
   * Templates can be referenced using ${templateName} syntax in paths.
   *
   * @example
   * templates: {
   *   date: () => new Date().toISOString().split('T')[0],
   *   user: (userId: string) => userId
   * }
   */
  templates?: Record<string, TemplateFunction>

  /**
   * Pattern functions for common path segment generation.
   *
   * @example
   * patterns: {
   *   daily: () => new Date().toISOString().split('T')[0],
   *   timestamp: () => Date.now().toString()
   * }
   */
  patterns?: Record<string, PatternFunction>

  /**
   * Include built-in patterns (date, timestamp, etc.)
   *
   * @default true
   */
  builtInPatterns?: boolean

  /**
   * Path caching configuration
   * Set to true for defaults, or provide custom configuration
   *
   * @example
   * cache: true  // Use defaults
   * cache: { enabled: true, maxSize: 500, ttl: 60000 }
   */
  cache?: boolean | CacheConfig
}

/**
 * Type helper to generate method names from directory keys.
 * If key already ends with 'Path', use as-is, otherwise append 'Path'.
 */
type DirectoryMethodName<K extends string> = K extends `${string}Path` ? K : `${K}Path`

/**
 * Options for listing files
 */
export interface ListFilesOptions {
  recursive?: boolean
  absolute?: boolean
  filesOnly?: boolean
  followSymlinks?: boolean
  maxDepth?: number
  filter?: (path: string) => boolean
}

/**
 * Options for watching files
 */
export interface WatchOptions {
  persistent?: boolean
  recursive?: boolean
  encoding?: BufferEncoding
}

/**
 * Options for mkdir
 */
export interface MkdirOptions {
  recursive?: boolean
  mode?: number
}

/**
 * Options for rmdir
 */
export interface RmdirOptions {
  recursive?: boolean
  force?: boolean
}

/**
 * Options for writeFile
 */
export type WriteFileOptions
  = | BufferEncoding
    | { encoding?: BufferEncoding; mode?: number; flag?: string }

/**
 * Options for sanitizing filenames and paths
 */
export interface SanitizeOptions {
  /**
   * Character to replace invalid characters with
   * @default '_'
   */
  replacement?: string

  /**
   * Maximum filename length
   * @default 255
   */
  maxLength?: number

  /**
   * Preserve file extension when truncating
   * @default true
   */
  preserveExtension?: boolean

  /**
   * Allow dots in filename
   * @default true
   */
  allowDots?: boolean

  /**
   * Allow spaces in filename
   * @default true
   */
  allowSpaces?: boolean

  /**
   * Remove zero-width characters
   * @default true
   */
  removeZeroWidth?: boolean

  /**
   * Remove control characters (0x00-0x1F, 0x7F)
   * @default true
   */
  removeControlChars?: boolean

  /**
   * Normalize Unicode to NFC form
   * @default true
   */
  normalizeUnicode?: boolean
}

/**
 * Options for glob pattern matching
 */
export interface GlobOptions {
  /**
   * Base directory for glob search (default: app root)
   */
  cwd?: string

  /**
   * Return absolute paths (default: true)
   */
  absolute?: boolean

  /**
   * Only return files, not directories (default: true)
   */
  filesOnly?: boolean

  /**
   * Match pattern against basename only (default: false)
   */
  matchBase?: boolean

  /**
   * Patterns to ignore (can be string or array)
   */
  ignore?: string | string[]

  /**
   * Case-sensitive matching (default: true on Unix, false on Windows)
   */
  caseSensitive?: boolean

  /**
   * Follow symbolic links (default: false)
   */
  followSymlinks?: boolean

  /**
   * Maximum directory depth to traverse
   */
  maxDepth?: number

  /**
   * Include files starting with . (default: false)
   */
  dot?: boolean
}

/**
 * Configuration for path caching
 */
export interface CacheConfig {
  /**
   * Enable path caching
   * @default true when cache config is provided
   */
  enabled?: boolean

  /**
   * Maximum number of cached entries (LRU eviction when exceeded)
   * @default 1000
   */
  maxSize?: number

  /**
   * Time to live for cache entries in milliseconds (0 = no expiration)
   * @default 0
   */
  ttl?: number

  /**
   * Cache template-rendered paths
   * @default true
   */
  includeTemplates?: boolean

  /**
   * Cache pattern-rendered paths
   * @default true
   */
  includePatterns?: boolean
}

/**
 * Statistics about cache performance
 */
export interface CacheStats {
  /**
   * Number of cache hits
   */
  hits: number

  /**
   * Number of cache misses
   */
  misses: number

  /**
   * Current number of cached entries
   */
  size: number

  /**
   * Maximum cache size
   */
  maxSize: number

  /**
   * Cache hit rate (hits / (hits + misses))
   */
  hitRate: number

  /**
   * Number of entries evicted due to size limit
   */
  evictions: number
}

/**
 * Memory usage information
 */
export interface MemoryUsage {
  /**
   * Number of generated helper methods
   */
  helperCount: number

  /**
   * Number of cached path entries
   */
  cacheSize: number

  /**
   * Estimated memory usage in bytes
   */
  estimatedBytes: number
}

/**
 * Options for creating temporary PathPal instances
 */
export interface TempOptions {
  /**
   * Prefix for temporary directory name
   * @default 'pathpal-'
   */
  prefix?: string

  /**
   * Whether to automatically create configured directories in temp space
   * @default true
   */
  createDirs?: boolean

  /**
   * Fixture files to create in temp space
   * Keys are paths relative to temp root, values are file contents
   * @example
   * { 'config/db.json': '{"host":"localhost"}' }
   */
  fixtures?: Record<string, string | Buffer>
}

/**
 * A PathPal instance bound to a temporary directory with cleanup capability
 */
export type TempPathPal<T extends Record<string, string>> = PathPal<T> & {
  /**
   * Absolute path to the temporary root directory
   */
  readonly tempRoot: string

  /**
   * Whether the temporary directory has been cleaned up
   */
  readonly isCleanedUp: boolean

  /**
   * Remove the temporary directory and all its contents
   * Safe to call multiple times (idempotent)
   */
  cleanup(): Promise<void>
}

/**
 * Batch operation request
 */
export interface BatchOperationRequest {
  /**
   * Operation type
   */
  op: 'path' | 'exists' | 'isFile' | 'isDirectory' | 'read'

  /**
   * Directory key
   */
  dir: string

  /**
   * Path segments
   */
  paths: string[]

  /**
   * Encoding for read operations
   */
  encoding?: BufferEncoding
}

/**
 * Generates typed helper methods for each configured directory
 */
type DirectoryHelpers<T extends Record<string, string>> = {
  // Path helper
  [K in keyof T as DirectoryMethodName<K & string>]: (...paths: string[]) => string
} & {
  // Exists helpers
  [K in keyof T as `${DirectoryMethodName<K & string>}Exists`]: (
    ...paths: string[]
  ) => Promise<boolean>
} & {
  [K in keyof T as `${DirectoryMethodName<K & string>}ExistsSync`]: (...paths: string[]) => boolean
} & {
  // Read helpers
  [K in keyof T as `${DirectoryMethodName<K & string>}Read`]: {
    (path: string): Promise<Buffer>
    (path: string, encoding: BufferEncoding): Promise<string>
  }
} & {
  [K in keyof T as `${DirectoryMethodName<K & string>}ReadSync`]: {
    (path: string): Buffer
    (path: string, encoding: BufferEncoding): string
  }
} & {
  // Write helpers
  [K in keyof T as `${DirectoryMethodName<K & string>}Write`]: (
    path: string,
    data: string | Buffer,
    options?: WriteFileOptions,
  ) => Promise<void>
} & {
  [K in keyof T as `${DirectoryMethodName<K & string>}WriteSync`]: (
    path: string,
    data: string | Buffer,
    options?: WriteFileOptions,
  ) => void
} & {
  // Mkdir helpers
  [K in keyof T as `${DirectoryMethodName<K & string>}Mkdir`]: (
    path: string,
    options?: MkdirOptions,
  ) => Promise<string | undefined>
} & {
  [K in keyof T as `${DirectoryMethodName<K & string>}MkdirSync`]: (
    path: string,
    options?: MkdirOptions,
  ) => string | undefined
} & {
  // Rmdir helpers
  [K in keyof T as `${DirectoryMethodName<K & string>}Rmdir`]: (
    path: string,
    options?: RmdirOptions,
  ) => Promise<void>
} & {
  [K in keyof T as `${DirectoryMethodName<K & string>}RmdirSync`]: (
    path: string,
    options?: RmdirOptions,
  ) => void
} & {
  // Ensure directory helpers
  [K in keyof T as `${DirectoryMethodName<K & string>}Ensure`]: (path?: string) => Promise<void>
} & {
  [K in keyof T as `${DirectoryMethodName<K & string>}EnsureSync`]: (path?: string) => void
} & {
  // List files helpers
  [K in keyof T as `${DirectoryMethodName<K & string>}ListFiles`]: (
    path?: string,
    options?: ListFilesOptions,
  ) => Promise<string[]>
} & {
  [K in keyof T as `${DirectoryMethodName<K & string>}ListFilesSync`]: (
    path?: string,
    options?: ListFilesOptions,
  ) => string[]
} & {
  // Delete recursive helpers
  [K in keyof T as `${DirectoryMethodName<K & string>}DeleteRecursive`]: (
    path: string,
  ) => Promise<void>
} & {
  [K in keyof T as `${DirectoryMethodName<K & string>}DeleteRecursiveSync`]: (path: string) => void
} & {
  // Watch helpers
  [K in keyof T as `${DirectoryMethodName<K & string>}Watch`]: (
    path: string,
    listener: (eventType: 'rename' | 'change', filename: string | null) => void,
    options?: WatchOptions,
  ) => FSWatcher
} & {
  // Sanitization helpers
  [K in keyof T as `${DirectoryMethodName<K & string>}Sanitize`]: (
    filename: string,
    options?: SanitizeOptions,
  ) => string
} & {
  [K in keyof T as `${DirectoryMethodName<K & string>}SanitizePath`]: (
    path: string,
    options?: SanitizeOptions,
  ) => string
} & {
  // Glob helpers
  [K in keyof T as `${DirectoryMethodName<K & string>}Glob`]: (
    pattern: string,
    options?: GlobOptions,
  ) => Promise<string[]>
} & {
  [K in keyof T as `${DirectoryMethodName<K & string>}GlobSync`]: (
    pattern: string,
    options?: GlobOptions,
  ) => string[]
}

/**
 * JSON representation of PathPal instance
 */
export interface PathPalJSON {
  root: string
  directories: Record<string, string>
  strict: boolean
}

/**
 * Internal glob segment types
 */
type GlobSegmentType = 'literal' | 'wildcard' | 'globstar' | 'range' | 'brace'

/**
 * Represents a parsed glob pattern segment
 */
interface GlobSegment {
  type: GlobSegmentType
  value: string | string[]
  negated?: boolean
}

/**
 * Internal class for matching glob patterns
 */
class GlobMatcher {
  #segments: GlobSegment[]
  #caseSensitive: boolean
  #matchBase: boolean
  #regex: RegExp | null = null

  constructor(pattern: string, options: { caseSensitive?: boolean; matchBase?: boolean } = {}) {
    this.#caseSensitive = options.caseSensitive ?? true
    this.#matchBase = options.matchBase ?? false
    this.#segments = this.#parsePattern(pattern)
  }

  /**
   * Check if a path matches the pattern
   */
  matches(path: string): boolean {
    // Normalize path separators to forward slashes
    const normalizedPath = path.replace(/\\/g, '/')

    // For matchBase mode, only check basename
    const testPath = this.#matchBase ? normalizedPath.split('/').pop() || '' : normalizedPath

    // Get or create regex
    if (!this.#regex) {
      this.#regex = this.#buildRegex()
    }

    return this.#regex.test(testPath)
  }

  /**
   * Helper: Flush current literal to segments
   */
  #flushLiteral(segments: GlobSegment[], current: string): string {
    if (current) {
      segments.push({ type: 'literal', value: current })
    }
    return ''
  }

  /**
   * Helper: Parse wildcard (* or **)
   */
  #parseWildcard(
    pattern: string,
    i: number,
    segments: GlobSegment[],
    current: string,
  ): { newIndex: number; newCurrent: string } {
    if (pattern[i + 1] === '*') {
      // Globstar
      const newCurrent = this.#flushLiteral(segments, current)
      segments.push({ type: 'globstar', value: '**' })
      let newIndex = i + 2
      if (pattern[newIndex] === '/') newIndex++
      return { newIndex, newCurrent }
    } else {
      // Single wildcard
      const newCurrent = this.#flushLiteral(segments, current)
      segments.push({ type: 'wildcard', value: '*' })
      return { newIndex: i + 1, newCurrent }
    }
  }

  /**
   * Helper: Parse character range [abc]
   */
  #parseRange(
    pattern: string,
    i: number,
    segments: GlobSegment[],
    current: string,
  ): { newIndex: number; newCurrent: string } | null {
    const endIndex = pattern.indexOf(']', i + 1)
    if (endIndex === -1) {
      return null
    }

    const newCurrent = this.#flushLiteral(segments, current)
    const rangeContent = pattern.slice(i + 1, endIndex)
    const negated = rangeContent[0] === '!' || rangeContent[0] === '^'

    segments.push({
      type: 'range',
      value: negated ? rangeContent.slice(1) : rangeContent,
      negated,
    })

    return { newIndex: endIndex + 1, newCurrent }
  }

  /**
   * Helper: Parse brace expansion {a,b,c}
   */
  #parseBrace(
    pattern: string,
    i: number,
    segments: GlobSegment[],
    current: string,
  ): { newIndex: number; newCurrent: string } | null {
    const endIndex = this.#findClosingBrace(pattern, i)
    if (endIndex === -1) {
      return null
    }

    const newCurrent = this.#flushLiteral(segments, current)
    const braceContent = pattern.slice(i + 1, endIndex)
    segments.push({
      type: 'brace',
      value: braceContent.split(','),
    })

    return { newIndex: endIndex + 1, newCurrent }
  }

  /**
   * Parse pattern string into segments
   */
  #parsePattern(pattern: string): GlobSegment[] {
    const segments: GlobSegment[] = []
    let current = ''
    let i = 0

    while (i < pattern.length) {
      const char = pattern[i]

      if (char === '*') {
        const result = this.#parseWildcard(pattern, i, segments, current)
        i = result.newIndex
        current = result.newCurrent
        continue
      }

      if (char === '?') {
        current = this.#flushLiteral(segments, current)
        segments.push({ type: 'wildcard', value: '?' })
        i++
        continue
      }

      if (char === '[') {
        const result = this.#parseRange(pattern, i, segments, current)
        if (result) {
          i = result.newIndex
          current = result.newCurrent
          continue
        }
      }

      if (char === '{') {
        const result = this.#parseBrace(pattern, i, segments, current)
        if (result) {
          i = result.newIndex
          current = result.newCurrent
          continue
        }
      }

      if (char === '\\' && i + 1 < pattern.length) {
        current += pattern[i + 1]
        i += 2
        continue
      }

      current += char
      i++
    }

    this.#flushLiteral(segments, current)

    return segments
  }

  /**
   * Build regex from segments
   */
  #buildRegex(): RegExp {
    let regexStr = '^'

    for (const segment of this.#segments) {
      switch (segment.type) {
        case 'literal':
          // Escape special regex characters
          regexStr += this.#escapeRegex(segment.value as string)
          break

        case 'wildcard':
          if (segment.value === '*') {
            regexStr += '[^/]*'
          } else if (segment.value === '?') {
            regexStr += '[^/]'
          }
          break

        case 'globstar':
          // Match zero or more path segments
          regexStr += '(?:(?:[^/]*(?:/|$))*)'
          break

        case 'range':
          if (segment.negated) {
            regexStr += `[^${this.#escapeRegex(segment.value as string)}]`
          } else {
            regexStr += `[${this.#escapeRegex(segment.value as string)}]`
          }
          break

        case 'brace':
          {
            const alternatives = (segment.value as string[])
              .map((alt) => this.#escapeRegex(alt))
              .join('|')
            regexStr += `(?:${alternatives})`
          }
          break
      }
    }

    regexStr += '$'

    const flags = this.#caseSensitive ? '' : 'i'
    return new RegExp(regexStr, flags)
  }

  /**
   * Find closing brace for brace expansion
   */
  #findClosingBrace(pattern: string, startIndex: number): number {
    let depth = 1
    let i = startIndex + 1

    while (i < pattern.length && depth > 0) {
      if (pattern[i] === '\\') {
        i += 2
        continue
      }
      if (pattern[i] === '{') depth++
      if (pattern[i] === '}') depth--
      i++
    }

    return depth === 0 ? i - 1 : -1
  }

  /**
   * Escape special regex characters
   */
  #escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}

/**
 * LRU Cache implementation for path caching
 */
class LRUCache<K, V> {
  #maxSize: number
  #ttl: number
  #cache: Map<K, { value: V; timestamp: number; accessCount: number }>
  #hits: number
  #misses: number
  #evictions: number

  constructor(maxSize: number, ttl: number) {
    this.#maxSize = maxSize
    this.#ttl = ttl
    this.#cache = new Map()
    this.#hits = 0
    this.#misses = 0
    this.#evictions = 0
  }

  get(key: K): V | undefined {
    const entry = this.#cache.get(key)

    if (!entry) {
      this.#misses++
      return undefined
    }

    // Check TTL if enabled (ttl > 0)
    if (this.#ttl > 0 && Date.now() - entry.timestamp > this.#ttl) {
      this.#cache.delete(key)
      this.#misses++
      return undefined
    }

    // Update access count for LRU
    entry.accessCount++
    this.#hits++
    return entry.value
  }

  set(key: K, value: V): void {
    // If at capacity, evict LRU entry
    if (this.#cache.size >= this.#maxSize && !this.#cache.has(key)) {
      this.#evictLRU()
    }

    this.#cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 0,
    })
  }

  has(key: K): boolean {
    const entry = this.#cache.get(key)
    if (!entry) return false

    // Check TTL
    if (this.#ttl > 0 && Date.now() - entry.timestamp > this.#ttl) {
      this.#cache.delete(key)
      return false
    }

    return true
  }

  delete(key: K): boolean {
    return this.#cache.delete(key)
  }

  clear(): void {
    this.#cache.clear()
    this.#hits = 0
    this.#misses = 0
    this.#evictions = 0
  }

  get size(): number {
    return this.#cache.size
  }

  getStats(): CacheStats {
    const total = this.#hits + this.#misses
    return {
      hits: this.#hits,
      misses: this.#misses,
      size: this.#cache.size,
      maxSize: this.#maxSize,
      hitRate: total > 0 ? this.#hits / total : 0,
      evictions: this.#evictions,
    }
  }

  keys(): K[] {
    return Array.from(this.#cache.keys())
  }

  #evictLRU(): void {
    let minAccessCount = Infinity
    let lruKey: K | undefined

    for (const [key, entry] of this.#cache) {
      if (entry.accessCount < minAccessCount) {
        minAccessCount = entry.accessCount
        lruKey = key
      }
    }

    if (lruKey !== undefined) {
      this.#cache.delete(lruKey)
      this.#evictions++
    }
  }
}

/**
 * PathPal provides a clean abstraction for working with filesystem paths
 * in your Node.js project. It generates helper methods based on your project's
 * directory structure.
 */
export class PathPalBase<T extends Record<string, string> = Record<string, string>> {
  #appRoot: URL
  #directories: T
  #strict: boolean
  #templates: Map<string, TemplateFunction>
  #patterns: Map<string, PatternFunction>
  #cache: LRUCache<string, string> | null
  #cacheConfig: CacheConfig

  /**
   * Creates a new PathPal instance
   *
   * @param config - Configuration options
   *
   * @example
   * const pal = new PathPal({
   *   root: process.cwd(),
   *   directories: {
   *     config: 'config',
   *     models: 'app/models'
   *   }
   * })
   *
   * pal.configPath('database.js')  // /project/config/database.js
   * pal.modelsPath('User.js')      // /project/app/models/User.js
   */
  constructor(config: PathPalConfig<T>) {
    this.#strict = config.strict ?? false
    this.#appRoot = this.#normalizeRoot(config.root)

    // Store directories configuration
    this.#directories = (config.directories || {}) as T

    // Initialize cache configuration and cache instance
    this.#cacheConfig = this.#initializeCacheConfig(config.cache)
    this.#cache = this.#cacheConfig.enabled
      ? new LRUCache(this.#cacheConfig.maxSize!, this.#cacheConfig.ttl!)
      : null

    // Initialize templates and patterns
    this.#templates = new Map()
    this.#patterns = new Map()

    // Register custom templates
    if (config.templates) {
      for (const [name, fn] of Object.entries(config.templates)) {
        this.#templates.set(name, fn)
      }
    }

    // Register custom patterns
    if (config.patterns) {
      for (const [name, fn] of Object.entries(config.patterns)) {
        this.#patterns.set(name, fn)
      }
    }

    // Register built-in patterns
    if (config.builtInPatterns !== false) {
      this.#registerBuiltInPatterns()
    }

    // Validate directory keys before creating helpers
    this.#validateDirectoryKeys()

    // Dynamically create helper methods for each configured directory
    this.#createPathHelpers()
  }

  /**
   * Initialize cache configuration from user config
   */
  #initializeCacheConfig(cache?: boolean | CacheConfig): CacheConfig {
    const cacheEnabled = cache === true || (typeof cache === 'object' && cache.enabled !== false)

    if (typeof cache === 'object') {
      return {
        enabled: cache.enabled ?? true,
        maxSize: cache.maxSize ?? 1000,
        ttl: cache.ttl ?? 0,
        includeTemplates: cache.includeTemplates ?? true,
        includePatterns: cache.includePatterns ?? true,
      }
    }

    return {
      enabled: cacheEnabled,
      maxSize: 1000,
      ttl: 0,
      includeTemplates: true,
      includePatterns: true,
    }
  }

  /**
   * Validates that directory keys are safe to use as method names
   */
  #validateDirectoryKeys(): void {
    for (const key of Object.keys(this.#directories)) {
      // Remove 'Path' suffix if present for validation
      const baseName = key.replace(/Path$/, '')

      // Check if it's a valid JavaScript identifier
      if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(baseName)) {
        throw new Error(
          `Invalid directory key "${key}": must be a valid JavaScript identifier. `
          + 'Use only letters, numbers, underscores, and dollar signs, and cannot start with a number.',
        )
      }

      // Prevent prototype pollution and reserved words
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new Error(
          `Reserved directory key "${key}" cannot be used as it could cause security issues.`,
        )
      }

      // Check for conflicts with existing PathPal methods
      const methodName = key.endsWith('Path') ? key : `${key}Path`
      const existingMethod = (this as Record<string, unknown>)[methodName]
      if (methodName in this && typeof existingMethod === 'function') {
        throw new Error(
          `Directory key "${key}" conflicts with existing PathPal method "${methodName}". `
          + 'Please choose a different key.',
        )
      }
    }
  }

  /**
   * Normalizes the root path to a URL object
   */
  #normalizeRoot(root: string | URL): URL {
    if (root instanceof URL) {
      return this.#validateFileUrl(root)
    }

    if (typeof root === 'string') {
      return this.#normalizeStringRoot(root)
    }

    throw new Error(
      `Invalid root path type: expected string or URL object, but received ${typeof root}.`,
    )
  }

  /**
   * Validates that a URL uses the file:// protocol
   */
  #validateFileUrl(url: URL): URL {
    if (url.protocol !== 'file:') {
      throw new Error(
        `Invalid URL protocol: expected "file:" for filesystem paths, but received "${url.protocol}". `
        + 'Only file:// URLs are supported.',
      )
    }
    return url
  }

  /**
   * Normalizes a string root path to a file:// URL
   */
  #normalizeStringRoot(root: string): URL {
    // Handle file:// URL strings
    if (root.startsWith('file://')) {
      return new URL(root)
    }

    // Convert to absolute path
    const absolutePath = isAbsolute(root) ? root : resolve(process.cwd(), root)

    // Create file:// URL
    return new URL(`file://${absolutePath}`)
  }

  /**
   * Validates path segments when in strict mode
   */
  #validatePathSegments(paths: string[]): void {
    if (!this.#strict) {
      return
    }

    for (const segment of paths) {
      // Check for path traversal attempts
      if (segment.includes('..')) {
        throw new Error(
          `Path traversal detected: segment "${segment}" contains ".." which is not allowed in strict mode. `
          + 'This could allow access to files outside the project root.',
        )
      }

      // Check for absolute paths
      if (isAbsolute(segment)) {
        throw new Error(
          `Absolute path detected: segment "${segment}" is an absolute path which is not allowed in strict mode. `
          + 'All paths must be relative to the project root.',
        )
      }
    }
  }

  /**
   * Registers built-in patterns
   */
  #registerBuiltInPatterns(): void {
    // Date patterns
    this.#patterns.set('date', () => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })

    this.#patterns.set('time', () => {
      const d = new Date()
      return `${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}-${String(d.getSeconds()).padStart(2, '0')}`
    })

    this.#patterns.set('datetime', () => {
      const d = new Date()
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const time = `${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}-${String(d.getSeconds()).padStart(2, '0')}`
      return `${date}-${time}`
    })

    this.#patterns.set('timestamp', () => Date.now().toString())

    this.#patterns.set('year', () => new Date().getFullYear().toString())

    this.#patterns.set('month', () => String(new Date().getMonth() + 1).padStart(2, '0'))

    this.#patterns.set('day', () => String(new Date().getDate()).padStart(2, '0'))
  }

  /**
   * Dynamically creates helper methods for each configured directory
   */
  #createPathHelpers(): void {
    for (const [name, dir] of Object.entries(this.#directories)) {
      const methodName = name.endsWith('Path') ? name : `${name}Path`

      // Create the path helper method
      Object.defineProperty(this, methodName, {
        value: (...paths: string[]): string => {
          return this.makePath(dir, ...paths)
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      // Create the async exists helper method
      Object.defineProperty(this, `${methodName}Exists`, {
        value: async (...paths: string[]): Promise<boolean> => {
          return this.exists(this.makePath(dir, ...paths))
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      // Create the sync exists helper method
      Object.defineProperty(this, `${methodName}ExistsSync`, {
        value: (...paths: string[]): boolean => {
          return this.existsSync(this.makePath(dir, ...paths))
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      // Create read helpers
      Object.defineProperty(this, `${methodName}Read`, {
        value: (path: string, encoding?: BufferEncoding): Promise<string | Buffer> => {
          return encoding
            ? this.readFile(this.makePath(dir, path), encoding)
            : this.readFile(this.makePath(dir, path))
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      Object.defineProperty(this, `${methodName}ReadSync`, {
        value: (path: string, encoding?: BufferEncoding): string | Buffer => {
          return encoding
            ? this.readFileSync(this.makePath(dir, path), encoding)
            : this.readFileSync(this.makePath(dir, path))
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      // Create write helpers
      Object.defineProperty(this, `${methodName}Write`, {
        value: (path: string, data: string | Buffer, options?: WriteFileOptions): Promise<void> => {
          return this.writeFile(this.makePath(dir, path), data, options)
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      Object.defineProperty(this, `${methodName}WriteSync`, {
        value: (path: string, data: string | Buffer, options?: WriteFileOptions): void => {
          this.writeFileSync(this.makePath(dir, path), data, options)
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      // Create mkdir helpers
      Object.defineProperty(this, `${methodName}Mkdir`, {
        value: (path: string, options?: MkdirOptions): Promise<string | undefined> => {
          return this.mkdir(this.makePath(dir, path), options)
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      Object.defineProperty(this, `${methodName}MkdirSync`, {
        value: (path: string, options?: MkdirOptions): string | undefined => {
          return this.mkdirSync(this.makePath(dir, path), options)
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      // Create rmdir helpers
      Object.defineProperty(this, `${methodName}Rmdir`, {
        value: (path: string, options?: RmdirOptions): Promise<void> => {
          return this.rmdir(this.makePath(dir, path), options)
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      Object.defineProperty(this, `${methodName}RmdirSync`, {
        value: (path: string, options?: RmdirOptions): void => {
          this.rmdirSync(this.makePath(dir, path), options)
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      // Create ensure directory helpers
      Object.defineProperty(this, `${methodName}Ensure`, {
        value: (path: string = ''): Promise<void> => {
          return this.ensureDir(path ? this.makePath(dir, path) : this.makePath(dir))
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      Object.defineProperty(this, `${methodName}EnsureSync`, {
        value: (path: string = ''): void => {
          this.ensureDirSync(path ? this.makePath(dir, path) : this.makePath(dir))
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      // Create list files helpers
      Object.defineProperty(this, `${methodName}ListFiles`, {
        value: (path: string = '', options?: ListFilesOptions): Promise<string[]> => {
          return this.listFiles(path ? this.makePath(dir, path) : this.makePath(dir), options)
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      Object.defineProperty(this, `${methodName}ListFilesSync`, {
        value: (path: string = '', options?: ListFilesOptions): string[] => {
          return this.listFilesSync(path ? this.makePath(dir, path) : this.makePath(dir), options)
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      // Create delete recursive helpers
      Object.defineProperty(this, `${methodName}DeleteRecursive`, {
        value: (path: string): Promise<void> => {
          return this.deleteRecursive(this.makePath(dir, path))
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      Object.defineProperty(this, `${methodName}DeleteRecursiveSync`, {
        value: (path: string): void => {
          this.deleteRecursiveSync(this.makePath(dir, path))
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      // Create watch helper
      Object.defineProperty(this, `${methodName}Watch`, {
        value: (
          path: string,
          listener: (eventType: 'rename' | 'change', filename: string | null) => void,
          options?: WatchOptions,
        ): FSWatcher => {
          return this.watch(this.makePath(dir, path), listener, options)
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      // Create sanitization helpers
      Object.defineProperty(this, `${methodName}Sanitize`, {
        value: (filename: string, options?: SanitizeOptions): string => {
          return this.sanitizeFilename(filename, options)
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      Object.defineProperty(this, `${methodName}SanitizePath`, {
        value: (path: string, options?: SanitizeOptions): string => {
          return this.sanitizePath(path, options)
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      // Create glob helpers
      Object.defineProperty(this, `${methodName}Glob`, {
        value: (pattern: string, options: GlobOptions = {}): Promise<string[]> => {
          const baseDir = this.makePath(dir)
          return this.glob(pattern, { ...options, cwd: baseDir })
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })

      Object.defineProperty(this, `${methodName}GlobSync`, {
        value: (pattern: string, options: GlobOptions = {}): string[] => {
          const baseDir = this.makePath(dir)
          return this.globSync(pattern, { ...options, cwd: baseDir })
        },
        enumerable: true,
        writable: false,
        configurable: false,
      })
    }
  }

  /**
   * Get the application root as a URL
   */
  get appRoot(): URL {
    return this.#appRoot
  }

  /**
   * Get the application root as a filesystem path
   */
  get appRootPath(): string {
    return fileURLToPath(this.#appRoot)
  }

  /**
   * Creates a file:// URL from the application root
   *
   * @param paths - Path segments to join
   * @returns A URL object
   *
   * @example
   * pal.makeURL('config', 'database.js')
   * // => URL { href: 'file:///project/config/database.js' }
   */
  makeURL(...paths: string[]): URL {
    if (paths.length === 0) {
      return this.#appRoot
    }

    this.#validatePathSegments(paths)

    const joinedPath = join(...paths)
    // Ensure the base URL has a trailing slash for proper resolution
    const baseHref = this.#appRoot.href.replace(/\/?$/, '/')
    return new URL(joinedPath, baseHref)
  }

  /**
   * Creates an absolute filesystem path from the application root
   *
   * @param paths - Path segments to join
   * @returns An absolute filesystem path
   *
   * @example
   * pal.makePath('config', 'database.js')
   * // => '/project/config/database.js'
   */
  makePath(...paths: string[]): string {
    // Check if caching is enabled
    if (this.#cache) {
      // Create cache key from path segments
      const cacheKey = paths.join('/')

      // Check cache first
      const cached = this.#cache.get(cacheKey)
      if (cached !== undefined) {
        return cached
      }

      // Cache miss - compute and cache the result
      const processedPaths = paths.map((p) => {
        if (p.includes('${')) {
          return this.renderTemplate(p)
        }
        return p
      })
      const result = fileURLToPath(this.makeURL(...processedPaths))

      // Cache the result
      this.#cache.set(cacheKey, result)
      return result
    }

    // No caching - compute directly
    const processedPaths = paths.map((p) => {
      if (p.includes('${')) {
        return this.renderTemplate(p)
      }
      return p
    })
    return fileURLToPath(this.makeURL(...processedPaths))
  }

  /**
   * Gets a relative path from the app root to the given absolute path
   *
   * @param absolutePath - An absolute filesystem path
   * @returns A relative path from app root
   *
   * @example
   * pal.relativePath('/project/config/database.js')
   * // => 'config/database.js'
   */
  relativePath(absolutePath: string): string {
    return relative(this.appRootPath, absolutePath)
  }

  /**
   * Checks if a given path is within the application root directory
   *
   * @param path - Path to check (can be absolute or relative)
   * @returns True if the path is within the root, false otherwise
   *
   * @example
   * pal.isWithinRoot('/project/config/database.js')  // => true
   * pal.isWithinRoot('/etc/passwd')                  // => false
   */
  isWithinRoot(path: string): boolean {
    const absolutePath = isAbsolute(path) ? path : this.makePath(path)
    const normalizedPath = normalize(absolutePath)
    const rootPath = this.appRootPath

    return normalizedPath.startsWith(rootPath)
  }

  /**
   * Gets a list of all configured directory names
   *
   * @returns Array of directory keys
   *
   * @example
   * pal.getDirectories()  // => ['config', 'models', 'public']
   */
  getDirectories(): string[] {
    return Object.keys(this.#directories)
  }

  /**
   * Returns a JSON representation of the PathPal instance
   *
   * @returns Object containing root, directories, and strict mode setting
   */
  toJSON(): PathPalJSON {
    return {
      root: this.appRootPath,
      directories: { ...this.#directories },
      strict: this.#strict,
    }
  }

  /**
   * Get the current platform type
   */
  get platform(): 'win32' | 'posix' {
    return process.platform === 'win32' ? 'win32' : 'posix'
  }

  /**
   * Normalizes a path to canonical form with consistent separators
   *
   * @param path - Path to normalize
   * @returns Normalized path
   *
   * @example
   * pal.normalizePath('config//database/../settings.json')
   * // => 'config/settings.json'
   */
  normalizePath(path: string): string {
    // First replace all backslashes with forward slashes for consistency
    const unifiedPath = path.replace(/\\/g, '/')
    const normalized = normalize(unifiedPath)

    // In strict mode, check if normalization resulted in path traversal outside root
    if (this.#strict && normalized.includes('..')) {
      throw new Error(
        `Path traversal detected: normalized path "${normalized}" contains ".." which is not allowed in strict mode. `
        + 'This could allow access to files outside the project root.',
      )
    }

    // Convert to forward slashes for consistency
    return normalized.split(sep).join('/')
  }

  /**
   * Converts a path to the specified platform format
   *
   * @param path - Path to convert
   * @param platform - Target platform ('win32' or 'posix'), defaults to current platform
   * @returns Platform-specific path
   *
   * @example
   * pal.toPlatformPath('config/database/mysql.json', 'win32')
   * // => 'config\\database\\mysql.json'
   */
  toPlatformPath(path: string, platform?: 'win32' | 'posix'): string {
    const targetPlatform = platform || this.platform

    if (targetPlatform === 'win32') {
      return this.toWindowsPath(path)
    } else {
      return this.toPosixPath(path)
    }
  }

  /**
   * Converts a path to POSIX format (forward slashes)
   *
   * @param path - Path to convert
   * @returns POSIX-formatted path
   *
   * @example
   * pal.toPosixPath('config\\database\\mysql.json')
   * // => 'config/database/mysql.json'
   */
  toPosixPath(path: string): string {
    return path.split(win32.sep).join(posix.sep)
  }

  /**
   * Converts a path to Windows format (backslashes)
   *
   * @param path - Path to convert
   * @returns Windows-formatted path
   *
   * @example
   * pal.toWindowsPath('config/database/mysql.json')
   * // => 'config\\database\\mysql.json'
   */
  toWindowsPath(path: string): string {
    return path.split(posix.sep).join(win32.sep)
  }

  /**
   * Resolves a symlink to its real path (async)
   *
   * @param path - Path to resolve (can be absolute or relative)
   * @returns Promise resolving to the real path
   *
   * @example
   * const realPath = await pal.resolveSymlink(pal.configPath('current'))
   * // => '/project/config/2024-01-14'
   */
  async resolveSymlink(path: string): Promise<string> {
    try {
      const absolutePath = isAbsolute(path) ? path : this.makePath(path)
      const resolved = await realpath(absolutePath)

      // In strict mode, ensure resolved path is within root
      if (this.#strict && !this.isWithinRoot(resolved)) {
        throw new Error(
          `Symlink target outside root: "${resolved}" is not within the project root. `
          + 'This is not allowed in strict mode.',
        )
      }

      return resolved
    } catch (error) {
      // If it's not a symlink or doesn't exist, return the original path
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return isAbsolute(path) ? path : this.makePath(path)
      }
      throw error
    }
  }

  /**
   * Resolves a symlink to its real path (sync)
   *
   * @param path - Path to resolve (can be absolute or relative)
   * @returns The real path
   *
   * @example
   * const realPath = pal.resolveSymlinkSync(pal.configPath('current'))
   * // => '/project/config/2024-01-14'
   */
  resolveSymlinkSync(path: string): string {
    try {
      const absolutePath = isAbsolute(path) ? path : this.makePath(path)
      const resolved = realpathSync(absolutePath)

      // In strict mode, ensure resolved path is within root
      if (this.#strict && !this.isWithinRoot(resolved)) {
        throw new Error(
          `Symlink target outside root: "${resolved}" is not within the project root. `
          + 'This is not allowed in strict mode.',
        )
      }

      return resolved
    } catch (error) {
      // If it's not a symlink or doesn't exist, return the original path
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return isAbsolute(path) ? path : this.makePath(path)
      }
      throw error
    }
  }

  /**
   * Checks if a path is a symlink (async)
   *
   * @param path - Path to check (can be absolute or relative)
   * @returns Promise resolving to true if the path is a symlink
   *
   * @example
   * const isLink = await pal.isSymlink(pal.configPath('current'))
   * // => true
   */
  async isSymlink(path: string): Promise<boolean> {
    try {
      const absolutePath = isAbsolute(path) ? path : this.makePath(path)
      const stats = await lstat(absolutePath)
      return stats.isSymbolicLink()
    } catch {
      return false
    }
  }

  /**
   * Checks if a path is a symlink (sync)
   *
   * @param path - Path to check (can be absolute or relative)
   * @returns True if the path is a symlink
   *
   * @example
   * const isLink = pal.isSymlinkSync(pal.configPath('current'))
   * // => true
   */
  isSymlinkSync(path: string): boolean {
    try {
      const absolutePath = isAbsolute(path) ? path : this.makePath(path)
      const stats = lstatSync(absolutePath)
      return stats.isSymbolicLink()
    } catch {
      return false
    }
  }

  /**
   * Checks if a path exists (async)
   *
   * @param path - Path to check (can be absolute or relative)
   * @returns Promise resolving to true if the path exists
   *
   * @example
   * if (await pal.exists(pal.configPath('database.json'))) {
   *   // Load config
   * }
   */
  async exists(path: string): Promise<boolean> {
    try {
      const absolutePath = isAbsolute(path) ? path : this.makePath(path)
      await access(absolutePath, constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  /**
   * Checks if a path exists (sync)
   *
   * @param path - Path to check (can be absolute or relative)
   * @returns True if the path exists
   *
   * @example
   * if (pal.existsSync(pal.configPath('database.json'))) {
   *   // Load config
   * }
   */
  existsSync(path: string): boolean {
    try {
      const absolutePath = isAbsolute(path) ? path : this.makePath(path)
      accessSync(absolutePath, constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  /**
   * Checks if a path is a file (async)
   *
   * @param path - Path to check (can be absolute or relative)
   * @returns Promise resolving to true if the path is a file
   *
   * @example
   * if (await pal.isFile(pal.configPath('database.json'))) {
   *   console.log('database.json is a file')
   * }
   */
  async isFile(path: string): Promise<boolean> {
    try {
      const absolutePath = isAbsolute(path) ? path : this.makePath(path)
      const stats = await stat(absolutePath)
      return stats.isFile()
    } catch {
      return false
    }
  }

  /**
   * Checks if a path is a file (sync)
   *
   * @param path - Path to check (can be absolute or relative)
   * @returns True if the path is a file
   *
   * @example
   * if (pal.isFileSync(pal.configPath('database.json'))) {
   *   console.log('database.json is a file')
   * }
   */
  isFileSync(path: string): boolean {
    try {
      const absolutePath = isAbsolute(path) ? path : this.makePath(path)
      const stats = statSync(absolutePath)
      return stats.isFile()
    } catch {
      return false
    }
  }

  /**
   * Checks if a path is a directory (async)
   *
   * @param path - Path to check (can be absolute or relative)
   * @returns Promise resolving to true if the path is a directory
   *
   * @example
   * if (await pal.isDirectory(pal.configPath())) {
   *   console.log('config directory exists')
   * }
   */
  async isDirectory(path: string): Promise<boolean> {
    try {
      const absolutePath = isAbsolute(path) ? path : this.makePath(path)
      const stats = await stat(absolutePath)
      return stats.isDirectory()
    } catch {
      return false
    }
  }

  /**
   * Checks if a path is a directory (sync)
   *
   * @param path - Path to check (can be absolute or relative)
   * @returns True if the path is a directory
   *
   * @example
   * if (pal.isDirectorySync(pal.configPath())) {
   *   console.log('config directory exists')
   * }
   */
  isDirectorySync(path: string): boolean {
    try {
      const absolutePath = isAbsolute(path) ? path : this.makePath(path)
      const stats = statSync(absolutePath)
      return stats.isDirectory()
    } catch {
      return false
    }
  }

  /**
   * Gets file stats for a path (async)
   *
   * @param path - Path to get stats for (can be absolute or relative)
   * @param followSymlinks - Whether to follow symlinks (default: true)
   * @returns Promise resolving to Stats object or null if path doesn't exist
   *
   * @example
   * const stats = await pal.getStats(pal.configPath('database.json'))
   * if (stats) {
   *   console.log('File size:', stats.size)
   * }
   */
  async getStats(path: string, followSymlinks = true): Promise<import('node:fs').Stats | null> {
    try {
      const absolutePath = isAbsolute(path) ? path : this.makePath(path)
      return followSymlinks ? await stat(absolutePath) : await lstat(absolutePath)
    } catch {
      return null
    }
  }

  /**
   * Gets file stats for a path (sync)
   *
   * @param path - Path to get stats for (can be absolute or relative)
   * @param followSymlinks - Whether to follow symlinks (default: true)
   * @returns Stats object or null if path doesn't exist
   *
   * @example
   * const stats = pal.getStatsSync(pal.configPath('database.json'))
   * if (stats) {
   *   console.log('File size:', stats.size)
   * }
   */
  getStatsSync(path: string, followSymlinks = true): import('node:fs').Stats | null {
    try {
      const absolutePath = isAbsolute(path) ? path : this.makePath(path)
      return followSymlinks ? statSync(absolutePath) : lstatSync(absolutePath)
    } catch {
      return null
    }
  }

  /**
   * Validates that a path is within the root directory in strict mode
   *
   * @param path - Path to validate
   * @throws Error if in strict mode and path is outside root
   */
  #validateStrictMode(path: string): void {
    if (this.#strict && !this.isWithinRoot(path)) {
      throw new Error(
        `Path "${path}" is outside root directory "${this.appRootPath}". `
        + 'This operation is not allowed in strict mode.',
      )
    }
  }

  /**
   * Reads a file's contents (async)
   *
   * @param path - Path to file (can be absolute or relative)
   * @param encoding - Text encoding (default: utf-8)
   * @returns Promise resolving to file contents
   *
   * @example
   * const config = await pal.readFile(pal.configPath('database.json'), 'utf-8')
   * const buffer = await pal.readFile(pal.publicPath('image.png'))
   */
  async readFile(path: string): Promise<Buffer>
  async readFile(path: string, encoding: BufferEncoding): Promise<string>
  async readFile(path: string, encoding?: BufferEncoding): Promise<string | Buffer> {
    const absolutePath = isAbsolute(path) ? path : this.makePath(path)
    this.#validateStrictMode(absolutePath)
    return encoding ? fsReadFile(absolutePath, encoding) : fsReadFile(absolutePath)
  }

  /**
   * Reads a file's contents (sync)
   *
   * @param path - Path to file (can be absolute or relative)
   * @param encoding - Text encoding (default: utf-8)
   * @returns File contents
   *
   * @example
   * const config = pal.readFileSync(pal.configPath('database.json'), 'utf-8')
   * const buffer = pal.readFileSync(pal.publicPath('image.png'))
   */
  readFileSync(path: string): Buffer
  readFileSync(path: string, encoding: BufferEncoding): string
  readFileSync(path: string, encoding?: BufferEncoding): string | Buffer {
    const absolutePath = isAbsolute(path) ? path : this.makePath(path)
    this.#validateStrictMode(absolutePath)
    return encoding ? fsReadFileSync(absolutePath, encoding) : fsReadFileSync(absolutePath)
  }

  /**
   * Writes data to a file (async)
   *
   * @param path - Path to file (can be absolute or relative)
   * @param data - Data to write
   * @param options - Write options
   * @returns Promise that resolves when write completes
   *
   * @example
   * await pal.writeFile(pal.configPath('database.json'), JSON.stringify(config), 'utf-8')
   * await pal.writeFile(pal.publicPath('image.png'), buffer)
   */
  async writeFile(
    path: string,
    data: string | Buffer,
    options?: BufferEncoding | { encoding?: BufferEncoding; mode?: number; flag?: string },
  ): Promise<void> {
    const absolutePath = isAbsolute(path) ? path : this.makePath(path)
    this.#validateStrictMode(absolutePath)
    return fsWriteFile(absolutePath, data, options)
  }

  /**
   * Writes data to a file (sync)
   *
   * @param path - Path to file (can be absolute or relative)
   * @param data - Data to write
   * @param options - Write options
   *
   * @example
   * pal.writeFileSync(pal.configPath('database.json'), JSON.stringify(config), 'utf-8')
   * pal.writeFileSync(pal.publicPath('image.png'), buffer)
   */
  writeFileSync(
    path: string,
    data: string | Buffer,
    options?: BufferEncoding | { encoding?: BufferEncoding; mode?: number; flag?: string },
  ): void {
    const absolutePath = isAbsolute(path) ? path : this.makePath(path)
    this.#validateStrictMode(absolutePath)
    fsWriteFileSync(absolutePath, data, options)
  }

  /**
   * Creates a directory (async)
   *
   * @param path - Path to directory (can be absolute or relative)
   * @param options - Options including recursive flag
   * @returns Promise resolving to the created directory path or undefined
   *
   * @example
   * await pal.mkdir(pal.configPath('backups'))
   * await pal.mkdir(pal.configPath('backups/daily'), { recursive: true })
   */
  async mkdir(
    path: string,
    options?: { recursive?: boolean; mode?: number },
  ): Promise<string | undefined> {
    const absolutePath = isAbsolute(path) ? path : this.makePath(path)
    this.#validateStrictMode(absolutePath)
    return fsMkdir(absolutePath, options)
  }

  /**
   * Creates a directory (sync)
   *
   * @param path - Path to directory (can be absolute or relative)
   * @param options - Options including recursive flag
   * @returns The created directory path or undefined
   *
   * @example
   * pal.mkdirSync(pal.configPath('backups'))
   * pal.mkdirSync(pal.configPath('backups/daily'), { recursive: true })
   */
  mkdirSync(path: string, options?: { recursive?: boolean; mode?: number }): string | undefined {
    const absolutePath = isAbsolute(path) ? path : this.makePath(path)
    this.#validateStrictMode(absolutePath)
    return fsMkdirSync(absolutePath, options)
  }

  /**
   * Removes a file or directory (async)
   *
   * @param path - Path to remove (can be absolute or relative)
   * @param options - Options including recursive flag
   * @returns Promise that resolves when removal completes
   *
   * @example
   * await pal.rmdir(pal.configPath('temp'))
   * await pal.rmdir(pal.configPath('temp'), { recursive: true })
   */
  async rmdir(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    const absolutePath = isAbsolute(path) ? path : this.makePath(path)
    this.#validateStrictMode(absolutePath)

    // Prevent deleting the root directory
    if (absolutePath === this.appRootPath) {
      throw new Error(
        'Cannot delete the application root directory. This operation is not allowed.',
      )
    }

    return fsRm(absolutePath, options)
  }

  /**
   * Removes a file or directory (sync)
   *
   * @param path - Path to remove (can be absolute or relative)
   * @param options - Options including recursive flag
   *
   * @example
   * pal.rmdirSync(pal.configPath('temp'))
   * pal.rmdirSync(pal.configPath('temp'), { recursive: true })
   */
  rmdirSync(path: string, options?: { recursive?: boolean; force?: boolean }): void {
    const absolutePath = isAbsolute(path) ? path : this.makePath(path)
    this.#validateStrictMode(absolutePath)

    // Prevent deleting the root directory
    if (absolutePath === this.appRootPath) {
      throw new Error(
        'Cannot delete the application root directory. This operation is not allowed.',
      )
    }

    fsRmSync(absolutePath, options)
  }

  /**
   * Ensures a directory exists, creating it and parent directories if needed (async)
   *
   * @param path - Path to directory (can be absolute or relative)
   * @returns Promise that resolves when directory is ensured to exist
   *
   * @example
   * await pal.ensureDir(pal.configPath('backups/daily'))
   * // Creates config/backups/daily and any missing parent directories
   */
  async ensureDir(path: string): Promise<void> {
    const absolutePath = isAbsolute(path) ? path : this.makePath(path)
    this.#validateStrictMode(absolutePath)

    try {
      await fsMkdir(absolutePath, { recursive: true })
    } catch (error) {
      // Check if directory already exists
      if (await this.isDirectory(absolutePath)) {
        return
      }
      throw error
    }
  }

  /**
   * Ensures a directory exists, creating it and parent directories if needed (sync)
   *
   * @param path - Path to directory (can be absolute or relative)
   *
   * @example
   * pal.ensureDirSync(pal.configPath('backups/daily'))
   * // Creates config/backups/daily and any missing parent directories
   */
  ensureDirSync(path: string): void {
    const absolutePath = isAbsolute(path) ? path : this.makePath(path)
    this.#validateStrictMode(absolutePath)

    try {
      fsMkdirSync(absolutePath, { recursive: true })
    } catch (error) {
      // Check if directory already exists
      if (this.isDirectorySync(absolutePath)) {
        return
      }
      throw error
    }
  }

  /**
   * Lists all files in a directory (async)
   *
   * @param path - Path to directory (can be absolute or relative)
   * @param options - Options for listing files
   * @returns Promise resolving to array of file paths
   *
   * @example
   * const files = await pal.listFiles(pal.configPath())
   * const allFiles = await pal.listFiles(pal.configPath(), { recursive: true })
   * const jsFiles = await pal.listFiles(pal.configPath(), {
   *   recursive: true,
   *   filter: (path) => path.endsWith('.js')
   * })
   */
  async listFiles(
    path: string,
    options: {
      recursive?: boolean
      absolute?: boolean
      filesOnly?: boolean
      followSymlinks?: boolean
      maxDepth?: number
      filter?: (path: string) => boolean
    } = {},
  ): Promise<string[]> {
    const {
      recursive = false,
      absolute = true,
      filesOnly = true,
      followSymlinks = true,
      maxDepth = Infinity,
      filter,
    } = options

    const absolutePath = isAbsolute(path) ? path : this.makePath(path)
    this.#validateStrictMode(absolutePath)

    const results: string[] = []

    const traverse = async (currentPath: string, depth: number): Promise<void> => {
      if (depth > maxDepth) {
        return
      }

      const entries = await readdir(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        const entryPath = join(currentPath, entry.name)

        // Check if it's within root in strict mode
        if (this.#strict && !this.isWithinRoot(entryPath)) {
          continue
        }

        let isDir = entry.isDirectory()

        // Handle symlinks
        if (entry.isSymbolicLink() && followSymlinks) {
          const stats = await this.getStats(entryPath, true)
          isDir = stats ? stats.isDirectory() : false
        }

        // Add to results if it matches criteria
        if (!filesOnly || !isDir) {
          const resultPath = absolute ? entryPath : this.relativePath(entryPath)
          if (!filter || filter(resultPath)) {
            results.push(resultPath)
          }
        }

        // Recurse into directories
        if (isDir && recursive) {
          await traverse(entryPath, depth + 1)
        }
      }
    }

    await traverse(absolutePath, 0)
    return results
  }

  /**
   * Lists all files in a directory (sync)
   *
   * @param path - Path to directory (can be absolute or relative)
   * @param options - Options for listing files
   * @returns Array of file paths
   *
   * @example
   * const files = pal.listFilesSync(pal.configPath())
   * const allFiles = pal.listFilesSync(pal.configPath(), { recursive: true })
   * const jsFiles = pal.listFilesSync(pal.configPath(), {
   *   recursive: true,
   *   filter: (path) => path.endsWith('.js')
   * })
   */
  listFilesSync(
    path: string,
    options: {
      recursive?: boolean
      absolute?: boolean
      filesOnly?: boolean
      followSymlinks?: boolean
      maxDepth?: number
      filter?: (path: string) => boolean
    } = {},
  ): string[] {
    const {
      recursive = false,
      absolute = true,
      filesOnly = true,
      followSymlinks = true,
      maxDepth = Infinity,
      filter,
    } = options

    const absolutePath = isAbsolute(path) ? path : this.makePath(path)
    this.#validateStrictMode(absolutePath)

    const results: string[] = []

    const traverse = (currentPath: string, depth: number): void => {
      if (depth > maxDepth) {
        return
      }

      const entries = readdirSync(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        const entryPath = join(currentPath, entry.name)

        // Check if it's within root in strict mode
        if (this.#strict && !this.isWithinRoot(entryPath)) {
          continue
        }

        let isDir = entry.isDirectory()

        // Handle symlinks
        if (entry.isSymbolicLink() && followSymlinks) {
          const stats = this.getStatsSync(entryPath, true)
          isDir = stats ? stats.isDirectory() : false
        }

        // Add to results if it matches criteria
        if (!filesOnly || !isDir) {
          const resultPath = absolute ? entryPath : this.relativePath(entryPath)
          if (!filter || filter(resultPath)) {
            results.push(resultPath)
          }
        }

        // Recurse into directories
        if (isDir && recursive) {
          traverse(entryPath, depth + 1)
        }
      }
    }

    traverse(absolutePath, 0)
    return results
  }

  /**
   * Deletes a directory and all its contents recursively (async)
   *
   * @param path - Path to directory (can be absolute or relative)
   * @returns Promise that resolves when deletion completes
   *
   * @example
   * await pal.deleteRecursive(pal.configPath('temp'))
   */
  async deleteRecursive(path: string): Promise<void> {
    return this.rmdir(path, { recursive: true, force: true })
  }

  /**
   * Deletes a directory and all its contents recursively (sync)
   *
   * @param path - Path to directory (can be absolute or relative)
   *
   * @example
   * pal.deleteRecursiveSync(pal.configPath('temp'))
   */
  deleteRecursiveSync(path: string): void {
    this.rmdirSync(path, { recursive: true, force: true })
  }

  /**
   * Watches a file or directory for changes
   *
   * @param path - Path to watch (can be absolute or relative)
   * @param listener - Callback for file system events
   * @param options - Watch options
   * @returns FSWatcher instance
   *
   * @example
   * const watcher = pal.watch(pal.configPath('database.json'), (eventType, filename) => {
   *   console.log(`Config changed: ${eventType} ${filename}`)
   * })
   *
   * // Stop watching
   * watcher.close()
   */
  watch(
    path: string,
    listener: (eventType: 'rename' | 'change', filename: string | null) => void,
    options?: { persistent?: boolean; recursive?: boolean; encoding?: BufferEncoding },
  ): FSWatcher {
    const absolutePath = isAbsolute(path) ? path : this.makePath(path)
    this.#validateStrictMode(absolutePath)
    return fsWatchSync(absolutePath, options, listener)
  }

  // ===========================
  // Path Sanitization Methods
  // ===========================

  /**
   * Helper: List of Windows reserved filenames
   */
  #getWindowsReservedNames(): string[] {
    return [
      'CON',
      'PRN',
      'AUX',
      'NUL',
      'COM1',
      'COM2',
      'COM3',
      'COM4',
      'COM5',
      'COM6',
      'COM7',
      'COM8',
      'COM9',
      'LPT1',
      'LPT2',
      'LPT3',
      'LPT4',
      'LPT5',
      'LPT6',
      'LPT7',
      'LPT8',
      'LPT9',
    ]
  }

  /**
   * Helper: Split filename into name and extension
   */
  #splitFilename(filename: string): { name: string; ext: string } {
    if (!filename.includes('.')) {
      return { name: filename, ext: '' }
    }
    const lastDotIndex = filename.lastIndexOf('.')
    return {
      name: filename.slice(0, lastDotIndex),
      ext: filename.slice(lastDotIndex),
    }
  }

  /**
   * Helper: Clean a filename string
   */
  #cleanFilename(
    filename: string,
    replacement: string,
    allowDots: boolean,
    allowSpaces: boolean,
    removeZeroWidth: boolean,
    removeControlChars: boolean,
    normalizeUnicode: boolean,
  ): string {
    let sanitized = filename

    // Normalize Unicode to NFC form
    if (normalizeUnicode && typeof sanitized.normalize === 'function') {
      sanitized = sanitized.normalize('NFC')
    }

    // Remove zero-width characters
    if (removeZeroWidth) {
      sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '')
    }

    // Remove control characters
    if (removeControlChars) {
      // eslint-disable-next-line no-control-regex
      sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '')
    }

    // Remove or replace dangerous characters
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[<>:"|?*\\/\x00]/g, replacement)

    // Handle spaces
    if (!allowSpaces) {
      sanitized = sanitized.replace(/ /g, replacement)
    }

    // Handle dots
    if (!allowDots) {
      const parts = this.#splitFilename(sanitized)
      if (parts.ext) {
        sanitized = parts.name.replace(/\./g, replacement) + parts.ext
      } else {
        sanitized = sanitized.replace(/\./g, replacement)
      }
    }

    // Remove leading/trailing dots and spaces
    sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '')

    return sanitized || 'unnamed'
  }

  /**
   * Helper: Handle Windows reserved filenames
   */
  #handleReservedNames(filename: string, replacement: string): string {
    const reserved = this.#getWindowsReservedNames()
    const parts = this.#splitFilename(filename)

    if (reserved.includes(parts.name.toUpperCase())) {
      return parts.name + replacement + parts.ext
    }

    return filename
  }

  /**
   * Helper: Truncate filename to max length
   */
  #truncateFilename(filename: string, maxLength: number, preserveExtension: boolean): string {
    if (filename.length <= maxLength) {
      return filename
    }

    const parts = this.#splitFilename(filename)

    if (preserveExtension && parts.ext) {
      const maxNameLength = maxLength - parts.ext.length
      if (maxNameLength > 0) {
        return parts.name.slice(0, maxNameLength) + parts.ext
      }
    }

    return filename.slice(0, maxLength)
  }

  /**
   * Sanitizes a filename by removing or replacing dangerous characters
   *
   * @param filename - Filename to sanitize
   * @param options - Sanitization options
   * @returns Sanitized filename
   *
   * @example
   * pal.sanitizeFilename('../../etc/passwd') // => 'etc_passwd'
   * pal.sanitizeFilename('file<>:"|?*.txt') // => 'file_______.txt'
   * pal.sanitizeFilename('CON.txt') // => 'CON_.txt' (Windows reserved)
   */
  sanitizeFilename(filename: string, options: SanitizeOptions = {}): string {
    const {
      replacement = '_',
      maxLength = 255,
      preserveExtension = true,
      allowDots = true,
      allowSpaces = true,
      removeZeroWidth = true,
      removeControlChars = true,
      normalizeUnicode = true,
    } = options

    let sanitized = this.#cleanFilename(
      filename,
      replacement,
      allowDots,
      allowSpaces,
      removeZeroWidth,
      removeControlChars,
      normalizeUnicode,
    )

    sanitized = this.#handleReservedNames(sanitized, replacement)
    sanitized = this.#truncateFilename(sanitized, maxLength, preserveExtension)

    return sanitized
  }

  /**
   * Sanitizes a full path by sanitizing each segment
   *
   * @param path - Path to sanitize
   * @param options - Sanitization options
   * @returns Sanitized path
   *
   * @example
   * pal.sanitizePath('uploads/../../etc/passwd')
   * // => 'uploads/etc_passwd'
   *
   * pal.sanitizePath('data/<script>/file.txt')
   * // => 'data/_script_/file.txt'
   */
  sanitizePath(path: string, options: SanitizeOptions = {}): string {
    // Split path into segments
    const segments = path.split(/[/\\]/).filter((seg) => seg.length > 0)

    // Remove path traversal segments (..)
    const cleanedSegments = segments.filter((seg) => seg !== '..')

    // Sanitize each segment
    const sanitizedSegments = cleanedSegments.map((segment) =>
      this.sanitizeFilename(segment, options),
    )

    // Join back with forward slashes
    return sanitizedSegments.join('/')
  }

  // ===========================
  // Glob Pattern Matching Methods
  // ===========================

  /**
   * Finds files matching a glob pattern
   *
   * @param pattern - Glob pattern (e.g., '*.json', '**\/*.ts')
   * @param options - Glob options
   * @returns Promise resolving to array of matching file paths
   *
   * @example
   * // Find all JSON files
   * const configs = await pal.glob('*.json')
   *
   * // Find all TypeScript files recursively
   * const tsFiles = await pal.glob('**\/*.ts')
   *
   * // Find with ignore patterns
   * const files = await pal.glob('src/**\/*.ts', {
   *   ignore: ['**\/*.test.ts', 'node_modules/**']
   * })
   *
   * // Find in specific directory
   * const configFiles = await pal.glob('*.json', { cwd: 'config' })
   */
  async glob(pattern: string, options: GlobOptions = {}): Promise<string[]> {
    const {
      cwd = this.appRootPath,
      absolute = true,
      filesOnly = true,
      matchBase = false,
      ignore = [],
      caseSensitive = process.platform !== 'win32',
      followSymlinks = false,
      maxDepth = Infinity,
      dot = false,
    } = options

    // Resolve base directory
    const baseDir = isAbsolute(cwd) ? cwd : this.makePath(cwd)
    this.#validateStrictMode(baseDir)

    // Parse pattern
    const matcher = new GlobMatcher(pattern, { caseSensitive, matchBase })
    const ignoreMatchers = (Array.isArray(ignore) ? ignore : [ignore])
      .filter((p) => p)
      .map((p) => new GlobMatcher(p, { caseSensitive }))

    // Determine if we need to recurse based on pattern
    const needsRecursion = pattern.includes('**') || pattern.includes('/')

    // List all files
    const allFiles = await this.listFiles(baseDir, {
      recursive: needsRecursion,
      absolute: true,
      filesOnly,
      followSymlinks,
      maxDepth,
    })

    // Filter by pattern and ignore patterns
    const matchedFiles = allFiles.filter((filePath) => {
      // Get relative path from base directory
      const relativePath = relative(baseDir, filePath).replace(/\\/g, '/')

      // Skip hidden files if dot=false
      if (!dot) {
        const pathParts = relativePath.split('/')
        if (pathParts.some((part) => part.startsWith('.'))) {
          return false
        }
      }

      // Check if matches pattern
      if (!matcher.matches(relativePath)) {
        return false
      }

      // Check if matches any ignore pattern
      if (ignoreMatchers.some((m) => m.matches(relativePath))) {
        return false
      }

      // Validate within root in strict mode
      if (this.#strict && !this.isWithinRoot(filePath)) {
        return false
      }

      return true
    })

    // Return absolute or relative paths
    return absolute ? matchedFiles : matchedFiles.map((f) => relative(baseDir, f))
  }

  /**
   * Synchronous version of glob()
   *
   * @param pattern - Glob pattern
   * @param options - Glob options
   * @returns Array of matching file paths
   *
   * @example
   * const configs = pal.globSync('*.json')
   * const tsFiles = pal.globSync('**\/*.ts', { cwd: 'src' })
   */
  globSync(pattern: string, options: GlobOptions = {}): string[] {
    const {
      cwd = this.appRootPath,
      absolute = true,
      filesOnly = true,
      matchBase = false,
      ignore = [],
      caseSensitive = process.platform !== 'win32',
      followSymlinks = false,
      maxDepth = Infinity,
      dot = false,
    } = options

    // Resolve base directory
    const baseDir = isAbsolute(cwd) ? cwd : this.makePath(cwd)
    this.#validateStrictMode(baseDir)

    // Parse pattern
    const matcher = new GlobMatcher(pattern, { caseSensitive, matchBase })
    const ignoreMatchers = (Array.isArray(ignore) ? ignore : [ignore])
      .filter((p) => p)
      .map((p) => new GlobMatcher(p, { caseSensitive }))

    // Determine if we need to recurse based on pattern
    const needsRecursion = pattern.includes('**') || pattern.includes('/')

    // List all files
    const allFiles = this.listFilesSync(baseDir, {
      recursive: needsRecursion,
      absolute: true,
      filesOnly,
      followSymlinks,
      maxDepth,
    })

    // Filter by pattern and ignore patterns
    const matchedFiles = allFiles.filter((filePath) => {
      // Get relative path from base directory
      const relativePath = relative(baseDir, filePath).replace(/\\/g, '/')

      // Skip hidden files if dot=false
      if (!dot) {
        const pathParts = relativePath.split('/')
        if (pathParts.some((part) => part.startsWith('.'))) {
          return false
        }
      }

      // Check if matches pattern
      if (!matcher.matches(relativePath)) {
        return false
      }

      // Check if matches any ignore pattern
      if (ignoreMatchers.some((m) => m.matches(relativePath))) {
        return false
      }

      // Validate within root in strict mode
      if (this.#strict && !this.isWithinRoot(filePath)) {
        return false
      }

      return true
    })

    // Return absolute or relative paths
    return absolute ? matchedFiles : matchedFiles.map((f) => relative(baseDir, f))
  }

  // ===========================
  // Cache Management Methods
  // ===========================

  /**
   * Clears the path cache
   *
   * @param directory - Optional directory name to clear cache for specific directory only
   *
   * @example
   * pal.clearCache()           // Clear all cached paths
   * pal.clearCache('logs')     // Clear cache for logs directory only
   */
  clearCache(directory?: string): void {
    if (!this.#cache) {
      return
    }

    if (directory) {
      // Clear cache entries that start with this directory
      const dirPath = this.#directories[directory as keyof T]
      if (dirPath) {
        // Iterate through cache and delete matching entries
        const keys = this.#cache.keys()
        for (const key of keys) {
          if (key.startsWith(dirPath)) {
            this.#cache.delete(key)
          }
        }
      }
    } else {
      // Clear entire cache
      this.#cache.clear()
    }
  }

  /**
   * Gets cache statistics
   *
   * @returns Cache performance statistics
   *
   * @example
   * const stats = pal.getCacheStats()
   * console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`)
   */
  getCacheStats(): CacheStats {
    if (!this.#cache) {
      return {
        hits: 0,
        misses: 0,
        size: 0,
        maxSize: this.#cacheConfig.maxSize!,
        hitRate: 0,
        evictions: 0,
      }
    }

    return this.#cache.getStats()
  }

  /**
   * Gets the current cache size
   *
   * @returns Number of cached entries
   *
   * @example
   * console.log(`Cache has ${pal.getCacheSize()} entries`)
   */
  getCacheSize(): number {
    return this.#cache?.size ?? 0
  }

  /**
   * Checks if a specific path is cached
   *
   * @param directory - Directory name
   * @param paths - Path segments
   * @returns True if the path is in cache
   *
   * @example
   * if (pal.isCached('logs', 'app.log')) {
   *   console.log('Path is cached')
   * }
   */
  isCached(directory: string, ...paths: string[]): boolean {
    if (!this.#cache) {
      return false
    }

    const dirPath = this.#directories[directory as keyof T]
    if (!dirPath) {
      return false
    }

    const cacheKey = [dirPath, ...paths].join('/')
    return this.#cache.has(cacheKey)
  }

  /**
   * Gets memory usage information
   *
   * @returns Memory usage statistics
   *
   * @example
   * const usage = pal.getMemoryUsage()
   * console.log(`Using ~${(usage.estimatedBytes / 1024).toFixed(2)} KB`)
   */
  getMemoryUsage(): MemoryUsage {
    const directories = Object.keys(this.#directories)
    const helpersPerDir = 17 // Each directory gets 17 helper methods
    const helperCount = directories.length * helpersPerDir
    const cacheSize = this.#cache?.size ?? 0

    // Rough estimation
    const estimatedBytes
      = helperCount * 64 // Function objects
        + cacheSize * 100 // Cached paths
        + JSON.stringify(this.toJSON()).length // Config

    return {
      helperCount,
      cacheSize,
      estimatedBytes,
    }
  }

  // ===========================
  // Batch Operations
  // ===========================

  /**
   * Resolves multiple paths in a single operation
   *
   * @param requests - Array of path requests [directory, ...paths]
   * @returns Array of resolved absolute paths
   *
   * @example
   * const paths = pal.resolvePaths([
   *   ['logs', 'app.log'],
   *   ['config', 'database.json'],
   *   ['models', 'User.js']
   * ])
   * // => ['/project/logs/app.log', '/project/config/database.json', '/project/app/models/User.js']
   */
  resolvePaths(requests: Array<[string, ...string[]]>): string[] {
    return requests.map(([dir, ...paths]) => {
      const dirPath = this.#directories[dir as keyof T]
      if (dirPath) {
        return this.makePath(dirPath, ...paths)
      }
      // If directory not found, treat first element as a path segment
      return this.makePath(dir, ...paths)
    })
  }

  /**
   * Checks existence of multiple paths in parallel
   *
   * @param requests - Array of path requests [directory, ...paths]
   * @returns Promise resolving to array of boolean existence results
   *
   * @example
   * const results = await pal.existsBatch([
   *   ['logs', 'app.log'],
   *   ['config', 'database.json']
   * ])
   * // => [true, false]
   */
  async existsBatch(requests: Array<[string, ...string[]]>): Promise<boolean[]> {
    const paths = this.resolvePaths(requests)
    return Promise.all(paths.map((path) => this.exists(path)))
  }

  /**
   * Performs multiple operations in parallel
   *
   * @param requests - Array of operation requests
   * @returns Promise resolving to array of operation results
   *
   * @example
   * const results = await pal.batch([
   *   { op: 'path', dir: 'logs', paths: ['app.log'] },
   *   { op: 'exists', dir: 'config', paths: ['database.json'] },
   *   { op: 'isFile', dir: 'models', paths: ['User.js'] }
   * ])
   * // => ['/project/logs/app.log', false, true]
   */
  async batch(requests: BatchOperationRequest[]): Promise<unknown[]> {
    const promises = requests.map(async (req) => {
      const dirPath = this.#directories[req.dir as keyof T]
      if (!dirPath) {
        throw new Error(`Directory "${req.dir}" not found in configuration`)
      }

      const path = this.makePath(dirPath, ...req.paths)

      switch (req.op) {
        case 'path':
          return path
        case 'exists':
          return this.exists(path)
        case 'isFile':
          return this.isFile(path)
        case 'isDirectory':
          return this.isDirectory(path)
        case 'read':
          return req.encoding ? this.readFile(path, req.encoding) : this.readFile(path)
        default:
          throw new Error(`Unknown operation: ${req.op}`)
      }
    })

    return Promise.all(promises)
  }

  /**
   * Reads multiple files in parallel
   *
   * @param requests - Array of file path requests [directory, ...paths]
   * @param encoding - Optional encoding for text files
   * @returns Promise resolving to array of file contents
   *
   * @example
   * const contents = await pal.readBatch([
   *   ['config', 'database.json'],
   *   ['config', 'app.json']
   * ], 'utf-8')
   * // => ['{"host":"localhost"}', '{"name":"myapp"}']
   */
  async readBatch(
    requests: Array<[string, ...string[]]>,
    encoding?: BufferEncoding,
  ): Promise<Array<string | Buffer>> {
    const paths = this.resolvePaths(requests)
    return Promise.all(
      paths.map((path) => (encoding ? this.readFile(path, encoding) : this.readFile(path))),
    )
  }

  // ===========================
  // Template Methods
  // ===========================

  /**
   * Renders a template string
   *
   * @param template - Template string with ${var} syntax
   * @param vars - Optional variables to pass to templates
   * @returns Rendered string
   *
   * @example
   * pal.renderTemplate('${date}/app.log')
   * // => '2024-01-14/app.log'
   */
  renderTemplate(template: string, vars: Record<string, unknown> = {}): string {
    return template.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const trimmedName = varName.trim()
      const templateFn = this.#templates.get(trimmedName)

      if (!templateFn) {
        throw new Error(`Template "${trimmedName}" not found`)
      }

      const result = templateFn(vars[trimmedName])
      if (typeof result !== 'string') {
        throw new Error(`Template "${trimmedName}" returned non-string value`)
      }

      return result
    })
  }

  /**
   * Registers a template function
   *
   * @param name - Template name
   * @param fn - Template function
   *
   * @example
   * pal.registerTemplate('date', () => new Date().toISOString().split('T')[0])
   */
  registerTemplate(name: string, fn: TemplateFunction): void {
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
      throw new Error(`Invalid template name "${name}": must be a valid JavaScript identifier`)
    }
    this.#templates.set(name, fn)
  }

  /**
   * Unregisters a template function
   *
   * @param name - Template name
   */
  unregisterTemplate(name: string): void {
    this.#templates.delete(name)
  }

  /**
   * Gets all registered template names
   *
   * @returns Array of template names
   */
  getTemplates(): string[] {
    return Array.from(this.#templates.keys())
  }

  // ===========================
  // Pattern Methods
  // ===========================

  /**
   * Executes a pattern function
   *
   * @param name - Pattern name
   * @param args - Arguments to pass to pattern function
   * @returns Pattern result
   *
   * @example
   * pal.pattern('date')
   * // => '2024-01-14'
   */
  pattern(name: string, ...args: unknown[]): string {
    const patternFn = this.#patterns.get(name)

    if (!patternFn) {
      throw new Error(`Pattern "${name}" not found`)
    }

    const result = patternFn(...args)
    if (typeof result !== 'string') {
      throw new Error(`Pattern "${name}" returned non-string value`)
    }

    return result
  }

  /**
   * Registers a pattern function
   *
   * @param name - Pattern name
   * @param fn - Pattern function
   *
   * @example
   * pal.registerPattern('daily', () => new Date().toISOString().split('T')[0])
   */
  registerPattern(name: string, fn: PatternFunction): void {
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
      throw new Error(`Invalid pattern name "${name}": must be a valid JavaScript identifier`)
    }
    this.#patterns.set(name, fn)
  }

  /**
   * Unregisters a pattern function
   *
   * @param name - Pattern name
   */
  unregisterPattern(name: string): void {
    this.#patterns.delete(name)
  }

  /**
   * Gets all registered pattern names
   *
   * @returns Array of pattern names
   */
  getPatterns(): string[] {
    return Array.from(this.#patterns.keys())
  }

  /**
   * Checks if a pattern exists
   *
   * @param name - Pattern name
   * @returns True if pattern exists
   */
  hasPattern(name: string): boolean {
    return this.#patterns.has(name)
  }

  // ===========================
  // Temporary Directory Methods
  // ===========================

  /**
   * Creates a temporary PathPal instance in a unique temp directory
   *
   * @param options - Options for temp directory creation
   * @returns A PathPal instance with temp root and cleanup capability
   *
   * @example
   * const temp = await pal.createTemp({
   *   prefix: 'mytest-',
   *   fixtures: { 'config/db.json': '{"host":"localhost"}' }
   * })
   * // ... use temp
   * await temp.cleanup()
   */
  async createTemp(options: TempOptions = {}): Promise<TempPathPal<T>> {
    const { prefix = 'pathpal-', createDirs = true, fixtures = {} } = options

    // Create unique temporary directory
    const tempRoot = await mkdtemp(join(tmpdir(), prefix))

    // Create temp PathPal instance with same config but different root
    const tempPal = new PathPalBase<T>({
      root: tempRoot,
      directories: this.#directories,
      strict: this.#strict,
    })

    // Track cleanup state
    let isCleanedUp = false

    // Create configured directories if requested
    if (createDirs) {
      for (const dirPath of Object.values(this.#directories)) {
        const fullPath = join(tempRoot, dirPath)
        await fsMkdir(fullPath, { recursive: true })
      }
    }

    // Create fixture files
    for (const [relativePath, content] of Object.entries(fixtures)) {
      const fullPath = join(tempRoot, relativePath)
      const dir = dirname(fullPath)
      await fsMkdir(dir, { recursive: true })
      await fsWriteFile(fullPath, content)
    }

    // Add temp-specific properties and methods
    const cleanup = async (): Promise<void> => {
      if (isCleanedUp) {
        return
      }
      await fsRm(tempRoot, { recursive: true, force: true })
      isCleanedUp = true
    }

    // Define temp-specific properties using Object.defineProperty for getter
    Object.defineProperty(tempPal, 'tempRoot', {
      value: tempRoot,
      writable: false,
      enumerable: true,
      configurable: false,
    })

    Object.defineProperty(tempPal, 'isCleanedUp', {
      get() {
        return isCleanedUp
      },
      enumerable: true,
      configurable: false,
    })

    Object.defineProperty(tempPal, 'cleanup', {
      value: cleanup,
      writable: false,
      enumerable: true,
      configurable: false,
    })

    // Return PathPal instance with additional temp properties
    return tempPal as TempPathPal<T>
  }

  /**
   * Creates a temporary PathPal instance and automatically cleans it up
   *
   * @param callback - Function to execute with temp PathPal instance
   * @param options - Options for temp directory creation
   * @returns Result of callback function
   *
   * @example
   * const result = await pal.withTemp(async (temp) => {
   *   await temp.writeFile(temp.configPath('test.json'), '{}')
   *   return temp.configPath('test.json')
   * })
   * // temp directory automatically cleaned up
   */
  async withTemp<R>(
    callback: (temp: TempPathPal<T>) => Promise<R>,
    options?: TempOptions,
  ): Promise<R> {
    const temp = await this.createTemp(options)
    try {
      return await callback(temp)
    } finally {
      await temp.cleanup()
    }
  }
}

/**
 * PathPal with typed directory helpers
 */
export type PathPal<T extends Record<string, string> = Record<string, string>> = PathPalBase<T>
  & DirectoryHelpers<T>

/**
 * Factory function to create a PathPal instance
 *
 * @param config - Configuration options
 * @returns A new PathPal instance with dynamically generated path helpers
 *
 * @example
 * import { createPathPal } from 'pathpal'
 *
 * const pal = createPathPal({
 *   root: process.cwd(),
 *   directories: {
 *     config: 'config',
 *     models: 'app/models',
 *     public: 'public',
 *     views: 'resources/views'
 *   }
 * })
 *
 * // Use the generated helpers
 * pal.configPath('database.js')  // /project/config/database.js
 * pal.modelsPath('User.js')      // /project/app/models/User.js
 * pal.publicPath('styles.css')   // /project/public/styles.css
 *
 * // Or use the generic makePath
 * pal.makePath('custom/path')    // /project/custom/path
 */
export function createPathPal<
  T extends Record<string, string> = Record<string, string>,
>(config: PathPalConfig<T>): PathPal<T> {
  return new PathPalBase(config) as PathPal<T>
}

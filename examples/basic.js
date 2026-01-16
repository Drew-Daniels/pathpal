/**
 * Basic PathPal usage example
 *
 * Run: node examples/basic.js
 */

import { createPathPal } from '../dist/index.js'

// Create a PathPal instance with nested directory structure
const paths = createPathPal({
  root: new URL('..', import.meta.url),
  directories: {
    src: 'src',
    config: 'config',
    models: 'src/models',
    services: 'src/services',
    uploads: 'storage/uploads',
    logs: 'storage/logs',
    cache: 'storage/cache',
  },
})

console.log('=== Basic Path Generation ===\n')

// Simple paths
console.log('Root path:', paths.appRootPath)
console.log('Source:', paths.srcPath())
console.log('Config:', paths.configPath())

console.log('\n=== Nested Paths ===\n')

// Nested paths - multiple ways to express the same thing
console.log('Models dir:', paths.modelsPath())
console.log('User model:', paths.modelsPath('User.ts'))
console.log('Nested model:', paths.modelsPath('auth/Session.ts'))

// These are equivalent:
console.log('\nEquivalent path expressions:')
console.log('  Separate args:', paths.srcPath('models', 'User.ts'))
console.log('  Single string:', paths.srcPath('models/User.ts'))
console.log('  Using helper:', paths.modelsPath('User.ts'))

console.log('\n=== Deep Nesting ===\n')

// Deep nesting
console.log('Deep path:', paths.uploadsPath('users', '123', 'avatars', 'profile.png'))
console.log('Log file:', paths.logsPath('2024', '01', '15', 'app.log'))

console.log('\n=== Utility Methods ===\n')

// Check if paths are within root
console.log('Is within root (relative):', paths.isWithinRoot('src/index.ts'))
console.log('Is within root (absolute):', paths.isWithinRoot(paths.srcPath('index.ts')))
console.log('Is within root (outside):', paths.isWithinRoot('/etc/passwd'))

// Get relative path
const absolutePath = paths.configPath('database.json')
console.log('\nAbsolute:', absolutePath)
console.log('Relative:', paths.relativePath(absolutePath))

// List all configured directories
console.log('\nConfigured directories:', paths.getDirectories())

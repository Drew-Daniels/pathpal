/**
 * File operations example with nested directories
 *
 * Run: node examples/file-operations.js
 *
 * This example creates a temporary directory structure and demonstrates
 * PathPal's file operation capabilities.
 */

import { createPathPal } from '../dist/index.js'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function main() {
  // Create a temporary directory for our example
  const tempDir = await mkdtemp(join(tmpdir(), 'pathpal-example-'))
  console.log('Working in:', tempDir, '\n')

  // Create PathPal instance with nested structure
  const paths = createPathPal({
    root: tempDir,
    directories: {
      config: 'config',
      configEnv: 'config/environments',
      data: 'data',
      dataUsers: 'data/users',
      dataProducts: 'data/products',
      logs: 'logs',
      logsApp: 'logs/app',
      logsError: 'logs/error',
    },
  })

  try {
    // ========================================
    // Creating nested directory structures
    // ========================================
    console.log('=== Creating Directories ===\n')

    // Ensure directories exist (creates parent directories automatically)
    await paths.configEnvPathEnsure()
    await paths.dataUsersPathEnsure()
    await paths.dataProductsPathEnsure()
    await paths.logsAppPathEnsure()
    await paths.logsErrorPathEnsure()

    console.log('Created directory structure:')
    console.log('  config/environments/')
    console.log('  data/users/')
    console.log('  data/products/')
    console.log('  logs/app/')
    console.log('  logs/error/')

    // ========================================
    // Writing files to nested directories
    // ========================================
    console.log('\n=== Writing Files ===\n')

    // Config files
    await paths.configPathWrite('app.json', JSON.stringify({
      name: 'my-app',
      version: '1.0.0',
    }, null, 2))

    await paths.configEnvPathWrite('development.json', JSON.stringify({
      debug: true,
      database: 'localhost',
    }, null, 2))

    await paths.configEnvPathWrite('production.json', JSON.stringify({
      debug: false,
      database: 'prod.example.com',
    }, null, 2))

    // Data files in nested user directories
    await paths.dataUsersPathEnsure('123')
    await paths.dataUsersPathWrite('123/profile.json', JSON.stringify({
      id: 123,
      name: 'Alice',
      email: 'alice@example.com',
    }, null, 2))

    await paths.dataUsersPathEnsure('456')
    await paths.dataUsersPathWrite('456/profile.json', JSON.stringify({
      id: 456,
      name: 'Bob',
      email: 'bob@example.com',
    }, null, 2))

    // Products
    await paths.dataProductsPathWrite('widget.json', JSON.stringify({
      sku: 'WIDGET-001',
      price: 29.99,
    }, null, 2))

    // Log files
    const timestamp = new Date().toISOString()
    await paths.logsAppPathWrite('app.log', `[${timestamp}] Application started\n`)
    await paths.logsErrorPathWrite('error.log', `[${timestamp}] No errors yet!\n`)

    console.log('Created files in nested directories')

    // ========================================
    // Reading files
    // ========================================
    console.log('\n=== Reading Files ===\n')

    const appConfig = await paths.configPathRead('app.json', 'utf-8')
    console.log('App config:', JSON.parse(appConfig))

    const userProfile = await paths.dataUsersPathRead('123/profile.json', 'utf-8')
    console.log('User 123:', JSON.parse(userProfile))

    // ========================================
    // Listing files recursively
    // ========================================
    console.log('\n=== Listing Files ===\n')

    // List all config files
    const configFiles = await paths.configPathListFiles('', { recursive: true })
    console.log('Config files:')
    configFiles.forEach(f => console.log(' ', paths.relativePath(f)))

    // List all data files
    const dataFiles = await paths.dataPathListFiles('', { recursive: true })
    console.log('\nData files:')
    dataFiles.forEach(f => console.log(' ', paths.relativePath(f)))

    // List with filter
    console.log('\nOnly JSON files in data/:')
    const jsonFiles = await paths.dataPathListFiles('', {
      recursive: true,
      filter: (path) => path.endsWith('.json'),
    })
    jsonFiles.forEach(f => console.log(' ', paths.relativePath(f)))

    // ========================================
    // Glob patterns
    // ========================================
    console.log('\n=== Glob Patterns ===\n')

    // Find all JSON files anywhere
    const allJson = await paths.glob('**/*.json')
    console.log('All JSON files:')
    allJson.forEach(f => console.log(' ', paths.relativePath(f)))

    // Find all files in config/
    const configGlob = await paths.configPathGlob('**/*')
    console.log('\nAll files in config/:')
    configGlob.forEach(f => console.log(' ', paths.relativePath(f)))

    // ========================================
    // Cleanup example
    // ========================================
    console.log('\n=== Cleanup ===\n')

    // Delete a nested directory
    await paths.dataUsersPathDeleteRecursive('456')
    console.log('Deleted data/users/456/')

    const remainingUsers = await paths.dataUsersPathListFiles('', { recursive: true })
    console.log('Remaining user files:')
    remainingUsers.forEach(f => console.log(' ', paths.relativePath(f)))

  } finally {
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true })
    console.log('\nCleaned up temp directory')
  }
}

main().catch(console.error)

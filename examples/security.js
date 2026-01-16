/**
 * Security features example
 *
 * Run: node examples/security.js
 *
 * This example demonstrates PathPal's security features:
 * - Safe mode to prevent path traversal
 * - Filename sanitization for user uploads
 */

import { createPathPal } from '../dist/index.js'

console.log('=== Safe Mode (Enabled by Default) ===\n')

// Safe mode is enabled by default
const strictPaths = createPathPal({
  root: '/var/www/myapp',
  directories: {
    uploads: 'storage/uploads',
    config: 'config',
  },
  // safe: true (this is the default)
})

// Demonstrate path traversal prevention
const maliciousInputs = [
  ['..', 'etc', 'passwd'],
  ['../../../etc/passwd'],
  ['/etc/passwd'],
  ['uploads', '..', '..', 'config', 'secrets.json'],
]

console.log('Attempting path traversal attacks:\n')

for (const input of maliciousInputs) {
  try {
    const result = strictPaths.makePath(...input)
    console.log(`  INPUT: ${JSON.stringify(input)}`)
    console.log(`  RESULT: ${result}`)
    console.log(`  STATUS: ALLOWED (unexpected!)\n`)
  } catch (error) {
    console.log(`  INPUT: ${JSON.stringify(input)}`)
    console.log(`  ERROR: ${error.message}`)
    console.log(`  STATUS: BLOCKED\n`)
  }
}

// Safe paths work fine
console.log('Safe paths work normally:')
console.log('  ', strictPaths.uploadsPath('images', 'avatar.png'))
console.log('  ', strictPaths.configPath('app.json'))

console.log('\n=== Filename Sanitization ===\n')

const paths = createPathPal({
  root: '/var/www/myapp',
  directories: {
    uploads: 'storage/uploads',
  },
})

// Dangerous filenames that users might try to upload
const dangerousFilenames = [
  '../../../etc/passwd',
  '..\\..\\..\\windows\\system32\\config',
  'file<script>alert(1)</script>.txt',
  'file:with:colons.txt',
  'file|with|pipes.txt',
  'CON.txt',           // Windows reserved name
  'PRN.txt',           // Windows reserved name
  'file\x00.txt',      // Null byte injection
  '   spaces   .txt',  // Leading/trailing spaces
  '...dots....txt',    // Multiple dots
  '\u200Bhidden\u200B.txt', // Zero-width characters
]

console.log('Sanitizing dangerous filenames:\n')

for (const filename of dangerousFilenames) {
  const safe = paths.sanitizeFilename(filename)
  const displayOriginal = JSON.stringify(filename)
  console.log(`  ${displayOriginal.padEnd(45)} => "${safe}"`)
}

console.log('\n=== Path Sanitization ===\n')

// Sanitize entire paths (each segment)
const dangerousPaths = [
  'uploads/../../../etc/passwd',
  'users/<script>/profile.jpg',
  'data\\windows\\style\\path',
  'files//double//slashes//here',
]

console.log('Sanitizing dangerous paths:\n')

for (const path of dangerousPaths) {
  const safe = paths.sanitizePath(path)
  console.log(`  "${path}"`)
  console.log(`    => "${safe}"\n`)
}

console.log('=== Safe Upload Handling Pattern ===\n')

// Example of safely handling user uploads
function handleUpload(userId, userProvidedFilename) {
  // 1. Sanitize the filename
  const safeFilename = paths.sanitizeFilename(userProvidedFilename, {
    maxLength: 100,
    allowSpaces: false,
  })

  // 2. Build safe path using PathPal
  const uploadPath = paths.uploadsPath('users', String(userId), safeFilename)

  // 3. Verify it's still within bounds (defense in depth)
  if (!paths.isWithinRoot(uploadPath)) {
    throw new Error('Invalid upload path')
  }

  return uploadPath
}

// Test the pattern
const testUploads = [
  { userId: 123, filename: 'my-photo.jpg' },
  { userId: 456, filename: '../../../etc/passwd' },
  { userId: 789, filename: 'report<script>.pdf' },
]

console.log('Handling user uploads safely:\n')

for (const { userId, filename } of testUploads) {
  const safePath = handleUpload(userId, filename)
  console.log(`  User ${userId} uploading "${filename}"`)
  console.log(`    Safe path: ${safePath}\n`)
}

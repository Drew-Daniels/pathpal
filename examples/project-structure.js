/**
 * Real-world project structure example
 *
 * Run: node examples/project-structure.js
 *
 * This example shows how PathPal can be used to manage a typical
 * web application's directory structure.
 */

import { createPathPal } from '../dist/index.js'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), 'pathpal-project-'))
  console.log('Simulating project at:', tempDir, '\n')

  // A typical web application structure
  const paths = createPathPal({
    root: tempDir,
    directories: {
      // Source code
      src: 'src',
      controllers: 'src/controllers',
      models: 'src/models',
      services: 'src/services',
      middleware: 'src/middleware',
      utils: 'src/utils',

      // Configuration
      config: 'config',

      // Static assets
      public: 'public',
      assets: 'public/assets',
      css: 'public/assets/css',
      js: 'public/assets/js',
      images: 'public/assets/images',

      // Views/templates
      views: 'views',
      layouts: 'views/layouts',
      partials: 'views/partials',

      // Storage
      storage: 'storage',
      uploads: 'storage/uploads',
      cache: 'storage/cache',
      logs: 'storage/logs',

      // Tests
      tests: 'tests',
      testUnit: 'tests/unit',
      testIntegration: 'tests/integration',
      testFixtures: 'tests/fixtures',
    },
    // safe: true (enabled by default)
    cache: true,  // Enable caching for performance
  })

  try {
    // ========================================
    // Initialize project structure
    // ========================================
    console.log('=== Initializing Project Structure ===\n')

    // Create all directories
    const dirs = paths.getDirectories()
    for (const dir of dirs) {
      const helperName = dir.endsWith('Path') ? dir : `${dir}Path`
      const ensureMethod = paths[`${helperName}Ensure`]
      if (ensureMethod) {
        await ensureMethod()
      }
    }
    console.log(`Created ${dirs.length} directories\n`)

    // ========================================
    // Simulate a typical workflow
    // ========================================
    console.log('=== Simulating Development Workflow ===\n')

    // 1. Create configuration
    console.log('1. Setting up configuration...')
    await paths.configPathWrite('app.json', JSON.stringify({
      name: 'my-web-app',
      port: 3000,
      env: 'development',
    }, null, 2))

    await paths.configPathWrite('database.json', JSON.stringify({
      host: 'localhost',
      port: 5432,
      name: 'myapp_dev',
    }, null, 2))

    // 2. Create source files
    console.log('2. Creating source files...')

    await paths.controllersPathWrite('UserController.js', `
export class UserController {
  async index(req, res) {
    // List users
  }

  async show(req, res) {
    // Show single user
  }
}
`.trim())

    await paths.modelsPathWrite('User.js', `
export class User {
  constructor(id, name, email) {
    this.id = id
    this.name = name
    this.email = email
  }
}
`.trim())

    await paths.servicesPathWrite('EmailService.js', `
export class EmailService {
  async send(to, subject, body) {
    console.log(\`Sending email to \${to}\`)
  }
}
`.trim())

    // 3. Create views
    console.log('3. Creating views...')

    await paths.layoutsPathWrite('main.html', `
<!DOCTYPE html>
<html>
<head>
  <title>{{title}}</title>
  <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body>
  {{content}}
  <script src="/assets/js/app.js"></script>
</body>
</html>
`.trim())

    await paths.viewsPathEnsure('users')
    await paths.viewsPathWrite('users/index.html', `
<h1>Users</h1>
<ul>
{{#each users}}
  <li>{{name}}</li>
{{/each}}
</ul>
`.trim())

    await paths.partialsPathWrite('header.html', '<header>My App</header>')
    await paths.partialsPathWrite('footer.html', '<footer>&copy; 2024</footer>')

    // 4. Create static assets
    console.log('4. Creating static assets...')

    await paths.cssPathWrite('app.css', `
body { font-family: sans-serif; }
.container { max-width: 1200px; margin: 0 auto; }
`)

    await paths.jsPathWrite('app.js', `
console.log('App loaded')
`)

    // 5. Create test files
    console.log('5. Creating test files...')

    await paths.testUnitPathWrite('User.test.js', `
import { User } from '../../src/models/User.js'

describe('User', () => {
  it('should create a user', () => {
    const user = new User(1, 'Alice', 'alice@example.com')
    expect(user.name).toBe('Alice')
  })
})
`)

    await paths.testFixturesPathWrite('users.json', JSON.stringify([
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
    ], null, 2))

    // ========================================
    // Demonstrate path usage patterns
    // ========================================
    console.log('\n=== Path Usage Patterns ===\n')

    // Loading config
    console.log('Loading configuration:')
    const appConfig = JSON.parse(await paths.configPathRead('app.json', 'utf-8'))
    console.log(`  App: ${appConfig.name} on port ${appConfig.port}`)

    // Resolving view paths (like a template engine would)
    console.log('\nResolving view paths:')
    console.log('  Layout:', paths.layoutsPath('main.html'))
    console.log('  View:', paths.viewsPath('users/index.html'))
    console.log('  Partial:', paths.partialsPath('header.html'))

    // Static file serving (like Express static middleware)
    console.log('\nStatic file paths:')
    console.log('  CSS:', paths.cssPath('app.css'))
    console.log('  JS:', paths.jsPath('app.js'))

    // Upload handling
    console.log('\nUpload path for user 123:')
    await paths.uploadsPathEnsure('users/123/documents')
    console.log('  ', paths.uploadsPath('users/123/documents/report.pdf'))

    // Log file rotation
    console.log('\nLog file paths:')
    const today = new Date().toISOString().split('T')[0]
    await paths.logsPathEnsure(today)
    console.log('  ', paths.logsPath(today, 'app.log'))
    console.log('  ', paths.logsPath(today, 'error.log'))

    // ========================================
    // Show final structure
    // ========================================
    console.log('\n=== Final Project Structure ===\n')

    const allFiles = await paths.glob('**/*', { absolute: false })
    allFiles.sort().forEach(f => console.log(' ', f))

    console.log(`\nTotal: ${allFiles.length} files`)

  } finally {
    await rm(tempDir, { recursive: true, force: true })
    console.log('\nCleaned up')
  }
}

main().catch(console.error)

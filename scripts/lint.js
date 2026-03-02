#!/usr/bin/env node
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const checks = [
  {
    file: 'src/shared/messaging.ts',
    regex: /postMessage\([^,]+,\s*['"]\*['"]\)/,
    message: 'Avoid postMessage with wildcard target origin in shared messaging.',
    expectAbsent: true,
  },
  {
    file: 'src/content/index.ts',
    regex: /window as any/,
    message: 'Avoid window as any in content bridge.',
    expectAbsent: true,
  },
  {
    file: 'src/tools/eyedropper/EyedropperPanel.tsx',
    regex: /window as any/,
    message: 'Avoid window as any in eyedropper panel.',
    expectAbsent: true,
  },
]

let hasError = false
for (const c of checks) {
  const content = readFileSync(join(process.cwd(), c.file), 'utf8')
  const matched = c.regex.test(content)
  if (c.expectAbsent && matched) {
    console.error(`✖ ${c.file}: ${c.message}`)
    hasError = true
  }
}

if (hasError) process.exit(1)
console.log('✓ lint checks passed')

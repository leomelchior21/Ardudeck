/**
 * ArduDeck — CSV Student Importer
 *
 * Usage:
 *   node scripts/import-students.mjs path/to/students.csv
 *
 * Requires env vars:
 *   SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_SERVICE_KEY=your-service-role-key
 *
 * CSV format expected (semicolon-separated):
 *   TURMA;N°;NOME DO(A) ALUNO(A);GRUPO;MATRIC;E-MAIL
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars')
  console.error('   Set them before running: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/import-students.mjs')
  process.exit(1)
}

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('❌ Usage: node scripts/import-students.mjs path/to/students.csv')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'latin1') // Handle Windows encoding
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)

  // Skip header line
  const dataLines = lines.slice(1)

  const students = []
  const seen = new Set()

  for (const line of dataLines) {
    // Each row has two student records (columns 1-6 and 10-15)
    // Format: TURMA;N°;NOME;GRUPO;MATRIC;E-MAIL;;DATE;EVENT;TURMA;N°;NOME;GRUPO;MATRIC;E-MAIL
    const cols = line.split(';').map(c => c.trim())

    // First student (columns 0-5)
    const student1 = extractStudent(cols, 0)
    if (student1 && !seen.has(student1.ra)) {
      seen.add(student1.ra)
      students.push(student1)
    }

    // Second student (columns 9-14, if present)
    if (cols.length > 9) {
      const student2 = extractStudent(cols, 9)
      if (student2 && !seen.has(student2.ra)) {
        seen.add(student2.ra)
        students.push(student2)
      }
    }
  }

  return students
}

function extractStudent(cols, offset) {
  const turma = cols[offset + 0] || ''   // e.g. "EF 9A"
  const nome = cols[offset + 2] || ''
  const grupo = cols[offset + 3] || ''
  const matric = cols[offset + 4] || ''

  // Validate
  if (!matric || !nome || matric.length < 4) return null
  if (!/^\d+$/.test(matric)) return null // RA must be numeric
  if (!turma.match(/^(EF|EM)/i)) return null // Must be a valid class

  return {
    ra: matric,
    full_name: nome.toUpperCase().trim(),
    grade: turma.trim(),
    group_name: translateGroup(grupo.trim()),
    character_id: Math.floor(Math.random() * 45), // Random starting character
  }
}

function translateGroup(grupo) {
  // Map Portuguese group names
  const map = {
    'amarelo': 'A',
    'branco': 'B',
    'azul': 'C',
    'verde': 'D',
    'vermelho': 'E',
    '': 'A',
  }
  return map[grupo.toLowerCase()] || grupo.toUpperCase()
}

async function importStudents(students) {
  console.log(`\n📋 Found ${students.length} students to import...\n`)

  let imported = 0
  let skipped = 0
  let errors = 0

  // Import in batches of 50
  const batchSize = 50
  for (let i = 0; i < students.length; i += batchSize) {
    const batch = students.slice(i, i + batchSize)

    const { data, error } = await supabase
      .from('students')
      .upsert(batch, {
        onConflict: 'ra',
        ignoreDuplicates: false,
      })
      .select()

    if (error) {
      console.error(`❌ Batch ${Math.floor(i/batchSize)+1} error:`, error.message)
      errors += batch.length
    } else {
      imported += batch.length
      const pct = Math.round((i + batch.length) / students.length * 100)
      process.stdout.write(`\r✅ Progress: ${pct}% (${i + batch.length}/${students.length})`)
    }
  }

  console.log('\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`✅ Imported:  ${imported}`)
  console.log(`⏭️  Skipped:   ${skipped}`)
  console.log(`❌ Errors:    ${errors}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

// Main
console.log('🚀 ArduDeck — Student CSV Importer')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`📁 File: ${csvPath}`)
console.log(`🔗 DB:   ${SUPABASE_URL}`)
console.log('')

const students = parseCSV(path.resolve(csvPath))
await importStudents(students)

// Print sample
console.log('\n📝 Sample records:')
students.slice(0, 5).forEach(s => {
  console.log(`  ${s.ra} | ${s.full_name.padEnd(40)} | ${s.grade} | Group ${s.group_name}`)
})

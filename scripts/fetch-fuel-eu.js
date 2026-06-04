import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { execSync } from 'child_process'

const OUT_DIR = 'v1/fuel'
const OUT_FILE = `${OUT_DIR}/eu-diesel.json`
const API_URL = 'https://eurooilwatch.com/api/v1/prices'

async function fetchEuroOilWatch() {
  const res = await fetch(API_URL, {
    headers: { 'User-Agent': 'currency-api-tr/1.0' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`EuroOilWatch HTTP ${res.status}`)
  return res.json()
}

function buildOutput(data, isStale = false) {
  const countries = {}
  for (const c of data.countries) {
    if (c.dieselPrice != null) {
      countries[c.countryCode] = {
        name: c.countryName,
        diesel_eur_per_liter: c.dieselPrice,
        petrol_eur_per_liter: c.petrolPrice ?? null,
      }
    }
  }
  return {
    date: data.bulletinDate,
    updated_at: new Date().toISOString(),
    bulletin_date: data.bulletinDate,
    is_stale: isStale,
    source: 'EuroOilWatch — EC Weekly Oil Bulletin',
    source_url: 'https://eurooilwatch.com/api/v1/prices',
    countries,
  }
}

function gitCommit(label) {
  try {
    execSync('git config user.email "actions@github.com"', { stdio: 'pipe' })
    execSync('git config user.name "currency-api-bot"', { stdio: 'pipe' })
    execSync(`git add ${OUT_FILE}`, { stdio: 'pipe' })
    const status = execSync('git status --porcelain', { stdio: 'pipe' }).toString().trim()
    if (!status) { console.log('No changes — already up to date'); return }
    execSync(`git commit -m "chore: eu diesel prices ${label}"`, { stdio: 'pipe' })
    execSync('git push', { stdio: 'pipe' })
    console.log(`Pushed: eu diesel prices ${label}`)
  } catch (err) {
    console.error('Git error:', err.message)
  }
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

  let output
  try {
    console.log('Fetching EuroOilWatch...')
    const data = await fetchEuroOilWatch()
    output = buildOutput(data, false)
    console.log(`OK — bulletin: ${output.bulletin_date}, countries: ${Object.keys(output.countries).length}`)
  } catch (err) {
    console.error('Fetch failed:', err.message)
    try {
      const existing = JSON.parse(readFileSync(OUT_FILE, 'utf8'))
      output = { ...existing, updated_at: new Date().toISOString(), is_stale: true }
      console.warn('Stale fallback — bulletin date:', existing.bulletin_date)
    } catch {
      console.error('No fallback file. Exiting.')
      process.exit(1)
    }
  }

  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2))
  gitCommit(output.bulletin_date)
}

main()

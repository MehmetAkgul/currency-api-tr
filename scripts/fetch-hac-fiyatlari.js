import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { execSync } from 'child_process'

const OUT_DIR = 'v1/religious'
const OUT_FILE = `${OUT_DIR}/hac-fiyatlari.json`
const STALE_THRESHOLD_MONTHS = 13

// Hardcoded 2026 baseline (Diyanet resmi açıklaması)
const BASELINE_2026 = {
  yil: 2026,
  bulletin_date: '2025-11-01',
  source: 'Diyanet İşleri Başkanlığı — Hac Hizmetleri Genel Müdürlüğü',
  source_url: 'https://hacumre.diyanet.gov.tr',
  paketler: [
    { tur: '4_kisilik_oda', label: '4 Kişilik Oda (Ekonomik)', sar: 26000 },
    { tur: '3_kisilik_oda', label: '3 Kişilik Oda', sar: 27750 },
    { tur: '2_kisilik_oda', label: '2 Kişilik Oda', sar: 29750 },
    { tur: 'yakin_mesafe_min', label: 'Yakın Mesafe (min)', sar: 63500 },
    { tur: 'yakin_mesafe_max', label: 'Yakın Mesafe (max)', sar: 90000 },
  ],
}

function readExisting() {
  try { return JSON.parse(readFileSync(OUT_FILE, 'utf8')) } catch { return null }
}

function isStaleCheck(existing) {
  if (!existing?.bulletin_date) return true
  const ageMs = Date.now() - new Date(existing.bulletin_date).getTime()
  const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30)
  return ageMonths > STALE_THRESHOLD_MONTHS
}

async function tryScrapeDiyanet() {
  // Diyanet sayfasından SAR rakamı bulmaya çalış
  try {
    const res = await fetch('https://hacumre.diyanet.gov.tr', {
      headers: { 'User-Agent': 'currency-api-tr/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const html = await res.text()
    // SAR rakamı formatı: "26.000" veya "26000" SAR şeklinde geçiyor
    const matches = [...html.matchAll(/(\d{2}[.,]\d{3})\s*SAR/gi)]
    if (matches.length < 3) return null // Yetersiz veri
    console.log(`Diyanet scrape: ${matches.length} SAR değeri bulundu`)
    return matches.map(m => parseFloat(m[1].replace('.', '').replace(',', '.')))
  } catch (err) {
    console.warn('Diyanet scrape failed:', err.message)
    return null
  }
}

function gitCommit(label) {
  try {
    execSync('git config user.email "actions@github.com"', { stdio: 'pipe' })
    execSync('git config user.name "currency-api-bot"', { stdio: 'pipe' })
    execSync(`git add ${OUT_FILE}`, { stdio: 'pipe' })
    const status = execSync('git status --porcelain', { stdio: 'pipe' }).toString().trim()
    if (!status) { console.log('No changes'); return }
    execSync(`git commit -m "chore: hac fiyatlari ${label}"`, { stdio: 'pipe' })
    execSync('git push', { stdio: 'pipe' })
    console.log(`Pushed: hac fiyatlari ${label}`)
  } catch (err) {
    console.error('Git error:', err.message)
  }
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

  const existing = readExisting()
  const isStale = isStaleCheck(existing)

  // Scrape denemesi
  const scraped = await tryScrapeDiyanet()

  let output
  if (existing && !isStale && !scraped) {
    // Güncel veri var, scrape yeni bir şey getirmedi → sadece updated_at güncelle
    output = { ...existing, updated_at: new Date().toISOString(), is_stale: false }
    console.log('Mevcut veri güncel, güncelleme yok')
  } else if (existing) {
    // Mevcut veriyi koru, is_stale flag güncelle
    output = { ...existing, updated_at: new Date().toISOString(), is_stale: isStale }
    console.log(`Mevcut veri korundu — is_stale: ${isStale}`)
  } else {
    // İlk çalışma → baseline yükle
    output = { ...BASELINE_2026, updated_at: new Date().toISOString(), is_stale: false }
    console.log('Baseline 2026 verisi yüklendi')
  }

  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2))
  gitCommit(output.yil)
}

main()

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { execSync } from 'child_process'

const OUT_DIR = 'v1/fuel'
const OUT_FILE = `${OUT_DIR}/bdt-diesel.json`

// Otomatik API mevcut degil. Aylik manuel guncelleme gereklidir.
// Kaynak: https://www.globalpetrolprices.com/diesel_prices/
const BASELINE_DATA = {
  manually_updated: '2026-06-04',
  source: 'Manuel guncelleme — GlobalPetrolPrices.com referans alinarak',
  source_url: 'https://www.globalpetrolprices.com/diesel_prices/',
  update_note: 'Otomatik API yok. Aylik manuel guncelleme gereklidir.',
  regions: {
    turkey: {
      TR: {
        name: 'Turkiye',
        diesel_try_per_liter: 46.5,
        diesel_eur_per_liter: null,
        currency: 'TRY',
        note: 'EPDK haftalik belirleme',
      },
    },
    bdt: {
      RU: {
        name: 'Rusya',
        diesel_rub_per_liter: 64,
        diesel_eur_per_liter: 0.71,
        currency: 'RUB',
      },
      KZ: {
        name: 'Kazakistan',
        diesel_kzt_per_liter: 210,
        diesel_eur_per_liter: 0.49,
        currency: 'KZT',
      },
      AZ: {
        name: 'Azerbaycan',
        diesel_azn_per_liter: 1.10,
        diesel_eur_per_liter: 0.65,
        currency: 'AZN',
      },
      UZ: {
        name: 'Ozbekistan',
        diesel_uzs_per_liter: 8500,
        diesel_eur_per_liter: 0.58,
        currency: 'UZS',
      },
      GE: {
        name: 'Gurcistan',
        diesel_gel_per_liter: 3.20,
        diesel_eur_per_liter: 1.15,
        currency: 'GEL',
      },
      BY: {
        name: 'Belarus',
        diesel_byn_per_liter: 1.85,
        diesel_eur_per_liter: 0.77,
        currency: 'BYN',
      },
    },
    middle_east: {
      IQ: {
        name: 'Irak',
        diesel_eur_per_liter: 0.35,
        currency: 'IQD',
        note: 'Devlet subvansiyonu — bolgeye gore farklilık gosterir',
      },
      IR: {
        name: 'Iran',
        diesel_eur_per_liter: 0.04,
        currency: 'IRR',
        note: 'Yogun subvansiyon — yabanci araclar farkli fiyat odeyebilir',
      },
      SY: {
        name: 'Suriye',
        diesel_eur_per_liter: 0.55,
        currency: 'SYP',
        note: 'Piyasa fiyati — resmi fiyat farkli olabilir, guzergah guvenligini kontrol edin',
      },
    },
  },
}

const STALE_DAYS = 30

function isStale(manuallyUpdated) {
  const updated = new Date(manuallyUpdated)
  const now = new Date()
  const diffMs = now - updated
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays > STALE_DAYS
}

function buildOutput(base, updatedAt, stale) {
  return {
    updated_at: updatedAt,
    manually_updated: base.manually_updated,
    is_stale: stale,
    source: base.source,
    source_url: base.source_url,
    update_note: base.update_note,
    regions: base.regions,
  }
}

function gitCommit() {
  try {
    execSync('git config user.email "actions@github.com"', { stdio: 'pipe' })
    execSync('git config user.name "currency-api-bot"', { stdio: 'pipe' })
    execSync(`git add ${OUT_FILE}`, { stdio: 'pipe' })
    const status = execSync('git status --porcelain', { stdio: 'pipe' }).toString().trim()
    if (!status) {
      console.log('No changes — already up to date')
      return
    }
    execSync(`git commit -m "chore: bdt diesel prices updated_at refresh"`, { stdio: 'pipe' })
    console.log('Committed: bdt-diesel.json')
  } catch (err) {
    console.error('Git error:', err.message)
  }
}

function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

  const now = new Date().toISOString()

  if (!existsSync(OUT_FILE)) {
    // Ilk olusturma — baseline yaz
    const stale = isStale(BASELINE_DATA.manually_updated)
    const output = buildOutput(BASELINE_DATA, now, stale)
    writeFileSync(OUT_FILE, JSON.stringify(output, null, 2))
    console.log(`Created ${OUT_FILE} — manually_updated: ${BASELINE_DATA.manually_updated}, is_stale: ${stale}`)
  } else {
    // Dosya var — sadece updated_at guncelle + stale kontrol
    let existing
    try {
      existing = JSON.parse(readFileSync(OUT_FILE, 'utf8'))
    } catch (err) {
      console.error('Could not parse existing file, rewriting from baseline:', err.message)
      const stale = isStale(BASELINE_DATA.manually_updated)
      const output = buildOutput(BASELINE_DATA, now, stale)
      writeFileSync(OUT_FILE, JSON.stringify(output, null, 2))
      gitCommit()
      return
    }

    const manuallyUpdated = existing.manually_updated || BASELINE_DATA.manually_updated
    const stale = isStale(manuallyUpdated)

    if (stale && !existing.is_stale) {
      console.warn(`STALE: manually_updated=${manuallyUpdated} — guncelleme gerekiyor!`)
    }

    const output = { ...existing, updated_at: now, is_stale: stale }
    writeFileSync(OUT_FILE, JSON.stringify(output, null, 2))
    console.log(`Updated ${OUT_FILE} — manually_updated: ${manuallyUpdated}, is_stale: ${stale}`)
  }

  gitCommit()
}

main()

import { Client } from '@notionhq/client'
import { writeFileSync } from 'fs'
import { find_pourcentage, mean, statistics_by_tens } from "./statistics"

const notion = new Client({
  auth: process.env.NOTION_TOKEN as string,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert any Notion property value to a plain string. */
function extractValue(property: any): string {
  if (!property) return ''

  switch (property.type) {
    case 'title':
      return property.title.map((t: any) => t.plain_text).join('')
    case 'rich_text':
      return property.rich_text.map((t: any) => t.plain_text).join('')
    case 'number':
      return property.number !== null && property.number !== undefined
        ? String(property.number)
        : ''
    case 'select':
      return property.select?.name ?? ''
    case 'multi_select':
      return property.multi_select.map((s: any) => s.name).join(' | ')
    case 'status':
      return property.status?.name ?? ''
    case 'date':
      return property.date
        ? property.date.end
          ? `${property.date.start} → ${property.date.end}`
          : property.date.start
        : ''
    case 'checkbox':
      return property.checkbox ? 'true' : 'false'
    case 'url':
      return property.url ?? ''
    case 'email':
      return property.email ?? ''
    case 'phone_number':
      return property.phone_number ?? ''
    case 'people':
      return property.people.map((p: any) => p.name ?? p.id).join(' | ')
    case 'files':
      return property.files
        .map((f: any) => f.file?.url ?? f.external?.url ?? f.name)
        .join(' | ')
    case 'relation':
      return property.relation.map((r: any) => r.id).join(' | ')
    case 'formula': {
      const f = property.formula
      if (f.type === 'string') return f.string ?? ''
      if (f.type === 'number') return f.number !== null ? String(f.number) : ''
      if (f.type === 'boolean') return String(f.boolean)
      if (f.type === 'date') return f.date?.start ?? ''
      return ''
    }
    case 'rollup': {
      const r = property.rollup
      if (r.type === 'number') return r.number !== null ? String(r.number) : ''
      if (r.type === 'date') return r.date?.start ?? ''
      if (r.type === 'array')
        return r.array.map((item: any) => extractValue(item)).join(' | ')
      return ''
    }
    case 'created_time':
      return property.created_time ?? ''
    case 'last_edited_time':
      return property.last_edited_time ?? ''
    case 'created_by':
      return property.created_by?.name ?? property.created_by?.id ?? ''
    case 'last_edited_by':
      return property.last_edited_by?.name ?? property.last_edited_by?.id ?? ''
    default:
      return ''
  }
}

/** Wrap a cell value so it is safe inside a CSV file. */
function csvCell(value: string): string {
  // Always quote to handle commas, quotes and newlines inside values
  return `"${value.replace(/"/g, '""')}"`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function downloadAll() {
  const allResults: any[] = []
  let cursor: string | undefined = undefined

  console.log('⬇️  Fetching testimonials from Notion…')

  // Paginate until we have every record
  do {
    const response: any = await notion.dataSources.query({
      data_source_id: process.env.TESTIMONIALS_ID as string,
      ...(cursor ? { start_cursor: cursor } : {}),
    })

    allResults.push(...response.results)
    console.log(`   fetched ${allResults.length} record(s) so far…`)

    cursor =
      response.has_more && response.next_cursor
        ? response.next_cursor
        : undefined
  } while (cursor)

  if (allResults.length === 0) {
    console.log('⚠️  No testimonials found. Check your TESTIMONIALS_ID.')
    return
  }

  // Fixed column order as requested
  let headers = [
    'Prenom', //
    'Sexe',
    'Age',
    'Statut_professionnel',
    'Niveau_études',
    'Secteur_activité',
    'Profession',
    'Fréquence_info_IA',
    'Impact_perçu',
    'Rapport_à_IA',
    'Intéressé_cellule',
    'Raison_cellule',
    'Témoignage',
    'Email', //
    'Fréquence_utilisation',
    'Tâche_IA',
    'Raisons_utilisation',
    'Satisfaction',
    'Date',
    'Consentement',
    'Afficher',
    'Dernière modification par',
  ]

  if(Bun.argv[2] === '--filtered') {
    headers.splice(0, 1)
    headers.splice(12, 1)

  }

  // Sort by Date (most recent first) before converting to strings
  allResults.sort((a, b) => {
    const dateA: string = a.properties?.Date?.date?.start ?? ''
    const dateB: string = b.properties?.Date?.date?.start ?? ''
    return dateB.localeCompare(dateA)
  })

  // Build CSV lines
  const headerLine = headers.map(csvCell).join(',')
  const dataLines = allResults.map((item) =>
    headers
      .map((key) => csvCell(extractValue(item.properties[key])))
      .join(',')
  )

  const csv = [headerLine, ...dataLines].join('\n')

  const statsCsv = createStatistics(allResults)
  
  writeFileSync('testimony.csv', csv + statsCsv, 'utf-8')
  console.log(
    `✅  Exported ${allResults.length} testimonial(s) with statistics → testimony.csv`
  )
}

downloadAll().catch((err) => {
  console.error('❌  Error:', err.message ?? err)
  process.exit(1)
})


function createStatistics(allResults: any[]): string {
  let output = "\n"

  // Extraction robuste de l'âge (gère les nombres et les textes comme "30 à 39 ans")
  const ages = allResults
    .map((item) => {
      const val = extractValue(item.properties?.Age);
      const match = val.match(/\d+/);
      return match ? parseInt(match[0]) : NaN;
    })
    .filter((n) => !isNaN(n));

  output += "#Âge moyen des participants\n"
  if (ages.length > 0) {
    const age_result = mean(ages);
    output += csvCell(String(age_result.toFixed(2))) + "ans\n"
  } else {
    output += "Aucune donnée d'âge exploitable.\n"
  }

  output += "#Répartition des âges par dizaines\n"
  output += csvCell("Intervalle") + csvCell("Pourcentage") + "\n"
  const age_result_tens = statistics_by_tens(ages)
  age_result_tens.sort((a, b) => a.value - b.value)
  for (const item of age_result_tens) {
    output += csvCell(`${item.value}-${item.value + 10} ans`) + csvCell(`${item.percentage}`) + "\n"
  }
  output += "\n"

  output += "#Diplôme des participants\n"
  output += csvCell("Niveau d'études") + csvCell("Pourcentage") + "\n"
  const diplome_values = allResults.map((item) => extractValue(item.properties?.Niveau_études)).filter(v => v.trim() !== "");
  const diplome_result = find_pourcentage(diplome_values)
  for (const item of diplome_result) {
    output += csvCell(`${item.value}`) + csvCell(`${item.percentage}`) + "\n"
  }

  output += "\n"

  output += "#Genre des participants\n"
  output += csvCell("Genre") + csvCell("Pourcentage") + "\n"
  const genre_values = allResults.map((item) => extractValue(item.properties?.Sexe)).filter(v => v.trim() !== "");
  const genre_result = find_pourcentage(genre_values)
  for (const item of genre_result) {
    output += csvCell(`${item.value}`) + csvCell(`${item.percentage}`) + "\n"
  }

  output += "\n"

  output += "#Statut professionnel des participants\n"
  output += csvCell("Statut professionnel") + csvCell("Pourcentage") + "\n"
  const statut_result = find_pourcentage(allResults.map((item) => extractValue(item.properties?.Statut_professionnel)))
  for (const item of statut_result) {
    output += csvCell(`${item.value}`) + csvCell(`${item.percentage}`) + "\n"
  }

  output += "\n"

  output += "#Secteur d'activité des participants\n"
  output += csvCell("Secteur d'activité") + csvCell("Pourcentage") + "\n"
  const secteur_result = find_pourcentage(allResults.map((item) => extractValue(item.properties?.Secteur_activité)))
  for (const item of secteur_result) {
    output += csvCell(`${item.value}`) + csvCell(`${item.percentage}`) + "\n"
  }

  output += "\n"

  output += "#Fréquence d'information sur l'IA des participants\n"
  output += csvCell("Fréquence d'information sur l'IA") + csvCell("Pourcentage") + "\n"
  const frequence_result = find_pourcentage(allResults.map((item) => extractValue(item.properties?.Fréquence_info_IA)))
  for (const item of frequence_result) {
    output += csvCell(`${item.value}`) + csvCell(`${item.percentage}`) + "\n"
  }

  output += "\n"

  output += "#Impact perçu des participants\n"
  output += csvCell("Impact perçu") + csvCell("Pourcentage") + "\n"
  const impact_result = find_pourcentage(allResults.map((item) => extractValue(item.properties?.Impact_perçu)))
  for (const item of impact_result) {
    output += csvCell(`${item.value}`) + csvCell(`${item.percentage}`) + "\n"
  }

  output += "\n"

  output += "#Rapport à l'IA des participants\n"
  output += csvCell("Rapport à l'IA") + csvCell("Pourcentage") + "\n"
  console.log(allResults.map((item) => extractValue(item.properties?.Rapport_à_IA))[5])
  const rapport_result = find_pourcentage(allResults.map((item) => extractValue(item.properties?.Rapport_à_IA)))
  for (const item of rapport_result) {
    output += csvCell(`${item.value}`) + csvCell(`${item.percentage}`) + "\n"
  }

  output += "\n"

  output += "#Fréquence d'utilisation de l'IA des participants\n"
  output += csvCell("Fréquence d'utilisation") + csvCell("Pourcentage") + "\n"
  const frequence_utilisation_result = find_pourcentage(allResults.map((item) => extractValue(item.properties?.Fréquence_utilisation)))
  for (const item of frequence_utilisation_result) {
    output += csvCell(`${item.value}`) + csvCell(`${item.percentage}`) + "\n"
  }

  output += "\n"

  output += "#Tâche d'IA des participants\n"  
  output += csvCell("Tâche d'IA") + csvCell("Pourcentage") + "\n"
  console.log(allResults.map((item) => extractValue(item.properties?.Tâche_IA))[5])
  const tache_result = find_pourcentage(allResults.map((item) => extractValue(item.properties?.Tâche_IA)))
  for (const item of tache_result) {
    output += csvCell(`${item.value}`) + csvCell(`${item.percentage}`) + "\n"
  }

  output += "\n"

  output += "#Raisons d'utilisation de l'IA des participants\n"
  output += csvCell("Raisons d'utilisation") + csvCell("Pourcentage") + "\n"
  const raisons_result = find_pourcentage(allResults.map((item) => extractValue(item.properties?.Raisons_utilisation)))
  for (const item of raisons_result) {
    output += csvCell(`${item.value}`) + csvCell(`${item.percentage}`) + "\n"
  }

  output += "\n"

  output += "#Satisfaction des participants\n"
  output += csvCell("Satisfaction") + csvCell("Pourcentage") + "\n"
  const satisfaction_result = find_pourcentage(allResults.map((item) => extractValue(item.properties?.Satisfaction)))
  for (const item of satisfaction_result) {
    output += csvCell(`${item.value}`) + csvCell(`${item.percentage}`) + "\n"
  }

  return output
}



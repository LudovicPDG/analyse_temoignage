import { extractValue } from "./download_all"

export function find_pourcentage(values: any[]): {value: any, percentage: string}[] {
    const result: {value: any, count: number}[] = []

    const processValue = (val: any) => {
        if (!val) return;
        if (typeof val === 'string') {
            val = val.trim();
        }
        if (val === '' || val === '"' || val === '""' || val === '"""') return;

        const existing = result.find((item) => item.value === val);
        if (existing) {
            existing.count += 1;
        } else {
            result.push({value: val, count: 1});
        }
    };

    for (const value of values) {
        if(!value) continue;
        
        if (typeof value === 'string' && (value.includes("\n") || value.includes(" | "))) {
          const splitValues = value.split(/\n| \| /);
          for (const splitValue of splitValues) {
              processValue(splitValue);
          }
          continue;
        }
        
        processValue(value);
    }
    
    let total = 0;
    for (const item of result) {
        total += item.count;
    }
    return result.sort((a, b) => b.count - a.count).map((item) => ({value: item.value, percentage: (item.count / total * 100).toFixed(2) + '%' }))
}


export function find_pourcentage_by_groupe(
  items: any[],
  groupKey: string,
  valueKey: string
): {
  group: string,
  values: { value: any, percentage: string }[]
}[] {

  const grouped: Record<string, any[]> = {}

  // Grouper les items
  for (const item of items) {
    const groupValue = extractValue(item.properties?.[groupKey]).trim()
    const targetValue = extractValue(item.properties?.[valueKey]).trim()

    if (!groupValue || !targetValue) continue

    if (!grouped[groupValue]) {
      grouped[groupValue] = []
    }

    grouped[groupValue].push(targetValue)
  }

  // Calcul des pourcentages pour chaque groupe
  const result = Object.entries(grouped).map(([group, values]) => ({
    group,
    values: find_pourcentage(values)
  }))

  return result
}

export function find_pourcentage_by_groupe_age_tens(
    items: any[],
    groupKey: string,
    valueKey: string
): {
    group: string,
    values: { value: any, percentage: string }[]
}[] {

    const grouped: Record<string, string[]> = {}

    for (const item of items) {
        const groupValue = extractValue(item.properties?.[groupKey]).trim()

        const rawAge = extractValue(item.properties?.[valueKey]).trim()

        const match = rawAge.match(/\d+/)

        if (!groupValue || !match) continue

        const age = parseInt(match[0])

        const tens = Math.floor(age / 10) * 10

        const ageRange = `${tens}-${tens + 9}`

        if (!grouped[groupValue]) {
            grouped[groupValue] = []
        }

        grouped[groupValue].push(ageRange)
    }

    return Object.entries(grouped).map(([group, values]) => ({
        group,
        values: find_pourcentage(values)
    }))
}

export function impact_by_age_tens(
  items: any[],
  ageKey: string,
  valueKey: string
): {
  group: string,
  values: { value: any, percentage: string }[]
}[] {

  const grouped: Record<string, string[]> = {}

  for (const item of items) {

    const rawAge = extractValue(item.properties?.[ageKey]).trim()
    const value = extractValue(item.properties?.[valueKey]).trim()

    const match = rawAge.match(/\d+/)
    if (!match || !value) continue

    const age = parseInt(match[0])

    const min = Math.floor(age / 10) * 10
    const max = min + 9

    const ageGroup = `${min}-${max} ans`

    if (!grouped[ageGroup]) {
      grouped[ageGroup] = []
    }

    grouped[ageGroup].push(value)
  }

  return Object.entries(grouped)
    .map(([group, values]) => ({
      group,
      values: find_pourcentage(values)
    }))
    .sort((a, b) => {
      // tri par âge
      const aMin = parseInt(a.group)
      const bMin = parseInt(b.group)
      return aMin - bMin
    })
}


export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function statistics_by_tens(values: number[]): {value: number, percentage: string}[] {
  const result: {value: number, count: number}[] = []
  for (const value of values) {
    if(!value) continue;
    const tens = Math.floor(value / 10) * 10
    const existing = result.find((item) => item.value === tens)
    if (existing) {
      existing.count += 1
    } else {
      result.push({value: tens, count: 1})
    }
  }
  return result.sort((a, b) => b.count - a.count).map((item) => ({
    value: item.value, 
    percentage: (item.count / values.length * 100).toFixed(2) + '%'
  }))
}


export function find_pourcentage(values: any[]): {value: any, percentage: string}[] {
    const result: {value: any, count: number}[] = []
    for (const value of values) {
        if(!value) continue;
        if(value == "") continue;
        if(value.includes("\n")) {
          const values = value.split("\n")
          for (const value of values) {
            const existing = result.find((item) => item.value === value);
            if (existing) {
                existing.count += 1
            } else {
                result.push({value, count: 1})
            }
          }
          continue;
        }
        const existing = result.find((item) => item.value === value);
        if (existing) {
            existing.count += 1
        } else {
            result.push({value, count: 1})
        }
    }
    let total = 0;
    console.log(result)
    for (const item of result) {
        total += item.count
    }
    console.log(total)
    console.log("salope")
    return result.sort((a, b) => b.count - a.count).map((item) => ({value: item.value, percentage: (item.count / total * 100).toFixed(2) + '%' }))
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

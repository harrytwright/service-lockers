export function findDifferences(obj1: any, obj2: any): Record<string, any> {
  const differences: Record<string, any> = {}

  for (const key in obj1) {
    if (obj1.hasOwnProperty(key)) {
      const val1 = obj1[key]
      const val2 = obj2[key]

      if (typeof val1 === 'object' && typeof val2 === 'object') {
        // Both properties are objects, recursively compare them
        const nestedDifferences = findDifferences(val1, val2)
        if (Object.keys(nestedDifferences).length > 0) {
          differences[key] = nestedDifferences
        }
      } else if (Array.isArray(val1) && Array.isArray(val2)) {
        // Both properties are arrays, compare their contents
        /* istanbul ignore next */
        const arrayDifferences = compareArrays(val1, val2)
        /* istanbul ignore next */
        if (arrayDifferences.length > 0) {
          differences[key] = arrayDifferences
        }
      } else if (val1 !== val2) {
        // Properties have different values, add to differences
        differences[key] = val1
      }
    }
  }

  return differences
}

/* istanbul ignore next */
function compareArrays(arr1: unknown[], arr2: unknown[]) {
  const differences = []

  for (let i = 0; i < arr1.length || i < arr2.length; i++) {
    if (i < arr1.length && i < arr2.length) {
      const itemDifferences = findDifferences(arr1[i], arr2[i])
      if (Object.keys(itemDifferences).length > 0) {
        differences.push(itemDifferences)
      }
    } else if (i < arr1.length) {
      differences.push(arr1[i])
    } else {
      differences.push(arr2[i])
    }
  }

  return differences
}

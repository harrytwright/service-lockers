import { describe, expect, test, xtest } from '@jest/globals'

import { findDifferences } from './generate-diff' // Import the module where the function is defined

describe('findDifferences', () => {
  test('should return an empty object for identical objects', () => {
    const obj1 = { a: 1, b: 'hello' }
    const obj2 = { a: 1, b: 'hello' }
    const result = findDifferences(obj1, obj2)
    expect(result).toEqual({})
  })

  test('should find differences in simple objects', () => {
    const obj1 = { a: 1, b: 'hello' }
    const obj2 = { a: 2, b: 'world' }
    const result = findDifferences(obj1, obj2)
    expect(result).toEqual({ a: 1, b: 'hello' })
  })

  test('should find differences in nested objects', () => {
    const obj1 = { a: 1, b: { x: 42, y: { 1: 2 } } }
    const obj2 = { a: 1, b: { x: 42, y: { 1: 3 } } }
    const result = findDifferences(obj1, obj2)
    expect(result).toEqual({ b: { y: { 1: 2 } } })
  })

  test('should find differences in arrays', () => {
    const obj1 = [1, 2, 3]
    const obj2 = [1, 2, 3]
    const result = findDifferences(obj1, obj2)
    expect(result).toEqual({})
  })

  test('should find differences in mixed objects and arrays', () => {
    const obj1 = { a: { 1: 2 }, b: 'hello' }
    const obj2 = { a: { 1: 3 }, b: 'world' }
    const result = findDifferences(obj1, obj2)
    expect(result).toEqual({ a: { 1: 2 }, b: 'hello' })
  })

  test('should handle empty objects', () => {
    const obj1 = {}
    const obj2 = {}
    const result = findDifferences(obj1, obj2)
    expect(result).toEqual({})
  })

  // Todo: Look into this
  xtest('should handle one empty object and one non-empty object', () => {
    const obj1 = {}
    const obj2 = { a: 1 }
    const result = findDifferences(obj1, obj2)
    expect(result).toEqual({ a: 1 })
  })
})

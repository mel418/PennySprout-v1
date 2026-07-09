import { describe, it, expect } from 'vitest'
import { extractJson } from '../aiJson'

describe('extractJson', () => {
  it('parses clean JSON directly', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
    expect(extractJson('[1,2,3]')).toEqual([1, 2, 3])
  })

  it('unwraps ```json fences', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('unwraps bare ``` fences', () => {
    expect(extractJson('```\n[1,2]\n```')).toEqual([1, 2])
  })

  it('strips surrounding prose', () => {
    expect(extractJson('Here is your analysis:\n{"score": 7}\nHope that helps!')).toEqual({ score: 7 })
  })

  it('repairs trailing commas', () => {
    expect(extractJson('{"a": 1, "b": [1, 2,],}')).toEqual({ a: 1, b: [1, 2] })
  })

  it('repairs smart quotes', () => {
    expect(extractJson('{“a”: “hi”}')).toEqual({ a: 'hi' })
  })

  it('throws on empty or non-string input', () => {
    expect(() => extractJson('')).toThrow('Empty response')
    expect(() => extractJson('   ')).toThrow('Empty response')
    expect(() => extractJson(undefined)).toThrow('Empty response')
  })

  it('throws on hopeless input rather than returning garbage', () => {
    expect(() => extractJson('no json here at all')).toThrow()
  })
})

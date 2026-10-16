import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@clerk/nextjs/server', () => ({ currentUser: vi.fn() }))

const { isAdminUser } = await import('../admin')

describe('isAdminUser', () => {
  it('is true only for publicMetadata.role === "admin"', () => {
    expect(isAdminUser({ publicMetadata: { role: 'admin' } })).toBe(true)
  })

  it('is false for other roles, missing metadata, and no user', () => {
    expect(isAdminUser({ publicMetadata: { role: 'member' } })).toBe(false)
    expect(isAdminUser({ publicMetadata: {} })).toBe(false)
    expect(isAdminUser({})).toBe(false)
    expect(isAdminUser(null)).toBe(false)
  })

  it('ignores unsafeMetadata, which users can write themselves', () => {
    expect(isAdminUser({ publicMetadata: {}, unsafeMetadata: { role: 'admin' } })).toBe(false)
  })
})

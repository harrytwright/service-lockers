/**
 * This may get exported via a tool, so needs to be in a good format
 * */

export const menus_scope = {
  full: 'menus:*',
  read: 'menus:read',
  developer: 'menus:read:developer',
  write: 'menus:write',
  manage: 'menus:manage',
  delete: 'menus:manage:delete',
} as const

export type menus_scope = (typeof menus_scope)[keyof typeof menus_scope]

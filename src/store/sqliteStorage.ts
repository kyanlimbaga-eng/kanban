import type { StateStorage } from 'zustand/middleware'
import { sqliteGetItem, sqliteRemoveItem, sqliteSetItem } from '../db/sqlite'

export const sqliteStorage: StateStorage = {
  getItem: async (name) => sqliteGetItem(name),
  setItem: async (name, value) => {
    await sqliteSetItem(name, value)
  },
  removeItem: async (name) => {
    await sqliteRemoveItem(name)
  },
}

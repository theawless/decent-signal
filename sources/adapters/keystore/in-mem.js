import { DSKey } from '../../models/key'

/**
 * Store user keys in the memory.
 * @implements DSKeystore
 */
export class DSInMemoryKeystore {
  constructor () {
    this._keys = new Map() // user id to key
  }

  async load (of) {
    if (this._keys.has(of.id)) {
      const data = this._keys.get(of.id)
      return new DSKey(data)
    } else {
      return undefined
    }
  }

  async save (of, key) {
    this._keys.set(of.id, key.data)
  }

  async remove (of) {
    if (!this._keys.delete(of.id)) {
      throw new Error(`already missing the key for user ${of.id}`)
    }
  }
}

import { DSKey } from '../../models/key'
import { DSEventEmitter } from '../../utilities/events'

/**
 * @event DSSharedSecretSystem#event:key-changed
 * @param {DSUser} user
 */

/**
 * Generate a shared secret using two user's asymmetric keys.
 * @implements DSCryptoSystem
 */
export class DSSharedSecretSystem {
  /**
   * @param {DSCryptography} crypto
   * @param {DSKeystore} store
   */
  constructor (crypto, store) {
    this._emitter = new DSEventEmitter()
    this._crypto = crypto
    this._store = store
    this._keys = undefined
    this._salt = undefined
  }

  get events () {
    return this._emitter
  }

  /**
   * Build our key pair and salt and send only the public key and salt.
   */
  async buildKey () {
    [this._keys, this._salt] = await Promise.all([
      this._crypto.keysForAgreement(),
      this._crypto.random()
    ])
    const data = JSON.stringify({
      pub: this._keys.public,
      salt: this._salt
    })
    return new DSKey(data)
  }

  /**
   * Using our private key and user's public key a shared key is generated.
   * This key is used as a password to generate the final shared secret.
   * To determine which salt to choose (it can be any) for secret derivation,
   * we just use the lexicographically larger one.
   */
  async acceptKey (from, key) {
    const { pub, salt } = JSON.parse(key.data)
    if (!pub || !salt) {
      throw new Error(`improper key received from user ${from.id}`)
    }
    const chosen = salt > this._salt ? salt : this._salt
    const shared = await this._crypto.secretFromKeys(this._keys.private, pub)
    const secret = await this._crypto.secretFromPass(shared, chosen)
    await this._store.save(from, new DSKey(secret))
  }

  /**
   * Remove shared secret for a user.
   */
  async removeKey (of) {
    await this._store.remove(of)
  }

  /**
   * Encrypt using the shared secret.
   */
  async encrypt (to, message) {
    const key = await this._store.load(to)
    if (!key) {
      throw new Error(`shared secret is missing for user ${to.id}`)
    }
    message.data = await this._crypto.secretEncrypt(key.data, message.data)
  }

  /**
   * Decrypt using the shared secret.
   */
  async decrypt (from, message) {
    const key = await this._store.load(from)
    if (!key) {
      throw new Error(`shared secret is missing for user ${from.id}`)
    }
    message.data = await this._crypto.secretDecrypt(key.data, message.data)
  }
}

import { DSCryptoSystem } from '../../interfaces/crypto-system'
import { DSKey } from '../../models/key'
import { DSEventEmitter } from '../../utilities/events'

/**
 * @event DSSharedSecretSystem#event:key-changed
 * @param {DSUser} user
 */

/**
 * Each user is assigned a public key and a salt. This information is exchanged
 * and both users generate a shared secret. To make this secret more secure,
 * it is used as a password and one of the user's salt is used to derive the
 * final shared secret key. This key is used to encrypt messages.
 * @implements DSCryptoSystem
 */
export class DSSharedSecretSystem extends DSCryptoSystem {
  /**
   * @param {DSCryptography} crypto
   * @param {DSKeystore} store
   */
  constructor (crypto, store) {
    super()
    this._emitter = new DSEventEmitter()
    this._crypto = crypto
    this._store = store
  }

  /**
   * @returns {DSEvents}
   */
  get events () {
    return this._emitter
  }

  /**
   * Build our public key and salt.
   * @returns {Promise<DSKey>}
   */
  async buildKey () {
    const [keys, salt] = await Promise.all([
      this._crypto.keysForAgreement(),
      this._crypto.random()
    ])
    this._keys = keys
    this._salt = salt
    const data = JSON.stringify({ pub: this._keys.public, salt })
    return new DSKey(data)
  }

  /**
   * Accept key from a user.
   * Using our private key and user's public key a secret is generated.
   * This secret is used as a password to generate the final secret.
   * To determine which salt to choose (it can be any) for derivation,
   * we just use the lexicographically larger one.
   * @param {DSUser} from
   * @param {DSKey} key
   */
  async acceptKey (from, key) {
    const { pub, salt } = JSON.parse(key.data)
    if (!pub || !salt) {
      throw new Error(`improper key received from user ${from.id}`)
    }
    const chosen = salt > this._salt ? salt : this._salt
    const semi = await this._crypto.secretFromKeys(this._keys.private, pub)
    const secret = await this._crypto.secretFromPass(semi, chosen)
    await this._store.save(from, new DSKey(secret))
  }

  /**
   * Remove shared secret for a user.
   * @param {DSUser} of
   */
  async removeKey (of) {
    await this._store.remove(of)
  }

  /**
   * Encrypt plain message for a user using the shared secret.
   * @param {DSUser} to
   * @param {DSMessage} message
   */
  async encrypt (to, message) {
    const key = await this._store.load(to)
    if (!key) {
      throw new Error(`shared secret is missing for user ${to.id}`)
    }
    message.data = await this._crypto.secretEncrypt(key.data, message.data)
  }

  /**
   * Decrypt encrypted message for a user using the shared secret.
   * @param {DSUser} from
   * @param {DSMessage} message
   */
  async decrypt (from, message) {
    const key = await this._store.load(from)
    if (!key) {
      throw new Error(`shared secret is missing for user ${from.id}`)
    }
    message.data = await this._crypto.secretDecrypt(key.data, message.data)
  }
}

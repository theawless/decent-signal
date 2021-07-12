import { DSCryptoSystem } from '../../interfaces/crypto-system'
import { DSKey } from '../../models/key'
import { DSEventEmitter } from '../../utilities/events'

/**
 * @event DSPublicKeySystem#event:key-changed
 * @param {DSUser} user
 */

/**
 * Performs symmetric encryption on messages. The key for symmetric encryption
 * is asymmetrically encrypted so that only the required user can read it.
 * @implements DSCryptoSystem
 */
export class DSPublicKeySystem extends DSCryptoSystem {
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
   * Build our public key.
   * @returns {Promise<DSKey>}
   */
  async buildKey () {
    this._keys = await this._crypto.keysForEncryption()
    return new DSKey(this._keys.public)
  }

  /**
   * Accept public key from a user.
   * @param {DSUser} from
   * @param {DSKey} key
   */
  async acceptKey (from, key) {
    await this._store.save(from, key)
  }

  /**
   * Remove public key for a user.
   * @param {DSUser} of
   */
  async removeKey (of) {
    await this._store.remove(of)
  }

  /**
   * Encrypt plain message for a user.
   * First the message is encrypted with a new secret and then
   * the secret is encrypted with public key of the user.
   * @param {DSUser} to
   * @param {DSMessage} message
   */
  async encrypt (to, message) {
    const [key, secret] = await Promise.all([
      this._store.load(to),
      this._crypto.secret()
    ])
    if (!key) {
      throw new Error(`public key is missing for user ${to.id}`)
    }
    const [sec, enc] = await Promise.all([
      this._crypto.publicEncrypt(key.data, secret),
      this._crypto.secretEncrypt(secret, message.data)
    ])
    message.data = JSON.stringify({ sec, enc })
  }

  /**
   * Decrypt encrypted message for a user.
   * First decrypt the secret using our private key and
   * then decrypt the message with the secret.
   * @param {DSUser} from
   * @param {DSMessage} message
   */
  async decrypt (from, message) {
    const { sec, enc } = JSON.parse(message.data)
    if (!sec || !enc) {
      throw new Error(`text was not encrypted properly from user ${from.id}`)
    }
    const secret = await this._crypto.privateDecrypt(this._keys.private, sec)
    message.data = await this._crypto.secretDecrypt(secret, enc)
  }
}

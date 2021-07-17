import { DSKey } from '../../models/key'
import { DSEventEmitter } from '../../utilities/events'

/**
 * @event DSPublicKeySystem#event:key-changed
 * @param {DSUser} user
 */

/**
 * Do symmetric encryption on messages and asymmetric encryption on the secret.
 * @implements DSCryptoSystem
 */
export class DSPublicKeySystem {
  /**
   * @param {DSCryptography} crypto
   * @param {DSKeystore} store
   */
  constructor (crypto, store) {
    this._emitter = new DSEventEmitter()
    this._crypto = crypto
    this._store = store
    this._keys = undefined
  }

  get events () {
    return this._emitter
  }

  /**
   * Build our key pair and send only the public key.
   */
  async buildKey () {
    this._keys = await this._crypto.keysForEncryption()
    return new DSKey(this._keys.public)
  }

  /**
   * Accept public key from a user.
   */
  async acceptKey (from, key) {
    await this._store.save(from, key)
  }

  /**
   * Remove public key for a user.
   */
  async removeKey (of) {
    await this._store.remove(of)
  }

  /**
   * First the message is encrypted with a new secret and then
   * the secret is encrypted with public key of the user. Both the
   * encrypted secret and the encrypted message are then sent.
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
   * First decrypt the secret using our private key and
   * then decrypt the message with the decrypted secret.
   */
  async decrypt (from, message) {
    const { sec, enc } = JSON.parse(message.data)
    if (!sec || !enc) {
      throw new Error(`user ${from.id} did not properly encrypt the message`)
    }
    const secret = await this._crypto.privateDecrypt(this._keys.private, sec)
    message.data = await this._crypto.secretDecrypt(secret, enc)
  }
}

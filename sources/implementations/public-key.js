import { DecentSignalCommunicator } from '../interfaces/communicator'
import { DecentSignalContact } from '../interfaces/models'

/**
 * Communicates by encrypting/decrypting with public key cryptography.
 */
export class DecentSignalPublicKeyCommunicator extends DecentSignalCommunicator {
  /**
   * @param {DecentSignalCryptography} crypto
   */
  constructor (crypto) {
    super()
    this._crypto = crypto
    this._publicKeys = new Map() // user id to public key map
  }

  /**
   * Build our contact information.
   * @returns {DecentSignalContact}
   */
  async getContact () {
    this._myKeys = await this._crypto.generateKeys()
    return new DecentSignalContact(this._myKeys.public)
  }

  /**
   * Set contact for a user.
   * @param {DecentSignalUser} of
   * @param {DecentSignalContact} contact
   */
  async setContact (of, contact) {
    this._publicKeys.set(of.id, contact.info)
  }

  /**
   * Remove contact of a user.
   * @param {DecentSignalUser} of
   */
  removeContact (of) {
    this._publicKeys.delete(of.id)
  }

  /**
   * Encrypt plain text for a user.
   * @param {DecentSignalUser} to
   * @param {string} text
   * @returns {Promise<string>}
   */
  async encryptText (to, text) {
    const key = this._publicKeys.get(to.id)
    const secret = await this._crypto.generateSecret(32)
    const encrypt = await Promise.all([
      this._crypto.publicEncrypt(key, secret),
      this._crypto.secretEncrypt(secret, text)
    ])
    return JSON.stringify({ secret: encrypt[0], text: encrypt[1] })
  }

  /**
   * Decrypt encrypted text for a user.
   * @param {DecentSignalUser} from
   * @param {string} text
   * @returns {Promise<string>}
   */
  async decryptText (from, text) {
    const encrypt = JSON.parse(text)
    const secret = await this._crypto.privateDecrypt(this._myKeys.private, encrypt.secret)
    return this._crypto.secretDecrypt(secret, encrypt.text)
  }
}

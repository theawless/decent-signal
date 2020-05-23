import crypto from 'crypto'
import { DecentSignalCryptography } from 'decent-signal'

/**
 * Cryptography functions that use node's built in crypto.
 * TODO: can use some of the crypto async functions here instead of sync.
 */
export class DecentSignalNodeCrypto extends DecentSignalCryptography {
  /**
   * Generate a secret randomly.
   * @returns {Promise<string>} hex encoded
   */
  async generateSecret () {
    return crypto.randomBytes(64).toString('hex')
  }

  /**
   * Encrypt a message by creating a key using scrypt and performing AES.
   * @param {string} secret utf8 encoded
   * @param {string} message utf8 encoded
   * @returns {Promise<string>} {salt, iv, encrypt, tag} hex encoded
   */
  async secretEncrypt (secret, message) {
    const salt = crypto.randomBytes(32)
    const key = crypto.scryptSync(secret, salt, 32)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    return JSON.stringify({
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      encrypt: cipher.update(message, 'utf8', 'hex') + cipher.final('hex'),
      tag: cipher.getAuthTag()
    })
  }

  /**
   * Decrypt a message by creating a key using scrypt and performing AES.
   * @param {string} secret utf8 encoded
   * @param {string} message {salt, iv, encrypted, tag} hex encoded
   * @returns {Promise<string>} utf8 encoded
   */
  async secretDecrypt (secret, message) {
    const { salt, iv, encrypt, tag } = JSON.parse(message)
    const key = crypto.scryptSync(secret, Buffer.from(salt, 'hex'), 32)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'))
    decipher.setAuthTag(Buffer.from(tag, 'hex'))
    return decipher.update(encrypt, 'hex', 'utf8') + decipher.final('utf8')
  }

  /**
   * Generate a public-private key pair using RSA.
   * @returns {Promise<{public: string, private: string}>} pem encoded
   */
  async generateKeyPair () {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    })
    return { public: publicKey, private: privateKey }
  }

  /**
   * Encrypt a message using RSA public key.
   * @param {string} key pem encoded
   * @param {string} message utf8 encoded
   * @returns {Promise<string>} hex encoded
   */
  async publicEncrypt (key, message) {
    return crypto.publicEncrypt(key, Buffer.from(message)).toString('hex')
  }

  /**
   * Decrypt a message using RSA private key.
   * @param {string} key pem encoded
   * @param {string} message hex encoded
   * @returns {Promise<string>} utf8 encoded
   */
  async privateDecrypt (key, message) {
    return crypto.privateDecrypt(key, Buffer.from(message, 'hex')).toString('utf8')
  }
}

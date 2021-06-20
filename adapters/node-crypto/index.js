import crypto from 'crypto'
import { DecentSignalCryptography } from 'decent-signal'

/**
 * Cryptography functions that use node's built in crypto.
 * TODO: can use some of the crypto async functions here instead of sync.
 */
export class DecentSignalNodeCrypto extends DecentSignalCryptography {
  /**
   * Generate a secret randomly.
   * @param {number} size
   * @returns {Promise<string>} hex encoded
   */
  async generateSecret (size) {
    return crypto.randomBytes(size).toString('hex')
  }

  /**
   * Encrypt text by creating a key using scrypt and performing AES.
   * @param {string} secret utf8 encoded
   * @param {string} text utf8 encoded
   * @returns {Promise<string>} {salt, iv, encrypt, tag} hex encoded
   */
  async secretEncrypt (secret, text) {
    const salt = crypto.randomBytes(32)
    const key = crypto.scryptSync(secret, salt, 32)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    return JSON.stringify({
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      encrypt: cipher.update(text, 'utf8', 'hex') + cipher.final('hex'),
      tag: cipher.getAuthTag()
    })
  }

  /**
   * Decrypt text by creating a key using scrypt and performing AES.
   * @param {string} secret utf8 encoded
   * @param {string} text {salt, iv, encrypted, tag} hex encoded
   * @returns {Promise<string>} utf8 encoded
   */
  async secretDecrypt (secret, text) {
    const { salt, iv, encrypt, tag } = JSON.parse(text)
    const key = crypto.scryptSync(secret, Buffer.from(salt, 'hex'), 32)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'))
    decipher.setAuthTag(Buffer.from(tag, 'hex'))
    return decipher.update(encrypt, 'hex', 'utf8') + decipher.final('utf8')
  }

  /**
   * Generate a public-private key pair using RSA.
   * @returns {Promise<{public: string, private: string}>} pem encoded
   */
  async generateKeys () {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    })
    return { public: publicKey, private: privateKey }
  }

  /**
   * Encrypt text using RSA public key.
   * @param {string} key pem encoded
   * @param {string} text utf8 encoded
   * @returns {Promise<string>} hex encoded
   */
  async publicEncrypt (key, text) {
    return crypto.publicEncrypt(key, Buffer.from(text)).toString('hex')
  }

  /**
   * Decrypt text using RSA private key.
   * @param {string} key pem encoded
   * @param {string} text hex encoded
   * @returns {Promise<string>} utf8 encoded
   */
  async privateDecrypt (key, text) {
    return crypto.privateDecrypt(key, Buffer.from(text, 'hex')).toString('utf8')
  }
}

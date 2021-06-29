import { DecentSignalCryptography } from '../interfaces/crypto'

/**
 * Cryptography functions that use node's built in crypto.
 */
export class DecentSignalNodeCrypto extends DecentSignalCryptography {
  /**
   * {crypto} node's crypto module
   */
  constructor (crypto) {
    super()
    this._crypto = crypto
  }

  /**
   * Generate a secret randomly.
   * @param {number} size
   * @returns {Promise<string>} base64 encoded
   */
  async generateSecret (size) {
    return this._crypto.randomBytes(size).toString('base64')
  }

  /**
   * Encrypt text by creating a key using scrypt and performing AES.
   * @param {string} secret utf8 encoded
   * @param {string} text utf8 encoded
   * @returns {Promise<string>} {salt, iv, enc, tag} base64 encoded
   */
  async secretEncrypt (secret, text) {
    const salt = this._crypto.randomBytes(32)
    const key = this._crypto.scryptSync(secret, salt, 32)
    const iv = this._crypto.randomBytes(16)
    const cipher = this._crypto.createCipheriv('aes-256-gcm', key, iv)
    return JSON.stringify({
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      enc: cipher.update(text, 'utf8', 'base64') + cipher.final('base64'),
      tag: cipher.getAuthTag().toString('base64')
    })
  }

  /**
   * Decrypt text by creating a key using scrypt and performing AES.
   * @param {string} secret utf8 encoded
   * @param {string} text {salt, iv, enc, tag} base64 encoded
   * @returns {Promise<string>} utf8 encoded
   */
  async secretDecrypt (secret, text) {
    const { salt, iv, enc, tag } = JSON.parse(text)
    const key = this._crypto.scryptSync(secret, Buffer.from(salt, 'base64'), 32)
    const decipher = this._crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return decipher.update(enc, 'base64', 'utf8') + decipher.final('utf8')
  }

  /**
   * Generate a public-private key pair using RSA.
   * @returns {Promise<{public: string, private: string}>} pem encoded
   */
  async generateKeys () {
    const { publicKey, privateKey } = this._crypto.generateKeyPairSync('rsa', {
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
   * @returns {Promise<string>} base64 encoded
   */
  async publicEncrypt (key, text) {
    return this._crypto.publicEncrypt(key, Buffer.from(text)).toString('base64')
  }

  /**
   * Decrypt text using RSA private key.
   * @param {string} key pem encoded
   * @param {string} text base64 encoded
   * @returns {Promise<string>} utf8 encoded
   */
  async privateDecrypt (key, text) {
    return this._crypto.privateDecrypt(key, Buffer.from(text, 'base64')).toString('utf8')
  }
}

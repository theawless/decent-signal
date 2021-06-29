import { DecentSignalCryptography } from '../interfaces/crypto'

/**
 * Cryptography functions that use web crypto.
 */
export class DecentSignalSubtleCrypto extends DecentSignalCryptography {
  /**
   * {crypto} web crypto module
   */
  constructor (crypto) {
    super()
    this._crypto = crypto
    this._enc = new TextEncoder()
    this._dec = new TextDecoder()
  }

  /**
   * Generate a secret randomly.
   * @param {number} size
   * @returns {Promise<string>} base64 encoded
   */
  async generateSecret (size) {
    const random = this._crypto.getRandomValues(new Uint8Array(size))
    return this._base64(random)
  }

  /**
   * Encrypt text by creating a key using PBKDF2 and performing AES.
   * @param {string} secret utf8 encoded
   * @param {string} text utf8 encoded
   * @returns {Promise<string>} {salt, iv, enc} base64 encoded
   */
  async secretEncrypt (secret, text) {
    const key1 = await this._crypto.subtle.importKey('raw', this._enc.encode(secret), 'PBKDF2', false, ['deriveKey'])
    const salt = this._crypto.getRandomValues(new Uint8Array(32))
    const algo = { name: 'PBKDF2', hash: 'SHA-512', salt: salt, iterations: 100000 }
    const key2 = await this._crypto.subtle.deriveKey(algo, key1, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
    const iv = this._crypto.getRandomValues(new Uint8Array(16))
    const encrypt = await this._crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key2, this._enc.encode(text))
    return JSON.stringify({
      salt: this._base64(salt),
      iv: this._base64(iv),
      enc: this._base64(new Uint8Array(encrypt))
    })
  }

  /**
   * Decrypt text by creating a key using PBKDF2 and performing AES.
   * @param {string} secret utf8 encoded
   * @param {string} text {salt, iv, enc} base64 encoded
   * @returns {Promise<string>} utf8 encoded
   */
  async secretDecrypt (secret, text) {
    const { salt, iv, enc } = JSON.parse(text)
    const key1 = await this._crypto.subtle.importKey('raw', this._enc.encode(secret), 'PBKDF2', false, ['deriveKey'])
    const algo = { name: 'PBKDF2', hash: 'SHA-512', salt: this._arr(salt), iterations: 100000 }
    const key2 = await this._crypto.subtle.deriveKey(algo, key1, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
    const decrypt = await this._crypto.subtle.decrypt({ name: 'AES-GCM', iv: this._arr(iv) }, key2, this._arr(enc))
    return this._dec.decode(decrypt)
  }

  /**
   * Generate a public-private key pair using RSA.
   * @returns {Promise<{public: string, private: string}>} base64 encoded
   */
  async generateKeys () {
    const algo = { name: 'RSA-OAEP', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-512' }
    const pair = await this._crypto.subtle.generateKey(algo, true, ['encrypt', 'decrypt'])
    const [publicKey, privateKey] = await Promise.all([
      this._crypto.subtle.exportKey('spki', pair.publicKey),
      this._crypto.subtle.exportKey('pkcs8', pair.privateKey)
    ])
    return { public: this._base64(new Uint8Array(publicKey)), private: this._base64(new Uint8Array(privateKey)) }
  }

  /**
   * Encrypt text using RSA public key.
   * @param {string} key base64
   * @param {string} text utf8
   * @returns {Promise<string>} base64
   */
  async publicEncrypt (key, text) {
    const algo = { name: 'RSA-OAEP', hash: 'SHA-512' }
    const key1 = await this._crypto.subtle.importKey('spki', this._arr(key), algo, false, ['encrypt'])
    const encrypted = await this._crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key1, this._enc.encode(text))
    return this._base64(new Uint8Array(encrypted))
  }

  /**
   * Decrypt text using RSA private key.
   * @param {string} key base64
   * @param {string} text base64
   * @returns {Promise<string>} utf8
   */
  async privateDecrypt (key, text) {
    const algo = { name: 'RSA-OAEP', hash: 'SHA-512' }
    const key1 = await this._crypto.subtle.importKey('pkcs8', this._arr(key), algo, false, ['decrypt'])
    const decrypted = await this._crypto.subtle.decrypt({ name: 'RSA-OAEP' }, key1, this._arr(text))
    return this._dec.decode(decrypted)
  }

  /**
   * Convert a base64 string to array.
   * @param {string} base64
   * @returns {Uint8Array}
   */
  _arr (base64) {
    const binary = atob(base64)
    const array = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; ++i) {
      array[i] = binary.charCodeAt(i)
    }
    return array
  }

  /**
   * Convert an array to base64 string.
   * @param {Uint8Array} array
   * @returns {string}
   */
  _base64 (array) {
    const binary = new Array(array.length)
    for (let i = 0; i < array.length; ++i) {
      binary[i] = String.fromCharCode(array[i])
    }
    return btoa(binary.join(''))
  }
}

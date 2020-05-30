import { DecentSignalCryptography } from 'decent-signal'

/**
 * Cryptography functions that use browser's built in crypto.
 * TODO: Find a library for the hex to/from array conversion.
 */
export class DecentSignalSubtleCrypto extends DecentSignalCryptography {
  /**
   * Objects for common use.
   */
  constructor () {
    super()
    this._enc = new TextEncoder()
    this._dec = new TextDecoder()
  }

  /**
   * Generate a secret randomly.
   * @returns {Promise<string>} hex encoded
   */
  async generateSecret () {
    const random = window.crypto.getRandomValues(new Uint8Array(32))
    return this._hex(random)
  }

  /**
   * Encrypt a message by creating a key using PBKDF2 and performing AES.
   * @param {string} secret utf8 encoded
   * @param {string} message utf8 encoded
   * @returns {Promise<string>} {salt, iv, encrypt} hex encoded
   */
  async secretEncrypt (secret, message) {
    const key1 = await window.crypto.subtle.importKey('raw', this._enc.encode(secret), 'PBKDF2', false, ['deriveKey'])
    const salt = window.crypto.getRandomValues(new Uint8Array(32))
    const algo = { name: 'PBKDF2', hash: 'SHA-512', salt: salt, iterations: 100000 }
    const key2 = await window.crypto.subtle.deriveKey(algo, key1, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
    const iv = window.crypto.getRandomValues(new Uint8Array(16))
    const encrypt = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key2, this._enc.encode(message))
    return JSON.stringify({ salt: this._hex(salt), iv: this._hex(iv), encrypt: this._hex(new Uint8Array(encrypt)) })
  }

  /**
   * Decrypt a message by creating a key using PBKDF2 and performing AES.
   * @param {string} secret utf8 encoded
   * @param {string} message {salt, iv, encrypt} hex encoded
   * @returns {Promise<string>} utf8 encoded
   */
  async secretDecrypt (secret, message) {
    const { salt, iv, encrypt } = JSON.parse(message)
    const key1 = await window.crypto.subtle.importKey('raw', this._enc.encode(secret), 'PBKDF2', false, ['deriveKey'])
    const algo = { name: 'PBKDF2', hash: 'SHA-512', salt: this._arr(salt), iterations: 100000 }
    const key2 = await window.crypto.subtle.deriveKey(algo, key1, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
    const decrypt = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: this._arr(iv) }, key2, this._arr(encrypt))
    return this._dec.decode(decrypt)
  }

  /**
   * Generate a public-private key pair using RSA.
   * @returns {Promise<{public: string, private: string}>} hex encoded
   */
  async generateKeyPair () {
    const algo = { name: 'RSA-OAEP', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-512' }
    const pair = await window.crypto.subtle.generateKey(algo, true, ['encrypt', 'decrypt'])
    const [publicKey, privateKey] = await Promise.all([
      window.crypto.subtle.exportKey('spki', pair.publicKey),
      window.crypto.subtle.exportKey('pkcs8', pair.privateKey)
    ])
    return { public: this._hex(new Uint8Array(publicKey)), private: this._hex(new Uint8Array(privateKey)) }
  }

  /**
   * Encrypt a message using RSA public key.
   * @param {string} key hex
   * @param {string} message utf8
   * @returns {Promise<string>} hex
   */
  async publicEncrypt (key, message) {
    const algo = { name: 'RSA-OAEP', hash: 'SHA-512' }
    const key1 = await window.crypto.subtle.importKey('spki', this._arr(key), algo, false, ['encrypt'])
    const encrypted = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key1, this._enc.encode(message))
    return this._hex(new Uint8Array(encrypted))
  }

  /**
   * Decrypt a message using RSA private key.
   * @param {string} key hex
   * @param {string} message hex
   * @returns {Promise<string>} utf8
   */
  async privateDecrypt (key, message) {
    const algo = { name: 'RSA-OAEP', hash: 'SHA-512' }
    const key1 = await window.crypto.subtle.importKey('pkcs8', this._arr(key), algo, false, ['decrypt'])
    const decrypted = await window.crypto.subtle.decrypt({ name: 'RSA-OAEP' }, key1, this._arr(message))
    return this._dec.decode(decrypted)
  }

  /**
   * Convert a hex string to array.
   * @param {string} hex
   * @returns {Uint8Array}
   */
  _arr (hex) {
    const array = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      array[i / 2] = parseInt(hex.substring(i, i + 2), 16)
    }
    return array
  };

  /**
   * Convert an array to hex string.
   * @param {Uint8Array} array
   * @returns {string}
   */
  _hex (array) {
    let hex = ''
    for (let i = 0; i < array.length; ++i) {
      const value = array[i].toString(16)
      hex += value.length === 1 ? '0' + value : value
    }
    return hex
  };
}

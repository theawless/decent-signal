/**
 * Cryptography functions that use web crypto.
 * All user text should be utf8 encoded.
 * All binary data should be base64 encoded.
 * @implements DSCryptography
 */
export class DSWebCrypto {
  /**
   * @param {object} crypto web module
   */
  constructor (crypto) {
    this._crypto = crypto
    this._encoder = new TextEncoder()
    this._decoder = new TextDecoder()
  }

  /**
   * Generate a random string or salt.
   */
  async random (size = 32) {
    const buf = this._crypto.getRandomValues(new Uint8Array(size))
    return this._base64(buf)
  }

  /**
   * Generate a secret key for AES.
   */
  async secret () {
    const key = await this._crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    )
    const buf = await this._crypto.subtle.exportKey('raw', key)
    return this._base64(new Uint8Array(buf))
  }

  /**
   * Derive a secret key using PBKDF2.
   */
  async secretFromPass (pass, salt) {
    const saltBuf = this._array(salt)
    const passObj = await this._crypto.subtle.importKey(
      'raw',
      this._encode(pass),
      'PBKDF2',
      false,
      ['deriveKey']
    )
    const key = await this._crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-512', salt: saltBuf, iterations: 100000 },
      passObj,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    )
    const keyBuf = await this._crypto.subtle.exportKey('raw', key)
    return this._base64(new Uint8Array(keyBuf))
  }

  /**
   * Encrypt plain text using AES.
   */
  async secretEncrypt (key, text) {
    const keyObj = await this._crypto.subtle.importKey(
      'raw',
      this._array(key),
      'AES-GCM',
      false,
      ['encrypt']
    )
    const ivBuf = this._crypto.getRandomValues(new Uint8Array(12))
    const encBuf = await this._crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivBuf },
      keyObj,
      this._encode(text)
    )
    return JSON.stringify({
      iv: this._base64(ivBuf),
      enc: this._base64(new Uint8Array(encBuf))
    })
  }

  /**
   * Decrypt encrypted text using AES.
   */
  async secretDecrypt (key, text) {
    const { iv, enc } = JSON.parse(text)
    if (!iv || !enc) {
      throw new Error('text was not encrypted properly')
    }
    const keyObj = await this._crypto.subtle.importKey(
      'raw',
      this._array(key),
      'AES-GCM',
      false,
      ['decrypt']
    )
    const decBuf = await this._crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this._array(iv) },
      keyObj,
      this._array(enc)
    )
    return this._decode(new Uint8Array(decBuf))
  }

  /**
   * Generate a public-private key pair using EC P-521.
   */
  async keysForAgreement () {
    const keyPair = await this._crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-521' },
      true,
      ['deriveBits']
    )
    const [publicKey, privateKey] = await Promise.all([
      this._crypto.subtle.exportKey('spki', keyPair.publicKey),
      this._crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
    ])
    return {
      public: this._base64(new Uint8Array(publicKey)),
      private: this._base64(new Uint8Array(privateKey))
    }
  }

  /**
   * Derive a secret key using DH.
   */
  async secretFromKeys (privateA, publicB) {
    const [privateKey, publicKey] = await Promise.all([
      this._crypto.subtle.importKey(
        'pkcs8',
        this._array(privateA),
        { name: 'ECDH', namedCurve: 'P-521' },
        false,
        ['deriveBits']
      ),
      this._crypto.subtle.importKey(
        'spki',
        this._array(publicB),
        { name: 'ECDH', namedCurve: 'P-521' },
        false,
        []
      )
    ])
    const buf = await this._crypto.subtle.deriveBits(
      { name: 'ECDH', public: publicKey },
      privateKey,
      528
    )
    return this._base64(new Uint8Array(buf))
  }

  /**
   * Generate a public-private key pair using RSA.
   */
  async keysForEncryption () {
    const keyPair = await this._crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-512'
      },
      true,
      ['encrypt', 'decrypt']
    )
    const [publicKey, privateKey] = await Promise.all([
      this._crypto.subtle.exportKey('spki', keyPair.publicKey),
      this._crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
    ])
    return {
      public: this._base64(new Uint8Array(publicKey)),
      private: this._base64(new Uint8Array(privateKey))
    }
  }

  /**
   * Encrypt plain text using RSA public key.
   */
  async publicEncrypt (key, text) {
    const keyObj = await this._crypto.subtle.importKey(
      'spki',
      this._array(key),
      { name: 'RSA-OAEP', hash: 'SHA-512' },
      false,
      ['encrypt']
    )
    const buf = await this._crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      keyObj,
      this._encode(text)
    )
    return this._base64(new Uint8Array(buf))
  }

  /**
   * Decrypt encrypted text using RSA private key.
   */
  async privateDecrypt (key, text) {
    const keyObj = await this._crypto.subtle.importKey(
      'pkcs8',
      this._array(key),
      { name: 'RSA-OAEP', hash: 'SHA-512' },
      false,
      ['decrypt']
    )
    const buf = await this._crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      keyObj,
      this._array(text)
    )
    return this._decode(new Uint8Array(buf))
  }

  /**
   * Convert a utf8 string to byte array.
   * @param {string} string
   * @returns {Uint8Array}
   */
  _encode (string) {
    return this._encoder.encode(string)
  }

  /**
   * Convert a byte array to utf8 string.
   * @param {Uint8Array} array
   * @returns {string}
   */
  _decode (array) {
    return this._decoder.decode(array)
  }

  /**
   * Convert a base64 string to byte array.
   * @param {string} string
   * @returns {Uint8Array}
   */
  _array (string) {
    const binary = atob(string)
    const array = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; ++i) {
      array[i] = binary.charCodeAt(i)
    }
    return array
  }

  /**
   * Convert a byte array to base64 string.
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

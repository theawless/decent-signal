/**
 * Cryptography functions that use node's built in crypto.
 * All user text should be utf8 encoded.
 * All binary data should be base64 encoded.
 * @implements DSCryptography
 */
export class DSNodeCrypto {
  /**
   * @param {object} crypto node module
   */
  constructor (crypto) {
    this._crypto = crypto
  }

  /**
   * Generate a random string or salt.
   */
  async random (size = 32) {
    return this._crypto.randomBytes(size).toString('base64')
  }

  /**
   * Generate a secret key for AES.
   */
  async secret () {
    const key = await new Promise((resolve, reject) => {
      this._crypto.generateKey('aes', { length: 256 }, (err, key) => {
        err ? reject(err) : resolve(key)
      })
    })
    return key.export().toString('base64')
  }

  /**
   * Derive a secret key using scrypt.
   */
  async secretFromPass (pass, salt) {
    const saltBuf = Buffer.from(salt, 'base64')
    const keyBuf = await new Promise((resolve, reject) => {
      this._crypto.scrypt(pass, saltBuf, 32, (err, key) => {
        err ? reject(err) : resolve(key)
      })
    })
    return keyBuf.toString('base64')
  }

  /**
   * Encrypt plain text using AES.
   */
  async secretEncrypt (key, text) {
    const keyBuf = Buffer.from(key, 'base64')
    const ivBuf = this._crypto.randomBytes(12)
    const cipher = this._crypto.createCipheriv('aes-256-gcm', keyBuf, ivBuf)
    return JSON.stringify({
      iv: ivBuf.toString('base64'),
      enc: cipher.update(text, 'utf8', 'base64') + cipher.final('base64'),
      tag: cipher.getAuthTag().toString('base64')
    })
  }

  /**
   * Decrypt encrypted text using AES.
   */
  async secretDecrypt (key, text) {
    const { iv, enc, tag } = JSON.parse(text)
    if (!iv || !enc || !tag) {
      throw new Error('text was not encrypted properly')
    }
    const keyBuf = Buffer.from(key, 'base64')
    const ivBuf = Buffer.from(iv, 'base64')
    const tagBuf = Buffer.from(tag, 'base64')
    const decipher = this._crypto.createDecipheriv('aes-256-gcm', keyBuf, ivBuf)
    decipher.setAuthTag(tagBuf)
    return decipher.update(enc, 'base64', 'utf8') + decipher.final('utf8')
  }

  /**
   * Generate a public-private key pair using EC x448.
   */
  async keysForAgreement () {
    const opts = {
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'der' }
    }
    const [publicKey, privateKey] = await new Promise((resolve, reject) => {
      this._crypto.generateKeyPair('x448', opts, (err, publicKey, privateKey) => {
        err ? reject(err) : resolve([publicKey, privateKey])
      })
    })
    return {
      public: publicKey.toString('base64'),
      private: privateKey.toString('base64')
    }
  }

  /**
   * Derive a secret key using DH.
   */
  async secretFromKeys (privateA, publicB) {
    const privateKey = this._crypto.createPrivateKey({
      key: Buffer.from(privateA, 'base64'),
      format: 'der',
      type: 'pkcs8'
    })
    const publicKey = this._crypto.createPublicKey({
      key: Buffer.from(publicB, 'base64'),
      format: 'der',
      type: 'spki'
    })
    const buf = this._crypto.diffieHellman({ privateKey, publicKey })
    return buf.toString('base64')
  }

  /**
   * Generate a public-private key pair using RSA.
   */
  async keysForEncryption () {
    const opts = {
      modulusLength: 4096,
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'der' }
    }
    const [publicKey, privateKey] = await new Promise((resolve, reject) => {
      this._crypto.generateKeyPair('rsa', opts, (err, publicKey, privateKey) => {
        err ? reject(err) : resolve([publicKey, privateKey])
      })
    })
    return {
      public: publicKey.toString('base64'),
      private: privateKey.toString('base64')
    }
  }

  /**
   * Encrypt plain text using RSA public key.
   */
  async publicEncrypt (key, text) {
    const keyObj = this._crypto.createPublicKey({
      key: Buffer.from(key, 'base64'),
      format: 'der',
      type: 'spki'
    })
    const buf = Buffer.from(text, 'utf8')
    return this._crypto.publicEncrypt(keyObj, buf).toString('base64')
  }

  /**
   * Decrypt encrypted text using RSA private key.
   */
  async privateDecrypt (key, text) {
    const keyObj = this._crypto.createPrivateKey({
      key: Buffer.from(key, 'base64'),
      format: 'der',
      type: 'pkcs8'
    })
    const buf = Buffer.from(text, 'base64')
    return this._crypto.privateDecrypt(keyObj, buf).toString('utf8')
  }
}

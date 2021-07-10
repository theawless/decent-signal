/**
 * Abstraction over various encryption methods.
 * @interface
 */
export class DSCryptography {
  /**
   * Generate a random string.
   * If size is not provided, then default salt size is used.
   * @param {number} [size] in bytes
   * @returns {Promise<string>}
   */
  async random (size) {}

  /**
   * Generate a secret key.
   * @returns {Promise<string>}
   */
  async secret () {}

  /**
   * Derive a secret key from a password and salt.
   * @param {string} pass
   * @param {string} salt
   * @returns {Promise<string>}
   */
  async secretFromPass (pass, salt) {}

  /**
   * Encrypt plain text with secret.
   * @param {string} key
   * @param {string} text
   * @returns {Promise<string>}
   */
  async secretEncrypt (key, text) {}

  /**
   * Decrypt encrypted text with secret.
   * @param {string} key
   * @param {string} text
   * @returns {Promise<string>}
   */
  async secretDecrypt (key, text) {}

  /**
   * Generate a public-private key pair to establish a shared secret.
   * @returns {Promise<{public: string, private: string}>}
   */
  async keysForAgreement () {}

  /**
   * Derive a secret key from a public-private key pair.
   * @param {string} privateA
   * @param {string} publicB
   * @returns {Promise<string>}
   */
  async secretFromKeys (privateA, publicB) {}

  /**
   * Generate a public-private key pair for encryption and decryption.
   * @returns {Promise<{public: string, private: string}>}
   */
  async keysForEncryption () {}

  /**
   * Encrypt plain text with public key.
   * @param {string} key
   * @param {string} text
   * @returns {Promise<string>}
   */
  async publicEncrypt (key, text) {}

  /**
   * Decrypt encrypted text with private key.
   * @param {string} key
   * @param {string} text
   * @returns {Promise<string>}
   */
  async privateDecrypt (key, text) {}
}

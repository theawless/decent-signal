/**
 * Abstraction over various encryption methods.
 * TODO: Add methods for elliptic curve cryptography.
 */
export class DecentSignalCryptography {
  /**
   * Generate a secret randomly.
   * @param {number} size
   * @returns {Promise<string>}
   */
  async generateSecret (size) {}

  /**
   * Encrypt plain text with secret.
   * @param {string} secret
   * @param {string} text
   * @returns {Promise<string>}
   */
  async secretEncrypt (secret, text) {}

  /**
   * Decrypt encrypted text with secret.
   * @param {string} secret
   * @param {string} text
   * @returns {Promise<string>}
   */
  async secretDecrypt (secret, text) {}

  /**
   * Generate a public-private key pair.
   * @returns {Promise<{public: string, private: string}>}
   */
  async generateKeys () {}

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

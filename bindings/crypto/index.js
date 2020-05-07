import {DecentSignalCryptography} from "../../dist/decent-signal.esm.js";
import crypto from "crypto";

/**
 * Implementation that uses node's built in crypto.
 * Maybe can use some of the crypto async functions here instead of sync.
 */
export class DecentSignalCrypto extends DecentSignalCryptography {
    /**
     * Generate a random secret.
     * @returns {Promise<string>} hex
     */
    async generateSecret() {
        return crypto.randomBytes(32).toString("hex");
    }

    /**
     * Encrypt a message by creating a key using scrypt and using aes.
     * @param {string} secret utf8
     * @param {string} message utf8
     * @returns {Promise<string>} {salt, iv, encrypted} all hex encoded
     */
    async secretEncrypt(secret, message) {
        const salt = crypto.randomBytes(32);
        const key = crypto.scryptSync(secret, salt, 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
        const encrypted = cipher.update(message, "utf8", "hex") + cipher.final("hex");
        return JSON.stringify({salt: salt.toString("hex"), iv: iv.toString("hex"), encrypted: encrypted});
    }

    /**
     * Decrypt a message by creating a key using scrypt and using aes.
     * @param {string} secret utf8
     * @param {string} message {salt, iv, encrypted} all hex encoded
     * @returns {Promise<string>} utf8
     */
    async secretDecrypt(secret, message) {
        const {salt, iv, encrypted} = JSON.parse(message);
        const key = crypto.scryptSync(secret, Buffer.from(salt, "hex"), 32);
        const decipher = crypto.createDecipheriv("aes-256-cbc", key, Buffer.from(iv, "hex"));
        return decipher.update(encrypted, "hex", "utf8") + decipher.final("utf8");
    }

    /**
     * Generate a public-private key pair using RSA.
     * @returns {Promise<{public: string, private: string}>} pem encoded keys
     */
    async generateKeyPair() {
        const {publicKey, privateKey} = crypto.generateKeyPairSync('rsa', {
            modulusLength: 4096,
            publicKeyEncoding: {type: 'spki', format: 'pem'},
            privateKeyEncoding: {type: 'pkcs8', format: 'pem'}
        });
        return {public: publicKey, private: privateKey};
    }

    /**
     * Encrypt a message using RSA public key.
     * @param {string} key pem encoded
     * @param {string} message utf8
     * @returns {Promise<string>} hex
     */
    async publicEncrypt(key, message) {
        return crypto.publicEncrypt(key, Buffer.from(message)).toString("hex");
    }

    /**
     * Decrypt a message using RSA private key.
     * @param {string} key pem encoded
     * @param {string} message hex
     * @returns {Promise<string>} utf8
     */
    async privateDecrypt(key, message) {
        return crypto.privateDecrypt(key, Buffer.from(message, "hex")).toString("utf8");
    }
}

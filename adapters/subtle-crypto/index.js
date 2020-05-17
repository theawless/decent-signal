import {DecentSignalCryptography} from "../../dist/decent-signal.esm";

/**
 * Cryptography functions that use browser's built in crypto.
 * TODO: Find a library for the hex to/from array conversion.
 */
export class DecentSignalSubtleCrypto extends DecentSignalCryptography {
    /**
     * Objects for common use.
     */
    constructor() {
        super();
        this._encoder = new TextEncoder();
        this._decoder = new TextDecoder();
    }

    /**
     * Generate a secret randomly.
     * @returns {Promise<string>} hex
     */
    async generateSecret() {
        const random = crypto.getRandomValues(new Uint8Array(64));
        return this._toHex(random);
    }

    /**
     * Encrypt a message by creating a key using PBKDF2 and performing AES.
     * @param {string} secret utf8
     * @param {string} message utf8
     * @returns {Promise<string>} {salt, iv, encrypted} all hex encoded
     */
    async secretEncrypt(secret, message) {
        const key1 = await crypto.subtle.importKey("raw", this._encoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
        const salt = crypto.getRandomValues(new Uint8Array(32));
        const key2 = await crypto.subtle.deriveKey(
            {name: "PBKDF2", hash: "SHA-512", salt: salt, iterations: 100000},
            key1,
            {name: "AES-GCM", length: 256},
            false,
            ["encrypt"]
        );
        const iv = crypto.getRandomValues(new Uint8Array(16));
        const encrypted = await crypto.subtle.encrypt({name: "AES-GCM", iv: iv}, key2, this._encoder.encode(message));
        return JSON.stringify({
            salt: this._toHex(salt),
            iv: this._toHex(iv),
            encrypted: this._toHex(new Uint8Array(encrypted))
        });
    }

    /**
     * Decrypt a message by creating a key using PBKDF2 and performing AES.
     * @param {string} secret utf8
     * @param {string} message {salt, iv, encrypted} all hex encoded
     * @returns {Promise<string>} utf8
     */
    async secretDecrypt(secret, message) {
        const {salt, iv, encrypted} = JSON.parse(message);
        const key1 = await crypto.subtle.importKey("raw", this._encoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
        const key2 = await crypto.subtle.deriveKey(
            {name: "PBKDF2", hash: "SHA-512", salt: this._toArray(salt), iterations: 100000},
            key1,
            {name: "AES-GCM", length: 256},
            false,
            ["decrypt"]
        );
        const decrypted = await crypto.subtle.decrypt(
            {name: "AES-GCM", iv: this._toArray(iv)},
            key2,
            this._toArray(encrypted)
        );
        return this._decoder.decode(decrypted);
    }

    /**
     * Generate a public-private key pair using RSA.
     * @returns {Promise<{public: string, private: string}>} hex encoded keys
     */
    async generateKeyPair() {
        const pair = await crypto.subtle.generateKey(
            {name: "RSA-OAEP", modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-512"},
            true,
            ["encrypt", "decrypt"]
        );
        const [publicKey, privateKey] = await Promise.all([
            crypto.subtle.exportKey("spki", pair.publicKey),
            crypto.subtle.exportKey("pkcs8", pair.privateKey)
        ]);
        return {public: this._toHex(new Uint8Array(publicKey)), private: this._toHex(new Uint8Array(privateKey))};
    }

    /**
     * Encrypt a message using RSA public key.
     * @param {string} key hex
     * @param {string} message utf8
     * @returns {Promise<string>} hex
     */
    async publicEncrypt(key, message) {
        const key1 = await crypto.subtle.importKey(
            "spki",
            this._toArray(key),
            {name: "RSA-OAEP", hash: "SHA-512"},
            false,
            ["encrypt"]
        );
        const encrypted = await crypto.subtle.encrypt({name: "RSA-OAEP"}, key1, this._encoder.encode(message));
        return this._toHex(new Uint8Array(encrypted));
    }

    /**
     * Decrypt a message using RSA private key.
     * @param {string} key hex
     * @param {string} message hex
     * @returns {Promise<string>} utf8
     */
    async privateDecrypt(key, message) {
        const key1 = await crypto.subtle.importKey(
            "pkcs8",
            this._toArray(key),
            {name: "RSA-OAEP", hash: "SHA-512"},
            false,
            ["decrypt"]
        );
        const decrypted = await crypto.subtle.decrypt({name: "RSA-OAEP"}, key1, this._toArray(message));
        return this._decoder.decode(decrypted);
    }

    /**
     * Convert a hex string to array.
     * @param hex {string}
     * @returns {Uint8Array}
     */
    _toArray(hex) {
        const array = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            array[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        return array;
    };

    /**
     * Convert an array to hex string
     * @param array {Uint8Array}
     * @returns {string} hex
     */
    _toHex(array) {
        let hex = "";
        for (let i = 0; i < array.length; ++i) {
            const value = array[i].toString(16);
            hex += value.length === 1 ? "0" + value : value;
        }
        return hex;
    };
}

import {DecentSignalSecretBox} from "../../dist/decent-signal.esm.js";

export class DecentSignalSjcl extends DecentSignalSecretBox {
    async encryptMessage(message) {
        sjcl.encrypt(this.password, message);
    }

    async decryptMessage(message) {
        sjcl.decrypt(this.password, message);
    }
}

import {DecentSignalPeer} from "../../dist/decent-signal.esm.js";

export class DecentSignalSimplePeer extends DecentSignalPeer {
    constructor(peer) {
        super(peer.address);
        this.peer = peer;
    }

    createOffer() {
    }

    acceptOffer() {
    }
}

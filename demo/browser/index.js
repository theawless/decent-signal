import {DecentSignal, DecentSignalNode} from "../../dist/decent-signal.esm.js";
import {
    DecentSignalLocalChat,
    DecentSignalLocalChatUser
} from "../../adapters/local-chat/dist/decent-signal-adapter-local-chat.esm.js";
import {DecentSignalSubtleCrypto} from "../../adapters/subtle-crypto/dist/decent-signal-adapter-subtle-crypto.esm.js";

/**
 * TODO: Do not use simple peer here. Try to demonstrate that decent-signal is not dependent on it.
 * Demo app for browser. See that 1. one channel can have multiple parties 2. nodes with wrong pass cannot join.
 * Serve and open the urls nodes in README to see them perform signalling and then say hi! to each other.
 * Each user rejects to do handshake with a user that is on same priority. If x1 > x2 then x2 is the initiator.
 */
class HelloWorld {
    /**
     * @param id {string}
     * @param rank {number}
     * @param party {string}
     * @param pass {string}
     */
    constructor(id, rank, party, pass) {
        this._crypto = new DecentSignalSubtleCrypto();
        this._user = new DecentSignalLocalChatUser(id, rank);
        this._chat = new DecentSignalLocalChat(this._user, "channel", "idb");
        this._signal = new DecentSignal(this._user, this._chat, this._crypto, {party: party, password: pass});
        this._peers = new Map(); // map of user id to peer
        this._onUserSeen = (user, accept) => this._handleSeen(user, accept).then();
        this._onNodeDiscovery = (node) => this._handleDiscovery(node).then();
        this._onSignalReceived = (node, data) => this._handleSignal(node, data).then();
    }

    /**
     * Start the demo.
     * @returns {Promise<void>}
     */
    async start() {
        await this._chat.joinChannel();
        await this._signal.startSignalling();
        this._signal.events.connect("user-seen", this._onUserSeen);
        this._signal.events.connect("node-discovered", this._onNodeDiscovery);
        this._signal.events.connect("signal-received", this._onSignalReceived);
    }

    /**
     * Stop the demo.
     * @returns {Promise<void>}
     */
    async stop() {
        this._signal.events.disconnect("signal-received", this._onSignalReceived);
        this._signal.events.disconnect("node-discovered", this._onNodeDiscovery);
        this._signal.events.disconnect("user-seen", this._onUserSeen);
        await this._signal.stopSignalling();
        await this._chat.leaveChannel();
    }

    /**
     * Decide whether we want to do handshake with the user.
     * @param user {DecentSignalLocalChatUser}
     * @param accept {function() : void}
     * @returns {Promise<void>}
     */
    async _handleSeen(user, accept) {
        if (this._user.rank - user.rank === 0) {
            console.log(`Skipping handshake for user ${user.id}.`);
            return;
        }
        accept();
    }

    /**
     * Create a new peer connection for each node.
     * @param node {DecentSignalNode}
     * @returns {Promise<void>}
     */
    async _handleDiscovery(node) {
        const peer = new SimplePeer({initiator: this._user.rank - node.user.rank < 0});
        this._peers.set(node.user.id, peer);
        peer.on("signal", (data) => {
            this._signal.sendSignal(node, JSON.stringify(data)).then();
        });
        peer.on("connect", () => {
            peer.send(`Hello from ${this._user.id}!`);
        });
        peer.on("data", data => {
            console.log(`Got a message: "${data}".`);
        });
    }

    /**
     * @param node {DecentSignalNode}
     * @param data {string}
     * @returns {Promise<void>}
     */
    async _handleSignal(node, data) {
        const peer = this._peers.get(node.user.id);
        peer.signal(JSON.parse(data));
    }
}

/**
 * Logs to the html page.
 */
console.log = function (...args) {
    const message = args.map(x => typeof x === "object" ? JSON.stringify(x) : x);
    document.getElementById("console").textContent += message + "\n";
};

/**
 * Async main function.
 * @returns {Promise<void>}
 */
async function main() {
    const args = new URLSearchParams(location.search);
    const demo = new HelloWorld(args.get("id"), parseInt(args.get("rank")), args.get("party"), args.get("pass"));
    await demo.start();
    window.addEventListener("beforeunload", (_) => {
        demo.stop().then();
    });
}

main().then();

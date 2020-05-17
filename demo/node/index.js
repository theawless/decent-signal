const wrtc = require("wrtc");
const Peer = require("simple-peer");
const RxDB = require("rxdb");
const snappy = require("pouchdb-adapter-snappy");
const {DecentSignal, DecentSignalNode} = require("@decent-signal/decent-signal");
const {DecentSignalNodeCrypto} = require("@decent-signal/adapter-node-crypto");
const {DecentSignalLocalChat, DecentSignalLocalChatUser} = require("@decent-signal/adapter-local-chat");

/**
 * Demo app for node. See that 1. one channel can have multiple parties 2. nodes with wrong pass cannot join.
 * Run the scripts from package.json to see them perform signalling and then say hi! to each other.
 * Each user rejects to do handshake with a user that is on same rank. If x1 > x2 then x2 is the initiator.
 *
 * Snappy was the only plugin that supports database access from multiple processes.
 * Even the node-websql plugin did not work as documented on the rxdb website.
 */
class HelloWorld {
    /**
     * @param id {string}
     * @param rank {number}
     * @param party {string}
     * @param pass {string}
     */
    constructor(id, rank, party, pass) {
        RxDB.addRxPlugin(snappy);
        this._crypto = new DecentSignalNodeCrypto();
        this._user = new DecentSignalLocalChatUser(id, rank);
        this._chat = new DecentSignalLocalChat(this._user, "channel", "snappy");
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
        if (this._user.rank === user.rank) {
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
        const peer = new Peer({wrtc: wrtc, initiator: this._user.rank - node.user.rank < 0});
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
 * Async main function.
 * @returns {Promise<void>}
 */
async function main() {
    const demo = new HelloWorld(process.argv[2], parseInt(process.argv[3]), process.argv[4], process.argv[5]);
    await demo.start();
    process.on("SIGINT", () => demo.stop().then(() => process.exit()));
}

main().then();

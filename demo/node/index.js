const {DecentSignal, DecentSignalNode, DecentSignalUser} = require("decent-signal");
const {DecentSignalCrypto} = require("decent-signal-crypto");
const {LocalChat} = require("./chat");
const wrtc = require("wrtc");
const Peer = require("simple-peer");

/**
 * Demo application for node.
 * Run the scripts from package.json to see them perform signalling and then hi! to each other.
 */
class HelloWorld {
    /**
     * Read the inputs from program arguments.
     */
    constructor() {
        this._crypto = new DecentSignalCrypto();
        this._user = new DecentSignalUser(process.argv[2], undefined);
        this._chat = new LocalChat(this._user, "channel");
        this._signal = new DecentSignal(this._user, this._chat, this._crypto, {
            party: process.argv[3],
            password: process.argv[4]
        });
        this._rank = (user) => parseInt(user.id.split("#")[0]);
        this._peers = new Map(); // map of user id to peer
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
        this._signal.events.connect("node-discovered", this._onNodeDiscovery);
        this._signal.events.connect("signal-received", this._onSignalReceived);
    }

    /**
     * Stop the demo.
     * @returns {Promise<void>}
     */
    async stop() {
        this._signal.events.disconnect("node-discovered", this._onNodeDiscovery);
        this._signal.events.disconnect("signal-received", this._onSignalReceived);
        await this._signal.stopSignalling();
        await this._chat.leaveChannel();
    }

    /**
     * Create a new peer connection for each node.
     * @param node {DecentSignalNode}
     * @returns {Promise<void>}
     */
    async _handleDiscovery(node) {
        const diff = this._rank(this._user) - this._rank(node.user);
        if (diff === 0) {
            return;
        }
        const peer = new Peer({wrtc: wrtc, initiator: diff < 0});
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
    const demo = new HelloWorld();
    await demo.start();
    process.on("SIGINT", () => demo.stop().then(() => process.exit()));
}

main().then();

/**
 * Opinionated event emitter for common use. TODO: Should we use a library?
 */
export class DecentSignalEmitter {
    /**
     * The events field is a event to list of handlers map.
     */
    constructor() {
        this.events = new Map();
    }

    /**
     * Emit an event.
     * @param {string} event
     * @param {...*} args
     */
    emit(event, ...args) {
        for (const handler of this.events.get(event) || []) {
            handler(...args);
        }
    }

    /**
     * Connect to an event.
     * The args to handler will be same as the args passed while emitting the event.
     * @param {string} event
     * @param {function(...*): void} handler
     */
    connect(event, handler) {
        this.events.set(event, this.events.get(event) || []);
        this.events.get(event).push(handler);
    }

    /**
     * Disconnect to an event.
     * This should be the same handler that was passed in the connect method.
     * @param {string} event
     * @param {function(...*): void} handler
     */
    disconnect(event, handler) {
        this.events.set(event, this.events.get(event).filter(h => h !== handler));
    }
}

/**
 * Abstraction over various encryption methods. TODO: Should we ship with a single implementation?
 * Probably won't need verify/sign because we trust the channel for user authentication.
 * The channel should make sure that the sender is who they claim to be.
 */
export class DecentSignalCryptography {
    /**
     * Encrypt a message.
     * @param {string} password
     * @param {string} message
     * @returns {Promise<string>}
     */
    async passwordEncrypt(password, message) {
    }

    /**
     * Decrypt a message.
     * @param {string} password
     * @param {string} message
     * @returns {Promise<string>}
     */
    async passwordDecrypt(password, message) {
    }

    /**
     * Generate a public-private key pair.
     * @returns {Promise<{public: string, private: string}>}
     */
    async generateKeys() {
    }

    /**
     * Encrypt a message.
     * @param {string} key
     * @param {string} message
     * @returns {Promise<string>}
     */
    async publicEncrypt(key, message) {
    }

    /**
     * Decrypt a message.
     * @param {string} key
     * @param {string} message
     * @returns {Promise<string>}
     */
    async privateDecrypt(key, message) {
    }
}

/**
 * Abstraction over a channel where the signalling information will be exchanged.
 * A channel usually corresponds to a room. In a channel we can make multiple parties.
 * This will keep number of channels in check on the server.
 * Currently this does not handle joining/creating/leaving/deleting a channel. TODO: Should it be added?
 *
 * The event "message-received" is emitted whenever there's new message in the channel.
 */
export class DecentSignalChannel {
    /**
     * Implementors need to make the connection ready before calling this.
     */
    constructor() {
        this.emitter = new DecentSignalEmitter();
    }

    /**
     * Send message to the channel.
     * @param {string} message
     * @returns {Promise<void>}
     */
    async sendMessage(message) {
    }
}

/**
 * Describes a node in the party.
 */
export class DecentSignalNode {
    /**
     * @param id {string}
     * @param key {{public: string, private: string}}
     * @param user *
     */
    constructor(id, key, user) {
        this.id = id;
        this.key = key;
        this.user = user;
    }
}

/**
 * Currently this does not handle connection offer/response creation. TODO: Should it be added?
 * The party creator will always join before other members, hence they will get all node discovery events.
 * There are no events for node disconnected because:
 * 1. if the node was never connected to then it doesn't matter if they left
 * 2. if the node was connected then the disconnected event is not a part of signalling data
 *
 * The event "node-discovered" is emitted whenever there's new node in the party.
 * The event "signal-received" is emitted whenever a node is sending signalling data.
 */
export class DecentSignal {
    /**
     * @param node {DecentSignalNode}
     * @param crypto {DecentSignalCryptography}
     * @param channel {DecentSignalChannel}
     * @param options {{password: string, party: string}}
     */
    constructor(node, channel, crypto, options) {
        this.node = node;
        this.crypto = crypto;
        this.channel = channel;
        this.options = options;
        this.nodes = [];
        this.emitter = new DecentSignalEmitter();
    }

    /**
     * Starts the signalling process. The assumptions are that:
     * 1. The channel is already created
     * 2. The user is a member of the channel and can send messages
     * @returns {Promise<void>}
     */
    async startSignalling() {
        this.channel.emitter.connect("message-received", this.onMessageReceived);
        const message = await this.crypto.passwordEncrypt(this.options.password, this.node.key.public);
        await this.channel.sendMessage(message);
    }

    /**
     * Stops the signalling process.
     * @returns {Promise<void>}
     */
    async stopSignalling() {
        this.channel.emitter.disconnect("message-received", this.onMessageReceived);
    }

    /**
     * Send signalling data to a node in the party.
     * @param node {DecentSignalNode}
     * @param stuff {string}
     * @returns {Promise<void>}
     */
    async sendSignallingData(node, stuff) {
        const message = JSON.stringify({party: this.options.party, to: node.id, stuff});
        const encrypted = await this.crypto.publicEncrypt(node.key.public, message);
        await this.channel.sendMessage(encrypted);
    }

    /**
     * Handler for message received signal from the channel.
     * @param from {string}
     * @param sender {*}
     * @param message {string}
     */
    async onMessageReceived(from, sender, message) {
        try {
            const {party, to, stuff} = JSON.parse(message);
            if (party === this.options.party) { // the message is the encrypted public key of the sending member
                if (to === undefined) {
                    try {
                        const key = await this.crypto.passwordDecrypt(this.options.password, stuff);
                        const node = new DecentSignalNode(from, {public: key, private: undefined}, sender);
                        this.nodes.push(node);
                        this.emitter.emit("node-discovered", node);
                    } catch (e) {
                        console.info(`Node ${from} did not properly encrypt their public key.`, e)
                    }
                } else if (to === this.node.id) { // the message meant for the given current node
                    const node = this.nodes.find(n => n.id === from);
                    if (node !== undefined) {
                        try {
                            const data = await this.crypto.privateDecrypt(this.node.key.private, stuff);
                            this.emitter.emit("signal-received", node, data);
                        } catch (e) {
                            console.info(`Node ${from} did not properly encrypt their signalling data.`, e)
                        }
                    } else {
                        console.info(`Node ${from} did not yet send their public key.`);
                    }
                }
            }
        } catch (e) {
            console.info(`Node ${from} sent a malformed message.`, e);
        }
    }
}

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
     * Generate a random secret.
     * @returns {Promise<string>}
     */
    async generateSecret() {
    }

    /**
     * Encrypt a message.
     * @param {string} secret
     * @param {string} message
     * @returns {Promise<string>}
     */
    async secretEncrypt(secret, message) {
    }

    /**
     * Decrypt a message.
     * @param {string} secret
     * @param {string} message
     * @returns {Promise<string>}
     */
    async secretDecrypt(secret, message) {
    }

    /**
     * Generate a public-private key pair.
     * @returns {Promise<{public: string, private: string}>}
     */
    async generateKeyPair() {
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
 * Describes a user in the channel.
 */
export class DecentSignalUser {
    /**
     * User id should be unique in the channel.
     * @param id {string}
     * @param data {*}
     */
    constructor(id, data) {
        this.id = id;
        this.data = data;
    }
}

/**
 * Describes a node in the party.
 */
export class DecentSignalNode {
    /**
     * @param user {DecentSignalUser}
     * @param key {{public: string, private: string}}
     */
    constructor(user, key) {
        this.user = user;
        this.key = key;
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
 *
 * TODO: All types of chanell messages that this class sends should be documented.
 */
export class DecentSignal {
    /**
     * @param user {DecentSignalUser}
     * @param crypto {DecentSignalCryptography}
     * @param channel {DecentSignalChannel}
     * @param options {{party: string, password: string}}
     */
    constructor(user, channel, crypto, options) {
        this.node = new DecentSignalNode(user, undefined);
        this.crypto = crypto;
        this.channel = channel;
        this.options = options;
        this.nodes = [];
        this.emitter = new DecentSignalEmitter();
        this.onMessageReceived = (from, message) => {
            this.receiveMessage(from, message).then();
        };
    }

    /**
     * Start the signalling process. The assumptions are that:
     * 1. The channel is already created
     * 2. The user is a member of the channel and can send messages
     * @returns {Promise<void>}
     */
    async startSignalling() {
        this.node.key = await this.crypto.generateKeyPair();
        this.channel.emitter.connect("message-received", this.onMessageReceived);
        await this.sendPublicKey();
    }

    /**
     * Send current node's public key to the channel.
     * @returns {Promise<void>}
     */
    async sendPublicKey() {
        const stuff = await this.crypto.secretEncrypt(this.options.password, this.node.key.public);
        const message = JSON.stringify({party: this.options.party, to: undefined, stuff: stuff});
        await this.channel.sendMessage(message);
    }

    /**
     * Find the node associated with the given user.
     * @param user {DecentSignalUser}
     * @returns {Promise<DecentSignalNode>}
     */
    findNode(user) {
        return this.nodes.find(n => n.user.id === user.id);
    }

    /**
     * Stop the signalling process.
     * @returns {Promise<void>}
     */
    async stopSignalling() {
        this.channel.emitter.disconnect("message-received", this.onMessageReceived);
    }

    /**
     * Send signalling data {party, to, stuff} to a node in the party after encryption.
     * @param user {DecentSignalUser}
     * @param data {string}
     * @returns {Promise<void>}
     */
    async sendSignallingData(user, data) {
        const node = this.findNode(user);
        const secret = await this.crypto.generateSecret();
        const encrypted_secret = await this.crypto.publicEncrypt(node.key.public, secret);
        const encrypted_data = await this.crypto.secretEncrypt(secret, data);
        const stuff = JSON.stringify({secret: encrypted_secret, data: encrypted_data})
        const message = JSON.stringify({party: this.options.party, to: user.id, stuff: stuff});
        await this.channel.sendMessage(message);
    }

    /**
     * Handler for message received signal from the channel.
     * @param from {DecentSignalUser}
     * @param message {string} {party, to, stuff}
     */
    async receiveMessage(from, message) {
        try {
            const {party, to, stuff} = JSON.parse(message);
            if (party === this.options.party) {
                const node = this.findNode(from);
                if (to === undefined && from.id !== this.node.user.id) {
                    // the message is the encrypted public key of the sending member
                    try {
                        if (node === undefined) {
                            const key = await this.crypto.secretDecrypt(this.options.password, stuff);
                            const node = new DecentSignalNode(from, {public: key, private: undefined});
                            this.nodes.push(node);
                            await this.sendPublicKey();
                            // TODO: Do a handshake before node discovery.
                            // ultra hack. we want to wait for the public key to actually be sent to the channel
                            // before sending out this event, otherwise the client might start sending signalling data
                            setTimeout(() => this.emitter.emit("node-discovered", from), 2000);
                        }
                    } catch (e) {
                        console.info(`User ${from.id} did not properly encrypt their public key.`, e)
                    }
                } else if (to === this.node.user.id) {
                    // the message is meant for the current node
                    if (node !== undefined) {
                        try {
                            const {secret, data} = JSON.parse(stuff);
                            const plain_secret = await this.crypto.privateDecrypt(this.node.key.private, secret);
                            const plain_data = await this.crypto.secretDecrypt(plain_secret, data);
                            this.emitter.emit("signal-received", from, plain_data);
                        } catch (e) {
                            console.info(`User ${from.id} did not properly encrypt their signalling data.`, e)
                        }
                    } else {
                        console.info(`User ${from.id} did not yet send their public key.`);
                    }
                }
            }
        } catch (e) {
            console.info(`User ${from.id} sent a malformed message.`, e);
        }
    }
}

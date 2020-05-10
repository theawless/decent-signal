const {DecentSignalChannel, DecentSignalMessage, DecentSignalUser} = require("decent-signal");
const RxDB = require("rxdb");
const snappy = require("pouchdb-adapter-snappy");

/**
 * Hacky implementation for a local chat using rxdb.
 * Interestingly, wasn't able to get any pouch db adapter to work with multiple processes.
 * Snappy snap was the only one that works, even websql didn't work which was mentioned in the docs.
 */
class LocalChat extends DecentSignalChannel {
    SCHEMA = {
        "version": 0,
        "properties": {
            "from": {"type": "string"},
            "to": {"type": "string"},
            "party": {"type": "string"},
            "type": {"type": "string"},
            "message": {"type": "string"}
        }
    };

    /**
     * @param user {DecentSignalUser}
     * @param name {string}
     */
    constructor(user, name) {
        super();
        this._user = user;
        this._name = name;
        RxDB.addRxPlugin(snappy);
    }

    /**
     * Join the channel by listening to all message insertion events.
     * @returns {Promise<void>}
     */
    async joinChannel() {
        this._db = await RxDB.createRxDatabase({name: this._name, adapter: "snappy"});
        await this._db.collection({name: "messages", schema: this.SCHEMA});
        this._db.messages.insert$.subscribe(change => {
            this._handleInsert(change.documentData);
        });
    }

    /**
     * Send a message receive notification.
     * @param entry according to schemata
     */
    _handleInsert(entry) {
        const from = new DecentSignalUser(entry.from, undefined);
        const to = entry.to === "" ? undefined : new DecentSignalUser(entry.to, undefined);
        const message = new DecentSignalMessage(entry.party, to, entry.type, entry.message);
        this.events.emit("message-received", from, message);
    }

    /**
     * Stop listening to updates in the file.
     * @returns {Promise<void>}
     */
    async leaveChannel() {
        await this._db.destroy;
    }

    /**
     * Send message to the channel.
     * @param message {DecentSignalMessage}
     * @returns {Promise<void>}
     */
    async sendMessage(message) {
        const doc = {
            to: message.to === undefined ? "" : message.to.id,
            party: message.party,
            type: message.type,
            from: this._user.id,
            message: message.message
        };
        await this._db.messages.insert(doc);
    }
}

module.exports.LocalChat = LocalChat;

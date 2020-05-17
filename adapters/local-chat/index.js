import {DecentSignalChannel, DecentSignalMessage, DecentSignalUser} from "../../dist/decent-signal.esm";

/**
 * Add rank to the decent signal user description.
 */
export class DecentSignalLocalChatUser extends DecentSignalUser {
    constructor(id, rank) {
        super(id);
        this.rank = rank;
    }
}

/**
 * Hacky implementation for a local chat using rxdb.
 * Assumes that the right database adapter is already added to RxDB by the caller.
 */
export class DecentSignalLocalChat extends DecentSignalChannel {
    SCHEMA = {
        "version": 0,
        "properties": {
            "from_id": {"type": "string"},
            "from_rank": {"type": "number"},
            "to_id": {"type": "string"},
            "to_rank": {"type": "number"},
            "party": {"type": "string"},
            "type": {"type": "string"},
            "message": {"type": "string"}
        }
    };

    /**
     * @param user {DecentSignalLocalChatUser}
     * @param channel {string}
     * @param adapter {string}
     */
    constructor(user, channel, adapter) {
        super();
        this._user = user;
        this._channel = channel;
        this._adapter = adapter;
    }

    /**
     * Join the channel by listening to all message insertion events.
     * @returns {Promise<void>}
     */
    async joinChannel() {
        this._db = await RxDB.createRxDatabase({name: this._channel, adapter: this._adapter});
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
        const from = new DecentSignalLocalChatUser(entry.from_id, entry.from_rank);
        const to = entry.to_id === "" ? undefined : new DecentSignalLocalChatUser(entry.to_id, entry.to_rank);
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
            from_id: this._user.id,
            from_rank: this._user.rank,
            to_id: message.to === undefined ? "" : message.to.id,
            to_rank: message.to === undefined ? -1 : message.to.rank,
            party: message.party,
            type: message.type,
            message: message.message
        };
        await this._db.messages.insert(doc);
    }
}

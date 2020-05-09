const {DecentSignalChannel, DecentSignalMessage, DecentSignalUser} = require("decent-signal");
const fs = require("fs");

/**
 * Hacky implementation for a chat using a local file.
 * We are using some sync functions because watchers + read/write doesn't work well together.
 */
class FileChat extends DecentSignalChannel {
    /**
     * @param user {DecentSignalUser}
     * @param path {string}
     */
    constructor(user, path) {
        super();
        this._user = user;
        this._path = path;
        this._onFileChanged = (_, __) => this._handleFileChange().then();
    }

    /**
     * Create the chat file.
     * @returns {Promise<void>}
     */
    async createChannel() {
        const file = await fs.promises.open(this._path, "a+");
        await file.close();
    }

    /**
     * Join the channel by listening to the file events.
     * @returns {Promise<void>}
     */
    async joinChannel() {
        this.lines = fs.readFileSync(this._path).toString().split("\n");
        fs.watchFile(this._path, this._onFileChanged);
    }

    /**
     * Stop listening to updates in the file.
     * @returns {Promise<void>}
     */
    async leaveChannel() {
        fs.unwatchFile(this._path, this._onFileChanged);
    }

    /**
     * Delete the chat file.
     * @returns {Promise<void>}
     */
    async deleteChannel() {
        await fs.promises.unlink(this._path);
    }

    /**
     * Handle watch file event and send message-received signal for new messages.
     */
    async _handleFileChange() {
        const oldLines = this.lines;
        this.lines = fs.readFileSync(this._path).toString().split("\n");
        for (const line of this.lines) {
            if (line !== undefined && oldLines.indexOf(line) === -1) {
                const entry = JSON.parse(line);
                const from = new DecentSignalUser(entry.from, undefined);
                const to = entry.to === undefined ? undefined : new DecentSignalUser(entry.to, undefined);
                const message = new DecentSignalMessage(entry.party, to, entry.type, entry.text);
                this.events.emit("message-received", from, message);
            }
        }
    }

    /**
     * Send message to the channel.
     * @param message {DecentSignalMessage}
     * @returns {Promise<void>}
     */
    async sendMessage(message) {
        const line = JSON.stringify({
            from: this._user.id,
            to: message.to === undefined ? undefined : message.to.id,
            party: message.party,
            type: message.type,
            text: message.message
        });
        this.lines.push(line);
        fs.writeFileSync(this._path, this.lines.join("\n"));
    }
}

module.exports.FileChat = FileChat;

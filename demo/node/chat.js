const fs = require("fs");
const ds = require("decent-signal");

class FileChat extends ds.DecentSignalChannel {
    constructor(user, path) {
        super();
        this.user = user;
        this.path = path;
    }

    async create() {
        this.file = await fs.promises.open(this.path, "a+");
        this.lines = (await this.file.readFile()).toString().split("\n");
        fs.watchFile(this.path, (_, __) => {
            const oldLines = this.lines
            this.file.readFile().then(buffer => {
                this.lines = dbuffer.toString().split("\n");
                for (const line of this.lines) {
                    if (line && oldLines.indexOf(line) === -1) {
                        const [id, message] = line.split(" :###: ");
                        const user = new ds.DecentSignalUser(id, undefined);
                        this.emitter.emit("message-received", user, message);
                    }
                }
            });
        });
    }

    async close() {
        await this.file.close();
        await fs.promises.unlink(this.path);
    }

    async sendMessage(message) {
        await this.file.write(this.user.id + " :###: " + message + "\n");
    }
}

module.exports.FileChat = FileChat;

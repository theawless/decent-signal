const ds = require("decent-signal");
const dsc = require("decent-signal-crypto");
const wrtc = require('wrtc');
const Peer = require("simple-peer");
const c = require("./chat");

async function main() {
    const user = new ds.DecentSignalUser(process.argv[2], undefined);
    const chat = new c.FileChat(user, "channel.txt");
    const crypto = new dsc.DecentSignalCrypto();
    const signal = new ds.DecentSignal(user, chat, crypto, {
        party: process.argv[3],
        password: process.argv[4]
    });
    await chat.create();
    await signal.startSignalling();

    const peers = new Map();
    signal.emitter.connect("node-discovered", (which) => {
        const peer = new Peer({wrtc: wrtc, initiator: user.id < which.id});
        peer.on("signal", (data) => {
            const stuff = JSON.stringify(data);
            signal.sendSignallingData(which, stuff);
        });
        peer.on('connect', () => {
            peer.send(`Hello from ${user.id}!`);
        })
        peer.on('data', data => {
            console.log(`Got a message: ${data}`)
        })
        peers.set(which.id, peer);
    });
    signal.emitter.connect("signal-received", (from, stuff) => {
        const peer = peers.get(from.id);
        const data = JSON.parse(stuff);
        peer.signal(data);
    });
}

main().then();

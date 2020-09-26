const RxDB = require('rxdb')
const snappy = require('pouchdb-adapter-snappy')
const {
  DecentSignalPublicKeyCommunicator,
  DecentSignal,
  DecentSignalParty,
  DecentSignalChannel,
  DecentSignalUser,
  DecentSignalMessage
} = require('decent-signal')
const { DecentSignalNodeCrypto } = require('decent-signal-adapter-node-crypto')
const { DecentSignalLocalChat } = require('decent-signal-adapter-local-chat')

/**
 * Example for node + crypto + public key communication + local chat as a channel + party system.
 * If the ids of the users differ by more than 1 then they do not connect.
 * Notice that nodes with wrong pass cannot join a party.
 */
class Demo {
  /**
   * @param {RxDatabaseBase} db
   * @param {string} id
   * @param {string} party
   * @param {string} pass
   */
  constructor (db, { id, party, pass }) {
    this._user = new DecentSignalUser(id)
    const crypto = new DecentSignalNodeCrypto()
    const communicator = new DecentSignalPublicKeyCommunicator(crypto)
    const local = new DecentSignalLocalChat(db, this._user)
    const chat = new DecentSignalParty(local, crypto, { party, pass })
    const server = new DecentSignalChannel(chat)
    this._signal = new DecentSignal(communicator, server)
    this._onUserSeen = (user) => this._handleUser(user, true).then()
    this._onUserLeft = (user) => this._handleUser(user, false).then()
    this._onMessageReceived = (from, message) => this._handleMessage(from, message).then()
  }

  /**
   * Start the demo.
   */
  async start () {
    await this._signal.startSignalling()
    this._signal.events.connect('user-seen', this._onUserSeen)
    this._signal.events.connect('user-left', this._onUserLeft)
    this._signal.events.connect('message-received', this._onMessageReceived)
  }

  /**
   * Stop the demo.
   */
  async stop () {
    this._signal.events.disconnect('message-received', this._onMessageReceived)
    this._signal.events.disconnect('user-left', this._onUserLeft)
    this._signal.events.disconnect('user-seen', this._onUserSeen)
    await this._signal.stopSignalling()
  }

  /**
   * Display the incoming message.
   * @param {DecentSignalUser} from
   * @param {DecentSignalMessage} message
   */
  async _handleMessage (from, message) {
    console.info(`Got message "${message.text}" from user ${from.id}.`)
  }

  /**
   * Display user activity and respond to it.
   * @param {DecentSignalUser} from
   * @param {boolean} active
   */
  async _handleUser (from, active) {
    if (active) {
      console.info(`User ${from.id} seen on the server.`)
      if (Math.abs(parseInt(this._user.id) - parseInt(from.id)) === 1) {
        await this._signal.connectUser(from)
        console.info(`Connected to user ${from.id}.`)
        const message = new DecentSignalMessage(`Hello! from ${this._user.id}`)
        await this._signal.sendMessage(from, message)
      } else {
        console.info(`Ignored user ${from.id}.`)
      }
    } else {
      console.info(`User ${from.id} has left the server.`)
    }
  }
}

/**
 * Async main function.
 *
 * Snappy was the only plugin that supports database access from multiple processes.
 * Even the node-websql plugin did not work as documented on the rxdb website.
 */
async function main () {
  RxDB.addRxPlugin(snappy)
  const db = await RxDB.createRxDatabase({ name: 'demo', adapter: 'snappy' })
  const demo = new Demo(db, { id: process.argv[2], party: process.argv[3], pass: process.argv[4] })
  await demo.start()
  setTimeout(async () => {
    await demo.stop()
    await db.destroy()
  }, 10000)
}

main().then()

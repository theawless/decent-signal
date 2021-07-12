import { DSMessage } from './models/message'
import { DSEventEmitter } from './utilities/events'

/**
 * @event DSWebrtcSignaller#event:initiator
 * @param {DSUser} user
 * @param {() => Promise<void>} connect
 * @param {(DSWebrtcPeer) => void} setup
 */

/**
 * @event DSWebrtcSignaller#event:responder
 * @param {() => Promise<void>} connect
 * @param {(DSWebrtcPeer) => void} setup
 */

/**
 * Cryptographically secure signalling for webrtc.
 * @implements DSEventsProvider
 */
export class DSWebrtcSignaller {
  /**
   * @param {DSCommunicator} communicator
   */
  constructor (communicator) {
    this._emitter = new DSEventEmitter()
    this._comm = communicator
    this._peers = new Map() // user id to peer
    this._handlers = new Map() // user id to handlers
    this._onUserJoin = (user, connect) => this._handleUserFound(user, connect, false)
    this._onUserSeen = (user, connect) => this._handleUserFound(user, connect, true)
    this._onUserLeft = (user) => this._handleUserLeft(user)
    this._onMessageReceived = (from, message) => this._handleMessage(from, message).then()
  }

  /**
   * @returns {DSEvents}
   */
  get events () {
    return this._emitter
  }

  /**
   * Start signalling.
   */
  async start () {
    await this._comm.start()
    this._comm.events.connect('user-join', this._onUserJoin)
    this._comm.events.connect('user-seen', this._onUserSeen)
    this._comm.events.connect('user-left', this._onUserLeft)
    this._comm.events.connect('message-received', this._onMessageReceived)
  }

  /**
   * Stop signalling.
   */
  async stop () {
    this._comm.events.disconnect('message-received', this._onMessageReceived)
    this._comm.events.disconnect('user-seen', this._onUserSeen)
    this._comm.events.disconnect('user-left', this._onUserLeft)
    this._comm.events.disconnect('user-join', this._onUserJoin)
    await this._comm.stop()
  }

  /**
   * Notify when an existing user is seen or a new user joins.
   * Depending on who comes first, the initiator is determined.
   * @param {DSUser} user
   * @param {() => Promise<void>} connect
   * @param {boolean} initiator
   */
  _handleUserFound (user, connect, initiator) {
    const setup = (peer) => {
      this._peers.set(user.id, peer)
      const signal = (data) => {
        const message = new DSMessage(data)
        this._comm.send(user, message).then()
      }
      this._handlers.set(user.id, signal)
      peer.events.connect('signal', signal)
    }
    const action = initiator ? 'initiator' : 'responder'
    this._emitter.emit(action, user, connect, setup)
  }

  /**
   * Clear our state when user leaves.
   * The webrtc connection might still not be broken.
   * @param {DSUser} user
   */
  _handleUserLeft (user) {
    if (this._peers.has(user.id)) {
      const peer = this._peers.get(user.id)
      const signal = this._handlers.get(user.id)
      peer.events.disconnect('signal', signal)
      this._handlers.delete(user.id)
      this._peers.delete(user.id)
    }
  }

  /**
   * Pass the signal data to the peer.
   * @param {DSUser} from
   * @param {DSMessage} message
   */
  async _handleMessage (from, message) {
    if (this._peers.has(from.id)) {
      const peer = this._peers.get(from.id)
      await peer.signal(message.data)
    }
  }
}

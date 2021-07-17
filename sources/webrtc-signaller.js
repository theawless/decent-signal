import { DSMessage } from './models/message'
import { DSEventEmitter } from './utilities/events'

/**
 * @event DSWebrtcSignaller#event:user-join
 * @param {DSUser} user
 * @param {{
 *   connect: () => Promise<void>,
 *   setup: (DSWebrtcPeer) => void
 * }} request
 */

/**
 * @event DSWebrtcSignaller#event:user-seen
 * @param {DSUser} user
 * @param {{
 *   connect: () => Promise<void>,
 *   setup: (DSWebrtcPeer) => void
 * }} request
 */

/**
 * @event DSWebrtcSignaller#event:user-left
 * @param {DSUser} user
 */

/**
 * Cryptographically secure webrtc signalling.
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
    this._onUserJoin = (...args) => this._handleFound('join', ...args)
    this._onUserSeen = (...args) => this._handleFound('seen', ...args)
    this._onUserLeft = (user) => this._handleLeft(user)
    this._onMessageReceived = (...args) => this._handleMessage(...args).then()
  }

  get events () {
    return this._emitter
  }

  /**
   * Start signalling.
   */
  async start () {
    this._comm.events.on('user-join', this._onUserJoin)
    this._comm.events.on('user-seen', this._onUserSeen)
    this._comm.events.on('user-left', this._onUserLeft)
    this._comm.events.on('message-received', this._onMessageReceived)
    await this._comm.start()
  }

  /**
   * Stop signalling.
   */
  async stop () {
    this._comm.events.off('user-join', this._onUserJoin)
    this._comm.events.off('user-seen', this._onUserSeen)
    this._comm.events.off('user-left', this._onUserLeft)
    this._comm.events.off('message-received', this._onMessageReceived)
    await this._comm.stop()
  }

  /**
   * Emit user update and ask clients to connect and setup or not.
   * @param {string} action
   * @param {DSUser} user
   * @param {() => Promise<void>} connect
   */
  _handleFound (action, user, connect) {
    const setup = (peer) => {
      this._peers.set(user.id, peer)
      const handler = (data) => {
        const message = new DSMessage(data)
        this._comm.send(user, message).then()
      }
      this._handlers.set(user.id, handler)
      peer.events.on('signal', handler)
    }
    this._emitter.emit(`user-${action}`, user, { connect, setup })
  }

  /**
   * Emit user update and clear our state.
   * The webrtc connection might still not be broken.
   * @param {DSUser} user
   */
  _handleLeft (user) {
    if (this._peers.has(user.id)) {
      const peer = this._peers.get(user.id)
      const handler = this._handlers.get(user.id)
      peer.events.off('signal', handler)
      this._handlers.delete(user.id)
      this._peers.delete(user.id)
      this._emitter.emit('user-left', user)
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

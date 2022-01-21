import { DSEventEmitter } from '../../utilities/events'

/**
 * @event DSSimplePeer#event:signal
 * @param {string} data
 */
/**
 * Abstraction over the famous simple peer library.
 * @implements DSWebrtcPeer
 */
export class DSSimplePeer {
  /**
   * @param {(boolean) => SimplePeer} factory
   */
  constructor (factory) {
    this._emitter = new DSEventEmitter()
    this._factory = factory
  }

  get events () {
    return this._emitter
  }

  /**
   * Build and set up the internal peer instance.
   */
  setup (initiator) {
    this._peer = this._factory(initiator)
    this._peer.on('signal', (data) => {
      this._emitter.emit('signal', JSON.stringify(data))
    })
  }

  async signal (data) {
    this._peer.signal(JSON.parse(data))
  }

  /**
   * Wait for the error and connect events.
   */
  async signalling () {
    return new Promise((resolve, reject) => {
      this._peer.on('connect', () => resolve())
      this._peer.on('error', (err) => reject(err))
    })
  }
}

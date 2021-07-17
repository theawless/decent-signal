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
   * @param {SimplePeer} peer
   */
  constructor (peer) {
    this._emitter = new DSEventEmitter()
    this._peer = peer
    this._peer.on('signal', (data) => {
      this._emitter.emit('signal', JSON.stringify(data))
    })
  }

  get events () {
    return this._emitter
  }

  /**
   * @returns {SimplePeer}
   */
  get peer () {
    return this._peer
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

import { DSEventEmitter } from '../../utilities/events'

/**
 * @event DSManualPeer#event:signal
 * @param {string} data
 */

/**
 * Signalling helper for the rtc peer connection.
 * @implements DSWebrtcPeer
 * @todo Can perfect negotiation be used here?
 */
export class DSManualPeer {
  /**
   * @param {object} wrtc
   * @param {RTCPeerConnection} peer
   * @param {boolean} initiator
   */
  constructor (wrtc, peer, initiator) {
    this._emitter = new DSEventEmitter()
    this._wrtc = wrtc
    this._peer = peer
    if (initiator) {
      this._peer.addEventListener('negotiationneeded', async () => {
        const offer = await this._peer.createOffer()
        await this._peer.setLocalDescription(offer)
        const data = JSON.stringify({ offer: this._peer.localDescription })
        this._emitter.emit('signal', data)
      })
    }
    this._peer.addEventListener('icecandidate', async (event) => {
      if (event.candidate) {
        const data = JSON.stringify({ ice: event.candidate })
        this._emitter.emit('signal', data)
      }
    })
  }

  get events () {
    return this._emitter
  }

  /**
   * @returns {RTCPeerConnection}
   */
  get peer () {
    return this._peer
  }

  /**
   * Extract offer/answer/ice from the signal and use it.
   */
  async signal (data) {
    const signal = JSON.parse(data)
    if (signal.answer) {
      const desc = new this._wrtc.RTCSessionDescription(signal.answer)
      await this._peer.setRemoteDescription(desc)
    } else if (signal.offer) {
      const desc = new this._wrtc.RTCSessionDescription(signal.offer)
      await this._peer.setRemoteDescription(desc)
      const answer = await this._peer.createAnswer()
      await this._peer.setLocalDescription(answer)
      const data = JSON.stringify({ answer: this._peer.localDescription })
      this._emitter.emit('signal', data)
    } else if (signal.ice) {
      const ice = new this._wrtc.RTCIceCandidate(signal.ice)
      await this._peer.addIceCandidate(ice)
    } else {
      console.log('Ignoring unexpected signal type.')
    }
  }

  /**
   * Wait for terminal state of the connection change event.
   */
  async signalling () {
    return new Promise((resolve, reject) => {
      this._peer.addEventListener('connectionstatechange', () => {
        if (this._peer.connectionState === 'connected') {
          resolve()
        } else if (this._peer.connectionState === 'failed') {
          reject(new Error('connection failed'))
        }
      })
    })
  }
}

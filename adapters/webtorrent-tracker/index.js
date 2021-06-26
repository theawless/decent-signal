import { DecentSignalChat, DecentSignalMessage, DecentSignalUser } from 'decent-signal'

/**
 * Peer id and info hash are both unique, but trackers do not enforce that.
 */
export class DecentSignalWebtorrentTrackerUser extends DecentSignalUser {
  /**
   * @param {string} peerId
   * @param {string} infoHash
   * @param {number} numWant
   */
  constructor (peerId, infoHash, numWant = 5) {
    super(peerId)
    this._peerId = peerId
    this._infoHash = infoHash
    this._numWant = numWant
  }

  /**
   * @returns {string}
   */
  get peerId () {
    return this._peerId
  }

  /**
   * @returns {string}
   */
  get infoHash () {
    return this._infoHash
  }

  /**
   * @returns {number}
   */
  get numWant () {
    return this._numWant
  }
}

/**
 * Hacky implementation for a chat using webtorrent tracker.
 */
export class DecentSignalWebtorrentTracker extends DecentSignalChat {
  /**
   * The socket should already be connected.
   * @param {WebSocket} socket
   * @param {DecentSignalWebtorrentTrackerUser} user
   */
  constructor (socket, user) {
    super()
    this._user = user
    this._socket = socket
    this._onMessage = (event) => this._handleMessage(JSON.parse(event.data))
  }

  /**
   * Start listening to tracker updates.
   */
  async joinChat () {
    this._socket.addEventListener('message', this._onMessage)
    this._announce({ event: 'started' })
  }

  /**
   * Stop listening to tracker updates.
   */
  async leaveChat () {
    this._announce({ event: 'stopped' })
    this._socket.removeEventListener('message', this._onMessage)
  }

  /**
   * Send message by updating the tracker.
   * The trackers help establish webrtc signalling over websockets.
   * They expect that only offers and answers are sent through them,
   * but for our use case we have hack-ily sent our encrypted messages.
   * @param {DecentSignalUser | undefined} to
   * @param {DecentSignalMessage} message
   */
  async sendMessage (to, message) {
    if (to) {
      this._announce({ to_peer_id: to.id, answer: message.text })
    } else {
      // just broadcast the same message to everybody
      const offers = Array(this._user.numWant).fill({
        offer: { sdp: message.text }, offer_id: 'notRandom'
      })
      this._announce({ offers })
    }
  }

  /**
   *
   * @param {object} opts
   */
  _announce (opts) {
    const defaultOpts = {
      action: 'announce',
      peer_id: this._user.peerId,
      info_hash: this._user.infoHash,
      numwant: this._user.numWant
    }
    const allOpts = { ...defaultOpts, ...opts }
    this._socket.send(JSON.stringify(allOpts))
  }

  /**
   * Handle the incoming message.
   * @param {object} data
   */
  _handleMessage (data) {
    if (data.info_hash !== this._user.infoHash) {
      return
    }
    if (!data.peer_id || data.peer_id === this._user.peerId) {
      return
    }
    const from = new DecentSignalUser(data.peer_id)
    if (data.offer && data.offer.sdp) {
      const message = new DecentSignalMessage(data.offer.sdp)
      this.events.emit('message-received', from, message)
    } else if (data.answer) {
      const message = new DecentSignalMessage(data.answer)
      this.events.emit('message-received', from, message)
    }
  }
}

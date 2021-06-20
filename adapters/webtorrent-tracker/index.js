import { DecentSignalChat, DecentSignalMessage, DecentSignalUser } from 'decent-signal'

/**
 * Peer id and info hash are both unique, but trackers do not enforce that.
 */
export class DecentSignalWebtorrentTrackerUser extends DecentSignalUser {
  /**
   * @param {string} peerId
   * @param {string} infoHash
   */
  constructor (peerId, infoHash) {
    super(peerId)
    this._peerId = peerId
    this._infoHash = infoHash
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
   * @param {DecentSignalUser | undefined} to
   * @param {DecentSignalMessage} message
   */
  async sendMessage (to, message) {
    if (to === undefined) {
      this._announce({ offers: [{ offer: message.text }] })
    } else {
      this._announce({ to_peer_id: to.id, answer: message.text })
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
      numwant: 50
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
    if (data.peer_id === undefined || data.peer_id === this._user.peerId) {
      return
    }
    console.log('wtf', data.info_hash, data.peer_id)
    const from = new DecentSignalUser(data.peer_id)
    if (data.offer !== undefined) {
      const message = new DecentSignalMessage(data.offer)
      this.events.emit('message-received', from, message)
    } else if (data.answer !== undefined) {
      const message = new DecentSignalMessage(data.answer)
      this.events.emit('message-received', from, message)
    }
  }
}

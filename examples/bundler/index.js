import {
  DSCommunicator,
  DSInMemoryKeystore,
  DSManualPeer,
  DSMessage,
  DSPublicKeySystem,
  DSSyncedRxDBService,
  DSUser,
  DSWebCrypto,
  DSWebrtcSignaller
} from 'decent-signal'

/**
 * Example for bundler.
 */
class Demo {
  /**
   * @param {RxDatabaseBase} db
   * @param {string} id
   */
  constructor (db, { id }) {
    this._user = new DSUser(id)
    this._service = new DSSyncedRxDBService(db, this._user)
    const crypto = new DSWebCrypto(window.crypto)
    const store = new DSInMemoryKeystore()
    const system = new DSPublicKeySystem(crypto, store)
    const comm = new DSCommunicator(this._service, system)
    this._signal = new DSWebrtcSignaller(comm)
    this._users = new Map() // user id to user
    this._peers = new Map() // user id to peer
    this._feeds = new Map() // user id to feed
    this._onSignalUserJoin = (...args) => this._handleSignalUser(...args, false).then()
    this._onSignalUserSeen = (...args) => this._handleSignalUser(...args, true).then()
    this._onServiceUserJoin = (user) => this._handleServiceUser(user, 'join')
    this._onServiceUserSeen = (user) => this._handleServiceUser(user, 'seen')
    this._onServiceUserLeft = (user) => this._handleServiceUser(user, 'left')
    this._onServiceMessageReceived = (...args) => this._handleServiceMessage(...args)
  }

  /**
   * Start the demo.
   */
  async start () {
    this._setupUI()
    this._signal.events.on('user-join', this._onSignalUserJoin)
    this._signal.events.on('user-seen', this._onSignalUserSeen)
    this._service.events.on('user-join', this._onServiceUserJoin)
    this._service.events.on('user-seen', this._onServiceUserSeen)
    this._service.events.on('user-left', this._onServiceUserLeft)
    this._service.events.on('message-received', this._onServiceMessageReceived)
    await this._signal.start()
  }

  /**
   * Stop the demo.
   */
  async stop () {
    this._users.clear()
    for (const feed of this._feeds.values()) {
      feed.close()
    }
    this._feeds.clear()
    for (const peer of this._peers.values()) {
      peer.close()
    }
    this._peers.clear()
    this._signal.events.off('user-join', this._onSignalUserJoin)
    this._signal.events.off('user-seen', this._onSignalUserSeen)
    this._service.events.off('user-join', this._onServiceUserJoin)
    this._service.events.off('user-seen', this._onServiceUserSeen)
    this._service.events.off('user-left', this._onServiceUserLeft)
    this._service.events.off('message-received', this._onServiceMessageReceived)
    await this._signal.stop()
  }

  /**
   * The users do not connect if their ids differ by more than 3.
   * @param {DSUser} user
   * @returns {boolean}
   */
  _shouldConnect (user) {
    return Math.abs(parseInt(this._user.id) - parseInt(user.id)) <= 3
  }

  /**
   * Maintain the users in a local map for display.
   * @param {DSUser} user
   * @param {string} action
   */
  _handleServiceUser (user, action) {
    console.info(`User ${user.id} action ${action} on the service.`)
    if (action === 'join' || action === 'seen') {
      this._users.set(user.id, user)
    } else {
      this._users.delete(user.id)
    }
    this._updateServicePeers()
  }

  /**
   * Setup peer and feed and initiate/respond to signalling.
   * @param {DSUser} user
   * @param {() => Promise<void>} connect
   * @param {(DSManualPeer) => void} setup
   * @param {boolean} initiator
   */
  async _handleSignalUser (user, { connect, setup }, initiator) {
    if (!this._shouldConnect(user)) {
      console.info(`Ignoring the user ${user.id}.`)
      return
    }
    const peer = new window.RTCPeerConnection()
    this._setupPeer(user, peer)
    const manual = new DSManualPeer(window, peer, initiator)
    setup(manual)
    console.info(`User ${user.id} found, we are initiator: ${initiator}.`)
    await connect()
    console.info(`One way connected to user ${user.id}.`)
    if (initiator) {
      const feed = peer.createDataChannel('feed')
      this._setupFeed(user, feed)
    } else {
      peer.addEventListener('datachannel', (event) => {
        this._setupFeed(user, event.channel)
      })
    }
    await manual.signalling()
    console.info(`Webrtc connection with user ${user.id} successful.`)
  }

  /**
   * Set up the peer.
   * @param {DSUser} user
   * @param {RTCPeerConnection} peer
   */
  _setupPeer (user, peer) {
    if (this._peers.has(user.id)) {
      console.info(`Closing old webrtc connection with user ${user.id}.`)
      this._peers.get(user.id).close()
    }
    this._peers.set(user.id, peer)
    peer.addEventListener('connectionstatechange', () => {
      this._updateWebrtcPeers()
    })
    this._updateWebrtcPeers()
  }

  /**
   * Set up the feed.
   * @param {DSUser} user
   * @param {RTCDataChannel} feed
   */
  _setupFeed (user, feed) {
    if (this._feeds.has(user.id)) {
      this._feeds.get(user.id).close()
    }
    this._feeds.set(user.id, feed)
    feed.addEventListener('message', (event) => {
      this._handleWebrtcMessage(user, event.data)
    })
  }

  /**
   * Set up the ui functionality.
   */
  _setupUI () {
    const serviceInput = document.getElementById('service-input')
    serviceInput.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') {
        const text = serviceInput.value.trim()
        if (text !== '') {
          const message = new DSMessage(text)
          this._handleServiceMessage(this._user, message)
          this._service.send(message).then()
        }
        serviceInput.value = ''
        event.preventDefault()
      }
    })
    const webRtcInput = document.getElementById('webrtc-input')
    webRtcInput.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') {
        const text = webRtcInput.value.trim()
        if (text !== '') {
          this._handleWebrtcMessage(this._user, text)
          for (const feed of this._feeds.values()) {
            if (feed.readyState === 'open') {
              feed.send(text)
            }
          }
        }
        webRtcInput.value = ''
        event.preventDefault()
      }
    })
  }

  /**
   * Show the service peers on the UI.
   */
  _updateServicePeers () {
    let text = ''
    for (const user of this._users.values()) {
      const connect = this._shouldConnect(user) ? 'connect' : 'ignore'
      text += `${user.id}: will ${connect}\n`
    }
    document.getElementById('service-peers').textContent = text
  }

  /**
   * Show the webrtc peers on the UI.
   */
  _updateWebrtcPeers () {
    let text = ''
    for (const [user, peer] of this._peers) {
      text += `${user}: state ${peer.connectionState}\n`
    }
    document.getElementById('webrtc-peers').textContent = text
  }

  /**
   * Show the service messages on the UI.
   * @param {DSUser} from
   * @param {DSMessage} message
   */
  _handleServiceMessage (from, message) {
    const area = document.getElementById('service-messages')
    area.textContent += `${from.id}: ${message.data}\n`
    area.scrollTop = area.scrollHeight
  }

  /**
   * Show the webrtc messages on the UI.
   * @param {DSUser} from
   * @param {string} message
   */
  _handleWebrtcMessage (from, message) {
    const area = document.getElementById('webrtc-messages')
    area.textContent += `${from.id}: ${message}\n`
    area.scrollTop = area.scrollHeight
  }
}

/**
 * Async main function.
 */
async function main () {
  const db = await window.RxDB.createRxDatabase({ name: 'demo', adapter: 'idb' })
  const args = new URLSearchParams(window.location.search)
  const demo = new Demo(db, { id: args.get('id') })
  await demo.start()
  const clean = (event) => {
    demo.stop().then(() => window.removeEventListener('beforeunload', clean))
    event.preventDefault()
    event.returnValue = ''
  }
  window.addEventListener('beforeunload', clean)
}

main().then()

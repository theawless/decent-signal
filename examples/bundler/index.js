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
 * Example for bundler + web crypto + public key + RxDB + webrtc.
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
    this._onSignalInitiator = (user, connect, setup) => this._handleSignalInitiate(user, connect, setup).then()
    this._onSignalResponder = (user, connect, setup) => this._handleSignalRespond(user, connect, setup).then()
    this._onServiceUserJoin = (user) => this._handleServiceUser(user, 'join')
    this._onServiceUserSeen = (user) => this._handleServiceUser(user, 'seen')
    this._onServiceUserLeft = (user) => this._handleServiceUser(user, 'left')
    this._onServiceMessageReceived = (from, message) => this._handleServiceMessage(from, message)
  }

  /**
   * Start the demo.
   */
  async start () {
    await this._signal.start()
    this._signal.events.connect('initiator', this._onSignalInitiator)
    this._signal.events.connect('responder', this._onSignalResponder)
    this._service.events.connect('user-join', this._onServiceUserJoin)
    this._service.events.connect('user-seen', this._onServiceUserSeen)
    this._service.events.connect('user-left', this._onServiceUserLeft)
    this._service.events.connect('message-received', this._onServiceMessageReceived)
    this._setupUI()
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
    this._service.events.disconnect('message-received', this._onServiceMessageReceived)
    this._service.events.disconnect('user-left', this._onServiceUserLeft)
    this._service.events.disconnect('user-seen', this._onServiceUserSeen)
    this._service.events.disconnect('user-join', this._onServiceUserJoin)
    this._signal.events.disconnect('responder', this._onSignalResponder)
    this._signal.events.disconnect('initiator', this._onSignalInitiator)
    await this._comm.stop()
  }

  /**
   * Maintain the users in a local map for display.
   * @param {DSUser} user
   * @param {string} action
   */
  _handleServiceUser (user, action) {
    console.log(`User ${user.id} action ${action} on the service.`)
    if (action === 'join' || action === 'seen') {
      this._users.set(user.id, user)
    } else {
      this._users.delete(user.id)
    }
    this._updateServicePeers()
  }

  /**
   * Initiate signalling and create the feed.
   * @param {DSUser} user
   * @param {() => Promise<void>} connect
   * @param {(DSWebrtcPeer) => void} setup
   */
  async _handleSignalInitiate (user, connect, setup) {
    console.log(`Initiate signalling with user ${user.id}.`)
    const peer = new window.RTCPeerConnection()
    this._setupPeer(user, peer)
    await connect()
    const manual = new DSManualPeer(window, peer, true)
    setup(manual)
    const feed = peer.createDataChannel('feed')
    this._setupFeed(user, feed)
    await manual.complete()
  }

  /**
   * Respond to signalling and accept the feed.
   * @param {DSUser} user
   * @param {() => Promise<void>} connect
   * @param {(DSWebrtcPeer) => void} setup
   */
  async _handleSignalRespond (user, connect, setup) {
    console.log(`Respond to signalling from user ${user.id}.`)
    const peer = new window.RTCPeerConnection()
    this._setupPeer(user, peer)
    await connect()
    const manual = new DSManualPeer(window, peer, false)
    setup(manual)
    peer.addEventListener('datachannel', (event) => {
      this._setupFeed(user, event.channel)
    })
    await manual.complete()
  }

  /**
   * Set up the peer.
   * @param {DSUser} user
   * @param {RTCPeerConnection} peer
   */
  _setupPeer (user, peer) {
    if (this._peers.has(user.id)) {
      console.log(`Closing old webrtc connection with user ${user.id}.`)
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
    for (const user of this._users.keys()) {
      text += `${user}\n`
    }
    document.getElementById('service-peers').textContent = text
  }

  /**
   * Show the webrtc peers on the UI.
   */
  _updateWebrtcPeers () {
    let text = ''
    for (const [user, peer] of this._peers) {
      text += `${user}: ${peer.connectionState}\n`
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

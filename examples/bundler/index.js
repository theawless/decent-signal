import {
  DSInMemoryKeystore,
  DSMessage,
  DSPublicKeyCommunicator,
  DSSecureCommunication,
  DSSyncedRxDBService,
  DSUser,
  DSWebCrypto
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
    const communicator = new DSPublicKeyCommunicator(crypto, store)
    this._comm = new DSSecureCommunication(this._service, communicator)
    this._peers = new Map() // user id to peer map
    this._feeds = new Map() // user id to feed map
    this._onUserSeen = (user, connect) => this._handleUserSeen(user, connect).then()
    this._onUserLeft = (user) => this._handleUserLeft(user).then()
    this._onServiceMessageReceived = (from, message) => this._handleServiceMessage(from, message)
    this._onMessageReceived = (from, message) => this._handleMessage(from, message).then()
  }

  /**
   * Start the demo.
   */
  async start () {
    await this._comm.start()
    this._comm.events.connect('user-seen', this._onUserSeen)
    this._comm.events.connect('user-left', this._onUserLeft)
    this._comm.events.connect('message-received', this._onMessageReceived)
    this._service.events.connect('message-received', this._onServiceMessageReceived)
    this._setupUI()
    for (const { user, connect } of await this._comm.everyone()) {
      await this._handleUserFound(user, connect)
    }
  }

  /**
   * Stop the demo.
   */
  async stop () {
    for (const peer of this._peers.values()) {
      peer.close()
    }
    for (const feed of this._feeds.values()) {
      feed.close()
    }
    this._peers.clear()
    this._feeds.clear()
    this._service.events.disconnect('message-received', this._onServiceMessageReceived)
    this._comm.events.disconnect('message-received', this._onMessageReceived)
    this._comm.events.disconnect('user-seen', this._onUserSeen)
    this._comm.events.disconnect('user-left', this._onUserLeft)
    await this._comm.stop()
  }

  /**
   * Create a webrtc peer for a user.
   * @param {DSUser} user
   * @returns {RTCPeerConnection}
   */
  _createPeer (user) {
    const peer = new window.RTCPeerConnection()
    peer.addEventListener('icecandidate', async (event) => {
      if (event.candidate) {
        const message = new DSMessage(JSON.stringify({ ice: event.candidate }))
        await this._comm.send(user, message)
      }
    })
    peer.addEventListener('connectionstatechange', () => {
      this._updateWebrtcPeers()
    })
    this._peers.set(user.id, peer)
    this._updateWebrtcPeers()
    this._updateServicePeers()
    return peer
  }

  /**
   * Remove a peer and its feed.
   * @param {DSUser} user
   */
  _removePeer (user) {
    if (this._feeds.has(user.id)) {
      this._feeds.get(user.id).close()
      this._feeds.delete(user.id)
    }
    if (this._peers.has(user.id)) {
      console.info(`Closing old connection for user ${user.id}`)
      this._peers.get(user.id).close()
      this._peers.delete(user.id)
    }
    this._updateWebrtcPeers()
    this._updateServicePeers()
  }

  /**
   * Handle user leaving event.
   * @param {DSUser} user
   */
  async _handleUserLeft (user) {
    this._removePeer(user)
    console.info(`User ${user.id} has left the service.`)
  }

  /**
   * Handle user seen event i.e. when a new user joins.
   * @param {DSUser} user
   * @param {() => Promise<void>} connect
   */
  async _handleUserSeen (user, connect) {
    console.log(`User ${user.id} joined the service.`)
    this._removePeer(user)
    await connect()
    const peer = this._createPeer(user)
    console.info(`Receiving connection from user ${user.id}.`)
    peer.addEventListener('datachannel', (event) => {
      this._feeds.set(user.id, event.channel)
      event.channel.addEventListener('message', (event) => {
        this._handleWebrtcMessage(user, event.data)
      })
    })
  }

  /**
   * Handle user found i.e. when we join and query the existing users.
   * @param {DSUser} user
   * @param {() => Promise<void>} connect
   */
  async _handleUserFound (user, connect) {
    console.log(`User ${user.id} was found on the service.`)
    this._removePeer(user)
    await connect()
    const peer = this._createPeer(user)
    console.info(`Initiating connection with user ${user.id}.`)
    peer.addEventListener('negotiationneeded', async () => {
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      const signal = JSON.stringify({ offer: peer.localDescription })
      const message = new DSMessage(signal)
      await this._comm.send(user, message)
    })
    const feed = peer.createDataChannel('feed')
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
        event.preventDefault()
        const text = serviceInput.value.trim()
        serviceInput.value = ''
        if (text !== '') {
          const message = new DSMessage(text)
          this._handleServiceMessage(this._user, message)
          this._service.send(message).then()
        }
      }
    })
    const webRtcInput = document.getElementById('webrtc-input')
    webRtcInput.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        const text = webRtcInput.value.trim()
        webRtcInput.value = ''
        if (text !== '') {
          this._handleWebrtcMessage(this._user, text)
          for (const feed of this._feeds.values()) {
            if (feed.readyState === 'open') {
              feed.send(text)
            }
          }
        }
      }
    })
  }

  /**
   * Show the service peers on the UI.
   */
  _updateServicePeers () {
    let text = ''
    for (const user of this._peers.keys()) {
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

  /**
   * Handle signalling data when it arrives from the other user.
   * @param {DSUser} from
   * @param {DSMessage} message
   */
  async _handleMessage (from, message) {
    const peer = this._peers.get(from.id)
    const signal = JSON.parse(message.data)
    if (signal.answer) {
      await peer.setRemoteDescription(new window.RTCSessionDescription(signal.answer))
    } else if (signal.offer) {
      await peer.setRemoteDescription(new window.RTCSessionDescription(signal.offer))
      const answer = await peer.createAnswer()
      await peer.setLocalDescription(answer)
      const message = new DSMessage(JSON.stringify({ answer: peer.localDescription }))
      await this._comm.send(from, message)
    } else if (signal.ice) {
      await peer.addIceCandidate(new window.RTCIceCandidate(signal.ice))
    }
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

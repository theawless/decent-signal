import { DecentSignal, DecentSignalMessage, DecentSignalPublicKeyCommunicator, DecentSignalUser } from 'decent-signal'
import { DecentSignalLocalServer } from 'decent-signal-adapter-local-server'
import { DecentSignalSubtleCrypto } from 'decent-signal-adapter-subtle-crypto'

/**
 * Example for bundler + subtle crypto + public key communication + local server + manual webrtc signalling.
 * TODO: Can use perfect negotiation here.
 */
class Demo {
  /**
   * @param {RxDatabaseBase} db
   * @param {string} id
   */
  constructor (db, { id }) {
    this._user = new DecentSignalUser(id)
    this._server = new DecentSignalLocalServer(db, this._user)
    const crypto = new DecentSignalSubtleCrypto()
    const communicator = new DecentSignalPublicKeyCommunicator(crypto)
    this._signal = new DecentSignal(communicator, this._server)
    this._peers = new Map() // user id to peer map
    this._feeds = new Map() // user id to feed map
    this._onUserSeen = (user) => this._handleUser(user, true).then()
    this._onUserLeft = (user) => this._handleUser(user, false).then()
    this._onServerMessageReceived = (from, message) => this._handleServerMessage(from, message)
    this._onMessageReceived = (from, message) => this._handleMessage(from, message).then()
  }

  /**
   * Start the demo.
   */
  async start () {
    await this._signal.startSignalling()
    this._signal.events.connect('user-seen', this._onUserSeen)
    this._signal.events.connect('user-left', this._onUserLeft)
    this._signal.events.connect('message-received', this._onMessageReceived)
    this._server.events.connect('message-received', this._onServerMessageReceived)
    for (const user of await this._signal.getUsers()) {
      await this._handleUser(user, true)
    }
    this._setupUI()
  }

  /**
   * Stop the demo.
   */
  async stop () {
    for (const peer of this._peers.values()) {
      peer.close()
    }
    this._server.events.disconnect('message-received', this._onServerMessageReceived)
    this._signal.events.disconnect('message-received', this._onMessageReceived)
    this._signal.events.disconnect('user-seen', this._onUserSeen)
    this._signal.events.disconnect('user-left', this._onUserLeft)
    await this._signal.stopSignalling()
  }

  /**
   * Handle user updates by starting webrtc connections.
   * @param {DecentSignalUser} user
   * @param {boolean} active
   */
  async _handleUser (user, active) {
    if (!active) {
      this._peers.get(user.id).close()
      this._peers.delete(user.id)
      this._feeds.delete(user.id)
      this._updateServerPeers()
      return
    }
    await this._signal.connectUser(user)
    const peer = new window.RTCPeerConnection()
    this._peers.set(user.id, peer)
    this._updateServerPeers()
    peer.addEventListener('icecandidate', async (event) => {
      if (event.candidate && peer === this._peers.get(user.id)) {
        const message = new DecentSignalMessage(JSON.stringify({ ice: event.candidate }))
        await this._signal.sendMessage(user, message)
      }
    })
    const initiator = this._user.id > user.id
    peer.addEventListener('connectionstatechange', () => {
      this._updateWebrtcPeers()
      if (initiator && peer.connectionState === 'failed' && peer === this._peers.get(user.id)) {
        console.log(`Re-initiating connection with user ${user.id}`)
        peer.restartIce()
      }
    })
    if (initiator) {
      console.log(`Initiating connection with user ${user.id}`)
      peer.addEventListener('negotiationneeded', async () => {
        const offer = await peer.createOffer()
        await peer.setLocalDescription(offer)
        const message = new DecentSignalMessage(JSON.stringify({ offer: peer.localDescription }))
        // wait for others to be ready for receiving our signals
        await new Promise(resolve => setTimeout(resolve, 4000))
        await this._signal.sendMessage(user, message)
      })
      const feed = peer.createDataChannel('feed')
      this._feeds.set(user.id, feed)
      feed.addEventListener('message', (event) => {
        this._handleWebrtcMessage(user, event.data)
      })
    } else {
      console.log(`Receiving connection from user ${user.id}`)
      peer.addEventListener('datachannel', (event) => {
        this._feeds.set(user.id, event.channel)
        event.channel.addEventListener('message', (event) => {
          this._handleWebrtcMessage(user, event.data)
        })
      })
    }
  }

  /**
   * Setup the ui functionality.
   */
  _setupUI () {
    const serverInput = document.getElementById('server-input')
    serverInput.addEventListener('keyup', (event) => {
      event.preventDefault()
      if (event.key === 'Enter') {
        const text = serverInput.value.trim()
        serverInput.value = ''
        if (text) {
          const message = new DecentSignalMessage(text)
          this._handleServerMessage(this._user, message)
          this._server.sendMessage(undefined, message).then()
        }
      }
    })
    const webRtcInput = document.getElementById('webrtc-input')
    webRtcInput.addEventListener('keyup', (event) => {
      event.preventDefault()
      if (event.key === 'Enter') {
        const text = webRtcInput.value.trim()
        webRtcInput.value = ''
        if (text) {
          this._handleWebrtcMessage(this._user, text)
          for (const feed of this._feeds.values()) {
            feed.send(text)
          }
        }
      }
    })
  }

  /**
   * Show the server peers on the UI.
   */
  _updateServerPeers () {
    let text = ''
    for (const user of this._peers.keys()) {
      text += `${user}\n`
    }
    document.getElementById('server-peers').textContent = text
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
   * Show the server messages on the UI.
   * @param {DecentSignalUser} from
   * @param {DecentSignalMessage} message
   */
  _handleServerMessage (from, message) {
    document.getElementById('server-messages').textContent += `${from.id}: ${message.text}\n`
  }

  /**
   * Show the webrtc messages on the UI.
   * @param {DecentSignalUser} from
   * @param {string} message
   */
  _handleWebrtcMessage (from, message) {
    document.getElementById('webrtc-messages').textContent += `${from.id}: ${message}\n`
  }

  /**
   * Handle signalling data when it arrives from the other user.
   * @param {DecentSignalUser} from
   * @param {DecentSignalMessage} message
   */
  async _handleMessage (from, message) {
    const peer = this._peers.get(from.id)
    const signal = JSON.parse(message.text)
    if (signal.answer) {
      await peer.setRemoteDescription(new window.RTCSessionDescription(signal.answer))
    } else if (signal.offer) {
      await peer.setRemoteDescription(new window.RTCSessionDescription(signal.offer))
      const answer = await peer.createAnswer()
      await peer.setLocalDescription(answer)
      const message = new DecentSignalMessage(JSON.stringify({ answer: peer.localDescription }))
      await this._signal.sendMessage(from, message)
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

/**
 * Example for vanilla + subtle crypto + public key communication + matrix im + simple peer.
 */
class Demo {
  /**
   * @param {MatrixClient} client
   * @param {SimpleDrawingBoard} pad
   * @param {{room: string}} options
   */
  constructor (client, pad, { room }) {
    this._pad = pad
    this._user = new window.decentSignal.DecentSignalUser(client.getUserId())
    this._chat = new window.decentSignal.DecentSignalMatrixChat(client, { room })
    const channel = new window.decentSignal.DecentSignalChannel(this._chat)
    const crypto = new window.decentSignal.DecentSignalSubtleCrypto()
    const communicator = new window.decentSignal.DecentSignalPublicKeyCommunicator(crypto)
    this._signal = new window.decentSignal.DecentSignal(communicator, channel)
    this._peers = new Map() // map of user id to peer
    this._onUserSeen = (user) => this._handleUser(user, true).then()
    this._onUserLeft = (user) => this._handleUser(user, false).then()
    this._onMessageReceived = (from, message) => this._handleMessage(from, message).then()
    this._setupUI()
  }

  /**
   * Start the demo.
   */
  async start () {
    await this._signal.startSignalling()
    this._signal.events.connect('user-seen', this._onUserSeen)
    this._signal.events.connect('user-left', this._onUserLeft)
    this._signal.events.connect('message-received', this._onMessageReceived)
    for (const user of await this._signal.getUsers()) {
      await this._handleUser(user, true)
    }
  }

  /**
   * Stop the demo.
   */
  async stop () {
    for (const peer of this._peers.values()) {
      peer.destroy()
    }
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
    if (this._peers.has(user.id)) {
      this._peers.get(user.id).destroy()
      this._peers.delete(user.id)
    }
    if (!active) {
      console.info(`User ${user.id} has left matrix chat.`)
      return
    }
    console.info(`User ${user.id} seen on matrix chat.`)
    await this._signal.connectUser(user)
    const peer = new window.SimplePeer({ initiator: this._user.id > user.id })
    peer.on('signal', (data) => {
      console.info(`Sending signalling data to ${user.id}.`)
      const message = new window.decentSignal.DecentSignalMessage(JSON.stringify(data))
      this._signal.sendMessage(user, message).then()
    })
    peer.on('data', (data) => {
      this._pad.fillImageByDataURL(JSON.parse(data)).then()
    })
    peer.on('connect', () => {
      console.info(`Webrtc connection established with ${user.id}.`)
    })
    peer.on('close', () => {
      console.info(`Webrtc connection closed with ${user.id}.`)
    })
    peer.on('error', () => {
      console.info(`Webrtc connection errored with ${user.id}.`)
    })
    this._peers.set(user.id, peer)
  }

  /**
   * Handle signalling data when it arrives from the other user.
   * @param {DecentSignalUser} from
   * @param {DecentSignalMessage} message
   */
  async _handleMessage (from, message) {
    console.info(`Received signalling data from ${from.id}.`)
    const peer = this._peers.get(from.id)
    peer.signal(JSON.parse(message.text))
  }

  /**
   * Setup the ui functionality.
   */
  _setupUI () {
    start.addEventListener('click', () => {
      start.disabled = true
      setStatus('Starting...')
      this.start().then(() => {
        stop.disabled = false
        setStatus('Signalling...')
      }).catch(() => {
        setStatus('Signalling failed...')
        start.disabled = false
      })
    })
    stop.addEventListener('click', () => {
      stop.disabled = true
      setStatus('Stopping...')
      this.stop().then(() => {
        start.disabled = false
        setStatus('Stopped...')
      })
    })
    this._pad.observer.on('drawEnd', (_) => {
      const data = JSON.stringify(this._pad.toDataURL())
      for (const peer of this._peers.values()) {
        if (peer.connected) {
          peer.send(data)
        }
      }
    })
  }
}

/**
 * Log to the console widget on the page.
 * @param {...*} args
 */
console.info = function (...args) {
  const console = document.getElementById('console')
  const message = args.map(x => typeof x === 'object' ? JSON.stringify(x) : x)
  console.textContent += `${message}\n`
  console.scrollTop = console.scrollHeight
}

/**
 * Updates the status on the page.
 * @param text
 */
function setStatus (text) {
  document.getElementById('status').innerHTML = text
}

/**
 * Generate a random color in RGBA format.
 */
function randomColor () {
  const num = Math.round(0xffffff * Math.random())
  return `rgb(${num >> 16},${num >> 8 & 255},${num & 255},1)`
}

/**
 * Async main function.
 */
async function main () {
  login.disabled = false
  logout.disabled = true
  start.disabled = true
  stop.disabled = true
  const loginId = document.getElementById('loginId')
  const loginPass = document.getElementById('loginPass')
  const pad = window.SimpleDrawingBoard.create(document.getElementById('sketchpad'))
  pad.setLineColor(randomColor())
  pad.observer.on('drawBegin', (_) => {
    loginId.blur()
    loginPass.blur()
  })
  logout.addEventListener('click', () => {
    logout.disabled = true
    setStatus('Logging out...')
    window.localStorage.removeItem('decent-signal-matrix-chat-user-id')
    window.localStorage.removeItem('decent-signal-matrix-chat-access-token')
    setStatus('Reloading page...')
    window.location.reload()
  })
  setStatus('Ready...')
  const room = '!pWVvtzxmhMBKhfkrIy:matrix.org' // decent-signal-github-demo
  const userId = window.localStorage.getItem('decent-signal-matrix-chat-user-id')
  const accessToken = window.localStorage.getItem('decent-signal-matrix-chat-access-token')
  const client = window.matrixcs.createClient({ baseUrl: 'https://matrix.org', userId, accessToken })
  const demo = new Demo(client, pad, { room })
  if (userId && accessToken) {
    console.info(`Logging in using saved access token for ${userId}.`)
    setStatus('Logged in...')
    login.disabled = true
    logout.disabled = false
    start.disabled = false
  } else {
    login.addEventListener('click', () => {
      if (loginId.value === '' || loginPass.value === '') {
        window.alert('Please provide all the fields in the form!')
        return
      }
      login.disabled = true
      setStatus('Logging in...')
      client.login('m.login.password', {
        user: loginId.value,
        password: loginPass.value,
        device_id: `dummy-device-${room}`
      }).then(() => {
        window.localStorage.setItem('decent-signal-matrix-chat-user-id', client.getUserId())
        window.localStorage.setItem('decent-signal-matrix-chat-access-token', client.getAccessToken())
        setStatus('Logged in...')
        logout.disabled = false
        start.disabled = false
      }).catch(() => {
        login.disabled = false
        setStatus('Login failed...')
      })
    })
  }
  const clean = (event) => {
    setStatus('Closing...')
    demo.stop().then(() => {
      window.removeEventListener('beforeunload', clean)
      setStatus('Closed...')
    })
    event.preventDefault()
    event.returnValue = ''
  }
  window.addEventListener('beforeunload', clean)
}

const login = document.getElementById('login')
const logout = document.getElementById('logout')
const start = document.getElementById('start')
const stop = document.getElementById('stop')

main().then()

/**
 * Example for vanilla + web crypto + public key + matrix im + simple peer.
 */
class Demo {
  /**
   * @param {SimpleDrawingBoard} pad
   * @param {MatrixClient} client
   * @param {string} room
   */
  constructor (pad, client, { room }) {
    this._pad = pad
    this._user = new window.decentSignal.DSUser(client.getUserId())
    const channel = new window.decentSignal.DSMatrixIM(client, { room })
    const service = new window.decentSignal.DSChannelAsService(channel)
    const crypto = new window.decentSignal.DSWebCrypto(window.crypto)
    const store = new window.decentSignal.DSInMemoryKeystore()
    const system = new window.decentSignal.DSSharedSecretSystem(crypto, store)
    const comm = new window.decentSignal.DSCommunicator(service, system)
    this._signal = new window.decentSignal.DSWebrtcSignaller(comm)
    this._peers = new Map() // user id to peer
    this._onInitiator = (user, connect, setup) => this._handleUser(user, connect, setup, true).then()
    this._onResponder = (user, connect, setup) => this._handleUser(user, connect, setup, false).then()
    this._setupUI()
  }

  /**
   * Start the demo.
   */
  async start () {
    await this._signal.start()
    this._signal.events.connect('initiator', this._onInitiator)
    this._signal.events.connect('responder', this._onResponder)
  }

  /**
   * Stop the demo.
   */
  async stop () {
    for (const peer of this._peers.values()) {
      peer.peer.destroy()
    }
    this._peers.clear()
    this._signal.events.disconnect('responder', this._onResponder)
    this._signal.events.disconnect('initiator', this._onInitiator)
    await this._signal.stop()
  }

  /**
   * Handle user updates by starting webrtc connections.
   * @param {DSUser} user
   * @param {() => Promise<void>} connect
   * @param {(DSWebrtcPeer) => void} setup
   * @param {boolean} initiator
   */
  async _handleUser (user, connect, setup, initiator) {
    if (this._peers.has(user.id)) {
      console.log(`Closing old webrtc connection with user ${user.id}.`)
      this._peers.get(user.id).peer.destroy()
      this._peers.delete(user.id)
    }
    console.log(`Start connection with user ${user.id}, initiator ${initiator}.`)
    await connect()
    const peer = new window.decentSignal.DSSimplePeer(
      new window.SimplePeer({ initiator, trickle: false })
    )
    this._peers.set(user.id, peer)
    setup(peer)
    peer.peer.on('data', (data) => {
      this._pad.fillImageByDataURL(JSON.parse(data)).then()
    })
    await peer.complete()
  }

  /**
   * Set up the ui functionality.
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
        if (peer.peer.connected) {
          peer.peer.send(data)
        }
      }
    })
  }
}

/**
 * Log to the console widget on the page.
 * @param {...*} args
 */
console.info = (...args) => {
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
 * @returns {string} rgba
 */
function randomColor () {
  const num = Math.round(0xffffff * Math.random())
  return `rgb(${num >> 16},${num >> 8 & 255},${num & 255},1)`
}

/**
 * Async main function.
 */
async function main () {
  canvas.height = canvas.clientHeight
  canvas.width = canvas.clientWidth
  login.disabled = false
  logout.disabled = true
  start.disabled = true
  stop.disabled = true
  const loginId = document.getElementById('loginId')
  const loginPass = document.getElementById('loginPass')
  const pad = window.SimpleDrawingBoard.create(canvas)
  pad.setLineColor(randomColor())
  pad.setLineSize(3)
  pad.observer.on('drawBegin', (_) => {
    loginId.blur()
    loginPass.blur()
  })
  logout.addEventListener('click', () => {
    logout.disabled = true
    setStatus('Logging out...')
    window.localStorage.removeItem(USER_KEY)
    window.localStorage.removeItem(TOKEN_KEY)
    setStatus('Reloading page...')
    window.location.reload()
  })
  setStatus('Ready...')
  const userId = window.localStorage.getItem(USER_KEY)
  const accessToken = window.localStorage.getItem(TOKEN_KEY)
  const client = window.matrixcs.createClient({
    baseUrl: 'https://matrix.org',
    userId,
    accessToken
  })
  const demo = new Demo(pad, client, { room: ROOM })
  if (userId && accessToken) {
    setStatus(`Logged in for ${userId}...`)
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
        device_id: `dummy-device-${ROOM}`
      }).then(() => {
        window.localStorage.setItem(USER_KEY, client.getUserId())
        window.localStorage.setItem(TOKEN_KEY, client.getAccessToken())
        setStatus('Reloading page...')
        window.location.reload()
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

const ROOM = '!pWVvtzxmhMBKhfkrIy:matrix.org' // decent-signal-github-demo
const USER_KEY = 'decent-signal-matrix-im-user-id'
const TOKEN_KEY = 'decent-signal-matrix-im-access-token'

const canvas = document.getElementById('sketchpad')
const login = document.getElementById('login')
const logout = document.getElementById('logout')
const start = document.getElementById('start')
const stop = document.getElementById('stop')

main().then()

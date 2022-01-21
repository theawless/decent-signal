/**
 * Example for vanilla.
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
    this._onUserFound = (...args) => this._handleFound(...args).then()
    this._onUserLeft = (user) => this._handleLeft(user)
    this._setupUI()
  }

  /**
   * Start the demo.
   */
  async start () {
    this._signal.events.on('user-found', this._onUserFound)
    this._signal.events.on('user-left', this._onUserLeft)
    await this._signal.start()
  }

  /**
   * Stop the demo.
   */
  async stop () {
    for (const peer of this._peers.values()) {
      peer.destroy()
    }
    this._peers.clear()
    this._signal.events.off('user-found', this._onUserFound)
    this._signal.events.off('user-left', this._onUserLeft)
    await this._signal.stop()
  }

  /**
   * Setup peer and initiate/respond to signalling.
   * @param {DSUser} user
   * @param {(DSSimplePeer) => Promise<void>} connect
   */
  async _handleFound (user, connect) {
    const factory = (initiator) => {
      console.info(`Connecting with ${user.id}, we are initiator: ${initiator}.`)
      const peer = new window.SimplePeer({ initiator, trickle: false })
      this._setupPeer(user, peer)
      return peer
    }
    await connect(new window.decentSignal.DSSimplePeer(factory))
    console.info(`Webrtc connection with user ${user.id} successful.`)
  }

  /**
   * Log when the user leaves.
   * @param {DSUser} user
   */
  _handleLeft (user) {
    console.info(`User ${user.id} left.`)
  }

  /**
   * Set up the peer.
   * @param {DSUser} user
   * @param {SimplePeer} peer
   */
  _setupPeer (user, peer) {
    if (this._peers.has(user.id)) {
      console.info(`Closing old webrtc connection with user ${user.id}.`)
      this._peers.get(user.id).destroy()
      this._peers.delete(user.id)
    }
    this._peers.set(user.id, peer)
    peer.on('data', (data) => {
      this._pad.fillImageByDataURL(JSON.parse(data)).then()
    })
    peer.on('close', () => {
      console.info(`Closed webrtc connection with user ${user.id}.`)
      this._peers.delete(user.id)
    })
    peer.on('error', () => {
      console.info(`Errored webrtc connection with user ${user.id}.`)
      this._peers.delete(user.id)
    })
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
      }).catch((e) => {
        console.error(e)
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
console.info = (...args) => {
  const console = document.getElementById('console')
  const message = args.map(x => typeof x === 'object' ? JSON.stringify(x) : x)
  console.textContent += `${message}\n`
  console.scrollTop = console.scrollHeight
}

/**
 * Updates the status on the page.
 * @param {string} text
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
      }).catch((e) => {
        console.error(e)
        login.disabled = false
        setStatus('Login failed...')
      })
    })
  }
  const clean = (event) => {
    setStatus('Closing...')
    if (!stop.disabled) {
      demo.stop().then(() => {
        window.removeEventListener('beforeunload', clean)
        setStatus('Closed...')
        stop.disabled = true
      })
    }
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

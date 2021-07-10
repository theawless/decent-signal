import { DSMessage } from '../../models/message'
import { DSUser } from '../../models/user'
import { DSEventEmitter } from '../../utilities/event-emitter'

/**
 * @event DSMatrixIM#event:message-received
 * @param {DSUser} from
 * @param {DSMessage} message
 */

/**
 * Abstraction over matrix instant messaging system.
 * @implements DSChannel
 */
export class DSMatrixIM {
  /**
   * The client should be already logged in.
   * @param {MatrixClient} client
   * @param {{room: string}} options
   */
  constructor (client, options) {
    this._emitter = new DSEventEmitter()
    this._client = client
    this._options = options
    this._onRoomEvent = (event) => this._handleEvent(event)
  }

  /**
   * @returns {DSEvents}
   */
  get events () {
    return this._emitter
  }

  /**
   * Start the client, join the room, and start listening to room events.
   */
  async join () {
    await this._client.clearStores() // need to clear the cache status
    const filter = await this._client.createFilter(this._buildFilter())
    this._client.startClient({ filter })
    await this._client.joinRoom(this._options.room)
    this._client.on('Room.timeline', this._onRoomEvent)
  }

  /**
   * Stop listening to room events, leave the room, and stop the client.
   */
  async leave () {
    this._client.removeListener('Room.timeline', this._onRoomEvent)
    await this._client.leave(this._options.room)
    this._client.stopClient()
  }

  /**
   * Send message by creating an event in the room.
   * @param {DSMessage} message
   * @param {DSUser} [to]
   */
  async send (message, to) {
    const content = {
      body: JSON.stringify({
        to: to ? to.id : '',
        text: message.data
      }),
      msgtype: 'm.text'
    }
    await this._client.sendEvent(this._options.room, 'm.room.message', content)
  }

  /**
   * Create a filter that reduces the number of events we listen to.
   * @returns {object}
   */
  _buildFilter () {
    return {
      room: {
        rooms: [this._options.room],
        timeline: {
          limit: 0,
          types: ['m.room.message']
        }
      }
    }
  }

  /**
   * Handler for timeline event.
   * @param {MatrixEvent} event
   */
  _handleEvent (event) {
    if (event.getType() !== 'm.room.message' || event.getContent().msgtype !== 'm.text') {
      return
    }
    if (event.getRoomId() !== this._options.room || event.getSender() === this._client.getUserId()) {
      return
    }
    try {
      const { to, text } = JSON.parse(event.getContent().body)
      if (to !== '' && to !== this._client.getUserId()) {
        return
      }
      const from = new DSUser(event.getSender())
      const message = new DSMessage(text)
      this._emitter.emit('message-received', from, message)
    } catch (e) {
      console.log(`User ${event.getSender()} is sending weird message.`)
    }
  }
}

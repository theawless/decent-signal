import { DecentSignalChat } from '../interfaces/chat'
import { DecentSignalMessage, DecentSignalUser } from '../interfaces/models'

/**
 * Abstraction over matrix instant messaging system.
 */
export class DecentSignalMatrixChat extends DecentSignalChat {
  /**
   * The client should be already logged in.
   * @param {MatrixClient} client
   * @param {{room: string}} options
   */
  constructor (client, options) {
    super()
    this._client = client
    this._options = options
    this._onRoomEvent = (event) => this._handleEvent(event)
  }

  /**
   * Start the client, join the room, and start listening to room events.
   */
  async joinChat () {
    await this._client.clearStores() // need to clear the cache status
    const filter = await this._client.createFilter(this._buildFilter())
    this._client.startClient({ filter })
    await this._client.joinRoom(this._options.room)
    this._client.on('Room.timeline', this._onRoomEvent)
  }

  /**
   * Stop listening to room events, leave the room, and stop the client.
   */
  async leaveChat () {
    this._client.removeListener('Room.timeline', this._onRoomEvent)
    await this._client.leave(this._options.room)
    this._client.stopClient()
  }

  /**
   * Send message by creating an event in the room.
   * @param {DecentSignalUser | undefined} to
   * @param {DecentSignalMessage} message
   */
  async sendMessage (to, message) {
    const content = {
      body: JSON.stringify({
        to: to ? to.id : '',
        text: message.text
      }),
      msgtype: 'm.text'
    }
    await this._client.sendEvent(this._options.room, 'm.room.message', content)
  }

  /**
   * Create a filter that reduces the number of events we listen to.
   * TODO: Can this be made better?
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
   * @param event {MatrixEvent}
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
      const from = new DecentSignalUser(event.getSender())
      const message = new DecentSignalMessage(text)
      this.events.emit('message-received', from, message)
    } catch (e) {
      console.log(`Getting weird data from user ${event.getSender()}.`)
    }
  }
}

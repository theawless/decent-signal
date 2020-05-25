import { DecentSignalChannel, DecentSignalMessage, DecentSignalUser } from 'decent-signal'

/**
 * Abstraction over matrix instant messaging system.
 */
export class DecentSignalMatrixChat extends DecentSignalChannel {
  /**
   * The client should be fully initialized.
   * @param {MatrixClient} client
   * @param {string} room
   */
  constructor (client, room) {
    super()
    this._client = client
    this._room = room
    this._onRoomEvent = (event) => this._handleEvent(event)
  }

  /**
   * Start listening to events in the room.
   * TODO: Add a filter to ignore receiving unnecessary events.
   * @returns {Promise<void>}
   */
  async startListening () {
    this._client.on('Room.timeline', this._onRoomEvent)
  }

  /**
   * Stop listening to updates in the room.
   * @returns {Promise<void>}
   */
  async stopListening () {
    this._client.removeListener('Room.timeline', this._onRoomEvent)
  }

  /**
   * Handler for timeline event.
   * @param event {object}
   */
  _handleEvent (event) {
    if (event.getType() !== 'm.room.message' || event.getContent().msgtype !== 'm.text') {
      return
    }
    if (event.getRoomId() !== this._room) {
      return
    }
    const from = new DecentSignalUser(event.getSender())
    const doc = JSON.parse(event.getContent().body)
    const to = doc.to === '' ? undefined : new DecentSignalUser(doc.to)
    const message = new DecentSignalMessage(doc.party, to, doc.type, doc.message)
    this.events.emit('message-received', from, message)
  }

  /**
   * Send message to the channel.
   * @param {DecentSignalMessage} message
   * @returns {Promise<void>}
   */
  async sendMessage (message) {
    const content = {
      body: JSON.stringify({
        to: message.to === undefined ? '' : message.to.id,
        party: message.party,
        type: message.type,
        message: message.message
      }),
      msgtype: 'm.text'
    }
    await this._client.sendEvent(this._room, 'm.room.message', content, '')
  }
}

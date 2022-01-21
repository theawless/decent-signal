/**
 * @event DSWebrtcPeer#event:signal
 * @param {string} data
 */

/**
 * Abstraction over various webrtc peers.
 * @interface
 * @implements DSEventsProvider
 */
export class DSWebrtcPeer {
  /**
   * Set up the internal peer object.
   @param {boolean} initiator
   */
  setup (initiator) {}

  /**
   * Accept the signal from other side.
   * @param {string} data
   */
  async signal (data) {}

  /**
   * Finish signalling.
   */
  async signalling () {}
}

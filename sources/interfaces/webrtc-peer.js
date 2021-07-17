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
   * Get internal peer object.
   * @returns {object}
   */
  get peer () {}

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

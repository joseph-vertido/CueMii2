/**
 * In-app dialog helpers.
 *
 * Native window.alert()/confirm() dialogs are drawn by the browser and anchored
 * to the top of the window — a position the page can't control. These helpers
 * raise an event instead, which <AlertDialog /> renders as a centred, themed
 * dialog inside the app.
 *
 * Using an event (rather than props) means any component can raise a dialog
 * without threading a callback down through the tree.
 */
export const ALERT_EVENT = 'cuemii:alert';

/**
 * Show a centred in-app alert.
 * @param {string} message - Message body (newlines are preserved)
 * @param {string} [title] - Optional heading
 */
export const showAlert = (message, title) => {
  window.dispatchEvent(
    new CustomEvent(ALERT_EVENT, {
      detail: { kind: 'alert', message: String(message), title },
    })
  );
};

/**
 * Centred in-app replacement for window.confirm().
 * Note this is ASYNCHRONOUS — callers must await it (or use .then), unlike the
 * native confirm which blocks.
 * @param {string} message - Message body (newlines are preserved)
 * @param {string} [title] - Optional heading
 * @returns {Promise<boolean>} true if confirmed
 */
export const showConfirm = (message, title) =>
  new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent(ALERT_EVENT, {
        detail: { kind: 'confirm', message: String(message), title, resolve },
      })
    );
  });

/**
 * Centred in-app replacement for window.prompt().
 * Asynchronous, like showConfirm.
 * @param {string} message - Message body
 * @param {Object} [opts]
 * @param {string} [opts.title] - Optional heading
 * @param {boolean} [opts.password] - Mask the typed value
 * @returns {Promise<string|null>} the entered text, or null if cancelled
 */
export const showPrompt = (message, opts = {}) =>
  new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent(ALERT_EVENT, {
        detail: {
          kind: 'prompt',
          message: String(message),
          title: opts.title,
          password: !!opts.password,
          resolve,
        },
      })
    );
  });

export default showAlert;

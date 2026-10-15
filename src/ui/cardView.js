import { h } from './dom.js';
import { openCustomDialog } from './feedback.js';

/**
 * Mở thiệp tri ân nhận được (hiệu ứng lật thiệp).
 *
 * @param {{ card: { icon: string, title: string, colors: string[] }, fromName: string, message?: string | null, eventName?: string }} opts
 * @returns {Promise<void>}
 */
export function showCard({ card, fromName, message, eventName }) {
  return new Promise((resolve) => {
    const close = openCustomDialog({
      className: 'card-dialog',
      labelledBy: 'card-title',
      onClose: resolve,
      children: [
        h(
          'div',
          { class: 'greeting-card', style: { '--card-bg': card.colors[0], '--card-ink': card.colors[1] } },
          h('div', { class: 'greeting-icon', 'aria-hidden': 'true' }, card.icon),
          h('h2', { class: 'greeting-title', id: 'card-title' }, card.title),
          message ? h('p', { class: 'greeting-message' }, `“${message}”`) : '',
          h('p', { class: 'greeting-from' }, `— ${fromName}`),
          eventName ? h('small', { class: 'greeting-event' }, eventName) : '',
        ),
        h('div', { class: 'dialog-actions single' }, h('button', { class: 'btn btn-block', type: 'button', onclick: () => close() }, 'Cảm ơn! 💖')),
      ],
    });
  });
}

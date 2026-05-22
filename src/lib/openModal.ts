/** Dispatch the open-modal custom event from any component. */
export function openModal(prefill?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-modal', { detail: { prefill } }))
  }
}

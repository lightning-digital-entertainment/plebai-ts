/* eslint-disable import/prefer-default-export */
export async function handleWebLnPayment(lightningInvoice: string) {
  if (!window || !window.webln) {
    throw new Error('WebLN is not available in your environment');
  }
  await window.webln.enable();
  await window.webln.sendPayment(lightningInvoice);
}

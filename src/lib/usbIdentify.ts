import type { DeviceIdentity } from '../types';

export function isWebUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

export async function identifyUsbDevice(): Promise<DeviceIdentity | null> {
  if (!isWebUsbSupported()) return null;
  try {
    const device = await navigator.usb.requestDevice({ filters: [] });
    return {
      manufacturerName: device.manufacturerName || 'Unknown manufacturer',
      productName: device.productName || 'Unknown device',
      vendorId: device.vendorId,
      productId: device.productId,
      serialNumber: device.serialNumber ?? undefined,
    };
  } catch {
    // User cancelled the chooser, or no device was selected.
    return null;
  }
}

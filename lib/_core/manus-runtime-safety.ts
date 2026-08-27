export function safelyInvoke(action: () => void): boolean {
  try {
    action();
    return true;
  } catch {
    return false;
  }
}

export function safelyPostMessage(postMessage: () => void): boolean {
  return safelyInvoke(postMessage);
}

export function safelyDeliverSafeArea(callback: () => void): boolean {
  return safelyInvoke(callback);
}

export function safelyInitializePreview(addListener: () => void, notifyReady: () => void): boolean {
  try {
    addListener();
    notifyReady();
    return true;
  } catch {
    return false;
  }
}

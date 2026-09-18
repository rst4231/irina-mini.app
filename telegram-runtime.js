export function normalizeInsets(value) {
  const input = value && typeof value === 'object' ? value : {};
  const normalize = (number) => Number.isFinite(Number(number)) ? Math.max(0, Number(number)) : 0;
  return {
    top: normalize(input.top),
    right: normalize(input.right),
    bottom: normalize(input.bottom),
    left: normalize(input.left),
  };
}

export function resolveTheme(telegram = {}) {
  return telegram?.colorScheme === 'dark' ? 'dark' : 'light';
}

function fallbackStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export async function setStoredJson(telegram, key, value) {
  const serialized = JSON.stringify(value);
  if (telegram?.DeviceStorage?.setItem) {
    return new Promise((resolve) => {
      try {
        telegram.DeviceStorage.setItem(key, serialized, (error, stored) => resolve(!error && Boolean(stored)));
      } catch {
        resolve(false);
      }
    });
  }

  try {
    fallbackStorage()?.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

export async function getStoredJson(telegram, key) {
  let serialized = null;
  if (telegram?.DeviceStorage?.getItem) {
    serialized = await new Promise((resolve) => {
      try {
        telegram.DeviceStorage.getItem(key, (error, value) => resolve(error ? null : value));
      } catch {
        resolve(null);
      }
    });
  } else {
    try {
      serialized = fallbackStorage()?.getItem(key) ?? null;
    } catch {
      serialized = null;
    }
  }

  if (typeof serialized !== 'string' || !serialized) return null;
  try {
    return JSON.parse(serialized);
  } catch {
    return null;
  }
}

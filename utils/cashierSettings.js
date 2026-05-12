export function isSettingEnabled(settingValue, fallbackValue = true) {
  if (typeof settingValue === 'boolean') {
    return settingValue
  }

  if (typeof settingValue === 'string') {
    const normalizedValue = settingValue.trim().toLowerCase()

    if (normalizedValue === 'true') return true
    if (normalizedValue === 'false') return false
  }

  return fallbackValue
}

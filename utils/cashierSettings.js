export function parseSettingAsBoolean(settingValue, fallbackValue = true) {
  if (typeof settingValue === 'boolean') {
    return settingValue
  }

  if (typeof settingValue === 'string') {
    const normalizedValue = settingValue.trim().toLowerCase()

    if (normalizedValue === 'true') return true
    if (normalizedValue === 'false') return false

    console.warn('Unexpected cashier setting value:', settingValue)
  }

  return fallbackValue
}

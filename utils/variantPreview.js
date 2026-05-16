const normalizeText = (value) => String(value || '').trim();

const getTypePriority = (variantType) => {
  const normalizedName = normalizeText(variantType?.variant_type_name).toLowerCase();
  return normalizedName === 'size' ? 0 : 1;
};

const getAvailableOptionNames = (variantType) => (
  Array.isArray(variantType?.options)
    ? [...variantType.options]
      .filter((option) => option?.available !== false)
      .sort((a, b) => (Number(a?.display_order) || 0) - (Number(b?.display_order) || 0))
      .map((option) => normalizeText(option?.option_name))
      .filter(Boolean)
    : []
);

const getPreviewSourceType = (variantTypes) => (
  [...variantTypes]
    .sort((a, b) => {
      const priorityDiff = getTypePriority(a) - getTypePriority(b);
      if (priorityDiff !== 0) return priorityDiff;
      return (Number(a?.display_order) || 0) - (Number(b?.display_order) || 0);
    })
    .find((variantType) => getAvailableOptionNames(variantType).length > 0)
);

export function getRegisteredSubvariantPreview(variantTypes, maxOptions = 3) {
  if (!Array.isArray(variantTypes) || variantTypes.length === 0) return [];
  const previewSourceType = getPreviewSourceType(variantTypes);
  if (!previewSourceType) return [];
  return getAvailableOptionNames(previewSourceType).slice(0, maxOptions);
}

export function getRegisteredSubvariantCount(variantTypes) {
  if (!Array.isArray(variantTypes) || variantTypes.length === 0) return 0;
  const previewSourceType = getPreviewSourceType(variantTypes);
  if (!previewSourceType) return 0;
  return getAvailableOptionNames(previewSourceType).length;
}

export const KNOWN_CATEGORIES = ['technical', 'cultural', 'sports', 'workshop', 'seminar'] as const;

export type KnownCategory = (typeof KNOWN_CATEGORIES)[number];

export const isKnownCategory = (c?: string): c is KnownCategory => {
  if (!c) return false;
  return (KNOWN_CATEGORIES as readonly string[]).includes(c);
};

export const displayCategoryLabel = (category?: string) => {
  if (!category) return '';
  if (isKnownCategory(category)) return category.charAt(0).toUpperCase() + category.slice(1);
  // For custom/unknown categories, display the actual value (trimmed and title-cased)
  const trimmed = category.trim();
  // Title-case the custom label (simple approach)
  return trimmed
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export const getCategoryColor = (category?: string) => {
  switch (category) {
    case 'technical':
      return 'bg-blue-100 text-blue-800';
    case 'cultural':
      return 'bg-purple-100 text-purple-800';
    case 'sports':
      return 'bg-green-100 text-green-800';
    case 'workshop':
      return 'bg-orange-100 text-orange-800';
    case 'seminar':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

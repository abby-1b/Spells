
/** Tags that we won't apply MarkDown to */
export const tagNoMarkDown = [
  'style',
  'css',
  'script'
];

/** Tags that will be moved to the `head` tag */
export const tagHead = [
  'title',
  'css',
  'style',
  'meta',
  'link'
];

/**
 * Tags that don't have closing tags by default.
 * NOTE: Adding Text to any of these tags makes them still have a closing tag.
 */
export const tagSingle = [
  'meta',
  'wbr',
  'br'
];

/**
 * Attributes that should contain URLs, and should therefore be replaced by
 * their corresponding relative links.
 */
export const linkAttributes = [
  /^src$/,
  /^href$/,
  /^data\-/,
];

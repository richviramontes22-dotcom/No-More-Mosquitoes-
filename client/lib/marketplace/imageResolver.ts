/**
 * Marketplace Image Resolver
 * Maps catalog_items.image_url filenames to uploaded asset CDN URLs
 * 
 * SOURCE OF TRUTH: marketplace_image_pricing_asset_map.md
 * Provides a deterministic mapping layer from database filename values to accessible image URLs
 */

/**
 * Map of filename keys to builder CDN URLs
 * These URLs correspond to the uploaded marketplace images
 */
const IMAGE_URL_MAP: Record<string, string> = {
  // Yard Signs (Metal & General variants)
  "yard-sign-metal-white.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F8893626ad6dc41509c9c4a8131d7e324?format=webp&width=800&height=1200",
  "yard_sign_metal_white.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F8893626ad6dc41509c9c4a8131d7e324?format=webp&width=800&height=1200",

  "yard-sign-general.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2Fe71513bf5cd54b6183dc2c5ea7fcd43f?format=webp&width=800&height=1200",
  "yard_sign_general.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2Fe71513bf5cd54b6183dc2c5ea7fcd43f?format=webp&width=800&height=1200",

  // Yard Sign General - Green variant (newly uploaded)
  "yard-sign-general-green.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F2cea34e327d24c46940b5a55d2788508?format=webp&width=800&height=1200",
  "yard_sign_general_green.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F2cea34e327d24c46940b5a55d2788508?format=webp&width=800&height=1200",

  // Garden Flag
  "garden-flag.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F948f93960a8d407cba48ca5b99dc195f?format=webp&width=800&height=1200",
  "garden_flag.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F948f93960a8d407cba48ca5b99dc195f?format=webp&width=800&height=1200",

  // Garden Flag - Green variant (newly uploaded)
  "garden-flag-green.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F6f8133c1275e423894672fb0dbd18d33?format=webp&width=800&height=1200",
  "garden_flag_green.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F6f8133c1275e423894672fb0dbd18d33?format=webp&width=800&height=1200",

  // Branded Hat
  "nmm-hat.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2Fe444cc77726c46f4af67098d97273c77?format=webp&width=800&height=1200",
  "nmm_hat.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2Fe444cc77726c46f4af67098d97273c77?format=webp&width=800&height=1200",

  // Branded Hat - Alternative filename (newly uploaded)
  "branded-hat.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2Fbba4a376752844eb8845ae48ae4bf825?format=webp&width=800&height=1200",
  "branded_hat.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2Fbba4a376752844eb8845ae48ae4bf825?format=webp&width=800&height=1200",

  // Branded Socks
  "nmm-socks.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F7b464887227b4be69b764fd7fc3bc2fd?format=webp&width=800&height=1200",
  "nmm_socks.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F7b464887227b4be69b764fd7fc3bc2fd?format=webp&width=800&height=1200",

  // Branded Socks - White variant (newly uploaded)
  "nmm-socks-white.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F88b816d9b9034bb28cfc462b20cb153a?format=webp&width=800&height=1200",
  "nmm_socks_white.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F88b816d9b9034bb28cfc462b20cb153a?format=webp&width=800&height=1200",

  // Branded Socks - Gray variant (newly uploaded)
  "nmm-socks-gray.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F6df1cc9fa39d49eaa7bdfcb636f93ff6?format=webp&width=800&height=1200",
  "nmm_socks_gray.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F6df1cc9fa39d49eaa7bdfcb636f93ff6?format=webp&width=800&height=1200",
  
  // Fish Species (Consultation Items)
  "mosquito-fish-gambusia.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F274543086042420da27d97789c5e6b7d?format=webp&width=800&height=1200",
  "gambusia_affinis.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F274543086042420da27d97789c5e6b7d?format=webp&width=800&height=1200",
  "mosquito_fish_gambusia.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F274543086042420da27d97789c5e6b7d?format=webp&width=800&height=1200",

  "mosquito-fish-koi.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F03e6dd04cb2f4190a0ce1c25f8810f6a?format=webp&width=800&height=1200",
  "koi.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F03e6dd04cb2f4190a0ce1c25f8810f6a?format=webp&width=800&height=1200",
  "mosquito_fish_koi.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F03e6dd04cb2f4190a0ce1c25f8810f6a?format=webp&width=800&height=1200",

  "mosquito-fish-guppy.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F64259a3d6b084b0097dc908e60e02a94?format=webp&width=800&height=1200",
  "guppy.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F64259a3d6b084b0097dc908e60e02a94?format=webp&width=800&height=1200",
  "mosquito_fish_guppy.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F64259a3d6b084b0097dc908e60e02a94?format=webp&width=800&height=1200",

  // Guppy - Alternative/enhanced variant (newly uploaded)
  "guppy-alt.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F6ba685159e2b41ebbfc210329659847b?format=webp&width=800&height=1200",
  "guppy_alt.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F6ba685159e2b41ebbfc210329659847b?format=webp&width=800&height=1200",

  "mosquito-fish-goldfish.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F000c0019f7174624bd3659fa1b9a8d3e?format=webp&width=800&height=1200",
  "goldfish.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F000c0019f7174624bd3659fa1b9a8d3e?format=webp&width=800&height=1200",
  "mosquito_fish_goldfish.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F000c0019f7174624bd3659fa1b9a8d3e?format=webp&width=800&height=1200",

  // Goldfish - Alternative/enhanced variant (newly uploaded)
  "goldfish-alt.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F803adc2aebcf4317a3ecf48bd782ed32?format=webp&width=800&height=1200",
  "goldfish_alt.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F803adc2aebcf4317a3ecf48bd782ed32?format=webp&width=800&height=1200",

  "mosquito-fish-minnows.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F5d7db69b0c2449e38da07efe923d1b17?format=webp&width=800&height=1200",
  "minnows.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F5d7db69b0c2449e38da07efe923d1b17?format=webp&width=800&height=1200",
  "mosquito_fish_minnows.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F5d7db69b0c2449e38da07efe923d1b17?format=webp&width=800&height=1200",

  // Minnow - Alternative/enhanced variant (newly uploaded)
  "minnow.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F4b93e06e9b0f4c76b1f65d15b072f7a3?format=webp&width=800&height=1200",
  "minnow_alt.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F4b93e06e9b0f4c76b1f65d15b072f7a3?format=webp&width=800&height=1200",
  "minnow-alt.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F4b93e06e9b0f4c76b1f65d15b072f7a3?format=webp&width=800&height=1200",

  "mosquito-fish-betta.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F103a876f7fd1442d9e2144f841f9dfaa?format=webp&width=800&height=1200",
  "betta-fish.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F103a876f7fd1442d9e2144f841f9dfaa?format=webp&width=800&height=1200",
  "betta.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F103a876f7fd1442d9e2144f841f9dfaa?format=webp&width=800&height=1200",
  "mosquito_fish_betta.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F103a876f7fd1442d9e2144f841f9dfaa?format=webp&width=800&height=1200",

  // Betta Fish - Alternative/enhanced variant (newly uploaded)
  "betta_fish.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F83c8ca43357d414d85001602e510639e?format=webp&width=800&height=1200",
  "betta-fish-alt.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F83c8ca43357d414d85001602e510639e?format=webp&width=800&height=1200",
  "betta_fish_alt.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F83c8ca43357d414d85001602e510639e?format=webp&width=800&height=1200",

  "mosquito-fish-bluegill.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2Fb70b0f75688a47d48e8aa69a21efd927?format=webp&width=800&height=1200",
  "bluegill.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2Fb70b0f75688a47d48e8aa69a21efd927?format=webp&width=800&height=1200",
  "sunfish.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2Fb70b0f75688a47d48e8aa69a21efd927?format=webp&width=800&height=1200",
  "mosquito_fish_bluegill.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2Fb70b0f75688a47d48e8aa69a21efd927?format=webp&width=800&height=1200",

  // Bluegill/Sunfish - Alternative/enhanced variant (newly uploaded)
  "bluegill_sunfish.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F1a68108f620541cfbf9acbb0ab85da9d?format=webp&width=800&height=1200",
  "bluegill-sunfish.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F1a68108f620541cfbf9acbb0ab85da9d?format=webp&width=800&height=1200",
  "sunfish_alt.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F1a68108f620541cfbf9acbb0ab85da9d?format=webp&width=800&height=1200",
  "sunfish-alt.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F1a68108f620541cfbf9acbb0ab85da9d?format=webp&width=800&height=1200",
  
  // Multi-fish variety image for Fish Stocking Service
  "fish-variety.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F6dd4876bcabb4733a3557cba33d32165?format=webp&width=800&height=1200",
  "fish_variety.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F6dd4876bcabb4733a3557cba33d32165?format=webp&width=800&height=1200",
  "pond-fish-setup.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F6dd4876bcabb4733a3557cba33d32165?format=webp&width=800&height=1200",
  "pond_fish_setup.jpg": "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F6dd4876bcabb4733a3557cba33d32165?format=webp&width=800&height=1200",
};

/**
 * Resolve an image URL from a catalog item's image_url filename value
 * 
 * @param filename - The filename value from catalog_items.image_url
 * @returns The full accessible CDN URL if mapped, null otherwise
 * 
 * Example:
 *   resolveImageUrl("yard-sign-metal-white.jpg")
 *   → "https://cdn.builder.io/api/v1/image/assets/.../..."
 */
export function resolveImageUrl(filename: string | null): string | null {
  if (!filename) {
    return null;
  }

  // Try exact match first
  if (IMAGE_URL_MAP[filename]) {
    return IMAGE_URL_MAP[filename];
  }

  // Try normalized match (underscore to dash)
  const normalized = filename.replace(/_/g, "-");
  if (IMAGE_URL_MAP[normalized]) {
    return IMAGE_URL_MAP[normalized];
  }

  // Try reverse normalized match (dash to underscore)
  const reverseNormalized = filename.replace(/-/g, "_");
  if (IMAGE_URL_MAP[reverseNormalized]) {
    return IMAGE_URL_MAP[reverseNormalized];
  }

  // Not found in mapping
  console.warn(`[imageResolver] No CDN URL found for filename: ${filename}`);
  return null;
}

/**
 * Get all mapped images (for debugging/verification)
 */
export function getMappedImages(): Record<string, string> {
  return { ...IMAGE_URL_MAP };
}

/**
 * Get list of all mapped filenames
 */
export function getMappedFilenames(): string[] {
  return Object.keys(IMAGE_URL_MAP);
}

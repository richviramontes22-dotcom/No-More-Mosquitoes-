export const img_logo_nomoremoss_black = {
  src: "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F2b3c51840df24579b587af7ce8f714ec?format=webp&width=800&height=1200",
  alt: "NO MORE MOSQUITOES logo",
};

export const img_logo_full_text = {
  src: "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F1e4da675dfe8488da291788793f52d6b?format=webp&width=800&height=1200",
  alt: "No More Mosquitoes Full Logo",
};

export const img_logo_banner_arrangement = {
  src: "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2Fa07994705cae470eb2cdcd551e128ae9?format=webp&width=800&height=1200",
  alt: "No More Mosquitoes Banner Arrangement",
};

export const img_bg_technician_spraying = {
  src: "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2Fcf2e6f26d228431eb0786b8bcc829c38?format=webp&width=1600",
  alt: "Technician spraying along fence line",
};

export const img_bg_modern_backyard_patio = {
  src: "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F184101fad80d48c0a74f408aae70e6e2?format=webp&width=1600",
  alt: "Modern backyard patio",
};

export const img_dpr_logo_state_of_ca_dpr = {
  src: "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F6a2059315b0b41e4a31b760c13a227e9?format=webp&width=800&height=1200",
  alt: "Department of Pesticide Regulation logo",
};

export const img_state_of_ca_bear_logo = {
  src: "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F26a9121e939b426e9953e979722c379e?format=webp&width=800&height=1200",
  alt: "State of California bear logo",
};

export const img_anaheim_seal = {
  src: "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F9f925596a86a44e3be109619c87188a7?format=webp&width=800&height=1200",
  alt: "City of Anaheim Seal",
};

export const heroImage = {
  src: img_bg_modern_backyard_patio.src,
  alt: "Enjoy the comfort of your yard all season",
};

export const technicianImages = [
  {
    src: img_bg_technician_spraying.src,
    alt: "Licensed technician applying mosquito treatment",
  },
  {
    src: "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F76cac00f29f24646aaae696a09f8db5d?format=webp&width=1600",
    alt: "Specialist treating trees along a fence line",
  },
  {
    src: "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F7f4488cb2d2346b2b8906df3439c2302?format=webp&width=1600",
    alt: "Technician misting orchard trees with backpack sprayer",
  },
];

export type CarouselImage = {
  src: string;
  mobileSrc?: string;
  alt: string;
  objectPosition?: string;
  animationKey?: string;
};

export const lifestyleImages: CarouselImage[] = [
  {
    src: "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F825ff38b2f6f4a31b12ea3c502afd4df?format=webp&width=1600",
    mobileSrc: "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F825ff38b2f6f4a31b12ea3c502afd4df?format=webp&width=800&height=1000",
    alt: "Modern outdoor space treatment",
    objectPosition: "center",
    animationKey: "patio",
  },
  {
    src: "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F399a351de6ca445594bc92ec86398a0e?format=webp&width=1600",
    mobileSrc: "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F399a351de6ca445594bc92ec86398a0e?format=webp&width=800&height=1000",
    alt: "Family enjoying outdoor patio",
    objectPosition: "center",
    animationKey: "family",
  },
  {
    src: "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F49a736ff1a1742a69e3ed75408c0fdef?format=webp&width=1600",
    mobileSrc: "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F49a736ff1a1742a69e3ed75408c0fdef?format=webp&width=800&height=1000",
    alt: "Technician spraying backyard",
    objectPosition: "center",
    animationKey: "fogger-close",
  },
];

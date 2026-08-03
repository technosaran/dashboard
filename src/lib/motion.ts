// Spring physics presets for tactile human-crafted micro-interactions
export const SPRING_PRESETS = {
  snappy: { type: "spring", stiffness: 400, damping: 30 },
  bouncy: { type: "spring", stiffness: 300, damping: 20 },
  gentle: { type: "spring", stiffness: 200, damping: 25 },
} as const;

export const STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.03,
    },
  },
};

export const FADE_UP_ITEM = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: SPRING_PRESETS.snappy },
};

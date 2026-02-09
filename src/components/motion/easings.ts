// Crowe-branded easing presets for anime.js v4
export const easings = {
  easeOutCubic: 'cubicBezier(0.33, 1, 0.68, 1)',
  easeInOutQuart: 'cubicBezier(0.76, 0, 0.24, 1)',
  easeOutExpo: 'cubicBezier(0.16, 1, 0.3, 1)',
  easeOutQuint: 'cubicBezier(0.22, 1, 0.36, 1)',
  easeInOutCubic: 'cubicBezier(0.65, 0, 0.35, 1)',
} as const;

export const durations = {
  instant: 75,
  fast: 150,
  normal: 250,
  slow: 350,
  slower: 500,
  entrance: 600,
} as const;

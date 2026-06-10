/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
  // Dynamic class strings constructed at runtime (e.g. MediaCollection's
  // COLUMN_CLASSES table built from numeric `preset.columns`) aren't visible
  // to Tailwind's content scanner, so their responsive variants get pruned
  // out of the compiled stylesheet. Without this safelist, every
  // MediaCollection grid renders as a single column at every breakpoint —
  // only `grid-cols-1` survives the prune.
  safelist: [
    'grid-cols-1',
    'grid-cols-2', 'sm:grid-cols-2',
    'grid-cols-3', 'lg:grid-cols-3',
    'grid-cols-4', 'xl:grid-cols-4',
    'grid-cols-5', '2xl:grid-cols-5',
  ],
};

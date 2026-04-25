const {
  buildColorVarMap,
  buildColorVars,
  buildFontSizeMap,
} = require('./lib/theme/build-css-vars');

const cssVarBlocks = buildColorVars();

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './lib/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: buildColorVarMap(),
      fontSize: buildFontSizeMap(),
    },
  },
  plugins: [
    ({ addBase }) => addBase(cssVarBlocks),
  ],
};

// Exposed for the parity test only — not consumed by Tailwind itself.
module.exports.__cssVarBlocksForTest = cssVarBlocks;

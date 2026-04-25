const { colors, type } = require('./tokens.cjs');

function buildColorVars() {
  const toBlock = (palette) =>
    Object.fromEntries(Object.entries(palette).map(([k, v]) => [`--${k}`, v]));
  return {
    ':root': toBlock(colors.light),
    '.dark': toBlock(colors.dark),
  };
}

function buildColorVarMap() {
  return Object.fromEntries(
    Object.keys(colors.light).map((k) => [k, `var(--${k})`]),
  );
}

function buildFontSizeMap() {
  return Object.fromEntries(
    Object.entries(type).map(([k, v]) => [
      k,
      [`${v.size}px`, { lineHeight: `${v.lineHeight}px`, fontWeight: v.weight }],
    ]),
  );
}

module.exports = { buildColorVars, buildColorVarMap, buildFontSizeMap };

// Regenerates .expo/types/router.d.ts from the current app/ tree without
// starting the Expo dev server. Mirrors what `npx expo start` would do via
// the typed-routes Babel plugin. Safe to delete after one-shot use.
const fs = require('fs');
const path = require('path');
const { getTypedRoutesDeclarationFile } = require('expo-router/build/typed-routes/generate');

const projectRoot = path.resolve(__dirname, '..');
const appDir = path.join(projectRoot, 'app');

function buildContext(dir) {
  const files = [];
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(t|j)sx?$/.test(entry.name)) {
        files.push('./' + path.relative(dir, full).replace(/\\/g, '/'));
      }
    }
  }
  walk(dir);
  const ctx = (id) => ({ default: () => null });
  ctx.keys = () => files;
  ctx.resolve = (id) => id;
  ctx.id = appDir;
  return ctx;
}

const ctx = buildContext(appDir);
const out = getTypedRoutesDeclarationFile(ctx);
const target = path.join(projectRoot, '.expo', 'types', 'router.d.ts');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, out);
console.log('Wrote', target);

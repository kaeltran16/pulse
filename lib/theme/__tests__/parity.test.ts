import resolveConfig from 'tailwindcss/resolveConfig';
import tailwindConfig from '../../../tailwind.config.js';
import { colors, type } from '../tokens';
import {
  buildColorVarMap,
  buildColorVars,
  buildFontSizeMap,
} from '../build-css-vars';

const resolved = resolveConfig(tailwindConfig as any) as any;

describe('tokens.ts ⇔ tailwind.config.js parity', () => {
  describe('colors — every semantic key maps to var(--<key>)', () => {
    const expected = buildColorVarMap();
    for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
      it(`colors.${key} resolves to ${expected[key]}`, () => {
        expect(resolved.theme.colors[key]).toBe(expected[key]);
      });
    }
  });

  describe('CSS variable blocks emitted by the tailwind plugin', () => {
    // The tailwind config exposes the addBase data via a named export
    // for this test (see tailwind.config.js Task 7).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { __cssVarBlocksForTest } = require('../../../tailwind.config.js');
    const expected = buildColorVars();

    it(':root block matches every light token', () => {
      for (const [k, v] of Object.entries(colors.light)) {
        expect(__cssVarBlocksForTest[':root'][`--${k}`]).toBe(v);
      }
    });

    it('.dark block matches every dark token', () => {
      for (const [k, v] of Object.entries(colors.dark)) {
        expect(__cssVarBlocksForTest['.dark'][`--${k}`]).toBe(v);
      }
    });

    it('.dark and :root cover identical key sets', () => {
      const lightKeys = Object.keys(expected[':root']).sort();
      const darkKeys = Object.keys(expected['.dark']).sort();
      expect(darkKeys).toEqual(lightKeys);
    });
  });

  describe('typography — every type key matches', () => {
    const expected = buildFontSizeMap();
    for (const key of Object.keys(type) as (keyof typeof type)[]) {
      it(`fontSize.${key} matches`, () => {
        const got = resolved.theme.fontSize[key];
        const exp = expected[key];
        // Tailwind shape: ['17px', { lineHeight: '22px', fontWeight: '400' }]
        expect(got[0]).toBe(exp[0]);
        expect(got[1].lineHeight).toBe(exp[1].lineHeight);
        expect(got[1].fontWeight).toBe(exp[1].fontWeight);
      });
    }
  });
});

import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/autolayout.ts',
  output: {
    file: 'dist/loom.jsx',
    format: 'iife',
    name: 'PhotoshopLoom',
    banner: '#target photoshop\n',
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
    }),
  ],
};


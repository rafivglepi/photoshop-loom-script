import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/autolayout.ts',
  output: {
    file: 'dist/autolayout.jsx',
    format: 'iife',
    name: 'PSAutoLayout',
    banner: '#target photoshop\n',
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
    }),
  ],
};


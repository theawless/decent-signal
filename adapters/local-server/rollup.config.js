import nodeResolve from '@rollup/plugin-node-resolve'
import pkg from './package.json'

export default {
  input: 'index.js',
  external: Object.keys(pkg.peerDependencies),
  output: [
    { file: pkg.main, format: 'cjs' },
    { file: pkg.module, format: 'es' },
    {
      file: pkg.browser,
      format: 'iife',
      name: 'decentSignal',
      extend: true,
      globals: { 'decent-signal': 'decentSignal' }
    }
  ],
  plugins: [nodeResolve()]
}

import pkg from './package.json'

export default {
  input: 'index.js',
  external: Object.keys(pkg.peerDependencies),
  output: [
    { file: pkg.module, format: 'es' },
    {
      file: pkg.browser,
      format: 'iife',
      name: 'decentSignal',
      extend: true,
      globals: { 'decent-signal': 'decentSignal' }
    }
  ]
}

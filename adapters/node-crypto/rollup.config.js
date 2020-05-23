import pkg from './package.json'

export default {
  input: 'index.js',
  external: ['crypto', ...Object.keys(pkg.peerDependencies)],
  output: [
    { file: pkg.main, format: 'cjs' },
    { file: pkg.module, format: 'es' }
  ]
}

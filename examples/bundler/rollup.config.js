import nodeResolve from '@rollup/plugin-node-resolve'
import pkg from './package.json'

export default {
  input: 'index.js',
  output: { file: pkg.module, format: 'es' },
  plugins: [nodeResolve()]
}

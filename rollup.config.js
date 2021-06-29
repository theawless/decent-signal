import multi from '@rollup/plugin-multi-entry'
import pkg from './package.json'

export default {
  input: 'sources/**/*.js',
  output: [
    { file: pkg.main, format: 'cjs' },
    { file: pkg.module, format: 'es' },
    { file: pkg.browser, format: 'iife', name: 'decentSignal' }
  ],
  plugins: [multi()]
}

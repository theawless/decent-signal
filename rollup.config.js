import pkg from './package.json';
import inject from '@rollup/plugin-inject';

export default [
    {
        input: 'src/index.js',
        external: Object.keys(pkg.dependencies),
        output: [{file: pkg.main, format: 'cjs'},],
        plugins: [inject({sjcl: "sjcl"})]
    },
    {
        input: 'src/index.js',
        output: [{file: pkg.module, format: 'es'}],
    }
];
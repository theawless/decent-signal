import pkg from "./package.json";
import inject from "@rollup/plugin-inject";

export default [
    {
        input: "index.js",
        external: Object.keys(pkg.peerDependencies),
        output: [{file: pkg.main, format: "cjs"}],
        plugins: [inject({RxDB: "rxdb"})]

    },
    {
        input: "index.js",
        output: [{file: pkg.module, format: "es"}]
    }
];

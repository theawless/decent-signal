import pkg from "./package.json";

export default [
    {
        input: "index.js",
        output: [{file: pkg.main, format: "cjs"}],
        external: ["crypto"]
    }
];

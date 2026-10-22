import { register } from "node:module";

// Install the TS/TSX loader before Node imports any test file.
register("./loader.mjs", import.meta.url);

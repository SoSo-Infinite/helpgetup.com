// Test loader: @/ aliases, extensionless .ts/.tsx, CSS stubs. No new packages.
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

// tests/support/loader.mjs -> repository root.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const srcRoot = join(repoRoot, "src");
const testsRoot = join(repoRoot, "tests");

function inside(root, file) {
  const rel = relative(root, file);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

// .ts, then .tsx, then index.ts / index.tsx. First hit wins.
function resolveSource(base) {
  return [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ].find((file) => existsSync(file));
}

export async function resolve(specifier, context, nextResolve) {
  let file;
  if (specifier.startsWith("@/")) {
    // tsconfig path: @/x -> <repo>/src/x
    file = resolveSource(join(srcRoot, specifier.slice(2)));
  } else if (
    extname(specifier) === "" &&
    (specifier.startsWith("./") || specifier.startsWith("../"))
  ) {
    const parent = context.parentURL?.startsWith("file:")
      ? fileURLToPath(context.parentURL)
      : "";
    // Extensionless relatives only from files under src/ or tests/.
    if (parent && (inside(srcRoot, parent) || inside(testsRoot, parent))) {
      file = resolveSource(join(dirname(parent), specifier));
    }
  }
  if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    // Node ESM does not add .js for extensionless subpaths such as next/link.
    const bare =
      extname(specifier) === "" && !/^[./]|^(node|file):/.test(specifier);
    if (bare && error?.code === "ERR_MODULE_NOT_FOUND") {
      return nextResolve(`${specifier}.js`, context);
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (!url.startsWith("file:")) return nextLoad(url, context);
  const file = fileURLToPath(url);
  if (file.endsWith(".css")) {
    // CSS modules return the class key. Plain CSS is an empty default export.
    const source = file.endsWith(".module.css")
      ? "const styles = new Proxy({}, { get: (_, key) => key }); export default styles;\n"
      : "export default {};\n";
    return { format: "module", source, shortCircuit: true };
  }
  const tsFile =
    /\.tsx?$/.test(file) &&
    inside(repoRoot, file) &&
    !relative(repoRoot, file).split(sep).includes("node_modules");
  if (!tsFile) return nextLoad(url, context);
  // Strip types and compile JSX. node_modules stays with Node's loader.
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      verbatimModuleSyntax: false,
    },
    fileName: file,
  });
  return { format: "module", source: outputText, shortCircuit: true };
}

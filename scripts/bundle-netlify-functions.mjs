// Pre-bundles each Netlify function into a single self-contained .cjs file with
// zero node_modules dependencies. Netlify's own function bundler (zip-it-and-ship-it /
// @vercel/nft) hangs for ~18 minutes tracing this project's large node_modules tree
// (devDependencies include @swc/core, three, @react-three/drei, recharts, etc.).
// Bundling everything inline here means Netlify has nothing left to trace.
import { build } from "esbuild";
import { readdirSync, mkdirSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "netlify", "functions");
const outDir = path.join(root, "dist", "netlify-functions");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const entries = readdirSync(srcDir).filter((f) => f.endsWith(".ts"));

for (const entry of entries) {
  const name = entry.replace(/\.ts$/, "");
  await build({
    entryPoints: [path.join(srcDir, entry)],
    outfile: path.join(outDir, `${name}.cjs`),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    minify: false,
    sourcemap: false,
    logLevel: "warning",
  });
  console.log(`[bundle-netlify-functions] Bundled ${name} -> dist/netlify-functions/${name}.cjs`);
}

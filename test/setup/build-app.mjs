import { fileURLToPath } from "node:url";

/**
 * Builds the app into the directory named on the command line.
 *
 * A script of its own, run as a child process, rather than a function called
 * from `build.ts`. Building leaves Nuxt's logger installed over the console,
 * and in the process Vitest reports from that silently swallows the run's
 * results — everything passes and nothing is printed. A child process cannot
 * reach the reporter, and gives its memory back when it exits.
 *
 * Plain JavaScript because nothing compiles it: `node` runs it directly.
 */
const [buildDir] = process.argv.slice(2);

if (!buildDir) throw new Error("Usage: node build-app.mjs <buildDir>");

const { buildNuxt, loadNuxt } = await import("nuxt/kit");

const nuxt = await loadNuxt({
  cwd: fileURLToPath(new URL("../..", import.meta.url)),
  dev: false,
  overrides: {
    buildDir,
    nitro: { output: { dir: `${buildDir}/output` } },
    // Nitro otherwise reports the build the way it does on the command line:
    // every chunk it wrote, ahead of the test results.
    logLevel: "silent",
  },
});

try {
  await buildNuxt(nuxt);
} finally {
  await nuxt.close();
}

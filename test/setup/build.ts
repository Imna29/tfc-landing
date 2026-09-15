import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { TestProject } from "vitest/node";

const run = promisify(execFile);

/**
 * Where the one build the server tests share is written.
 *
 * A fixed path rather than the random one `@nuxt/test-utils` picks per
 * `setup()` call, because a fixed path is the whole point: every test file
 * boots the same output. Under `.nuxt/` so it is already ignored.
 */
const buildDir = fileURLToPath(new URL("../../.nuxt/test/shared", import.meta.url));

/** The script that does the building, run as a child process. See below. */
const builder = fileURLToPath(new URL("build-app.mjs", import.meta.url));

/**
 * Builds the app once for the whole server test run.
 *
 * `@nuxt/test-utils` builds per `setup()` call, into a directory named after a
 * random id, so nothing was ever reused and a run paid for one full production
 * build per test file — around two thirds of the time the suite took. Nothing
 * about a test file changes what is built: the things that differ between them
 * — the database URL, the connection budget, the port, the mailbox to send to
 * — are handed to the server process as environment when it starts, not
 * compiled into it. So one build serves them all, and `setupTestServer` boots
 * servers from it instead of building again.
 *
 * The exception is a file that passes `nuxtConfig`, which is a request for a
 * *different* build; `setupTestServer` gives those their own, as before.
 *
 * Built fresh each run rather than kept between them, because a stale build is
 * the one failure mode this must not have: a test that passed against the
 * previous commit's server would be worse than a slow one.
 */
export async function setup(project: TestProject) {
  await rm(buildDir, { recursive: true, force: true });

  await run(process.execPath, [builder, buildDir]);

  project.provide("buildDir", buildDir);
}

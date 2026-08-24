import { afterAll, beforeEach } from "vitest";
import { closeTestDatabase, resetDatabase } from "../helpers/database";

// Every server test starts from an empty database. Registered here rather than
// per file so that no test can forget it and quietly depend on another test's
// leftovers.
beforeEach(resetDatabase);

afterAll(closeTestDatabase);

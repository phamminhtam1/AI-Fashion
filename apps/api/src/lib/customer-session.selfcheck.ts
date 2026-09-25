// ponytail: staff vs customer cookie names must stay distinct
import assert from "node:assert/strict";
import { CUSTOMER_SESSION_COOKIE, SESSION_COOKIE } from "./session.js";

assert.equal(SESSION_COOKIE, "elane_session");
assert.equal(CUSTOMER_SESSION_COOKIE, "elane_customer_session");
assert.notEqual(SESSION_COOKIE, CUSTOMER_SESSION_COOKIE);

console.log("customer-session.selfcheck: ok");

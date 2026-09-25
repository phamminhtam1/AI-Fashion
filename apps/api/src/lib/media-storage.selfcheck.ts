import assert from "node:assert/strict";
import { mediaPublicUrl } from "./media-storage.js";
import { env } from "../env.js";

// ponytail: URL builder only — skips network upload
const key = "abc/file.jpg";
const url = mediaPublicUrl(key);
if (env.supabaseUrl) {
  assert.match(url, /\/storage\/v1\/object\/public\/products\/abc\/file\.jpg$/);
  assert.ok(!url.includes("/rest/v1"));
} else {
  assert.equal(url, `/media/${key}`);
}
console.log("media-storage self-check ok");

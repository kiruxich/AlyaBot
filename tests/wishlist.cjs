const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { test } = require("node:test");

// Run the real route and component without a dev server or external services.
const root = path.resolve(__dirname, "..");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (id, ...args) {
  return resolve.call(this, id.startsWith("@/") ? path.join(root, id.slice(2)) : id, ...args);
};
for (const ext of [".ts", ".tsx"]) {
  require.extensions[ext] = (mod, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
      fileName: filename,
    });
    mod._compile(outputText, filename);
  };
}
process.env.NODE_ENV = "development";
for (const key of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) delete process.env[key];
const { config } = require("../lib/config.ts");
config.ownerId = 101;
config.herId = 202;
const db = require("../lib/db.ts");
const { POST } = require("../app/api/app/route.ts");
const { NextRequest } = require("next/server");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { Wishlist } = require("../components/shared.tsx");
const wish = { id: "gift", title: "Подарок", note: "Белый", createdAt: 1, reserved: true };
const render = (owner, item = wish) => renderToStaticMarkup(React.createElement(Wishlist, { owner, wishlist: [item], run: async () => true }));
const post = (role, payload) => {
  config.devUserId = role === "owner" ? config.ownerId : config.herId;
  return POST(new NextRequest("http://localhost/api/app", { method: "POST", body: JSON.stringify(payload) }));
};

test("owner can complete a wish, retain it after reload, and undo completion", async () => {
  await db.setWishlist([wish]);
  let response = await post("owner", { op: "wish.complete", id: wish.id, completed: true });
  assert.equal(response.status, 200);
  let data = await response.json();
  assert.ok(data.wishlist[0].completedAt > 0);
  assert.equal(data.wishlist[0].reserved, false);
  const [saved] = await db.getWishlist();
  assert.equal(saved.completedAt, data.wishlist[0].completedAt);
  assert.equal(saved.title, wish.title);
  assert.equal(saved.note, wish.note);
  response = await post("owner", { op: "wish.complete", id: wish.id, completed: true });
  data = await response.json();
  assert.equal(data.wishlist[0].completedAt, saved.completedAt);
  // A harmless delete of an absent ID returns the real response for her role.
  response = await post("her", { op: "wish.delete", id: "absent" });
  data = await response.json();
  assert.equal(data.wishlist[0].completedAt, saved.completedAt);
  assert.equal("reserved" in data.wishlist[0], false);
  response = await post("her", { op: "wish.complete", id: wish.id, completed: false });
  assert.equal(response.status, 403);
  response = await post("owner", { op: "wish.complete", id: wish.id, completed: false });
  data = await response.json();
  assert.equal(data.wishlist[0].completedAt, undefined);
  assert.equal(data.wishlist.length, 1);
});

test("completed wishes cannot be secretly reserved again", async () => {
  await db.setWishlist([{ ...wish, reserved: false, completedAt: 100 }]);
  const response = await post("owner", { op: "wish.reserve", id: wish.id, reserved: true });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.wishlist[0].reserved, false);
  assert.equal(data.wishlist[0].completedAt, 100);
});

test("invalid completion requests leave the wishlist unchanged", async () => {
  await db.setWishlist([wish]);
  for (const payload of [{ id: "missing", completed: true }, { id: wish.id, completed: "false" }]) {
    const response = await post("owner", { op: "wish.complete", ...payload });
    assert.equal(response.status, 400);
    assert.deepEqual(await db.getWishlist(), [wish]);
  }
});

test("completion controls appear for owner and completed status appears for both", () => {
  assert.match(render(true), /Куплено \/ подарено/);
  assert.doesNotMatch(render(false), /Куплено \/ подарено/);
  const completed = { ...wish, reserved: false, completedAt: 100 };
  for (const owner of [true, false]) assert.match(render(owner, completed), /Исполнено/);
  assert.match(render(true, completed), /Вернуть в желания/);
  assert.doesNotMatch(render(true, completed), /Забронировать тайно/);
});

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ACCOUNT_DELETION_CONFIRMATION,
  FEATURE_DIRECTORY_COPY,
  GO_BACK_ACCESSIBILITY_LABEL,
  accessibleTextValue,
  isAccountDeletionConfirmed,
} = require("./dist");

test("account deletion stays disabled until DELETE is typed", () => {
  assert.equal(ACCOUNT_DELETION_CONFIRMATION, "DELETE");
  assert.equal(isAccountDeletionConfirmed(""), false);
  assert.equal(isAccountDeletionConfirmed("Type DELETE"), false);
  assert.equal(isAccountDeletionConfirmed("delete"), false);
  assert.equal(isAccountDeletionConfirmed("DELETE"), true);
  assert.equal(isAccountDeletionConfirmed("DELETE", true), false);
});

test("empty inputs expose an empty accessibility value", () => {
  assert.deepEqual(accessibleTextValue(""), { text: "" });
  assert.deepEqual(accessibleTextValue(undefined), { text: "" });
  assert.deepEqual(accessibleTextValue("Test"), { text: "Test" });
});

test("feature directory copy uses property-only rent and one-document OR rule", () => {
  assert.match(FEATURE_DIRECTORY_COPY.marketplace, /properties for sale or rent/i);
  assert.doesNotMatch(FEATURE_DIRECTORY_COPY.marketplace, /items for sale or rent/i);
  assert.match(FEATURE_DIRECTORY_COPY.verification, /National ID or one residency\/ownership contract/i);
  assert.doesNotMatch(FEATURE_DIRECTORY_COPY.verification, /documents/i);
});

test("nested navigation uses a back label", () => {
  assert.equal(GO_BACK_ACCESSIBILITY_LABEL, "Go back");
});

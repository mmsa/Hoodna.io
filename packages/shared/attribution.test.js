const assert = require("node:assert/strict");
const test = require("node:test");

const {
  parseAttributionFromSearch,
  parseReferralCode,
  mergeFirstTouch,
  withUtmParams,
  SHARE_UTM,
} = require("./dist");

test("parses UTM, referral, and known social referrers", () => {
  const utm = parseAttributionFromSearch(
    "?utm_source=Facebook&utm_medium=cpc&utm_campaign=launch&ref=abc123",
  );
  assert.equal(utm.source, "facebook");
  assert.equal(utm.medium, "cpc");
  assert.equal(utm.campaign, "launch");
  assert.equal(parseReferralCode(new URLSearchParams("ref=abc123")), "abc123");

  const fromWa = parseAttributionFromSearch("", { referrer: "https://wa.me/s" });
  assert.equal(fromWa.source, "whatsapp");
  assert.equal(fromWa.medium, "social");
});

test("first-touch merge keeps existing attribution and can fill referral", () => {
  const first = mergeFirstTouch(null, {
    attribution: { source: "facebook", campaign: "a" },
    referralCode: undefined,
  });
  const second = mergeFirstTouch(first, {
    attribution: { source: "google", campaign: "b" },
    referralCode: "neigh123",
  });
  assert.equal(second.attribution.source, "facebook");
  assert.equal(second.attribution.campaign, "a");
  assert.equal(second.referralCode, "neigh123");
});

test("withUtmParams keeps existing ref and does not overwrite utm", () => {
  const url = withUtmParams(
    "https://eljiran.io/signup?ref=abc123",
    SHARE_UTM.invite,
  );
  assert.match(url, /ref=abc123/);
  assert.match(url, /utm_source=referral/);
  const again = withUtmParams(url, SHARE_UTM.whatsappInvite);
  assert.match(again, /utm_source=referral/);
  assert.doesNotMatch(again, /utm_source=whatsapp/);
});

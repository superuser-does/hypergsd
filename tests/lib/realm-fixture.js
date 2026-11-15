// Shared realm-scale fixture for the realm-selection interaction and
// presentation suites and the bench. Promotes to tests/lib/realm-fixture.js
// (require path changes from ../../hypergsd-source/tests/lib/harness to
// ./lib/harness). 500 actions: 95 in each of five realms plus 25 realm-less
// strays, one active project per realm, deterministic titles. gsd_complete is
// EXPLICIT "false" — the fixture-row rule: dashboard lists filter on the
// positive test, a missing field does not match.
"use strict";

const NAMES = ["Work", "Home", "Errands", "Reading", "Side project"];
const PER_REALM = 95;
const REALMLESS = 25; // 5*95 + 25 = 500

module.exports = function seedRealmFixture(wiki) {
  NAMES.forEach(r => wiki.addTiddler({title: "P " + r, tags: ["$:/GSD/Project"], gsd_status: "active"}));
  NAMES.forEach(r => {
    for (let i = 1; i <= PER_REALM; i++)
      wiki.addTiddler({
        title: "A " + r + " " + String(i).padStart(2, "0"),
        tags: ["$:/GSD/Action", "$:/GSD/Realm/" + r],
        gsd_status: "next", gsd_complete: "false", gsd_project: "P " + r
      });
  });
  for (let i = 1; i <= REALMLESS; i++)
    wiki.addTiddler({title: "A none " + String(i).padStart(2, "0"), tags: ["$:/GSD/Action"], gsd_status: "next", gsd_complete: "false"});
  return {
    names: NAMES,
    realms: NAMES.map(r => "$:/GSD/Realm/" + r).sort(),
    perRealm: PER_REALM,
    realmless: REALMLESS,
    total: NAMES.length * PER_REALM + REALMLESS
  };
};
module.exports.NAMES = NAMES;

/* IMPORTANT
 * This snapshot file is auto-generated, but designed for humans.
 * It should be checked into source control and tracked carefully.
 * Re-generate by setting TAP_SNAPSHOT=1 and running tests.
 * Make sure to inspect the output below.  Do not ignore changes!
 */

'use strict'

exports[`test/map.js TAP import-map - get map versions - non scoped > on GET of map versions, response should match snapshot 1`] = `
Object {
  "name": "buzz",
  "org": "local",
  "versions": Array [
    Array [
      5,
      Object {
        "integrity": "sha512-Xsex3JB8ymI7lc30kdrQ2FZYKVh25UQxpRo38HW5L6Ldnu4f5nQ0ZtDEG4AsKXT8FAbg0DGrfxV7grC2AI/RRQ==",
        "version": "5.2.2",
      },
    ],
    Array [
      4,
      Object {
        "integrity": "sha512-Xsex3JB8ymI7lc30kdrQ2FZYKVh25UQxpRo38HW5L6Ldnu4f5nQ0ZtDEG4AsKXT8FAbg0DGrfxV7grC2AI/RRQ==",
        "version": "4.9.2",
      },
    ],
  ],
}
`

exports[`test/map.js TAP import-map - get map versions - scoped > on GET of map versions, response should match snapshot 1`] = `
Object {
  "name": "@cuz/buzz",
  "org": "local",
  "versions": Array [
    Array [
      5,
      Object {
        "integrity": "sha512-Xsex3JB8ymI7lc30kdrQ2FZYKVh25UQxpRo38HW5L6Ldnu4f5nQ0ZtDEG4AsKXT8FAbg0DGrfxV7grC2AI/RRQ==",
        "version": "5.2.2",
      },
    ],
    Array [
      4,
      Object {
        "integrity": "sha512-Xsex3JB8ymI7lc30kdrQ2FZYKVh25UQxpRo38HW5L6Ldnu4f5nQ0ZtDEG4AsKXT8FAbg0DGrfxV7grC2AI/RRQ==",
        "version": "4.9.2",
      },
    ],
  ],
}
`

exports[`test/map.js TAP import-map - put map -> get map - non scoped successfully uploaded > on GET of map, response should match snapshot 1`] = `
Object {
  "imports": Object {
    "fuzz": "http://localhost:4001/finn/pkg/fuzz/v8",
  },
}
`

exports[`test/map.js TAP import-map - put map -> get map - scoped successfully uploaded > on GET of map, response should match snapshot 1`] = `
Object {
  "imports": Object {
    "fuzz": "http://localhost:4001/finn/pkg/fuzz/v8",
  },
}
`

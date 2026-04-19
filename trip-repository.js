'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

let database = null;

function init(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  database = new DatabaseSync(dbPath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function requireDb() {
  if (!database) throw new Error('trip-repository 未初始化,请先调用 init(dbPath)');
  return database;
}

function rowToTrip(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    payload: JSON.parse(row.payload_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function upsertTrip({ id, slug, name, payloadJson }) {
  requireDb()
    .prepare(`
      INSERT INTO trips (id, slug, name, payload_json)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        name = excluded.name,
        payload_json = excluded.payload_json,
        updated_at = CURRENT_TIMESTAMP
    `)
    .run(id, slug, name, payloadJson);
  return findTripById(id);
}

function findTripById(id) {
  const row = requireDb()
    .prepare(`SELECT id, slug, name, payload_json, created_at, updated_at FROM trips WHERE id = ?`)
    .get(id);
  return rowToTrip(row);
}

function listTripRowsWithPayload() {
  return requireDb()
    .prepare(`
      SELECT id, slug, name, payload_json, created_at, updated_at
      FROM trips
      ORDER BY updated_at DESC, created_at DESC
    `)
    .all();
}

function listExistingSlugs() {
  return requireDb()
    .prepare('SELECT slug FROM trips')
    .all()
    .map((row) => row.slug);
}

function deleteTripById(id) {
  const result = requireDb().prepare('DELETE FROM trips WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = {
  init,
  upsertTrip,
  findTripById,
  listTripRowsWithPayload,
  listExistingSlugs,
  deleteTripById,
  rowToTrip,
};

import { Database } from 'bun:sqlite';

const DB = new Database('db.sqlite', { create: true });

const createSQL = /* sql */ `CREATE TABLE IF NOT EXISTS points (
	id TEXT PRIMARY KEY,
	createdAt TEXT NOT NULL DEFAULT current_timestamp,
	channelID TEXT,
	userName TEXT NOT NULL DEFAULT '',
	category TEXT NOT NULL DEFAULT ''
);`;
// TODO add indexes
let query = DB.query(createSQL);
query.run();

export const db = DB;

/* test add a point
query = db.query("INSERT INTO Points (channelID,userName,category) VALUES ($channelID,$userName,$category)");
query.run({
	$channelID:5,
	$userName:'raul',
	$category:'test'
})
*/

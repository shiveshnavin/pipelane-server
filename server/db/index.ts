import { SQLiteDB } from "multi-db-orm";

const db = new SQLiteDB('test.sqlite')
db.create("users_comments", {
    id: 'string',
    comments: `[]`
}).then(() => console.log('DB Initialized'))

export default db
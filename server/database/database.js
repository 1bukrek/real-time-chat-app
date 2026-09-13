import sqlite from "sqlite3"
import path from "path"
import { fileURLToPath } from "url"

// find the directory name of the current module
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sqlite3 = sqlite.verbose()
const databasePath = process.env.DATABASE_PATH || path.join(__dirname, "chat_app.db")

// create a new database object
const database = new sqlite3.Database(databasePath, (err) => {
    if (err) console.error(`[ERROR] [DATABASE] Could not open the SQLite database: ${err.message}`)
})

database.serialize(() => {
    database.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `)

    database.run(`
        CREATE TABLE IF NOT EXISTS friends (
            user1_username TEXT NOT NULL,
            user2_username TEXT NOT NULL,
            since DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user1_username, user2_username),
            FOREIGN KEY (user1_username) REFERENCES users(username) ON DELETE CASCADE,
            FOREIGN KEY (user2_username) REFERENCES users(username) ON DELETE CASCADE
        )
    `)

    database.run(`
        CREATE TABLE IF NOT EXISTS friend_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_username TEXT NOT NULL,
            receiver_username TEXT NOT NULL,
            status TEXT CHECK( status IN ('pending', 'accepted', 'rejected') ) DEFAULT 'pending',
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_username) REFERENCES users(username) ON DELETE CASCADE,
            FOREIGN KEY (receiver_username) REFERENCES users(username) ON DELETE CASCADE,
            UNIQUE(sender_username, receiver_username)
        );
    `)

    database.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_username TEXT NOT NULL,
            room_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_username) REFERENCES users(username)
        )
    `)

    database.run(`
        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(created_by) REFERENCES users(username) ON DELETE CASCADE
        )
    `)

    database.run(`
        CREATE TABLE IF NOT EXISTS group_members (
            group_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (group_id, username),
            FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE,
            FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
        )
    `)

    database.all("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name IN ('friends', 'friend_requests')", (schemaErr, tables) => {
        if (schemaErr) return console.error(`[ERROR] [DATABASE] Could not inspect relationship tables: ${schemaErr.message}`)

        const friendsSchema = tables.find(table => table.name === "friends")?.sql || ""
        const requestsSchema = tables.find(table => table.name === "friend_requests")?.sql || ""
        const migrateFriends = friendsSchema.includes("user1_username TEXT NOT NULL UNIQUE")
        const migrateRequests = requestsSchema.includes("sender_username TEXT NOT NULL UNIQUE")

        const migrateRequestsTable = () => {
            if (!migrateRequests) return
            database.run("ALTER TABLE friend_requests RENAME TO friend_requests_legacy", (renameErr) => {
                if (renameErr) return console.error(`[ERROR] [DATABASE] Could not prepare friend-request migration: ${renameErr.message}`)
                database.run(`CREATE TABLE friend_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sender_username TEXT NOT NULL,
                    receiver_username TEXT NOT NULL,
                    status TEXT CHECK(status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
                    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (sender_username) REFERENCES users(username) ON DELETE CASCADE,
                    FOREIGN KEY (receiver_username) REFERENCES users(username) ON DELETE CASCADE,
                    UNIQUE(sender_username, receiver_username)
                )`, (createErr) => {
                    if (createErr) return console.error(`[ERROR] [DATABASE] Could not create the migrated friend-request table: ${createErr.message}`)
                    database.run("INSERT INTO friend_requests SELECT * FROM friend_requests_legacy", (copyErr) => {
                        if (copyErr) return console.error(`[ERROR] [DATABASE] Could not copy friend requests: ${copyErr.message}`)
                        database.run("DROP TABLE friend_requests_legacy", (dropErr) => {
                            if (dropErr) console.error(`[ERROR] [DATABASE] Could not remove the old friend-request table: ${dropErr.message}`)
                        })
                    })
                })
            })
        }

        if (!migrateFriends) return migrateRequestsTable()
        database.run("ALTER TABLE friends RENAME TO friends_legacy", (renameErr) => {
            if (renameErr) return console.error(`[ERROR] [DATABASE] Could not prepare friends migration: ${renameErr.message}`)
            database.run(`CREATE TABLE friends (
                user1_username TEXT NOT NULL,
                user2_username TEXT NOT NULL,
                since DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user1_username, user2_username),
                FOREIGN KEY (user1_username) REFERENCES users(username) ON DELETE CASCADE,
                FOREIGN KEY (user2_username) REFERENCES users(username) ON DELETE CASCADE
            )`, (createErr) => {
                if (createErr) return console.error(`[ERROR] [DATABASE] Could not create the migrated friends table: ${createErr.message}`)
                database.run("INSERT INTO friends SELECT * FROM friends_legacy", (copyErr) => {
                    if (copyErr) return console.error(`[ERROR] [DATABASE] Could not copy friends: ${copyErr.message}`)
                    database.run("DROP TABLE friends_legacy", (dropErr) => {
                        if (dropErr) return console.error(`[ERROR] [DATABASE] Could not remove the old friends table: ${dropErr.message}`)
                        migrateRequestsTable()
                    })
                })
            })
        })
    })

    database.all("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'messages'", (err, rows) => {
        if (err || !rows[0]?.sql?.includes("user_username TEXT NOT NULL UNIQUE")) return

        database.run("ALTER TABLE messages RENAME TO messages_legacy", (renameErr) => {
            if (renameErr) return console.error(`[ERROR] [DATABASE] Could not rename the legacy messages table: ${renameErr.message}`)

            database.run(`
                CREATE TABLE messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_username TEXT NOT NULL,
                    room_id INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_username) REFERENCES users(username)
                )
            `, (createErr) => {
                if (createErr) return console.error(`[ERROR] [DATABASE] Could not create the current messages table: ${createErr.message}`)

                database.run(`
                    INSERT INTO messages (id, user_username, room_id, content, timestamp)
                    SELECT id, user_username, room_id, content, timestamp FROM messages_legacy
                `, (copyErr) => {
                    if (copyErr) return console.error(`[ERROR] [DATABASE] Could not migrate existing messages: ${copyErr.message}`)
                    database.run("DROP TABLE messages_legacy")
                })
            })
        })
    })
})

export default database

import sqlite from "sqlite3"

const sqlite3 = sqlite.verbose()

const database = new sqlite3.Database("chat_app.db", (err) => {
    if (err) return console.error("Veritabanı açılırken hata oluştu:", err.message)
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
            user1_username INTEGER NOT NULL,
            user2_username INTEGER NOT NULL,
            since DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user1_username, user2_username),
            FOREIGN KEY (user1_username) REFERENCES users(username) ON DELETE CASCADE,
            FOREIGN KEY (user2_username) REFERENCES users(username) ON DELETE CASCADE
        )
    `)

    database.run(`
        CREATE TABLE IF NOT EXISTS friend_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_username INTEGER NOT NULL,
            reciever_username INTEGER NOT NULL,
            status TEXT CHECK( status IN ('pending', 'accepted', 'rejected') ) DEFAULT 'pending',
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_username) REFERENCES users(username) ON DELETE CASCADE,
            FOREIGN KEY (reciever_username) REFERENCES users(username) ON DELETE CASCADE,
            UNIQUE(sender_username, reciever_username)
        );
    `)

    database.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_username INTEGER NOT NULL,
            room_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_username) REFERENCES users(username),
            FOREIGN KEY(room_id) REFERENCES rooms(id)
        )
    `)
})

export default database

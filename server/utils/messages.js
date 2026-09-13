import database from "../database/database.js"

function create_message(username, room_id, content, callback) {
    const query = `INSERT INTO messages (user_username, room_id, content) VALUES (?, ?, ?)`;
    database.run(query, [username, room_id, content], function (err) {
        callback(err, { id: this.lastID, username, room_id, content })
    })
}

function get_messages_by_room(room_id, callback) {
    const query = `
        SELECT id, user_username AS username, room_id, content, timestamp
        FROM messages
        WHERE room_id = ?
        ORDER BY timestamp ASC, id ASC
    `

    database.all(query, [room_id], callback)
}

function get_all_messages(callback) {
    const query = `
        SELECT * FROM messages
        ORDER BY messages.timestamp ASC
    `

    return new Promise((resolve, reject) => {
        database.all(query, [], (err, rows) => {
            if (err) {
                reject(err); // Reject the promise with the error if there's an issue
            } else {
                resolve(rows); // Resolve the promise with the rows
            }
        });
    });
}

function get_message_by_id(message_id) {
    const query = `
        SELECT * FROM messages
        WHERE messages.id = ?
    `;

    database.get(query, [message_id], (err, row) => {
        if (err) {
            console.error(`[ERROR] [MESSAGES] Could not find message ${message_id}: ${err.message}`)
            return;
        }

        if (!row) return null

        return row
    });
}


function delete_all_messages() {
    const query = `DELETE FROM messages`;

    database.run(query, (err) => {
        if (err) {
            console.error(`[ERROR] [MESSAGES] Could not delete all messages: ${err.message}`)
        } else {
            console.log("[INFO] [MESSAGES] Deleted all messages.")

            // ID reset for messages
            database.run(`DELETE FROM sqlite_sequence WHERE name='messages'`, (resetErr) => {
                if (resetErr) {
                    console.error(`[ERROR] [MESSAGES] Could not reset the message ID sequence: ${resetErr.message}`)
                } else {
                    console.log("[INFO] [MESSAGES] Reset the message ID sequence.")
                }
            });
        }

    });
}

export { create_message, get_messages_by_room, get_all_messages, get_message_by_id, delete_all_messages };
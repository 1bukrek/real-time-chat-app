import database from "../database.js"

function create_message(username, room_id, content) {
    const query = `INSERT INTO messages (user_username, room_id, content) VALUES (?, ?, ?)`;
    database.run(query, [username, room_id, content])
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
            console.error("Error occured while searchind message id: ", err.message);
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
            console.error("An error occured while deleting the messages:", err.message)
        } else {
            console.log("All messages have been deleted.")

            // ID reset for messages
            database.run(`DELETE FROM sqlite_sequence WHERE name='messages'`, (resetErr) => {
                if (resetErr) {
                    console.error("Error occured while reset:", resetErr.message)
                } else {
                    console.log("ID reseted.")
                }
            });
        }

    });
}

export { create_message, get_all_messages, get_message_by_id, delete_all_messages };
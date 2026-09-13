import database from "../database/database.js"

function delete_all_users() {
    const query = `DELETE FROM users`

    database.run(query, (err) => {
        if (err) {
            console.error(
                `[ERROR] [USERS] Could not delete all users: ${err.message}`
            )
        } else {
            console.log("[INFO] [USERS] Deleted all users.")

            // ID reset for users
            database.run(
                `DELETE FROM sqlite_sequence WHERE name='users'`,
                (reset_err) => {
                    if (reset_err) {
                        console.error(
                            `[ERROR] [USERS] Could not reset the user ID sequence: ${reset_err.message}`
                        )
                    } else {
                        console.log("[INFO] [USERS] Reset the user ID sequence.")
                    }
                }
            )
        }
    })
}

function get_user_by_username(username) {
    const query = `
        SELECT * FROM users
        WHERE users.username = ?
    `

    return new Promise((resolve, reject) => {
        database.get(query, [username], (err, row) => {
            if (err) {
                reject(err) // Reject the promise with the error if there's an issue
            }

            if (!row) return null

            resolve(row)
        })
    })
}

function add_friend_to_user(username, friend) {
    database.get(
        "SELECT friends FROM users WHERE username = ?",
        [username],
        (err, row) => {
            if (err) {
                console.error(`[ERROR] [USERS] Could not fetch ${username}: ${err.message}`)
                return
            }

            if (!row) {
                console.warn(`[WARN] [USERS] User not found: ${username}`)
                return
            }

            let current_friends = row.friends
            let friends_array = current_friends
                ? current_friends.split(",")
                : []

            if (friends_array.includes(friend)) {
                console.info(`[INFO] [USERS] ${friend} is already a friend of ${username}.`)
                return
            }

            friends_array.push(friend)
            const new_friends_list = friends_array.join(",")

            // Update the user's friends list in the database
            database.run(
                "UPDATE users SET friends = ? WHERE username = ?",
                [new_friends_list, username],
                (err) => {
                    if (err) {
                        console.error(
                            `[ERROR] [USERS] Could not update the friend list for ${username}: ${err.message}`
                        )
                        return
                    }
                    console.log(`[INFO] [USERS] Added ${friend} to ${username}'s friend list.`)
                }
            )
        }
    )
}

function update_friend_request_list(username, friend) {
    database.get(
        "SELECT friend_requests FROM users WHERE username = ?",
        [friend],
        (err, row) => {
            if (err) {
                console.error(`[ERROR] [USERS] Could not fetch ${friend}: ${err.message}`)
                return
            }

            if (username == friend) return

            if (!row) {
                console.warn(`[WARN] [USERS] User not found: ${friend}`)
                return
            }

            let current_friend_requests = row.friend_requests
            let friend_requests_array = current_friend_requests
                ? current_friend_requests.split(",")
                : []

            if (friend_requests_array.includes(friend)) {
                console.info(`[INFO] [USERS] A friend request from ${username} to ${friend} already exists.`)
                return
            }

            friend_requests_array.push(friend)
            const new_friend_requests_list = friend_requests_array.join(",")

            // Update the user's friend request list in the database
            database.run(
                "UPDATE users SET friend_requests = ? WHERE username = ?",
                [new_friend_requests_list, username],
                (err) => {
                    if (err) {
                        console.error(
                            `[ERROR] [USERS] Could not update the friend requests for ${username}: ${err.message}`
                        )
                        return
                    }
                }
            )
        }
    )
}

export {
    delete_all_users,
    get_user_by_username,
    add_friend_to_user,
    update_friend_request_list,
}

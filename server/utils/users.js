import database from "../database.js"

function delete_all_users() {
    const query = `DELETE FROM users`

    database.run(query, (err) => {
        if (err) {
            console.error(
                "An error occured while deleting the users:",
                err.message
            )
        } else {
            console.log("All messages have been deleted.")

            // ID reset for users
            database.run(
                `DELETE FROM sqlite_sequence WHERE name='users'`,
                (reset_err) => {
                    if (reset_err) {
                        console.error(
                            "Error occured while reset:",
                            reset_err.message
                        )
                    } else {
                        console.log("ID reseted.")
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
                console.error("ERROR FETCHING USER")
                return
            }

            if (!row) {
                console.log("USER NOT FOUND")
                return
            }

            let current_friends = row.friends
            let friends_array = current_friends
                ? current_friends.split(",")
                : []

            if (friends_array.includes(friend)) {
                console.log("FRIEND ALREADY ADDED")
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
                            "ERROR UPDATING FRIEND LIST:",
                            err.message
                        )
                        return
                    }
                    console.log("FRIEND ADDED")
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
                console.error("ERROR FETCHING USER")
                return
            }

            if (username == friend) return

            if (!row) {
                console.error("USER NOT FOUND")
                return
            }

            let current_friend_requests = row.friend_requests
            let friend_requests_array = current_friend_requests
                ? current_friend_requests.split(",")
                : []

            if (friend_requests_array.includes(friend)) {
                console.error("FRIEND REQUEST ALREADY SENT")
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
                            "ERROR UPDATING FRIEND REQUEST LIST:",
                            err.message
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

import express from "express"
import http from "http"
import { Server } from "socket.io"

import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import database from "./database.js"

import { create_message } from "./utils/messages.js"
import { get_user_by_username, update_friend_request_list } from "./utils/users.js"

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.json())

app.use(express.static("../public"))

app.post("/register", (req, res) => {
    const { username, password } = req.body

    if (!username || !password) {
        return res.json({
            success: false,
            message: "Username and password are required.",
        })
    }

    // Check if the user already exists in the database
    database.get(
        "SELECT * FROM users WHERE users.username = ?",
        [username],
        (err, row) => {
            if (err) {
                return res.json({ success: false, message: "Database error" })
            }
            if (row) {
                return res.json({
                    success: false,
                    message: "Username already exists!",
                })
            }

            // Hash the password
            const hashedPassword = bcrypt.hashSync(password, 8)

            // Insert the new user into the database
            database.run("INSERT INTO users (username, password, friends, friend_requests) VALUES (?, ?, ?, ?)", [username, hashedPassword, "", ""],
                function (err) {
                    if (err) {
                        return res.json({
                            success: false,
                            message: "Failed to register user",
                        })
                    }

                    res.json({
                        success: true,
                        message: "User registered successfully!",
                    })
                }
            )
        }
    )
})

app.post("/login", (req, res) => {
    const { username, password } = req.body

    if (!username || !password) {
        return res.json({
            success: false,
            message: "Username and password are required.",
        })
    }

    // Find the user in the database by username
    database.get("SELECT * FROM users WHERE username = ?", [username],
        (err, row) => {
            if (err) {
                // If there is a database error:
                return res.json({ success: false, message: "Database error" })
            }

            if (!row) {
                // If user doesn't exist:
                return res.json({
                    success: false,
                    message: "INVALID USERNAME OR PASSWORD",
                })
            }

            // Compare the provided password with the hashed password from the database
            const passwordMatch = bcrypt.compareSync(password, row.password)

            if (passwordMatch) {
                // Create JWT token "for one hour" after successful login
                const token = jwt.sign(
                    { id: row.id, username: row.username },
                    "secretkey",
                    { expiresIn: "1h" }
                )

                // Return the token to the client
                return res.json({
                    success: true,
                    message: "Login successful!",
                    token: token,
                })
            } else {
                // If the passwords do not match
                return res.json({
                    success: false,
                    message: "Invalid username or password",
                })
            }
        }
    )
})

app.get("/users/:username", (req, res) => {
    const { username } = req.params

    database.get(
        "SELECT * FROM users WHERE username =?",
        [username],
        (err, row) => {
            if (err) {
                return res.json({ success: false, message: "Database error" })
            }

            if (!row) {
                return res.json({ success: false, message: "User not found" })
            }

            res.json({
                success: true,
                user: {
                    id: row.id,
                    username: row.username,
                    friends: JSON.parse(row.friends),
                },
            })
        }
    )
})


io.on("connection", (socket) => {
    socket.on("authenticate", (token) => {
        // Verify token
        jwt.verify(token, "secretkey", (err, decoded) => {
            if (err) {
                console.log("INVALID TOKEN ERROR")
                socket.emit("unauthorized", { message: "INVALID TOKEN" })
            } else {
                // console.log("USER ", decoded.id, " IS AUTHENTICATED.")
                socket.emit("authenticated", { message: `LOGGED AS USER ${decoded.id}` })
            }
        })
    })

    socket.on("registration", (data) => {
        console.log(data)
    })

    socket.on("chat_message", ({ message, username }) => {
        create_message(username, "0", message)
        io.emit("chat_message", `${username}: ${message}`)
    })

    // creating a friend request once a event emitted from client side
    socket.on("send_friend_request", ({ sender_id, reciever_id }) => {
        database.run("INSERT INTO friend_requests (sender_id, receiver_id) VALUES(?, ?)", [sender_id, reciever_id], function (err) {
            if (err) return res.json({ success: false, message: "Failed to send friend request", })
        })
    })
})

server.listen(3000, () => {
    console.warn("SERVER IS RUNNING ON: http://localhost:3000")
})

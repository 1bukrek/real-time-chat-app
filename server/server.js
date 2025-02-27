import express from "express"
import http from "http"
import { Server } from "socket.io"

import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import database from "./database.js"

import { create_message } from "./utils/messages.js"
import { get_user_by_username } from "./utils/users.js"

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

    // check if the user already exists in the database
    database.get("SELECT * FROM users WHERE users.username = ?", [username], (err, row) => {
        if (err) return res.json({ success: false, message: "Database error!" })
        if (row) return res.json({ success: false, message: "Username already exists!" })
        // hash the password
        const hashedPassword = bcrypt.hashSync(password, 8)
        // insert the new user into the database
        database.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashedPassword],
            function (err) {
                if (err) return res.json({ success: false, message: "Failed to register user" })
                res.json({ success: true, message: "User registered successfully!", })
            }
        )
    }
    )
})

app.post("/login", (req, res) => {
    const { username, password } = req.body
    if (!username || !password) return res.json({ success: false, message: "Username and password are required.", })

    // find the user in the database by username
    database.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
        if (err) return res.json({ success: false, message: "Database error" })
        if (!row) return res.json({ success: false, message: "INVALID USERNAME OR PASSWORD", })

        // compare the provided password with the hashed password from the database
        const passwordMatch = bcrypt.compareSync(password, row.password)
        if (passwordMatch) {
            // create jwt token for one hour after successful login
            const token = jwt.sign({ id: row.id, username: row.username }, "secretkey", { expiresIn: "1h" })
            // return the token to the client
            return res.json({ success: true, message: "Login successful!", token: token, })
        } // if the passwords do not match
        else return res.json({ success: false, message: "Invalid username or password", })
    }
    )
})

io.on("connection", (socket) => {
    socket.on("authenticate", (token) => {
        // verify token
        jwt.verify(token, "secretkey", (err, decoded) => {
            if (err) socket.emit("unauthorized", { message: "INVALID TOKEN" })
            else socket.emit("authenticated", { message: `LOGGED AS USER ${decoded.id}` })
        })
    })

    // response friends list
    socket.on("request_friends_list", (username) => {
        database.all("SELECT u.username, u.username FROM friends f JOIN users u ON (u.username = f.user1_username OR u.username = f.user2_username) WHERE ? IN (f.user1_username, f.user2_username)",
            [username],
            (err, rows) => {
                if (err) return socket.emit("response_friends_list", { status: false, message: "Database error!" })
                else return socket.emit("response_friends_list", { status: true, friends: rows })
            }
        )
    })

    // response requests list
    socket.on("request_requests_list", (username) => {
        database.all("SELECT friend_requests.id, users.username AS sender FROM friend_requests JOIN users ON friend_requests.sender_username = users.username WHERE friend_requests.receiver_username = ? AND friend_requests.status = 'pending'",
            [username],
            (err, rows) => {
                if (err) return console.log(err.message)
                else return socket.emit("response_requests_list", { status: true, requests: rows })
            }
        );
    })

    // create a friend request once a event emitted from client side
    socket.on("send_friend_request", async ({ sender_username, receiver_username }) => {
        await get_user_by_username(receiver_username).then(data => {
            if (data) database.run("INSERT INTO friend_requests (sender_username, receiver_username) VALUES(?, ?)", [sender_username, receiver_username])
        })
    })
    socket.on("chat_message", ({ message, username }) => create_message(username, "0", message))
})

server.listen(3000, () => {
    console.warn("SERVER IS RUNNING ON: http://localhost:3000")
})

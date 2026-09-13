import express from "express"
import http from "http"
import { Server } from "socket.io"

import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import path from "path"
import { fileURLToPath } from "url"
import database from "./database/database.js"

import { create_message, get_messages_by_room } from "./utils/messages.js"
import { get_user_by_username } from "./utils/users.js"

const app = express()
const server = http.createServer(app)
const io = new Server(server)
const port = Number(process.env.PORT) || 3000
const host = process.env.HOST || "0.0.0.0"
const jwtSecret = process.env.JWT_SECRET || "secretkey"
const adminUsername = process.env.ADMIN_USERNAME || "admin"
const adminPassword = process.env.ADMIN_PASSWORD
const log = {
    info: (scope, message) => console.log(`\x1b[36m[INFO] [${scope}]\x1b[0m ${message}`),
    warn: (scope, message) => console.warn(`\x1b[33m[WARN] [${scope}]\x1b[0m ${message}`),
    error: (scope, message, err) => console.error(`\x1b[31m[ERROR] [${scope}]\x1b[0m ${message}${err ? `: ${err.message}` : ""}`),
}
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET must be configured in production.")
}

function get_room_id(username, friend_username) {
    const room = [username, friend_username].sort().join(":")
    return {
        name: `private:${room}`,
        id: Math.abs([...room].reduce((hash, character) => ((hash << 5) - hash) + character.charCodeAt(0) | 0, 0)),
    }
}

function get_group_room(group_id) {
    return { name: `group:${group_id}`, id: -Number(group_id) }
}

function notify_user(username, event, data = {}) {
    for (const connectedSocket of io.sockets.sockets.values()) {
        if (connectedSocket.username === username) connectedSocket.emit(event, data)
    }
}

app.use(express.json())
app.disable("x-powered-by")

app.use(express.static(path.join(__dirname, "..", "public")))

function require_admin(req, res, next) {
    const authorization = req.headers.authorization || ""
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : null
    if (!token) return res.status(401).json({ success: false, message: "Authentication is required." })

    jwt.verify(token, jwtSecret, (err, decoded) => {
        if (err) return res.status(401).json({ success: false, message: "Your session has expired." })
        if (decoded.username !== adminUsername) return res.status(403).json({ success: false, message: "Administrator access is required." })
        req.admin = decoded
        next()
    })
}

function database_all(query, parameters = []) {
    return new Promise((resolve, reject) => database.all(query, parameters, (err, rows) => err ? reject(err) : resolve(rows)))
}

function database_run(query, parameters = []) {
    return new Promise((resolve, reject) => database.run(query, parameters, function (err) { err ? reject(err) : resolve(this) }))
}

app.get("/admin/data", require_admin, async (req, res) => {
    try {
        const [users, messages] = await Promise.all([
            database_all("SELECT id, username, created_at FROM users ORDER BY created_at DESC, id DESC"),
            database_all("SELECT id, user_username AS username, room_id, content, timestamp FROM messages ORDER BY timestamp DESC, id DESC"),
        ])
        res.json({ success: true, users, messages, admin: req.admin.username })
    } catch (err) {
        log.error("ADMIN", "Could not load dashboard data", err)
        res.status(500).json({ success: false, message: "Dashboard data could not be loaded." })
    }
})

app.delete("/admin/messages/:id", require_admin, async (req, res) => {
    const messageId = Number(req.params.id)
    if (!Number.isInteger(messageId) || messageId < 1) return res.status(400).json({ success: false, message: "Invalid message ID." })
    try {
        const result = await database_run("DELETE FROM messages WHERE id = ?", [messageId])
        if (!result.changes) return res.status(404).json({ success: false, message: "Message not found." })
        res.json({ success: true })
    } catch (err) {
        log.error("ADMIN", `Could not delete message ${messageId}`, err)
        res.status(500).json({ success: false, message: "Message could not be deleted." })
    }
})

app.delete("/admin/messages", require_admin, async (req, res) => {
    try {
        const result = await database_run("DELETE FROM messages")
        res.json({ success: true, deleted: result.changes })
    } catch (err) {
        log.error("ADMIN", "Could not delete all messages", err)
        res.status(500).json({ success: false, message: "Messages could not be deleted." })
    }
})

app.delete("/admin/users/:username", require_admin, async (req, res) => {
    const username = req.params.username
    if (!username || username === adminUsername) return res.status(400).json({ success: false, message: "The administrator account cannot be deleted." })
    try {
        await database_run("BEGIN TRANSACTION")
        await database_run("DELETE FROM messages WHERE user_username = ?", [username])
        await database_run("DELETE FROM friends WHERE user1_username = ? OR user2_username = ?", [username, username])
        await database_run("DELETE FROM friend_requests WHERE sender_username = ? OR receiver_username = ?", [username, username])
        const result = await database_run("DELETE FROM users WHERE username = ?", [username])
        await database_run("COMMIT")
        if (!result.changes) return res.status(404).json({ success: false, message: "User not found." })
        res.json({ success: true })
    } catch (err) {
        await database_run("ROLLBACK").catch(() => {})
        log.error("ADMIN", `Could not delete user ${username}`, err)
        res.status(500).json({ success: false, message: "User could not be deleted." })
    }
})

app.delete("/admin/users", require_admin, async (req, res) => {
    try {
        await database_run("BEGIN TRANSACTION")
        await database_run("DELETE FROM messages")
        await database_run("DELETE FROM friends")
        await database_run("DELETE FROM friend_requests")
        const result = await database_run("DELETE FROM users WHERE username != ?", [adminUsername])
        await database_run("COMMIT")
        res.json({ success: true, deleted: result.changes })
    } catch (err) {
        await database_run("ROLLBACK").catch(() => {})
        log.error("ADMIN", "Could not delete all users", err)
        res.status(500).json({ success: false, message: "Users could not be deleted." })
    }
})

app.post("/register", (req, res) => {
    const { username, password } = req.body

    if (!username || !password) {
        return res.json({
            success: false,
            message: "Username and password are required.",
        })
    }
    if (username === adminUsername) return res.json({ success: false, message: "That username is reserved." })

    // check if the user already exists in the database
    database.get("SELECT * FROM users WHERE users.username = ?", [username], (err, row) => {
        if (err) { log.error("REGISTER", "Could not check whether the username exists", err); return res.json({ success: false, message: "We could not check your account right now." }) }
        if (row) return res.json({ success: false, message: "That username is already in use. Choose another one." })
        // hash the password
        const hashedPassword = bcrypt.hashSync(password, 8)
        // insert the new user into the database
        database.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashedPassword],
            function (err) {
                if (err) { log.error("REGISTER", `Could not create account for ${username}`, err); return res.json({ success: false, message: "We could not create your account right now." }) }
                log.info("REGISTER", `Account created for ${username}`)
                res.json({ success: true, message: "User registered successfully!", })
            }
        )
    }
    )
})

app.post("/login", (req, res) => {
    const { username, password } = req.body
    if (!username || !password) return res.json({ success: false, message: "Username and password are required.", })

    if (username === adminUsername) {
        if (!adminPassword || password !== adminPassword) return res.json({ success: false, message: "Invalid username or password." })
        const token = jwt.sign({ id: 0, username: adminUsername, isAdmin: true }, jwtSecret, { expiresIn: "1h" })
        log.info("LOGIN", `Successful admin sign-in for ${adminUsername}`)
        return res.json({ success: true, message: "Login successful!", token, isAdmin: true })
    }

    // find the user in the database by username
    database.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
        if (err) { log.error("LOGIN", "Could not look up the account", err); return res.json({ success: false, message: "We could not sign you in right now." }) }
        if (!row) { log.warn("LOGIN", `Rejected sign-in: username not found (${username})`); return res.json({ success: false, message: "Invalid username or password." }) }

        // compare the provided password with the hashed password from the database
        const passwordMatch = bcrypt.compareSync(password, row.password)
        if (passwordMatch) {
            // create jwt token for one hour after successful login
            const token = jwt.sign({ id: row.id, username: row.username, isAdmin: row.username === adminUsername }, jwtSecret, { expiresIn: "1h" })
            // return the token to the client
            log.info("LOGIN", `Successful sign-in for ${username}`)
            return res.json({ success: true, message: "Login successful!", token: token, isAdmin: row.username === adminUsername, })
        } // if the passwords do not match
        else { log.warn("LOGIN", `Rejected sign-in: incorrect password (${username})`); return res.json({ success: false, message: "Invalid username or password." }) }
    }
    )
})

io.on("connection", (socket) => {
    socket.on("authenticate", (token) => {
        // verify token
        jwt.verify(token, jwtSecret, (err, decoded) => {
            if (err) socket.emit("unauthorized", { message: "INVALID TOKEN" })
            else {
                socket.username = decoded.username
                socket.emit("authenticated", { message: `Secure session active for ${decoded.username}` })
            }
        })
    })

    // response friends list
    socket.on("request_friends_list", () => {
        if (!socket.username) return
        database.all("SELECT CASE WHEN f.user1_username = ? THEN f.user2_username ELSE f.user1_username END AS username FROM friends f WHERE ? IN (f.user1_username, f.user2_username)",
            [socket.username, socket.username],
            (err, rows) => {
                if (err) return socket.emit("response_friends_list", { status: false, message: "Database error!" })
                else return socket.emit("response_friends_list", { status: true, friends: rows })
            }
        )
    })

    socket.on("request_groups_list", () => {
        if (!socket.username) return
        database.all("SELECT g.id, g.name, COUNT(gm2.username) AS member_count FROM groups g JOIN group_members gm ON gm.group_id = g.id LEFT JOIN group_members gm2 ON gm2.group_id = g.id WHERE gm.username = ? GROUP BY g.id ORDER BY g.created_at DESC, g.id DESC", [socket.username],
            (err, rows) => {
                if (err) return socket.emit("groups_error", { message: "The group list could not be loaded." })
                socket.emit("response_groups_list", { status: true, groups: rows })
            }
        )
    })

    socket.on("create_group", ({ name, member_usernames = [] }) => {
        if (!socket.username || typeof name !== "string" || !name.trim() || !Array.isArray(member_usernames)) return
        const groupName = name.trim().slice(0, 80)
        const members = [...new Set([socket.username, ...member_usernames.filter(member => typeof member === "string" && member.trim())])]
        database.all("SELECT username FROM users WHERE username IN (" + members.map(() => "?").join(",") + ")", members, (userErr, users) => {
            if (userErr || users.length !== members.length) return socket.emit("groups_error", { message: "Every group member must be an existing user." })
            database.run("INSERT INTO groups (name, created_by) VALUES (?, ?)", [groupName, socket.username], function (groupErr) {
                if (groupErr) return socket.emit("groups_error", { message: "The group could not be created." })
                const groupId = this.lastID
                const placeholders = members.map(() => "(?, ?)").join(",")
                const values = members.flatMap(member => [groupId, member])
                database.run(`INSERT INTO group_members (group_id, username) VALUES ${placeholders}`, values, (memberErr) => {
                    if (memberErr) return socket.emit("groups_error", { message: "The group members could not be saved." })
                    members.forEach(member => notify_user(member, "groups_updated"))
                    socket.emit("group_created", { id: groupId, name: groupName })
                })
            })
        })
    })

    socket.on("open_group_conversation", ({ group_id }) => {
        if (!socket.username || !Number.isInteger(group_id)) return
        database.get("SELECT g.id, g.name FROM groups g JOIN group_members gm ON gm.group_id = g.id WHERE g.id = ? AND gm.username = ?", [group_id, socket.username], (groupErr, group) => {
            if (groupErr || !group) return socket.emit("groups_error", { message: "You are not a member of that group." })
            const room = get_group_room(group.id)
            socket.join(room.name)
            get_messages_by_room(room.id, (historyErr, messages) => {
                if (historyErr) return socket.emit("chat_message_error", { message: "The group history could not be loaded." })
                socket.emit("group_conversation_history", { group, messages })
            })
        })
    })

    socket.on("respond_friend_request", ({ request_id, action }) => {
        if (!socket.username || !Number.isInteger(request_id) || !["accept", "reject"].includes(action)) return
        database.get("SELECT sender_username, receiver_username FROM friend_requests WHERE id = ? AND status = 'pending' AND receiver_username = ?", [request_id, socket.username], (err, request) => {
            if (err || !request) return socket.emit("friend_request_error", { message: "That friend request is no longer available." })
            if (action === "reject") {
                return database.run("UPDATE friend_requests SET status = 'rejected' WHERE id = ?", [request_id], () => {})
            }
            database.run("INSERT INTO friends (user1_username, user2_username) VALUES (?, ?)", [request.sender_username, request.receiver_username], (insertErr) => {
                if (insertErr) return socket.emit("friend_request_error", { message: "Could not accept this friend request." })
                database.run("UPDATE friend_requests SET status = 'accepted' WHERE id = ?", [request_id], () => {
                    socket.emit("friendship_updated")
                    notify_user(request.sender_username, "friendship_updated")
                })
            })
        })
    })

    socket.on("open_private_conversation", ({ friend_username }) => {
        if (!socket.username || !friend_username || friend_username === socket.username) return
        database.get("SELECT 1 FROM friends WHERE (user1_username = ? AND user2_username = ?) OR (user1_username = ? AND user2_username = ?)", [socket.username, friend_username, friend_username, socket.username], (err, row) => {
            if (err || !row) return socket.emit("friend_request_error", { message: "Private conversations are available only with accepted friends." })
            const room = get_room_id(socket.username, friend_username)
            socket.join(room.name)
            get_messages_by_room(room.id, (historyErr, messages) => {
                if (historyErr) return socket.emit("chat_message_error", { message: "The chat history could not be loaded." })
                socket.emit("private_conversation_history", { friend_username, messages })
            })
        })
    })

    // response requests list
    socket.on("request_requests_list", () => {
        if (!socket.username) return
        database.all("SELECT friend_requests.id, users.username AS sender FROM friend_requests JOIN users ON friend_requests.sender_username = users.username WHERE friend_requests.receiver_username = ? AND friend_requests.status = 'pending'",
            [socket.username],
            (err, rows) => {
                if (err) return log.error("REQUESTS", `Could not load requests for ${socket.username}`, err)
                else return socket.emit("response_requests_list", { status: true, requests: rows })
            }
        );
    })

    // create a friend request once a event emitted from client side
    socket.on("send_friend_request", async ({ receiver_username }) => {
        if (!socket.username || !receiver_username || receiver_username === socket.username) return
        await get_user_by_username(receiver_username).then(data => {
            if (!data) return socket.emit("friend_request_error", { message: "That user does not exist." })
            database.run("INSERT INTO friend_requests (sender_username, receiver_username) VALUES(?, ?)", [socket.username, receiver_username], (err) => {
                if (err) return socket.emit("friend_request_error", { message: "That friend request could not be sent." })
                notify_user(receiver_username, "friend_request_received")
            })
        }).catch(() => socket.emit("friend_request_error", { message: "That friend request could not be sent." }))
    })
    socket.on("chat_message", ({ message, username, recipient_username, group_id }) => {
        if (!message?.trim() || !username || username !== socket.username) return

        const sendMessage = room => create_message(username, room.id, message.trim(), (err, savedMessage) => {
            if (err) { log.error("MESSAGE", `Could not save a message from ${username}`, err); return socket.emit("chat_message_error", { message: "The message could not be saved. Please try again." }) }
            log.info("MESSAGE", `Saved message ${savedMessage.id} from ${username}`)
            io.to(room.name).emit("chat_message", savedMessage)
        })

        if (Number.isInteger(group_id)) {
            return database.get("SELECT 1 FROM group_members WHERE group_id = ? AND username = ?", [group_id, username], (err, member) => {
                if (err || !member) return socket.emit("chat_message_error", { message: "You are not a member of that group." })
                sendMessage(get_group_room(group_id))
            })
        }
        if (!recipient_username || recipient_username === username) return
        const room = get_room_id(username, recipient_username)
        sendMessage(room)
    })
})

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        log.error("SERVER", `Port ${port} is already in use. Stop the existing RChat server or start this one with another port, for example PORT=3001.`)
        return
    }
    log.error("SERVER", "RChat could not start", err)
})

server.listen(port, host, () => {
    log.info("SERVER", `RChat is listening on ${host}:${port}`)
})

function shutdown(signal) {
    log.info("SERVER", `Received ${signal}; shutting down.`)
    server.close(() => database.close(() => process.exit(0)))
}

process.once("SIGTERM", () => shutdown("SIGTERM"))
process.once("SIGINT", () => shutdown("SIGINT"))

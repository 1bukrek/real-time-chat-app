const token = localStorage.getItem("token")
const storedAdmin = localStorage.getItem("isAdmin") === "true"
const state = { users: [], messages: [] }
const pageStatus = document.getElementById("page-status")

if (!token || !storedAdmin) window.location.href = "/login.html"

document.getElementById("admin-label").textContent = `Signed in as ${localStorage.getItem("username") || "admin"}`

document.getElementById("logout-button").addEventListener("click", () => {
    localStorage.removeItem("token")
    localStorage.removeItem("username")
    localStorage.removeItem("isAdmin")
    window.location.href = "/login.html"
})

function escape_text(value) {
    return String(value ?? "").replace(/[&<>\"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[character]))
}

function format_date(value) {
    if (!value) return "Unknown"
    return new Date(`${value}Z`).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
}

function set_status(message = "") { pageStatus.textContent = message }

function render_users() {
    const search = document.getElementById("user-search").value.trim().toLowerCase()
    const users = state.users.filter(user => user.username.toLowerCase().includes(search))
    document.getElementById("users-table").innerHTML = users.map(user => `<tr><td>${escape_text(user.username)}</td><td>${format_date(user.created_at)}</td><td class="action-column"><button class="row-delete" data-user="${escape_text(user.username)}">Delete</button></td></tr>`).join("")
    document.getElementById("users-empty").classList.toggle("visible", users.length === 0)
    document.querySelectorAll("[data-user]").forEach(button => button.addEventListener("click", () => delete_user(button.dataset.user)))
}

function render_messages() {
    const search = document.getElementById("message-search").value.trim().toLowerCase()
    const messages = state.messages.filter(message => `${message.username} ${message.content}`.toLowerCase().includes(search))
    document.getElementById("messages-table").innerHTML = messages.map(message => `<tr><td>${escape_text(message.username)}</td><td class="message-content" title="${escape_text(message.content)}">${escape_text(message.content)}</td><td>${format_date(message.timestamp)}</td><td class="action-column"><button class="row-delete" data-message="${message.id}">Delete</button></td></tr>`).join("")
    document.getElementById("messages-empty").classList.toggle("visible", messages.length === 0)
    document.querySelectorAll("[data-message]").forEach(button => button.addEventListener("click", () => delete_message(button.dataset.message)))
}

function render() {
    document.getElementById("user-count").textContent = state.users.length
    document.getElementById("message-count").textContent = state.messages.length
    render_users()
    render_messages()
}

async function admin_request(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) } })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || "The request failed.")
    return data
}

async function load_dashboard() {
    try {
        const data = await admin_request("/admin/data")
        state.users = data.users
        state.messages = data.messages
        render()
    } catch (error) {
        set_status(error.message)
        if (error.message.includes("session") || error.message.includes("Administrator")) window.location.href = "/login.html"
    }
}

async function delete_user(username) {
    if (!window.confirm(`Delete ${username} and all of their messages?`)) return
    try { await admin_request(`/admin/users/${encodeURIComponent(username)}`, { method: "DELETE" }); set_status(`Deleted ${username}.`); await load_dashboard() }
    catch (error) { set_status(error.message) }
}

async function delete_message(id) {
    if (!window.confirm("Delete this message permanently?")) return
    try { await admin_request(`/admin/messages/${id}`, { method: "DELETE" }); set_status("Message deleted."); await load_dashboard() }
    catch (error) { set_status(error.message) }
}

document.getElementById("delete-users-button").addEventListener("click", async () => {
    if (!window.confirm("Delete every user except the administrator and remove all messages and relationships?")) return
    try { await admin_request("/admin/users", { method: "DELETE" }); set_status("All non-admin users and their data were deleted."); await load_dashboard() }
    catch (error) { set_status(error.message) }
})

document.getElementById("delete-messages-button").addEventListener("click", async () => {
    if (!window.confirm("Delete every message permanently?")) return
    try { await admin_request("/admin/messages", { method: "DELETE" }); set_status("All messages were deleted."); await load_dashboard() }
    catch (error) { set_status(error.message) }
})

document.getElementById("user-search").addEventListener("input", render_users)
document.getElementById("message-search").addEventListener("input", render_messages)
load_dashboard()

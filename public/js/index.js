const socket = io()
const token = localStorage.getItem("token") // make sure the token is stored after login
const connectionStatus = document.getElementById("connection-status")
const chatStatus = document.getElementById("chat-status")
const userLabel = document.getElementById("user-label")
const accountUsername = document.getElementById("account-username")
const accountAvatar = document.getElementById("account-avatar")
const logoutButton = document.getElementById("logout-button")
const conversationType = document.getElementById("conversation-type")
const conversationTitle = document.getElementById("conversation-title")
const username = localStorage.getItem("username")
let activeFriend = null
let activeGroup = null
userLabel.textContent = username || "Guest"
accountUsername.textContent = username || "Guest"
accountAvatar.textContent = (username || "G").charAt(0).toUpperCase()

logoutButton.addEventListener("click", () => {
    localStorage.removeItem("token")
    localStorage.removeItem("username")
    socket.disconnect()
    window.location.href = "/login.html"
})

// control token, redirect to login if it is not available 
if (token) socket.emit("authenticate", token) // send the token to the server for authentication
else window.location.href = "/login.html" // redirect to login if no token is found

// handle unsuccessfull server authentication response
socket.on("unauthorized", (data) => {
    console.error(`[AUTH] Authentication rejected: ${data.message}`)
    connectionStatus.textContent = "Authentication failed"
    chatStatus.textContent = "Your session is no longer valid. Redirecting to sign in..."
    // redirect to login page if unauthorized
    window.location.href = "/login.html"
})

// handle successfull server authentication response
socket.on("authenticated", (data) => {
    console.info(`[AUTH] ${data.message}`)
    connectionStatus.textContent = "Secure connection active"
    socket.emit("request_friends_list")
    socket.emit("request_requests_list")
    socket.emit("request_groups_list")
})
// handle connection errors
socket.on("connect_error", (err) => {
    console.error(`[SOCKET] Unable to connect to the chat server: ${err.message}`)
    connectionStatus.textContent = "Connection unavailable"
    chatStatus.textContent = "We could not reach the chat server. Check that it is running and try again."
})
// handle creating messages
socket.on("chat_message", (msg) => {
    renderMessage(msg)
})

socket.on("chat_message_error", ({ message }) => {
    console.error(`[MESSAGE] The server could not save this message: ${message}`)
    chatStatus.textContent = `Message not sent: ${message}`
})

const form = document.getElementById("form")
const input = document.getElementById("input")
const messages = document.getElementById("messages")

const friends_list = document.getElementById("friends-list");
const add_friend_form = document.getElementById("add-friend-form");
const friend_name_input = document.getElementById("friend-name");

const requests_list = document.getElementById("requests-list")
const groups_list = document.getElementById("groups-list")
const create_group_form = document.getElementById("create-group-form")
const group_name_input = document.getElementById("group-name")
const group_members_input = document.getElementById("group-members")

function renderMessage(msg) {
    const emptyState = messages.querySelector(".empty-state")
    if (emptyState) emptyState.remove()

    const item = document.createElement("li")
    item.className = msg.username === username ? "own-message" : "other-message"
    const sender = document.createElement("strong")
    sender.textContent = msg.username === username ? "You" : msg.username
    const content = document.createElement("span")
    content.textContent = msg.content
    item.append(sender, content)
    messages.appendChild(item)
    messages.scrollTop = messages.scrollHeight
}

function refreshFriends() {
    socket.emit("request_friends_list")
}

function refreshRequests() {
    socket.emit("request_requests_list")
}

socket.on("private_conversation_history", ({ friend_username, messages: history }) => {
    if (activeFriend !== friend_username) return
    messages.innerHTML = ""
    if (!history.length) {
        messages.innerHTML = '<li class="empty-state"><strong>Private conversation</strong><span>Your messages with this friend will appear here.</span></li>'
        return
    }
    history.forEach(renderMessage)
    messages.scrollTop = messages.scrollHeight
})

socket.on("group_conversation_history", ({ group, messages: history }) => {
    if (!activeGroup || activeGroup.id !== group.id) return
    messages.innerHTML = ""
    if (!history.length) messages.innerHTML = '<li class="empty-state"><strong>Group conversation</strong><span>Your group messages will appear here.</span></li>'
    else history.forEach(renderMessage)
    messages.scrollTop = messages.scrollHeight
})

socket.on("response_friends_list", ({ status, message, friends }) => {
    if (!status) return chatStatus.textContent = `Friend list unavailable: ${message}`
    friends_list.innerHTML = ""
    friends.forEach(friend => {
        const friendItem = document.createElement("li")
        const p = document.createElement("p");
        p.textContent = friend.username;
        const small = document.createElement("small");
        small.textContent = "Private conversation"
        friendItem.appendChild(p);
        friendItem.appendChild(small);
        friendItem.addEventListener("click", () => {
            activeFriend = friend.username
            activeGroup = null
            conversationType.textContent = "PRIVATE CONVERSATION"
            conversationTitle.textContent = friend.username
            input.disabled = false
            input.placeholder = `Message ${friend.username}...`
            messages.innerHTML = '<li class="empty-state"><strong>Private conversation</strong><span>Your messages with this friend will appear here.</span></li>'
            socket.emit("open_private_conversation", { friend_username: activeFriend })
        })
        friends_list.appendChild(friendItem);
    })
})

socket.on("response_requests_list", ({ status, message, requests }) => {
    if (!status) return chatStatus.textContent = `Requests unavailable: ${message}`
    requests_list.innerHTML = ""
    requests.forEach(user => {
        const requestItem = document.createElement("li")
        const row = document.createElement("div")
        row.className = "request-row"
        const p = document.createElement("p")
        p.textContent = user.sender
        const actions = document.createElement("div")
        actions.className = "request-actions"
        actions.innerHTML = `<button type="button" data-action="accept">Accept</button><button type="button" data-action="reject">Refuse</button>`
        actions.addEventListener("click", (event) => {
            const action = event.target.dataset.action
            if (!action) return
            socket.emit("respond_friend_request", { request_id: user.id, action })
            requestItem.remove()
            chatStatus.textContent = action === "accept" ? `You are now friends with ${user.sender}.` : `Refused the request from ${user.sender}.`
        })
        row.append(p, actions)
        requestItem.appendChild(row)
        requests_list.appendChild(requestItem)
    })
})

add_friend_form.addEventListener("submit", (e) => {
    e.preventDefault()
    if (friend_name_input.value) {
        socket.emit("send_friend_request", {
            receiver_username: friend_name_input.value
        })
        chatStatus.textContent = `Friend request sent to ${friend_name_input.value}.`
        friend_name_input.value = ""
    }
})

create_group_form.addEventListener("submit", (e) => {
    e.preventDefault()
    const members = group_members_input.value.split(",").map(member => member.trim()).filter(Boolean)
    if (!group_name_input.value.trim()) return
    socket.emit("create_group", { name: group_name_input.value, member_usernames: members })
    group_name_input.value = ""
    group_members_input.value = ""
})

form.addEventListener("submit", (e) => {
    e.preventDefault()
    if (input.value && (activeFriend || activeGroup)) {
        socket.emit("chat_message", {
            message: input.value,
            username: localStorage.getItem("username"),
            recipient_username: activeFriend,
            group_id: activeGroup?.id,
        })
        input.value = ""
    }
})

socket.on("friend_request_error", ({ message }) => {
    console.error(`[FRIENDS] Friend request action failed: ${message}`)
    chatStatus.textContent = message
})

socket.on("friend_request_received", refreshRequests)
socket.on("friendship_updated", () => {
    refreshFriends()
    refreshRequests()
})

socket.on("groups_updated", () => socket.emit("request_groups_list"))
socket.on("group_created", ({ name }) => {
    chatStatus.textContent = `Created group ${name}.`
    socket.emit("request_groups_list")
})
socket.on("groups_error", ({ message }) => { chatStatus.textContent = message })

socket.on("response_groups_list", ({ status, message, groups }) => {
    if (!status) return chatStatus.textContent = `Groups unavailable: ${message}`
    groups_list.innerHTML = ""
    groups.forEach(group => {
        const groupItem = document.createElement("li")
        const name = document.createElement("p")
        const memberCount = document.createElement("small")
        name.textContent = group.name
        memberCount.textContent = `${group.member_count} members`
        groupItem.append(name, memberCount)
        groupItem.addEventListener("click", () => {
            activeFriend = null
            activeGroup = group
            conversationType.textContent = "GROUP CONVERSATION"
            conversationTitle.textContent = group.name
            input.disabled = false
            input.placeholder = `Message ${group.name}...`
            messages.innerHTML = '<li class="empty-state"><strong>Group conversation</strong><span>Loading group history...</span></li>'
            socket.emit("open_group_conversation", { group_id: group.id })
        })
        groups_list.appendChild(groupItem)
    })
})
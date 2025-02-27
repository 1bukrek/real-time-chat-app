const socket = io()
const token = localStorage.getItem("token") // make sure the token is stored after login

// control token, redirect to login if it is not available 
if (token) socket.emit("authenticate", token) // send the token to the server for authentication
else window.location.href = "/login.html" // redirect to login if no token is found

// handle unsuccessfull server authentication response
socket.on("unauthorized", (data) => {
    console.log(data.message)
    // redirect to login page if unauthorized
    window.location.href = "/login.html"
})

// handle successfull server authentication response
socket.on("authenticated", (data) => console.log(data.message))
// handle connection errors
socket.on("connect_error", (err) => console.log("CONNECTION ERROR: ", err.message))
// request friend list and requests list from server from server
socket.emit("request_friends_list", localStorage.getItem("username"))
socket.emit("request_requests_list", localStorage.getItem("username"))

// handle creating messages
socket.on("chat_message", (msg) => {
    let item = document.createElement("li")
    item.textContent = msg
    messages.appendChild(item)
    window.scrollTo(0, document.body.scrollHeight)
})

const form = document.getElementById("form")
const input = document.getElementById("input")
const messages = document.getElementById("messages")

const friends_list = document.getElementById("friends-list");
const add_friend_form = document.getElementById("add-friend-form");
const friend_name_input = document.getElementById("friend-name");

const requests_list = document.getElementById("requests-list")

socket.on("response_friends_list", ({ status, message, friends }) => {
    friends.forEach(friend => {
        const friendItem = document.createElement("li")
        const p = document.createElement("p");
        p.textContent = friend.username;
        const small = document.createElement("small");
        /* preview of the last message
        small.textContent = friend.message.length > 20
            ? friend.message.substring(0, 30) + "..."
            : friend.message; */
        small.textContent = "Hey, this is a test message!"
        friendItem.appendChild(p);
        friendItem.appendChild(small);
        friends_list.appendChild(friendItem);
    })
})

socket.on("response_requests_list", ({ status, message, requests }) => {
    requests.forEach(user => {
        const requestItem = document.createElement("li")
        const p = document.createElement("p")
        p.textContent = user.sender
        requestItem.appendChild(p)
        requests_list.appendChild(requestItem)
    })
})

add_friend_form.addEventListener("submit", (e) => {
    e.preventDefault()
    if (friend_name_input.value) {
        socket.emit("send_friend_request", {
            sender_username: localStorage.getItem("username"),
            receiver_username: friend_name_input.value
        })
        friend_name_input.value = ""
    }
})

form.addEventListener("submit", (e) => {
    e.preventDefault()
    if (input.value) {
        socket.emit("chat_message", {
            message: input.value,
            username: localStorage.getItem("username"),
        })
        input.value = ""
    }
})
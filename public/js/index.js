const socket = io()
const token = localStorage.getItem("token") // Make sure the token is stored after login

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

const friends = [
    { name: "Alice", message: "Hello!" },
    { name: "Bob", message: "What's up?" },
    { name: "Charlie", message: "Good morning!" }
];

friends.forEach(friend => {
    const friendItem = document.createElement("li")
    const p = document.createElement("p");
    p.textContent = friend.name;
    const small = document.createElement("small");
    small.textContent = friend.message.length > 20
        ? friend.message.substring(0, 30) + "..."
        : friend.message;
    friendItem.appendChild(p);
    friendItem.appendChild(small);
    friends_list.appendChild(friendItem);
})

add_friend_form.addEventListener("submit", (e) => {
    e.preventDefault()
    if (friend_name_input.value) {
        socket.emit("send_friend_request", {
            sender_username: localStorage.getItem("username"),
            reciever_username: friend_name_input.value
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
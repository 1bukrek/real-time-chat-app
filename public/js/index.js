const socket = io()

// Retrieve the token
const token = localStorage.getItem("token") // Make sure the token is stored after login

// Emit the 'authenticate' event with the token if available
if (token) {
    socket.emit("authenticate", token) // Send the token to the server for authentication
} else {
    window.location.href = "/login.html" // Redirect to login if no token is found
}

// Handle server responses
socket.on("unauthorized", (data) => {
    console.log(data.message)
    window.location.href = "/login.html" // Redirect to login page if unauthorized
})

socket.on("authenticated", (data) => {
    console.log(data.message) // Display success message if authenticated
})

// Handling any connection errors
socket.on("connect_error", (err) => {
    console.log("CONNECTION ERROR: ", err.message)
})

const form = document.getElementById("form")
const input = document.getElementById("input")
const messages = document.getElementById("messages")

const friends_list = document.getElementById("friends-list");
const add_friend_form = document.getElementById("add-friend-form");
const friend_name_input = document.getElementById("friend-name");

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

// Adding friends functionality
add_friend_form.addEventListener("submit", (e) => {
    e.preventDefault()
    if (friend_name_input.value) {
        // const friendItem = document.createElement("li")
        // friendItem.textContent = friend_name_input.value
        // friends_list.appendChild(friendItem)

        socket.emit("send_friend_request", {
            sender_id: localStorage.getItem("username"),
            reciever_id: friend_name_input.value,
        })

        friend_name_input.value = ""
    }
})

socket.on("chat_message", (msg) => {
    let item = document.createElement("li")
    item.textContent = msg
    messages.appendChild(item)
    window.scrollTo(0, document.body.scrollHeight)
})

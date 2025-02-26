document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault()

    const username = document.getElementById("username").value
    const password = document.getElementById("password").value

    // Send the data to server.js
    const response = await fetch("/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            username: username,
            password: password,
        }),
    })

    // Get the data from server.js
    const data = await response.json()

    if (data.success) {
        // Store the token and username in local storage
        localStorage.setItem("token", data.token)
        localStorage.setItem("username", username)
        window.location.href = "/"
    } else {
        console.log("LOGIN FAILED: ", data.message)
    }
})

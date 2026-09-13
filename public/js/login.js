document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault()

    const username = document.getElementById("username").value
    const password = document.getElementById("password").value

    const status = document.getElementById("form-status")
    status.textContent = "Signing you in..."
    try {
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
        localStorage.setItem("isAdmin", String(Boolean(data.isAdmin)))
        window.location.href = data.isAdmin ? "/admin.html" : "/"
    } else {
        console.error(`[AUTH] Login rejected for ${username}: ${data.message}`)
        status.textContent = data.message || "We could not sign you in. Check your details and try again."
    }
    } catch (error) {
        console.error(`[AUTH] Login request failed: ${error.message}`)
        status.textContent = "The server is unavailable. Please try again in a moment."
    }
})

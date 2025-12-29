let currentUser = null;
let token = null;

// Auth functions
function showSignup() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'block';
}

function showLogin() {
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
}

async function signup() {
    try {
        const username = document.getElementById('signup-username').value;
        const password = document.getElementById('signup-password').value;
        const image = document.getElementById('signup-profile-image').files[0];
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        if (image) formData.append('profileImage', image);

        const res = await fetch('/signup', { method: 'POST', body: formData });
        if (res.ok) {
            alert('Signed up! Please login.');
            showLogin();
        } else {
            const error = await res.text();
            alert(`Signup failed: ${error}`);
        }
    } catch (err) {
        alert('Network error: ' + err.message);
    }
}

async function login() {
    try {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const res = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            token = data.token;
            document.getElementById('auth').style.display = 'none';
            document.getElementById('header').style.display = 'flex';
            document.getElementById('main').style.display = 'flex';
            loadData();
            setInterval(checkMessages, 5000);
        } else {
            const error = await res.text();
            alert(`Login failed: ${error}`);
        }
    } catch (err) {
        alert('Network error: ' + err.message);
    }
}

function logout() {
    currentUser = null;
    token = null;
    document.getElementById('auth').style.display = 'flex';
    document.getElementById('header').style.display = 'none';
    document.getElementById('main').style.display = 'none';
}

// Load data
async function loadData() {
    await Promise.all([renderPosts(), renderFriends(), renderFriendRequests()]);
}

async function renderPosts() {
    const res = await fetch('/posts', { headers: { 'Authorization': token } });
    const posts = await res.json();
    const postsDiv = document.getElementById('posts');
    postsDiv.innerHTML = '';
    posts.forEach((post, index) => {
        postsDiv.innerHTML += `
            <div class="post">
                <img src="${post.profile_image || '/default-profile.png'}" class="profile-img" alt="Profile">
                <p><strong>${post.username}</strong></p>
                ${post.image ? `<img src="${post.image}">` : ''}
                <p>${post.text}</p>
                <button onclick="likePost(${post.id})"><i class="fas fa-heart"></i> ${post.likes}</button>
                <button onclick="commentPost(${post.id})">Comment</button>
                <div id="comments-${post.id}"></div>
            </div>
        `;
    });
}

async function createPost() {
    const text = document.getElementById('post-text').value;
    const image = document.getElementById('post-image').files[0];
    const formData = new FormData();
    formData.append('text', text);
    if (image) formData.append('image', image);

    await fetch('/posts', { method: 'POST', headers: { 'Authorization': token }, body: formData });
    renderPosts();
}

async function likePost(id) {
    await fetch(`/posts/${id}/like`, { method: 'POST', headers: { 'Authorization': token } });
    renderPosts();
}

async function commentPost(id) {
    const comment = prompt('Add comment:');
    if (comment) {
        await fetch(`/posts/${id}/comment`, { method: 'POST', headers: { 'Authorization': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ comment }) });
        renderPosts();
    }
}

async function addFriend() {
    const friend = prompt('Enter username to send request:');
    if (friend) {
        await fetch('/friend-request', { method: 'POST', headers: { 'Authorization': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ friend }) });
        alert('Request sent!');
    }
}

async function renderFriends() {
    const res = await fetch('/friends', { headers: { 'Authorization': token } });
    const friends = await res.json();
    const friendsDiv = document.getElementById('friends-list');
    friendsDiv.innerHTML = '';
    friends.forEach(friend => {
        friendsDiv.innerHTML += `<p><img src="${friend.profile_image || '/default-profile.png'}" class="profile-img" alt="Profile">${friend.username} <button onclick="openChat('${friend.username}')">Chat</button></p>`;
    });
}

async function renderFriendRequests() {
    const res = await fetch('/friend-requests', { headers: { 'Authorization': token } });
    const requests = await res.json();
    const requestsDiv = document.getElementById('friend-requests');
    requestsDiv.innerHTML = '';
    requests.forEach(req => {
        requestsDiv.innerHTML += `<p>${req.from} <button onclick="acceptRequest(${req.id})">Accept</button> <button onclick="declineRequest(${req.id})">Decline</button></p>`;
    });
}

async function acceptRequest(id) {
    await fetch(`/friend-request/${id}/accept`, { method: 'POST', headers: { 'Authorization': token } });
    renderFriends();
    renderFriendRequests();
}

async function declineRequest(id) {
    await fetch(`/friend-request/${id}/decline`, { method: 'POST', headers: { 'Authorization': token } });
    renderFriendRequests();
}

async function openChat(friend) {
    document.getElementById('chat-friend').textContent = friend;
    document.getElementById('chat').style.display = 'block';
    renderChat(friend);
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const image = document.getElementById('chat-image').files[0];
    const friend = document.getElementById('chat-friend').textContent;
    const formData = new FormData();
    formData.append('to', friend);
    formData.append('text', input.value);
    if (image) formData.append('image', image);

    await fetch('/messages', { method: 'POST', headers: { 'Authorization': token }, body: formData });
    input.value = '';
    renderChat(friend);
}

async function renderChat(friend) {
    const res = await fetch(`/messages/${friend}`, { headers: { 'Authorization': token } });
    const messages = await res.json();
    const messagesDiv = document.getElementById('chat-messages');
    messagesDiv.innerHTML = '';
    messages.forEach(msg => {
        messagesDiv.innerHTML += `<p>${msg.from}: ${msg.text}${msg.image ? `<img src="${msg.image}" style="max-width:100px;">` : ''}</p>`;
    });
}

async function checkMessages() {
    if (currentUser) {
        const res = await fetch('/messages/check', { headers: { 'Authorization': token } });
        const newMsgs = await res.json();
        if (newMsgs.count > 0) {
            alert('New messages received!');
        }
    }
}

function closeChat() {
    document.getElementById('chat').style.display = 'none';
}
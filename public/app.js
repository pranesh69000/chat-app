// PRODUCTION BACKEND URL (Decoupled on Render)
const BACKEND_URL = 'https://api-secret-chat.onrender.com';

// Auto-detects: uses local server if on localhost, otherwise connects to live Render cloud backend
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? '' 
  : BACKEND_URL;

function getApiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function getWsUrl(path) {
  if (!API_BASE_URL) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${path}`;
  }
  const wsBase = API_BASE_URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  return `${wsBase}${path}`;
}

// STATE MANAGEMENT
let token = localStorage.getItem('chat_token');
let currentUser = null;
let activeRecipientId = null;
let activeRecipientPhone = null;
let ws = null;
let titleTapCount = 0;
let tapTimer = null;

// Voice recording state
let mediaRecorder = null;
let audioChunks = [];
let recordStartTime = null;
let recordInterval = null;

// === 1. PUBLIC TIC-TAC-TOE GAME ENGINE ===
const board = document.getElementById('board');
const gameStatus = document.getElementById('game-status');
let gameState = ['', '', '', '', '', '', '', '', ''];
let isGameActive = true;

const winningConditions = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function handleCellClick(e) {
  const cell = e.target;
  const index = parseInt(cell.getAttribute('data-index'));

  if (gameState[index] !== '' || !isGameActive) return;

  makeMove(index, 'X');

  if (checkWinner('X')) {
    gameStatus.textContent = "You Win! 🎉";
    isGameActive = false;
    return;
  }

  if (!gameState.includes('')) {
    gameStatus.textContent = "It's a Draw!";
    isGameActive = false;
    return;
  }

  isGameActive = false;
  gameStatus.textContent = "Computer is thinking...";

  setTimeout(() => {
    computerMove();
  }, 400);
}

function makeMove(index, player) {
  gameState[index] = player;
  const cell = document.querySelector(`.cell[data-index="${index}"]`);
  cell.textContent = player;
  cell.classList.add(player.toLowerCase());
}

function computerMove() {
  const emptySpots = [];
  gameState.forEach((val, idx) => {
    if (val === '') emptySpots.push(idx);
  });

  if (emptySpots.length === 0) return;

  let chosenIndex = null;

  for (let idx of emptySpots) {
    gameState[idx] = 'O';
    if (checkWinner('O')) {
      chosenIndex = idx;
      gameState[idx] = '';
      break;
    }
    gameState[idx] = '';
  }

  if (chosenIndex === null) {
    for (let idx of emptySpots) {
      gameState[idx] = 'X';
      if (checkWinner('X')) {
        chosenIndex = idx;
        gameState[idx] = '';
        break;
      }
      gameState[idx] = '';
    }
  }

  if (chosenIndex === null && gameState[4] === '') {
    chosenIndex = 4;
  }

  if (chosenIndex === null) {
    chosenIndex = emptySpots[Math.floor(Math.random() * emptySpots.length)];
  }

  makeMove(chosenIndex, 'O');

  if (checkWinner('O')) {
    gameStatus.textContent = "Computer Wins! 🤖";
    isGameActive = false;
    return;
  }

  if (!gameState.includes('')) {
    gameStatus.textContent = "It's a Draw!";
    isGameActive = false;
    return;
  }

  isGameActive = true;
  gameStatus.textContent = "Your Turn (X)";
}

function checkWinner(player) {
  return winningConditions.some(combination => {
    return combination.every(index => gameState[index] === player);
  });
}

document.getElementById('reset-game-btn').addEventListener('click', () => {
  gameState = ['', '', '', '', '', '', '', '', ''];
  isGameActive = true;
  gameStatus.textContent = "Your Turn (X)";
  document.querySelectorAll('.cell').forEach(c => {
    c.textContent = '';
    c.classList.remove('x', 'o');
  });
});

board.addEventListener('click', handleCellClick);

// === 2. SECRET 5-TAP TITLE ENTRY ===
const secretTitle = document.getElementById('secret-title');
const secretModal = document.getElementById('secret-modal');
const closeModalBtn = document.getElementById('close-modal-btn');

secretTitle.addEventListener('click', () => {
  titleTapCount++;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => { titleTapCount = 0; }, 1500);

  if (titleTapCount >= 5) {
    titleTapCount = 0;
    openSecretModal();
  }
});

closeModalBtn.addEventListener('click', () => {
  secretModal.classList.add('hidden');
});

function openSecretModal() {
  secretModal.classList.remove('hidden');
  showAuthStep('auth-login-step');
  document.getElementById('login-phone').focus();
}

// === 3. AUTH STEPS & PASSCODE UNLOCK ===
const authError = document.getElementById('auth-error-msg');

function showError(msg) {
  authError.textContent = msg;
  authError.classList.remove('hidden');
}

function clearError() {
  authError.textContent = '';
  authError.classList.add('hidden');
}

function showAuthStep(stepId) {
  clearError();
  document.querySelectorAll('.auth-step').forEach(step => step.classList.add('hidden'));
  document.getElementById(stepId).classList.remove('hidden');
}

document.getElementById('to-register-link').addEventListener('click', (e) => {
  e.preventDefault();
  showAuthStep('auth-register-step');
  document.getElementById('reg-phone').focus();
});

document.getElementById('to-login-link').addEventListener('click', (e) => {
  e.preventDefault();
  showAuthStep('auth-login-step');
  document.getElementById('login-phone').focus();
});

// LOGIN: phone + passcode
async function submitLogin() {
  clearError();
  const rawDigits = document.getElementById('login-phone').value.trim();
  const passcode = document.getElementById('login-passcode').value.trim();

  if (!rawDigits || rawDigits.length !== 10) return showError('Enter a valid 10-digit mobile number.');
  if (!passcode) return showError('Enter your passcode.');

  const phoneNumber = `+91${rawDigits}`;

  try {
    const res = await fetch(getApiUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, passcode })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    setSession(data.sessionToken, data.user);
  } catch (err) {
    showError(err.message);
  }
}

document.getElementById('login-submit-btn').addEventListener('click', submitLogin);
document.getElementById('login-passcode').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') submitLogin();
});

// REGISTER: phone + passcode (no OTP)
async function submitRegister() {
  clearError();
  const rawDigits = document.getElementById('reg-phone').value.trim();
  const passcode = document.getElementById('reg-passcode').value.trim();

  if (!rawDigits || rawDigits.length !== 10) return showError('Enter a valid 10-digit mobile number.');
  if (!passcode) return showError('Set a numeric passcode.');

  const phoneNumber = `+91${rawDigits}`;

  try {
    const res = await fetch(getApiUrl('/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, passcode })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    setSession(data.sessionToken, data.user);
  } catch (err) {
    showError(err.message);
  }
}

document.getElementById('register-submit-btn').addEventListener('click', submitRegister);
document.getElementById('reg-passcode').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') submitRegister();
});

function setSession(newToken, user) {
  token = newToken;
  currentUser = user;
  localStorage.setItem('chat_token', token);
  secretModal.classList.add('hidden');
  checkAuthAndEnter();
}

// === 4. MULTI-USER CONTACTS & CHAT NAVIGATION ===
async function checkAuthAndEnter() {
  try {
    const res = await fetch(getApiUrl('/auth/me'), {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      localStorage.removeItem('chat_token');
      token = null;
      secretModal.classList.remove('hidden');
      return;
    }
    const data = await res.json();
    currentUser = data.user;

    document.getElementById('game-view').classList.add('hidden');
    document.getElementById('chat-view').classList.remove('hidden');
    document.getElementById('my-phone-display').textContent = currentUser.phoneNumber;

    connectWebSocket();
    loadContacts();
  } catch {
    secretModal.classList.remove('hidden');
  }
}

async function loadContacts() {
  const regList = document.getElementById('registered-contacts-list');
  const res = await fetch(getApiUrl('/contacts/registered'), {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();

  regList.innerHTML = '';
  if (data.registered && data.registered.length > 0) {
    data.registered.forEach(c => {
      const item = document.createElement('div');
      item.className = 'contact-item';
      item.innerHTML = `
        <div class="contact-left">
          <div class="avatar">👤</div>
          <div>
            <div class="contact-name">${escapeHtml(c.phoneNumber)}</div>
            <div class="contact-phone">Tap to open chat</div>
          </div>
        </div>
        <span class="online-tag">Chat</span>
      `;
      item.addEventListener('click', () => openChatWith(c.userId, c.phoneNumber));
      regList.appendChild(item);
    });
  } else {
    regList.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:0.9rem;">No other contacts on app yet. Enter a 10-digit number above to invite or chat!</div>';
  }
}

document.getElementById('check-contact-btn').addEventListener('click', async () => {
  const rawDigits = document.getElementById('new-contact-phone').value.trim();
  if (!rawDigits || rawDigits.length !== 10) {
    alert('Please enter a valid 10-digit Indian mobile number');
    return;
  }

  const phone = `+91${rawDigits}`;

  const res = await fetch(getApiUrl('/contacts/sync'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ phoneNumbers: [phone] })
  });

  const data = await res.json();
  const unregList = document.getElementById('unregistered-contacts-list');

  if (data.registered && data.registered.length > 0) {
    const contact = data.registered[0];
    openChatWith(contact.userId, contact.phoneNumber);
  } else if (data.notRegistered && data.notRegistered.length > 0) {
    const unreg = data.notRegistered[0];
    unregList.innerHTML = `
      <div class="contact-item">
        <div class="contact-left">
          <div class="avatar">✉️</div>
          <div>
            <div class="contact-name">${escapeHtml(unreg.phoneNumber)}</div>
            <div class="contact-phone">Not on app yet</div>
          </div>
        </div>
        <a href="sms:${unreg.phoneNumber}?body=${encodeURIComponent(unreg.inviteLink)}" class="invite-badge">Send SMS Invite</a>
      </div>
    `;
  }
  document.getElementById('new-contact-phone').value = '';
});

function openChatWith(userId, phoneNumber) {
  activeRecipientId = userId;
  activeRecipientPhone = phoneNumber;

  document.getElementById('chat-partner-name').textContent = phoneNumber;
  document.getElementById('contacts-screen').classList.add('hidden');
  document.getElementById('active-chat-window').classList.remove('hidden');

  loadMessages();
}

document.getElementById('back-to-contacts-btn').addEventListener('click', () => {
  activeRecipientId = null;
  document.getElementById('active-chat-window').classList.add('hidden');
  document.getElementById('contacts-screen').classList.remove('hidden');
  loadContacts();
});

// === 5. REAL-TIME WEBSOCKET & CHAT ENGINE ===
function connectWebSocket() {
  if (ws && ws.readyState === 1) return;
  const wsUrl = getWsUrl(`/ws?token=${token}`);
  ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'new_message') {
      if (activeRecipientId && (data.message.senderId === activeRecipientId || data.message.recipientId === activeRecipientId)) {
        renderMessage(data.message);
        scrollToBottom();

        if (data.message.senderId === activeRecipientId) {
          ws.send(JSON.stringify({
            action: 'mark_read',
            messageId: data.message.id
          }));
        }
      }
    } else if (data.type === 'message_sent') {
      const pendingBubble = document.getElementById(`msg-${data.message.clientMessageId}`);
      if (pendingBubble) {
        pendingBubble.id = `msg-${data.message.id}`;
      }
      updateMessageStatusUI(data.message.id, 'sent');
    } else if (data.type === 'message_status_updated') {
      updateMessageStatusUI(data.messageId, data.status);
    }
  };
}

async function loadMessages() {
  if (!activeRecipientId) return;

  const res = await fetch(getApiUrl(`/messages/${activeRecipientId}?limit=50`), {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const container = document.getElementById('messages-container');
  container.innerHTML = '';

  data.messages.forEach(msg => {
    renderMessage(msg);
    if (msg.recipientId === currentUser.id && msg.status !== 'read') {
      ws.send(JSON.stringify({
        action: 'mark_read',
        messageId: msg.id
      }));
    }
  });
  scrollToBottom();
}

function renderMessage(msg) {
  const container = document.getElementById('messages-container');
  
  const existing = document.getElementById(`msg-${msg.id}`) || 
                   (msg.clientMessageId && document.getElementById(`msg-${msg.clientMessageId}`));
  if (existing) {
    existing.id = `msg-${msg.id}`;
    updateMessageStatusUI(msg.id, msg.status);
    return;
  }

  const isMine = msg.senderId === currentUser.id;
  const bubble = document.createElement('div');
  bubble.id = `msg-${msg.id || msg.clientMessageId}`;
  bubble.className = `msg-bubble ${isMine ? 'msg-sent' : 'msg-received'}`;

  let mediaHtml = '';
  if (msg.mediaUrl) {
    const fullMediaUrl = msg.mediaUrl.startsWith('http') ? msg.mediaUrl : getApiUrl(msg.mediaUrl);
    if (msg.type === 'image') {
      mediaHtml = `<img src="${fullMediaUrl}" class="msg-media" alt="Photo">`;
    } else if (msg.type === 'audio') {
      mediaHtml = `<audio controls src="${fullMediaUrl}"></audio>`;
    } else if (msg.type === 'video') {
      mediaHtml = `<video controls src="${fullMediaUrl}" class="msg-media"></video>`;
    }
  }

  const timeStr = new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const tickHtml = isMine ? getTickHtml(msg.status || 'sent') : '';

  bubble.innerHTML = `
    ${mediaHtml}
    ${msg.content ? `<div>${escapeHtml(msg.content)}</div>` : ''}
    <div class="msg-meta">
      <span>${timeStr}</span>
      ${tickHtml}
    </div>
  `;

  container.appendChild(bubble);
}

function getTickHtml(status) {
  if (status === 'sent') return `<span class="tick" title="Sent (Single Tick)">✓</span>`;
  if (status === 'delivered') return `<span class="tick" title="Delivered (Double Tick)">✓✓</span>`;
  if (status === 'read') return `<span class="tick read" title="Read (Blue Tick)">✓✓</span>`;
  return `<span class="tick">✓</span>`;
}

function updateMessageStatusUI(messageId, status) {
  const bubble = document.getElementById(`msg-${messageId}`);
  if (!bubble) return;
  const tickEl = bubble.querySelector('.tick');
  if (tickEl) {
    if (status === 'delivered') {
      tickEl.textContent = '✓✓';
      tickEl.className = 'tick';
    } else if (status === 'read') {
      tickEl.textContent = '✓✓';
      tickEl.className = 'tick read';
    }
  }
}

function scrollToBottom() {
  const container = document.getElementById('messages-container');
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !activeRecipientId) return;

  const clientMessageId = `c_${Date.now()}_${Math.random()}`;

  const localMessage = {
    id: clientMessageId,
    clientMessageId,
    senderId: currentUser.id,
    recipientId: activeRecipientId,
    content: text,
    type: 'text',
    status: 'sent',
    createdAt: Date.now()
  };

  renderMessage(localMessage);
  scrollToBottom();
  input.value = '';

  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({
      action: 'send_message',
      recipientId: activeRecipientId,
      content: text,
      type: 'text',
      clientMessageId
    }));
  }
}

document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// Voice Recording
const voiceRecordBtn = document.getElementById('voice-record-btn');
const recordingBanner = document.getElementById('recording-banner');
const recordingTimer = document.getElementById('recording-timer');
const cancelRecordBtn = document.getElementById('cancel-record-btn');

voiceRecordBtn.addEventListener('click', async () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    stopRecordingUI();
  } else {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startRecording(stream);
    } catch (err) {
      alert('Microphone access denied: ' + err.message);
    }
  }
});

function startRecording(stream) {
  audioChunks = [];
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach(track => track.stop());

    if (audioChunks.length === 0) return;
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    if (audioBlob.size < 100) return;

    const audioUrl = URL.createObjectURL(audioBlob);
    const clientMessageId = `c_${Date.now()}`;

    renderMessage({
      id: clientMessageId,
      clientMessageId,
      senderId: currentUser.id,
      recipientId: activeRecipientId,
      content: '',
      type: 'audio',
      mediaUrl: audioUrl,
      status: 'sent',
      createdAt: Date.now()
    });
    scrollToBottom();

    const formData = new FormData();
    formData.append('file', audioBlob, `voice_${Date.now()}.webm`);

    try {
      const res = await fetch(getApiUrl('/media/upload'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Audio upload failed');

      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          action: 'send_message',
          recipientId: activeRecipientId,
          content: '',
          type: 'audio',
          mediaUrl: data.mediaUrl,
          clientMessageId
        }));
      }
    } catch (err) {
      alert('Voice upload failed: ' + err.message);
    }
  };

  mediaRecorder.start();
  startRecordingUI();
}

function startRecordingUI() {
  voiceRecordBtn.classList.add('recording');
  recordingBanner.classList.remove('hidden');
  recordStartTime = Date.now();
  recordInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
    recordingTimer.textContent = `Recording: ${elapsed}s (Tap 🎙️ to send)`;
  }, 1000);
}

function stopRecordingUI() {
  voiceRecordBtn.classList.remove('recording');
  recordingBanner.classList.add('hidden');
  clearInterval(recordInterval);
}

cancelRecordBtn.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    audioChunks = [];
    mediaRecorder.stop();
    stopRecordingUI();
  }
});

// Media File Attachment
document.getElementById('media-file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !activeRecipientId) return;

  const localMediaUrl = URL.createObjectURL(file);
  let type = 'image';
  if (file.type.startsWith('audio/')) type = 'audio';
  else if (file.type.startsWith('video/')) type = 'video';

  const clientMessageId = `c_${Date.now()}`;

  renderMessage({
    id: clientMessageId,
    clientMessageId,
    senderId: currentUser.id,
    recipientId: activeRecipientId,
    content: '',
    type,
    mediaUrl: localMediaUrl,
    status: 'sent',
    createdAt: Date.now()
  });
  scrollToBottom();

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(getApiUrl('/media/upload'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        action: 'send_message',
        recipientId: activeRecipientId,
        content: '',
        type,
        mediaUrl: data.mediaUrl,
        clientMessageId
      }));
    }
  } catch (err) {
    alert('Upload error: ' + err.message);
  } finally {
    e.target.value = '';
  }
});

function lockApp() {
  if (ws) { ws.close(); ws = null; }
  token = null;
  currentUser = null;
  activeRecipientId = null;
  activeRecipientPhone = null;
  localStorage.removeItem('chat_token');
  document.getElementById('chat-view').classList.add('hidden');
  document.getElementById('game-view').classList.remove('hidden');
}

document.getElementById('lock-chat-btn').addEventListener('click', lockApp);
document.getElementById('lock-app-btn').addEventListener('click', lockApp);

// === AUTO-LOCK: When user leaves the app (tab hidden, phone goes to home/background) ===
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    lockApp();
  }
});

// Fallback for mobile browsers (home button press, app switcher)
window.addEventListener('pagehide', () => {
  lockApp();
});

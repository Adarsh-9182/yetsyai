// ============================================================================
//  NutritiScan — app.js  (runs in the visitor's browser)
//  Its whole job: take what the user types, send the conversation to our own
//  server (/api/chat), and show Claude's reply. The secret key never touches
//  this file — it stays safe on the server.
// ============================================================================

const chatLog  = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatText = document.getElementById("chatText");
const sendBtn  = document.getElementById("sendBtn");

// We keep the running conversation here so the AI remembers context.
// (It does NOT include the greeting bubble — that's just decoration.)
const messages = [];

// --- Add a message bubble to the screen -------------------------------------
function addBubble(role, text, extraClass = "") {
  const wrap = document.createElement("div");
  wrap.className = "msg " + (role === "user" ? "msg-user" : "msg-bot");

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble " + extraClass;
  bubble.textContent = text;

  wrap.appendChild(bubble);
  chatLog.appendChild(wrap);
  chatLog.scrollTop = chatLog.scrollHeight; // keep newest message in view
  return bubble;
}

// --- Handle the user pressing Send ------------------------------------------
chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = chatText.value.trim();
  if (!text) return;

  // 1. Show the user's message and remember it.
  addBubble("user", text);
  messages.push({ role: "user", content: text });
  chatText.value = "";

  // 2. Lock the input and show a "thinking" bubble while we wait.
  sendBtn.disabled = true;
  chatText.disabled = true;
  const thinking = addBubble("bot", "NutritiScan is thinking…", "thinking");

  try {
    // 3. Send the whole conversation to our server.
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");

    // 4. Replace the "thinking" bubble with the real answer and remember it.
    thinking.classList.remove("thinking");
    thinking.textContent = data.reply;
    messages.push({ role: "assistant", content: data.reply });
  } catch (err) {
    thinking.classList.remove("thinking");
    thinking.textContent =
      "Sorry — I couldn't reach the assistant just now. Please try again.";
    console.error(err);
  } finally {
    // 5. Re-enable the input for the next message.
    sendBtn.disabled = false;
    chatText.disabled = false;
    chatText.focus();
  }
});

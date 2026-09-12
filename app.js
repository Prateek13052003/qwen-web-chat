(() => {
  "use strict";

  const LS_SETTINGS = "qwenchat.settings";
  const LS_CONVERSATIONS = "qwenchat.conversations";
  const LS_ACTIVE = "qwenchat.activeId";

  const el = (id) => document.getElementById(id);

  const messagesEl = el("messages");
  const emptyStateEl = el("emptyState");
  const chatListEl = el("chatList");
  const chatTitleEl = el("chatTitle");
  const messageInput = el("messageInput");
  const sendBtn = el("sendBtn");
  const stopBtn = el("stopBtn");
  const modelSelect = el("modelSelect");
  const connDot = el("connDot");
  const connLabel = el("connLabel");

  const settingsOverlay = el("settingsOverlay");
  const baseUrlInput = el("baseUrlInput");
  const apiKeyInput = el("apiKeyInput");
  const modelIdInput = el("modelIdInput");
  const systemPromptInput = el("systemPromptInput");
  const testConnBtn = el("testConnBtn");
  const testConnResult = el("testConnResult");

  // ---------------- State ----------------
  let settings = loadSettings();
  let conversations = loadConversations();
  let activeId = localStorage.getItem(LS_ACTIVE);
  let abortController = null;

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(LS_SETTINGS)) || {
        baseUrl: "", apiKey: "", modelId: "", systemPrompt: "",
      };
    } catch {
      return { baseUrl: "", apiKey: "", modelId: "", systemPrompt: "" };
    }
  }

  function saveSettings() {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
  }

  function loadConversations() {
    try {
      return JSON.parse(localStorage.getItem(LS_CONVERSATIONS)) || [];
    } catch {
      return [];
    }
  }

  function persistConversations() {
    localStorage.setItem(LS_CONVERSATIONS, JSON.stringify(conversations));
  }

  function getActiveConversation() {
    return conversations.find((c) => c.id === activeId) || null;
  }

  function normalizedBaseUrl() {
    return (settings.baseUrl || "").trim().replace(/\/+$/, "");
  }

  // ---------------- Sidebar / conversation list ----------------
  function renderChatList() {
    chatListEl.innerHTML = "";
    conversations
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .forEach((conv) => {
        const item = document.createElement("div");
        item.className = "chat-item" + (conv.id === activeId ? " active" : "");
        const title = document.createElement("span");
        title.className = "chat-item-title";
        title.textContent = conv.title || "New chat";
        const del = document.createElement("button");
        del.className = "delete-chat";
        del.textContent = "✕";
        del.title = "Delete chat";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteConversation(conv.id);
        });
        item.appendChild(title);
        item.appendChild(del);
        item.addEventListener("click", () => switchConversation(conv.id));
        chatListEl.appendChild(item);
      });
  }

  function deleteConversation(id) {
    conversations = conversations.filter((c) => c.id !== id);
    persistConversations();
    if (activeId === id) {
      activeId = conversations[0] ? conversations[0].id : null;
      localStorage.setItem(LS_ACTIVE, activeId || "");
    }
    renderChatList();
    renderActiveConversation();
  }

  function switchConversation(id) {
    if (abortController) abortController.abort();
    activeId = id;
    localStorage.setItem(LS_ACTIVE, id);
    renderChatList();
    renderActiveConversation();
  }

  function createConversation() {
    const conv = {
      id: "c" + Date.now() + Math.random().toString(36).slice(2, 7),
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    conversations.push(conv);
    activeId = conv.id;
    localStorage.setItem(LS_ACTIVE, activeId);
    persistConversations();
    renderChatList();
    renderActiveConversation();
    messageInput.focus();
  }

  // ---------------- Markdown rendering ----------------
  function renderMarkdown(raw) {
    let html;
    try {
      html = marked.parse(raw || "", { breaks: true });
    } catch {
      html = escapeHtml(raw || "");
    }
    if (window.DOMPurify) {
      html = DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
    }
    return html;
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function attachCodeCopyButtons(container) {
    container.querySelectorAll("pre").forEach((pre) => {
      if (pre.querySelector(".copy-code-btn")) return;
      const btn = document.createElement("button");
      btn.className = "copy-code-btn";
      btn.textContent = "Copy";
      btn.addEventListener("click", () => {
        const code = pre.querySelector("code");
        navigator.clipboard.writeText(code ? code.textContent : pre.textContent).then(() => {
          btn.textContent = "Copied!";
          setTimeout(() => (btn.textContent = "Copy"), 1500);
        });
      });
      pre.style.position = "relative";
      pre.appendChild(btn);
    });
  }

  // ---------------- Message rendering ----------------
  function renderActiveConversation() {
    const conv = getActiveConversation();
    messagesEl.innerHTML = "";
    if (!conv || conv.messages.length === 0) {
      chatTitleEl.textContent = conv ? conv.title : "New chat";
      messagesEl.appendChild(emptyStateEl);
      emptyStateEl.classList.remove("hidden");
      return;
    }
    emptyStateEl.classList.add("hidden");
    chatTitleEl.textContent = conv.title;
    conv.messages.forEach((msg) => appendMessageRow(msg.role, msg.content, false));
    scrollToBottom();
  }

  function appendMessageRow(role, content, animate) {
    const row = document.createElement("div");
    row.className = "msg-row";

    const avatar = document.createElement("div");
    avatar.className = "avatar " + role;
    avatar.textContent = role === "user" ? "You" [0] : "Q";
    if (role === "user") avatar.textContent = "U";

    const contentWrap = document.createElement("div");
    contentWrap.className = "msg-content";

    const body = document.createElement("div");
    body.className = "msg-body";
    if (role === "assistant" && content === "") {
      body.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    } else if (role === "error") {
      body.className = "msg-error";
      body.textContent = content;
    } else {
      body.innerHTML = renderMarkdown(content);
      attachCodeCopyButtons(body);
    }

    contentWrap.appendChild(body);
    row.appendChild(avatar);
    row.appendChild(contentWrap);
    messagesEl.appendChild(row);
    return body;
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ---------------- Connection status ----------------
  function setConnStatus(state, label) {
    connDot.className = "dot" + (state === "ok" ? " ok" : state === "err" ? " err" : "");
    connLabel.textContent = label;
  }

  async function fetchModels(silent) {
    const base = normalizedBaseUrl();
    if (!base || !settings.apiKey) {
      setConnStatus("", "Not connected");
      return [];
    }
    try {
      const res = await fetch(base + "/models", {
        headers: {
          Authorization: "Bearer " + settings.apiKey,
          "ngrok-skip-browser-warning": "true",
        },
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const models = (data.data || []).map((m) => m.id);
      setConnStatus("ok", "Connected");
      populateModelSelect(models);
      return models;
    } catch (err) {
      setConnStatus("err", "Connection failed");
      if (!silent) throw err;
      return [];
    }
  }

  function populateModelSelect(models) {
    const current = settings.modelId || modelSelect.value;
    modelSelect.innerHTML = "";
    if (models.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No models found";
      modelSelect.appendChild(opt);
      return;
    }
    models.forEach((id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id;
      modelSelect.appendChild(opt);
    });
    if (models.includes(current)) {
      modelSelect.value = current;
    } else {
      modelSelect.value = models[0];
      settings.modelId = models[0];
      saveSettings();
    }
  }

  // ---------------- Sending messages ----------------
  function autoTitle(conv, text) {
    if (conv.title !== "New chat") return;
    conv.title = text.trim().slice(0, 48) || "New chat";
  }

  async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    if (!normalizedBaseUrl() || !settings.apiKey) {
      openSettings();
      return;
    }

    let conv = getActiveConversation();
    if (!conv) {
      createConversation();
      conv = getActiveConversation();
    }

    emptyStateEl.classList.add("hidden");
    autoTitle(conv, text);
    conv.messages.push({ role: "user", content: text });
    conv.updatedAt = Date.now();
    persistConversations();
    renderChatList();
    chatTitleEl.textContent = conv.title;

    appendMessageRow("user", text, false);
    messageInput.value = "";
    autoResize();
    scrollToBottom();

    const assistantBodyEl = appendMessageRow("assistant", "", true);
    scrollToBottom();

    setGenerating(true);
    abortController = new AbortController();

    const model = settings.modelId || modelSelect.value;
    const payloadMessages = [];
    if (settings.systemPrompt && settings.systemPrompt.trim()) {
      payloadMessages.push({ role: "system", content: settings.systemPrompt.trim() });
    }
    conv.messages.forEach((m) => payloadMessages.push({ role: m.role, content: m.content }));

    let accumulated = "";
    let renderScheduled = false;
    const scheduleRender = () => {
      if (renderScheduled) return;
      renderScheduled = true;
      requestAnimationFrame(() => {
        assistantBodyEl.innerHTML = renderMarkdown(accumulated);
        attachCodeCopyButtons(assistantBodyEl);
        scrollToBottom();
        renderScheduled = false;
      });
    };

    try {
      const res = await fetch(normalizedBaseUrl() + "/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + settings.apiKey,
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          model,
          messages: payloadMessages,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}${errText ? " — " + errText.slice(0, 300) : ""}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const chunk = JSON.parse(data);
            const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
            if (delta && typeof delta.content === "string") {
              accumulated += delta.content;
              scheduleRender();
            }
          } catch {
            // ignore malformed SSE fragments
          }
        }
      }

      assistantBodyEl.innerHTML = renderMarkdown(accumulated);
      attachCodeCopyButtons(assistantBodyEl);

      if (!accumulated.trim()) {
        accumulated = "*(empty response)*";
        assistantBodyEl.innerHTML = renderMarkdown(accumulated);
      }

      conv.messages.push({ role: "assistant", content: accumulated });
      conv.updatedAt = Date.now();
      persistConversations();
    } catch (err) {
      if (err.name === "AbortError") {
        conv.messages.push({ role: "assistant", content: accumulated || "*(stopped)*" });
        assistantBodyEl.innerHTML = renderMarkdown(accumulated || "*(stopped)*");
      } else {
        assistantBodyEl.className = "msg-error";
        assistantBodyEl.textContent = "Error: " + err.message;
        conv.messages.push({ role: "error", content: "Error: " + err.message });
      }
      persistConversations();
    } finally {
      setGenerating(false);
      abortController = null;
      scrollToBottom();
    }
  }

  function setGenerating(isGenerating) {
    sendBtn.classList.toggle("hidden", isGenerating);
    stopBtn.classList.toggle("hidden", !isGenerating);
    messageInput.disabled = isGenerating;
  }

  function autoResize() {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + "px";
  }

  // ---------------- Settings modal ----------------
  function openSettings() {
    baseUrlInput.value = settings.baseUrl || "";
    apiKeyInput.value = settings.apiKey || "";
    modelIdInput.value = settings.modelId || "";
    systemPromptInput.value = settings.systemPrompt || "";
    testConnResult.textContent = "";
    testConnResult.className = "test-result";
    settingsOverlay.classList.remove("hidden");
  }

  function closeSettings() {
    settingsOverlay.classList.add("hidden");
  }

  async function testConnection() {
    testConnResult.textContent = "Testing…";
    testConnResult.className = "test-result";
    const base = (baseUrlInput.value || "").trim().replace(/\/+$/, "");
    const key = (apiKeyInput.value || "").trim();
    if (!base || !key) {
      testConnResult.textContent = "Enter a base URL and API key first.";
      testConnResult.className = "test-result err";
      return;
    }
    try {
      const res = await fetch(base + "/models", {
        headers: {
          Authorization: "Bearer " + key,
          "ngrok-skip-browser-warning": "true",
        },
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const models = (data.data || []).map((m) => m.id);
      testConnResult.textContent = `Connected — ${models.length} model(s) found.`;
      testConnResult.className = "test-result ok";
      if (models.length && !modelIdInput.value) {
        modelIdInput.value = models[0];
      }
    } catch (err) {
      testConnResult.textContent = "Failed: " + err.message;
      testConnResult.className = "test-result err";
    }
  }

  function saveSettingsFromModal() {
    settings.baseUrl = (baseUrlInput.value || "").trim().replace(/\/+$/, "");
    settings.apiKey = (apiKeyInput.value || "").trim();
    settings.modelId = (modelIdInput.value || "").trim();
    settings.systemPrompt = systemPromptInput.value || "";
    saveSettings();
    closeSettings();
    fetchModels(true);
  }

  function clearAllChats() {
    if (!confirm("Delete all conversations? This cannot be undone.")) return;
    conversations = [];
    activeId = null;
    persistConversations();
    localStorage.removeItem(LS_ACTIVE);
    renderChatList();
    renderActiveConversation();
    closeSettings();
  }

  // ---------------- Sidebar collapse ----------------
  function toggleSidebar() {
    el("sidebar").classList.toggle("collapsed");
  }

  // ---------------- Event wiring ----------------
  el("newChatBtn").addEventListener("click", createConversation);
  el("settingsBtn").addEventListener("click", openSettings);
  el("emptyStateSettingsBtn").addEventListener("click", openSettings);
  el("closeSettingsBtn").addEventListener("click", closeSettings);
  el("saveSettingsBtn").addEventListener("click", saveSettingsFromModal);
  el("testConnBtn").addEventListener("click", testConnection);
  el("clearAllBtn").addEventListener("click", clearAllChats);
  el("sidebarToggle").addEventListener("click", toggleSidebar);
  settingsOverlay.addEventListener("click", (e) => {
    if (e.target === settingsOverlay) closeSettings();
  });

  sendBtn.addEventListener("click", sendMessage);
  stopBtn.addEventListener("click", () => {
    if (abortController) abortController.abort();
  });
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  messageInput.addEventListener("input", autoResize);

  modelSelect.addEventListener("change", () => {
    settings.modelId = modelSelect.value;
    saveSettings();
  });

  // ---------------- Init ----------------
  function init() {
    renderChatList();
    if (!activeId && conversations.length) {
      activeId = conversations[0].id;
    }
    renderActiveConversation();
    if (settings.modelId) {
      const opt = document.createElement("option");
      opt.value = settings.modelId;
      opt.textContent = settings.modelId;
      modelSelect.appendChild(opt);
      modelSelect.value = settings.modelId;
    }
    if (normalizedBaseUrl() && settings.apiKey) {
      fetchModels(true);
    } else {
      setConnStatus("", "Not connected");
      openSettings();
    }
  }

  init();
})();

# QwenChat — Self-Hosted LLM Chat Client

**Live app:** https://prateek13052003.github.io/qwen-web-chat/

A ChatGPT/Claude-style chat interface, built from scratch in vanilla HTML/CSS/JavaScript, for talking to any **OpenAI-compatible** LLM API — including a self-hosted, open-weight model served from a free cloud GPU.

No framework, no build step, no backend server. It's a static site that runs entirely in your browser and talks directly to whatever API endpoint you give it.

## Features

- Real-time streaming responses via Server-Sent Events (SSE), rendered token-by-token
- Markdown + code block rendering with a one-click copy button
- Multiple conversations with sidebar history, auto-titled, persisted in `localStorage`
- Connection settings panel: paste a Base URL + API key, test the connection, and auto-detect available models
- Optional system prompt, stop-generation control, dark theme

## How it connects to a model

This app is the **client** — it doesn't run a model itself. Pair it with any server that exposes an OpenAI-compatible `/v1/chat/completions` + `/v1/models` API, for example:

- A [llama.cpp](https://github.com/ggml-org/llama.cpp) server running a GGUF model, tunneled to a public HTTPS URL (e.g. via [ngrok](https://ngrok.com))
- Any hosted OpenAI-compatible endpoint

In this project's original use case, the backend is a 27B-parameter Qwen model (GGUF, quantized) served from a Kaggle notebook's free 2×T4 GPU, exposed through an API-key-protected ngrok tunnel.

## Usage

1. Open the [live app](https://prateek13052003.github.io/qwen-web-chat/) (or open `index.html` locally — no server required).
2. Click **Connection settings**.
3. Enter your **Base URL** (ending in `/v1`) and **API key**.
4. Click **Test connection**, then **Save**.
5. Start chatting.

## Tech stack

Vanilla JavaScript · HTML/CSS · [marked.js](https://github.com/markedjs/marked) (Markdown) · [DOMPurify](https://github.com/cure53/DOMPurify) (sanitization) · Server-Sent Events · GitHub Pages

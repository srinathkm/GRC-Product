import { useState, useRef, useEffect } from 'react';

const API = '/api';

export function ChatPanel() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);
    fetch(`${API}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    })
      .then((r) => r.json())
      .then((data) => {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: data.answer,
            guarded: data.guarded === true,
          },
        ]);
      })
      .catch((e) => {
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: 'Error: ' + e.message, guarded: false },
        ]);
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        AI Assistant – Ask about regulatory changes
      </div>
      <div className="chat-messages">
        {messages.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Ask questions about DFSA, SAMA, CMA, Dubai 2040, Saudi 2030, and SDAIA. Keep questions on-topic for best results.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`message ${msg.role} ${msg.guarded ? 'guarded' : ''}`}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="message assistant">Thinking…</div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="chat-form">
        <form onSubmit={send}>
          <input
            type="text"
            placeholder="Ask about regulations or frameworks…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

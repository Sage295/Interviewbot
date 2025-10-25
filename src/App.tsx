import { useState } from "react";
import "./App.css";

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<string[]>([]);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages([...messages, `🧑 You: ${input}`, "🤖 Bot: Interesting! Tell me more."]);
    setInput("");
  };

  return (
    <div className="app">
      <h1>💬 InterviewBot</h1>
      <div className="chat-box">
        {messages.map((msg, i) => (
          <p key={i}>{msg}</p>
        ))}
      </div>

      <div className="input-area">
        <input
          type="text"
          placeholder="Type your response..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}

export default App;

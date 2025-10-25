import { useEffect } from "react";
import "./App.css";
import bgCanvas from "./bgCanvas.js";      // background dots
import heroCanvas from "./heroCanvas.js";  // hero (foreground) dots

function App() {
  useEffect(() => {
    bgCanvas();
    heroCanvas();

    // Remove blinking cursor after typing ends
    const timer = setTimeout(() => {
      const el = document.querySelector(".typing-container");
      if (el) el.classList.add("typed-done");
    }, 3600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="App">
      {/* Background and hero layers */}
      <canvas className="canvas-2"></canvas>
      <canvas className="canvas"></canvas>

      {/* Typing animation overlay */}
      <div className="typing-container">
        <h1 className="typing-text">Hi, welcome to RetroCruit.</h1>
      </div>

      {/* Main content */}
      <div className="content">
        {/* Add your buttons, sections, etc. later */}
      </div>
    </div>
  );
}

export default App;

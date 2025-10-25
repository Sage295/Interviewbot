import { useEffect } from "react";
import "./App.css";
import bgCanvas from "./bgCanvas.js";
import heroCanvas from "./heroCanvas.js";

function App() {
  useEffect(() => {
    bgCanvas();
    heroCanvas();

    const typingEl = document.querySelector(".typing-container");
    const textEl = document.querySelector(".typing-text");
    const overlayEl = document.querySelector(".black-overlay");
    const secondTypingEl = document.querySelector(".second-typing-container");
    const secondTextEl = document.querySelector(".second-typing-text");

    const timer = setTimeout(() => {
      if (typingEl) typingEl.classList.add("typed-done");
    }, 3600);

    const handleScroll = () => {
      if (!typingEl || !overlayEl || !textEl) return;
      const scrollY = window.scrollY;
      const scrollLimit = 200;

      // Move title to top-left
      if (scrollY > 20) {
        typingEl.classList.add("move-to-corner");
        textEl.textContent = "RetroCruit";
      } else {
        typingEl.classList.remove("move-to-corner");
        textEl.textContent = "Hi, welcome to RetroCruit.";
      }

      // Fade overlay
      const opacity = Math.min(scrollY / scrollLimit, 1);
      overlayEl.style.opacity = String(opacity);

      // When user scrolls past 90% of first screen -> trigger 2nd typing
      if (scrollY > window.innerHeight * 0.9 && secondTypingEl && secondTextEl) {
        if (!secondTypingEl.classList.contains("active")) {
          secondTypingEl.classList.add("active");
          startSecondTyping(secondTextEl);
        }
      }
    };

    const startSecondTyping = (el: Element) => {
      const fullText =
        "I am an interview chatbot here to help strengthen your skills, ready to get better?";
      let i = 0;
      const typingSpeed = 50;

      const type = () => {
        if (i < fullText.length) {
          el.textContent += fullText.charAt(i);
          i++;
          setTimeout(type, typingSpeed);
        } else {
          // After full sentence typed, wait 10s, then delete
          setTimeout(() => backspace(), 10000);
        }
      };

      const backspace = () => {
        const current = el.textContent || "";
        if (current.length > 0) {
          el.textContent = current.slice(0, -1);
          setTimeout(backspace, 30);
        }
      };

      type();
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div className="App">
      {/* Background layers */}
      <canvas className="canvas-2"></canvas>
      <canvas className="canvas"></canvas>

      {/* Black overlay */}
      <div className="black-overlay"></div>

      {/* Top typing */}
      <div className="typing-container">
        <h1 className="typing-text">Hi, welcome to RetroCruit.</h1>
      </div>

      {/* Second typing */}
      <div className="second-typing-container">
        <h1 className="second-typing-text"></h1>
      </div>

      {/* Content for scrolling */}
      <div className="content"></div>
    </div>
  );
}

export default App;

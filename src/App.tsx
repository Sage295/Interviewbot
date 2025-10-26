import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import "./App.css";
import bgCanvas from "./bgCanvas.js";
import heroCanvas from "./heroCanvas.js";
import HologramButton from "./components/Hologram";
import SkillB from "./pages/SkillB";
import SkillC from "./pages/SkillC";
import Conversation from "./pages/Conversation";
import MenuButton from "./components/MenuButton";
import VoiceListener from "./components/VoiceListener";   // 🎙️ Voice activation
import Mascot from "./components/Mascot";  
import RA from "./pages/RA";
import TC from "./pages/TC";           


function Home() {
  const navigate = useNavigate();

  // 🧠 State
  const [mascotVisible, setMascotVisible] = useState(false);
  const [textFaded, setTextFaded] = useState(false);

  // 🎙️ Triggered by VoiceListener when user says "start" or "hello"
  const handleVoiceTrigger = () => {
    console.log("🎤 Voice triggered mascot!");
    setTextFaded(true);
    setTimeout(() => setMascotVisible(true), 800); // drop mascot slightly after fade
  };

  useEffect(() => {
    bgCanvas();
    heroCanvas();

    const typingEl = document.querySelector(".typing-container");
    const textEl = document.querySelector(".typing-text");
    const secondTypingEl = document.querySelector(".second-typing-container");
    const secondTextEl = document.querySelector(".second-typing-text");
    const cursorEl = document.querySelector(".typing-cursor");
    const dividerEl = document.querySelector(".vertical-divider");
    const arrowEl = document.querySelector(".scroll-arrow");
    const hologramLeft = document.querySelector(".hologram-left");
    const hologramRight = document.querySelector(".hologram-right");

    setTimeout(() => arrowEl?.classList.add("visible"), 2000);

    const handleScroll = () => {
      const overlayEl = document.querySelector(".black-overlay") as HTMLElement | null;
      if (!typingEl || !overlayEl || !textEl || !secondTypingEl) return;

      const scrollY = window.scrollY;
      const scrollLimit = 200;

      // Move header to corner
      if (scrollY > 20) {
        typingEl.classList.add("move-to-corner");
        textEl.textContent = "RetroCruit";
      } else {
        typingEl.classList.remove("move-to-corner");
        textEl.textContent = "Hi, welcome to RetroCruit.";
      }

      // ✅ Fade overlay safely
      overlayEl.style.opacity = String(Math.min(scrollY / scrollLimit, 1));

      // Hide arrow when intro text leaves center
      if (arrowEl) {
        const hideArrow = scrollY > 20;
        arrowEl.classList.toggle("visible", !hideArrow);
      }

      // Trigger typing + buttons
      if (scrollY > window.innerHeight * 0.9) {
        if (!secondTypingEl.classList.contains("active")) {
          secondTypingEl.classList.add("active");
          startSecondTyping(
            secondTextEl,
            cursorEl,
            dividerEl,
            hologramLeft,
            hologramRight
          );
        }
      } else {
        // Reset when scrolling up
        secondTypingEl.classList.remove("active");
        if (secondTextEl) secondTextEl.textContent = "";
        cursorEl?.classList.remove("active");
        dividerEl?.classList.remove("visible");
        hologramLeft?.classList.remove("visible");
        hologramRight?.classList.remove("visible");
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 🧠 Typing animation for second message
  const startSecondTyping = (
    el: Element | null,
    cursor: Element | null,
    divider: Element | null,
    holoLeft: Element | null,
    holoRight: Element | null
  ) => {
    if (!el || !cursor) return;

    const fullText = "Ready to level up your interview game?";
    let i = 0;
    const typingSpeed = 40;

    cursor.classList.add("active");
    el.textContent = "";

    const type = () => {
      if (i < fullText.length) {
        el.textContent += fullText.charAt(i);
        i++;
        setTimeout(type, typingSpeed);
      } else {
        setTimeout(() => backspace(), 4000);
      }
    };

    const backspace = () => {
      const current = el.textContent || "";
      if (current.length > 0) {
        el.textContent = current.slice(0, -1);
        setTimeout(backspace, 20);
      } else {
        cursor.classList.remove("active");
        divider?.classList.add("visible");
        holoLeft?.classList.add("visible");
        holoRight?.classList.add("visible");
      }
    };

    type();
  };

  return (
    <div className={`App ${textFaded ? "fade-text" : ""}`}>
      <MenuButton />

      {/* Background layers */}
      <canvas className="canvas-2"></canvas>
      <canvas className="canvas"></canvas>

      <div className="black-overlay"></div>

      {/* Intro typing */}
      <div className="typing-container">
        <h1 className="typing-text">Hi, welcome to RetroCruit.</h1>
      </div>

      {/* Scroll hint */}
      <div className="scroll-arrow">Scroll ↓</div>

      {/* Second typing text */}
      <div className="second-typing-container">
        <h1 className="second-typing-text"></h1>
        <span className="typing-cursor"></span>
      </div>

      {/* Divider */}
      <div className="vertical-divider"></div>

      {/* Scrollable filler */}
      <div className="content"></div>

      {/* ✅ Hologram buttons */}
      <HologramButton
        side="left"
        text="Skill Builder"
        subtitle="Need a confidence boost? Practice your skills with me to learn how to be the best you for an interview."
        onClick={() => navigate("/skillbuilder")}
      />
      <HologramButton
        side="right"
        text="Skill Check"
        subtitle="Confident? Test yourself before the real deal and see if you're ready."
        onClick={() => navigate("/skillcheck")}
      />

      {/* 🎙️ Voice activation + 🤖 Mascot */}
      <VoiceListener onVoiceTrigger={handleVoiceTrigger} />
      <Mascot visible={mascotVisible} />
    </div>
  );
}

// 🧭 Router Wrapper
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/skillbuilder" element={<SkillB />} />
        <Route path="/conversation" element={<Conversation />} />
       <Route path="/ra" element={<RA />} />
       <Route path="/tc" element={<TC />} />
       <Route path="/skillcheck" element={<SkillC/>} />

      </Routes>
    </Router>
  );
}

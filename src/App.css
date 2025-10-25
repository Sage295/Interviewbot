@import url('https://fonts.googleapis.com/css2?family=Michroma&display=swap');


body {
  margin: 0;
  background-color: black; /* background behind everything */
  color: white;
  overflow-y: auto;
}

.App {
  position: relative;
  overflow: visible;
  text-align: center;
  height: 100vh;
}

/* ✅ Keep particles visible */
.canvas-2 {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  z-index: 0; /* was -2 */
  opacity: 0.4;
}

.canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  z-index: 1; /* was -1 */
  opacity: 0.8;
}

/* ✅ Page content */
.content {
  position: relative;
  z-index: 2;
  color: white;
  background: transparent;
  height: 200vh; 
}
.content::after {
  content: "Scroll ↓";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2rem;
  opacity: 0.5;
}
.typing-container {
  position: fixed;
  top: 25%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  font-family: "Michroma", sans-serif;
  font-size: 1.2rem; 
  color: #BD0927;
  white-space: nowrap;
  overflow: hidden;
  border-right: 2px solid #BD0927; /* thinner cursor */
  width: 0;
  animation: typing 3.5s steps(30, end) forwards, blink 0.75s step-end infinite;
}

/* Keyframes for typing */
@keyframes typing {
  from {
    width: 0;
  }
  to {
    width:55ch; 
  }
}


@keyframes blink {
  50% {
    border-color: transparent;
  }
}

/* When scrolled — move to top-left corner */
.move-to-corner {
  position: fixed;
  top: 1.5rem;
  left: 2rem;
  transform: none;
  background: transparent;
  border: none;
  font-size: 1rem;
  color: white;
  transition: all 0.8s ease-in-out;
  width: auto !important;
  animation: none; /* stop typing animation */
  border-right: none; /* remove cursor */
}

/* Smooth fade controlled dynamically from JS */
.black-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: black;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.5s ease;
  z-index: 1.5;
}

.black-overlay.visible {
  opacity: 1; /* fully black */
}

.second-typing-container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9999;
  font-family: "Michroma", sans-serif;
  font-size: 0.5rem;
  color: #bd0927;
  white-space: nowrap;
  overflow: hidden;
  opacity: 0;
  transition: opacity 1s ease-in-out;
}

.second-typing-container.active {
  opacity: 1;
}

.second-typing-text {
  border-right: 2px solid #bd0927;
  animation: blink 0.75s step-end infinite;
}



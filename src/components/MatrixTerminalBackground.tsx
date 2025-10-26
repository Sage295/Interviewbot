import React, { useEffect, useState } from "react";
import { fakeCommands } from "../data/fakeCommands";
import "./MatrixTerminalBackground.css";

interface Line {
  id: number;
  text: string;
  displayedText: string;
  isComplete: boolean;
}

const MatrixBackground: React.FC = () => {
  const [lines, setLines] = useState<Line[]>([]);

  // Add new lines periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setLines(prev => {
        const command = fakeCommands[Math.floor(Math.random() * fakeCommands.length)];
        const newLine: Line = {
          id: Date.now(),
          text: `C:\\> ${command}`,
          displayedText: "",
          isComplete: false
        };
        const updated = [...prev, newLine];
        return updated.slice(-30); // limit number of lines
      });
    }, 2000); // New line every 2 seconds

    return () => clearInterval(interval);
  }, []);

  // Typing effect for each line
  useEffect(() => {
    const typingInterval = setInterval(() => {
      setLines(prev =>
        prev.map(line => {
          if (line.isComplete) return line;
          
          if (line.displayedText.length < line.text.length) {
            return {
              ...line,
              displayedText: line.text.slice(0, line.displayedText.length + 1)
            };
          } else {
            return {
              ...line,
              isComplete: true
            };
          }
        })
      );
    }, 30); // Type speed: 30ms per character

    return () => clearInterval(typingInterval);
  }, []);

  return (
    <div className="matrix-bg">
      {lines.map(line => (
        <div key={line.id} className="matrix-line">
          {line.displayedText}
          {!line.isComplete && <span className="cursor">_</span>}
        </div>
      ))}
    </div>
  );
};

export default MatrixBackground;
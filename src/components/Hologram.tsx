import React from "react";
import "./Hologram.css";

interface Props {
  side: "left" | "right";
  text: string;
  subtitle?: string; 
  onClick?: () => void; 
}

const Hologram: React.FC<Props> = ({ side, text, subtitle, onClick }) => {
  return (
    <div className={`hologram-wrapper hologram-${side}`}>
      
      <button className="btn hologram" data-text={text} onClick={onClick}>
        <span data-text={text}>{text}</span>
        <div className="scan-line"></div>
      </button>

      {subtitle && <p className="hologram-subtitle">{subtitle}</p>}
    </div>
  );
};

export default Hologram;

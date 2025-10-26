import React from "react";
import "./Mascot.css";

interface MascotProps {
  visible: boolean;
}

const Mascot: React.FC<MascotProps> = ({ visible }) => {
  return (
    <div className={`mascot ${visible ? "visible" : ""}`}>
      <img src="/assets/mascot.png" alt="RetroCruit Mascot" className="mascot-img" />
      <div className="mascot-bubble">
        <p>Hey there, ready for your interview?</p>
      </div>
    </div>
  );
};

export default Mascot;

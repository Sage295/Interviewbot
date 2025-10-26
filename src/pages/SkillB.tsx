import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // ✅ Add this
import "./SkillB.css";
import PageTitle from "../components/PageTitle";

const SkillB: React.FC = () => {
  const [moveToCorner, setMoveToCorner] = useState(false);
  const navigate = useNavigate(); // ✅ Add this

  useEffect(() => {
    const timer = setTimeout(() => setMoveToCorner(true), 1300);
    return () => clearTimeout(timer);
  }, []);

  // --- Navigation Handlers ---
  const handleConversationClick = () => {
    navigate("/conversation"); 
  };

 const handleResumeClick = () => {
  navigate("/ra");
};

 const handleTechnicalClick = () => {
  navigate("/tc");
};
const handleRetroClick = () => {
  navigate("/"); 
};



  return (
    <div className="skillb-page">
      {/* --- Animated Header --- */}
      <div className={`skillb-header ${moveToCorner ? "move-to-corner" : ""}`}>
        <h1 className="skillb-title">Skill Builder</h1>
      {moveToCorner && (
  <span className="retrocruit-mini" onClick={handleRetroClick}>
    RetroCruit
  </span>
)}

      </div>

      {/* --- Holographic Sidebar (Right) --- */}
      <div className="holo-sidebar right">
        <ul>
          <li onClick={handleConversationClick}>Conversation</li>
          <li onClick={handleResumeClick}>Resume Analyzer</li>
          <li onClick={handleTechnicalClick}>Technical Challenge</li>
        </ul>
      </div>

      {/* --- Page Content --- */}
      <div className="skillb-content">
        <PageTitle title="" subtitle="Train your abilities" />

        <p>
          Welcome to the Skill Builder page! Practice your skills and visualize your progress.
          Choose an option from the holographic panel.
        </p>
      </div>
    </div>
  );
};

export default SkillB;

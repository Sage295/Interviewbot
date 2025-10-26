import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // ✅ Add this
import "./SkillC.css";
import PageTitle from "../components/PageTitle";

const SkillC: React.FC = () => {
  const [moveToCorner, setMoveToCorner] = useState(false);
  const navigate = useNavigate(); // ✅ Navigation hook

  useEffect(() => {
    const timer = setTimeout(() => setMoveToCorner(true), 1300);
    return () => clearTimeout(timer);
  }, []);

  // --- Go back to main page ---
  const handleRetroClick = () => {
    navigate("/");
  };

  return (
    <div className="skillc-page">
      {/* --- Animated Header --- */}
      <div className={`skillc-header ${moveToCorner ? "move-to-corner" : ""}`}>
        <h1 className="skillc-title">Skill Checker</h1>
        {moveToCorner && (
          <span className="retrocruit-mini" onClick={handleRetroClick}>
            RetroCruit
          </span>
        )}
      </div>

      {/* --- Page Content --- */}
      <div className="skillc-content">
        <PageTitle title="" subtitle="Test your progress" />

        <p>
          Welcome to the Skill Checker page! Evaluate your knowledge through real-time
          challenges, analyze your performance, and see how you would do on the mock real deal.
        </p>
      </div>
    </div>
  );
};

export default SkillC;

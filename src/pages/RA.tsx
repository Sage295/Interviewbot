import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Conversation.css"; // ✅ reuse same CSS for consistent style

const ResumeAnalyzer: React.FC = () => {
  const firstText = " Welcome to Resume Analyzer";
  const secondText =
    "  Upload your resume to receive personalized insights, detailed analysis, and tailored advice to strengthen your professional profile.";

  const [mainText, setMainText] = useState("");
  const [subText, setSubText] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [showNext, setShowNext] = useState(false);
  const [showRetro, setShowRetro] = useState(false);

  const navigate = useNavigate();

  // --- Navigate back to SkillBuilder ---
  const goToSkillBuilder = () => {
    navigate("/skillbuilder"); // ✅ matches your <Route path="/skillbuilder" ...>
  };

  // --- Typing animation logic ---
  useEffect(() => {
    let index = 0;
    const textToType = step === 1 ? firstText : secondText;

    if (step === 1) {
      setMainText("");
      setShowRetro(true); // show RetroCruit when typing begins
    } else {
      setSubText("");
    }

    setShowNext(false);

    const typeChar = () => {
      if (index < textToType.length) {
        if (step === 1) {
          setMainText((prev) => prev + textToType.charAt(index));
        } else {
          setSubText((prev) => prev + textToType.charAt(index));
        }
        index++;
        setTimeout(typeChar, 60);
      } else {
        if (step === 1) setShowNext(true);
      }
    };

    const startTimer = setTimeout(typeChar, 200);
    return () => clearTimeout(startTimer);
  }, [step]);

  // --- Handle "Next →" click ---
  const handleNext = () => {
    setShowNext(false);
    setStep(2);
  };

  return (
    <>
      {/* --- RetroCruit clickable label --- */}
      {showRetro && (
        <span className="retrocruit-top" onClick={goToSkillBuilder}>
          RetroCruit
        </span>
      )}

      {/* --- Centered typing area --- */}
      <div className="conversation-page">
        <div className="conversation-center">
          <h1 className="typing-title">{mainText}</h1>

          {step === 2 && <p className="typing-subtext">{subText}</p>}

          {showNext && (
            <button className="next-btn" onClick={handleNext}>
              Next →
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default ResumeAnalyzer;

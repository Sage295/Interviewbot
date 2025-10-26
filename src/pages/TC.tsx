import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Conversation.css"; // ✅ reuse same styles

const TC: React.FC = () => {
  const firstText = " Welcome to Technical Challenge";
  const secondText =
    "  Test and enhance your coding abilities through real-world problems and logic puzzles crafted to push your limits.";

  const [mainText, setMainText] = useState("");
  const [subText, setSubText] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [showNext, setShowNext] = useState(false);
  const [showRetro, setShowRetro] = useState(false);

  const navigate = useNavigate();

  // --- Navigate back to SkillBuilder ---
  const goToSkillBuilder = () => {
    navigate("/skillbuilder");
  };

  // --- Typing animation logic ---
  useEffect(() => {
    let index = 0;
    const textToType = step === 1 ? firstText : secondText;

    if (step === 1) {
      setMainText("");
      setShowRetro(true);
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

export default TC;

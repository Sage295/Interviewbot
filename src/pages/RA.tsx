import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./RA.css"; 

const ResumeAnalyzer: React.FC = () => {
  const firstText = " Welcome to Resume Analyzer";
  const secondText =
    "  Upload your resume to receive personalized insights, detailed analysis, and tailored advice to strengthen your professional profile.";

  const [mainText, setMainText] = useState("");
  const [subText, setSubText] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [showNext, setShowNext] = useState(false);
  const [showRetro, setShowRetro] = useState(false);
  const [showUploadBox, setShowUploadBox] = useState(false);

  const navigate = useNavigate();

  const goToSkillBuilder = () => navigate("/skillbuilder");

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
        if (step === 1) {
          setShowNext(true);
        } else {
          // ✅ Once second text finishes, show upload box after slight delay
          setTimeout(() => setShowUploadBox(true), 500);
        }
      }
    };

    const startTimer = setTimeout(typeChar, 200);
    return () => clearTimeout(startTimer);
  }, [step]);

  const handleNext = () => {
    setShowNext(false);
    setStep(2);
  };

  return (
    <>
      {showRetro && (
        <span className="retrocruit-top" onClick={goToSkillBuilder}>
          RetroCruit
        </span>
      )}

      <div className="conversation-page">
        <div className="conversation-center">
          <h1 className="typing-title">{mainText}</h1>

          {step === 2 && <p className="typing-subtext">{subText}</p>}

          {showNext && (
            <button className="next-btn" onClick={handleNext}>
              Next →
            </button>
          )}
          {showUploadBox && (
            <div className="upload-box fade-in">
              <p>Drag & drop your resume here or click to upload</p>
              <input type="file" accept=".pdf,.doc,.docx" />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ResumeAnalyzer;

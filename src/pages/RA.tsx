import React from "react";
import "./About.css";

const techLinks = [
  {
    name: "React",
    url: "https://react.dev",
    logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg",
  },
  {
    name: "TypeScript",
    url: "https://www.typescriptlang.org/",
    logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg",
  },
  {
    name: "CSS",
    url: "https://developer.mozilla.org/en-US/docs/Web/CSS",
    logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg",
  },
  {
    name: "Vite",
    url: "https://vitejs.dev/",
    logo: "https://vitejs.dev/logo.svg",
  },
];

const About: React.FC = () => {
  return (
    <div className="about-page">
      <div className="about-container">
        <h1 className="about-title">About This Project</h1>
        <p className="about-intro">
          We designed <span className="highlight">RetroCruit</span> to empower students to practice, grow, and walk into every interview feeling ready to win.
        </p>

        <p className="about-body">
        For tech students who’ve struggled to find the best interview tips, boost confidence, and figure out how to actually shine when it matters most.
        Our goal? To make an interview prep bot where you can practice, learn, and grow into your best professional self, all in one interactive space.
        </p>

        <h2 className="about-subtitle"> Technologies Used</h2>

        <ul className="tech-buttons">
          {techLinks.map((tech) => (
            <li key={tech.name}>
              {[...Array(5)].map((_, i) => (
                <span
                  key={i}
                  onClick={() => window.open(tech.url, "_blank")}
                  style={{ cursor: "pointer" }}
                >
                  <img
                    src={tech.logo}
                    alt={tech.name}
                    className="tech-logo"
                    draggable="false"
                  />
                </span>
              ))}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default About;

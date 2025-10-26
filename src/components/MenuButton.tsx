import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBarsStaggered, faXmark } from "@fortawesome/free-solid-svg-icons";
import "./MenuButton.css";

const MenuButton: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Menu icon button */}
      <button
        className="menu-button"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        <FontAwesomeIcon
          icon={open ? faXmark : faBarsStaggered}
          className="menu-icon"
        />
      </button>

      {/* Sliding Holographic Menu */}
      <div className={`holo-menu ${open ? "open" : ""}`}>
        <ul>
          
          <li><a href="/skillbuilder"> Skill Builder</a></li>
          <li><a href="/skillcheck"> Skill Check</a></li>
          <li><a href="/About"> About</a></li>
        </ul>
      </div>
    </>
  );
};

export default MenuButton;

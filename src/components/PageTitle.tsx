import React from "react";

interface PageTitleProps {
  title: string;
  subtitle?: string;
}

const PageTitle: React.FC<PageTitleProps> = ({ title, subtitle }) => (
  <div style={{ marginTop: "15vh", textAlign: "center" }}>
    <h1 style={{ color: "#fff", fontSize: "2.5rem", marginBottom: "0.5rem" }}>
      {title}
    </h1>
    {subtitle && (
      <p style={{ color: "#aaa", fontSize: "1.1rem" }}>{subtitle}</p>
    )}
  </div>
);

export default PageTitle;

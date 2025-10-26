import React, { useState, useCallback } from 'react';
import { AppView } from './types';
import ConversationCoach from './Components/ConversationCoach';
import ResumeAnalyzer from './Components/ResumeAnalyzer';
import Technical from './Components/Technical';
import MockInterview from './Components/MockInterview';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.COACH);

  const NavButton: React.FC<{
    view: AppView;
    label: string;
  }> = ({ view, label }) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        currentView === view
          ? 'bg-brand-secondary text-white'
          : 'text-gray-600 dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-card'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text font-sans">
      <div className="container mx-auto p-4 max-w-6xl">
        <header className="text-center my-6">
          <h1 className="text-4xl md:text-5xl font-bold text-brand-primary dark:text-brand-secondary">
            AI Career Coach
          </h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            Hone your interview skills and perfect your resume.
          </p>
        </header>

        <nav className="flex justify-center my-8 p-2 bg-white dark:bg-dark-card rounded-lg shadow-md space-x-2">
          <NavButton view={AppView.COACH} label="Conversation Coach" />
          <NavButton view={AppView.RESUME} label="Resume Analyzer" />
          <NavButton view={AppView.TECHNICAL} label="Technical Challenge" />
          <NavButton view={AppView.MOCK} label="Mock Interview" />
        </nav>

        <main>
          {currentView === AppView.COACH && <ConversationCoach />}
          {currentView === AppView.RESUME && <ResumeAnalyzer />}
          {currentView === AppView.TECHNICAL && <Technical />}
          {currentView === AppView.MOCK && <MockInterview />}
        </main>
      </div>
    </div>
  );
};

export default App;

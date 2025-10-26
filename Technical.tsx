import React, { useState, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { MarkdownReport } from './ResumeAnalyzer'; // Using MarkdownReport from ResumeAnalyzer

const LoadingSpinner: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex justify-center items-center space-x-2">
        <div className="w-4 h-4 border-2 border-brand-secondary rounded-full animate-spin border-t-transparent"></div>
        <span className="text-gray-600 dark:text-gray-300">{text}</span>
    </div>
);

// New exported function for rendering markdown content to a jsPDF document.
// This is now the canonical renderMarkdownToPdf for the entire application.
export const renderMarkdownToPdf = (
  doc: any,
  text: string,
  initialY: number
): number => {
    let y = initialY;
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Strip emojis from the entire text before processing
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}]/gu;
    const cleanedText = text.replace(emojiRegex, '');


    const addTextInternal = (
        lineText: string,
        options: {
            fontSize?: number;
            fontStyle?: 'normal' | 'bold' | 'italic';
            xOffset?: number;
            spacing?: number;
            isCode?: boolean; // Added for code blocks
        } = {}
    ) => {
        const {
            fontSize = 10,
            fontStyle = 'normal',
            xOffset = 0,
            spacing = 4,
            isCode = false,
        } = options;

        doc.setFont(isCode ? 'courier' : 'helvetica', fontStyle as string); // Use courier for code
        doc.setFontSize(fontSize);

        const textLines = doc.splitTextToSize(
            lineText,
            pageWidth - margin * 2 - xOffset
        );
        const textHeight = doc.getTextDimensions(textLines).h;

        if (y > margin && y + textHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
        
        doc.text(textLines, margin + xOffset, y);
        y += textHeight + spacing;
        return y; // Return the updated Y position
    };
    
    const lines = cleanedText.split('\n');
    const cleanMarkdown = (str: string) => str.replace(/\*\*/g, '');

    let inCodeBlock = false;
    lines.forEach(line => {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            y += 2; // Add a small vertical gap for code block delineation
            return;
        }

        if (inCodeBlock) {
            y = addTextInternal(line, { fontSize: 9, fontStyle: 'normal', isCode: true, xOffset: 5, spacing: 3 });
            return;
        }

        // Skip horizontal rules which can appear as '***' or '---'
        if (/^(\*|-|_){3,}$/.test(trimmedLine)) {
            y += 2; // Just add a small vertical gap and skip the line
            return;
        }

        if (trimmedLine.startsWith('### ')) {
            y += 2; // Add a bit of space before headers
            y = addTextInternal(cleanMarkdown(trimmedLine.substring(4)), { fontSize: 13, fontStyle: 'bold', spacing: 6 });
        } else if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
            const itemText = `•  ${cleanMarkdown(trimmedLine.substring(2))}`;
            y = addTextInternal(itemText, { xOffset: 5 });
        } else if (/^\s*\d+\.\s/.test(trimmedLine)) {
            // Match ordered lists like "1. ", " 2. ", etc.
            const itemText = `   ${cleanMarkdown(trimmedLine)}`;
            y = addTextInternal(itemText, { xOffset: 5 });
        } else if (trimmedLine === '') {
            y += 4; // Treat empty lines as paragraph breaks
        }
        else {
            // Regular paragraph text, clean any bolding. Use original line to preserve indentation.
            y = addTextInternal(cleanMarkdown(line), {}); 
        }
    });
    return y;
};

const Technical: React.FC = () => {
    const [question, setQuestion] = useState<string>('');
    const [code, setCode] = useState<string>('');
    const [language, setLanguage] = useState<string>('javascript');
    const [output, setOutput] = useState<string>('');
    const [isLoadingQuestion, setIsLoadingQuestion] = useState<boolean>(false);
    const [isLoadingCode, setIsLoadingCode] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    const handleFetchQuestion = useCallback(async () => {
        setError('');
        setQuestion('');
        setOutput('');
        setCode('');
        setIsLoadingQuestion(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = "Generate a medium-difficulty LeetCode-style programming challenge. Provide a clear problem description, one or two illustrative examples with inputs and outputs, and the constraints for the problem. Format the output in Markdown.";
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
            });
            
            setQuestion(response.text);
        } catch (err) {
            console.error("Error fetching question:", err);
            setError("Failed to fetch a new question. Please try again.");
        } finally {
            setIsLoadingQuestion(false);
        }
    }, []);

    const handleRunCode = useCallback(async () => {
        if (!code || !question) {
            setError('Please fetch a question and write some code before running.');
            return;
        }
        setError('');
        setOutput('');
        setIsLoadingCode(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `
            You are a senior software engineer conducting a technical interview.
            A candidate has submitted the following code in ${language} for the given problem.

            Your task is to evaluate the solution and provide constructive feedback. Structure your feedback in Markdown as follows:

            ### Code Correctness
            - Does the code solve the problem correctly? Does it handle edge cases? Point out any logical errors.

            ### Efficiency & Complexity
            - Analyze the time and space complexity of the solution. Is it optimal? Can it be improved?

            ### Code Style & Readability
            - Comment on the code's style, clarity, and use of best practices for ${language}. Suggest improvements for readability.

            ### Overall Feedback
            - Provide a summary of your evaluation and suggest a direction for the candidate to improve their solution.

            ---
            **Problem:**
            ${question}

            ---
            **Candidate's Code (${language}):**
            \`\`\`${language}
            ${code}
            \`\`\`
            ---
            `;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
            });
            
            setOutput(response.text);

        } catch (err) {
            console.error("Error running code analysis:", err);
            setError("Failed to analyze the code. Please try again.");
        } finally {
            setIsLoadingCode(false);
        }
    }, [code, question, language]);
    
    const handleDownloadReport = useCallback(() => {
        const { jsPDF } = (window as any).jspdf;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        let y = margin;

        const addText = (text: string, options: { 
            fontSize?: number, 
            fontStyle?: 'normal' | 'bold' | 'italic', 
            align?: 'left' | 'center',
            isCode?: boolean,
            spacing?: number
        } = {}) => {
            if (!text.trim()) return;
    
            const { 
                fontSize = 12, 
                fontStyle = 'normal', 
                align = 'left',
                isCode = false,
                spacing = 5
            } = options;
    
            doc.setFont(isCode ? 'courier' : 'helvetica', fontStyle as string);
            doc.setFontSize(fontSize);
    
            const textLines = doc.splitTextToSize(text, pageWidth - margin * 2);
            const textHeight = doc.getTextDimensions(textLines).h;
            
            if (y > margin && y + textHeight > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }
            
            let x = margin;
            if (align === 'center') {
                x = pageWidth / 2;
            }
    
            doc.text(textLines, x, y, { align: align === 'center' ? 'center' : undefined });
            y += textHeight + spacing;
            return y;
        };

        y = addText("Technical Challenge Report", { fontSize: 18, fontStyle: 'bold', align: 'center', spacing: 10 });

        y = addText("Problem", { fontSize: 14, fontStyle: 'bold', spacing: 8 });
        y = renderMarkdownToPdf(doc, question, y); // Using the exported renderMarkdownToPdf
        y += 5;
        
        y = addText("Your Solution", { fontSize: 14, fontStyle: 'bold', spacing: 8 });
        y = addText(code, { isCode: true, fontSize: 10 });
        y += 5;
        
        y = addText("AI Feedback", { fontSize: 14, fontStyle: 'bold', spacing: 8 });
        renderMarkdownToPdf(doc, output, y); // Using the exported renderMarkdownToPdf

        doc.save("technical-challenge-report.pdf");
    }, [question, code, output]);

    return (
        <div className="bg-white dark:bg-dark-card p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Technical Challenge</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Question & Controls */}
                <div className="space-y-4">
                    <button
                        onClick={handleFetchQuestion}
                        disabled={isLoadingQuestion}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                    >
                        {isLoadingQuestion ? <LoadingSpinner text="Generating..." /> : 'Get New Question'}
                    </button>
                    <div className="p-4 h-[35rem] overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
                        {question ? (
                             <MarkdownReport text={question} />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                {isLoadingQuestion ? <LoadingSpinner text="Generating..." /> : "Click 'Get New Question' to start."}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Code Editor & Output */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label htmlFor="language-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                           Language:
                        </label>
                        <select
                            id="language-select"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="block w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary sm:text-sm rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                        >
                            <option value="javascript">JavaScript</option>
                            <option value="python">Python</option>
                            <option value="java">Java</option>
                            <option value="c">C</option>
                            <option value="cpp">C++</option>
                        </select>
                    </div>
                     <textarea
                        rows={15}
                        className="shadow-sm block w-full sm:text-sm border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-brand-secondary focus:border-brand-secondary font-mono"
                        placeholder={`// Write your ${language} code here...`}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                     />
                    <button
                        onClick={handleRunCode}
                        disabled={isLoadingCode || !question || !code}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-secondary hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
                    >
                        {isLoadingCode ? <LoadingSpinner text="Evaluating..." /> : 'Run Code & Get Feedback'}
                    </button>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          AI Feedback
                        </label>
                        <button 
                          onClick={handleDownloadReport}
                          disabled={!output || isLoadingCode}
                          className="px-4 py-1 text-sm bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            Download Report
                        </button>
                    </div>
                    <div className="p-4 h-64 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
                         {output ? (
                            <MarkdownReport text={output} />
                        ) : (
                             <div className="flex items-center justify-center h-full text-gray-500">
                                {isLoadingCode ? <LoadingSpinner text="Evaluating..." /> : "Your feedback will appear here."}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Technical;
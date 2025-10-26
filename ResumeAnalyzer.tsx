import React, { useState, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';

const LoadingSpinner: React.FC<{ text?: string }> = ({ text = "Analyzing..." }) => (
    <div className="flex justify-center items-center space-x-2">
        <div className="w-4 h-4 border-2 border-brand-secondary rounded-full animate-spin border-t-transparent"></div>
        <span className="text-gray-600 dark:text-gray-300">{text}</span>
    </div>
);

// Renders markdown-style text with bold headers and clean lists.
export const MarkdownReport: React.FC<{ text: string }> = ({ text }) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];
    let listType: 'ul' | 'ol' | null = null;
    let paragraphLines: string[] = [];

    const cleanText = (str: string) => str.replace(/\*/g, '');

    const flushParagraph = () => {
        if (paragraphLines.length > 0) {
            elements.push(
                <p key={`p-${elements.length}`} className="my-2 whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {paragraphLines.join('\n')}
                </p>
            );
            paragraphLines = [];
        }
    };

    const flushList = () => {
        if (listItems.length > 0 && listType) {
            const listKey = `list-${elements.length}`;
            const ListComponent = listType; // 'ul' or 'ol'
            const listStyle = listType === 'ul' ? "list-disc" : "list-decimal";

            elements.push(
                <ListComponent key={listKey} className={`${listStyle} pl-6 space-y-2 my-2`}>
                    {listItems.map((item, j) => <li key={j}>{item}</li>)}
                </ListComponent>
            );
            listItems = [];
            listType = null;
        }
    };

    const flushAll = () => {
        flushParagraph();
        flushList();
    };

    lines.forEach((line) => {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('### ')) {
            flushAll();
            elements.push(
                <h3 key={`h3-${elements.length}`} className="text-lg font-bold mt-4 mb-2 text-gray-800 dark:text-white">
                    {trimmedLine.substring(4)}
                </h3>
            );
        } else if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
            flushParagraph();
            if (listType !== 'ul') {
                flushList();
                listType = 'ul';
            }
            listItems.push(cleanText(trimmedLine.substring(2)));
        } else if (/^\s*\d+\.\s/.test(trimmedLine)) {
            flushParagraph();
             if (listType !== 'ol') {
                flushList();
                listType = 'ol';
            }
            listItems.push(cleanText(trimmedLine.replace(/^\d+\.\s*/, '')));
        } else if (trimmedLine === '') {
            flushAll();
        } else {
            flushList();
            paragraphLines.push(cleanText(line));
        }
    });

    flushAll(); // Flush any remaining content

    return (
        <div className="font-sans text-sm text-gray-700 dark:text-gray-300">
            {elements}
        </div>
    );
};

// New exported function for rendering markdown content to a jsPDF document.
// This function is now centralized in Technical.tsx to handle code blocks correctly.
// export const renderMarkdownToPdf is removed from here.


const ResumeAnalyzer: React.FC = () => {
  const [resumeText, setResumeText] = useState<string>('');
  const [jobDescription, setJobDescription] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parsingMessage, setParsingMessage] = useState<string>('Parsing resume...');
  const [error, setError] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file.');
      setResumeText('');
      setFileName('');
      return;
    }

    const pdfjsLib = (globalThis as any).pdfjsLib;
    if (!pdfjsLib) {
      setError('PDF library failed to load. Please refresh the page.');
      console.error('pdf.js library not found on window object.');
      return;
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.js`;

    setError('');
    setIsParsing(true);
    setParsingMessage('Parsing resume...');
    setFileName(file.name);
    setResumeText('');
    setAnalysisResult('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (!e.target?.result) {
            throw new Error("File could not be read.");
        }
        const typedArray = new Uint8Array(e.target.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        let textContent = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const text = await page.getTextContent();
          textContent += text.items.map(item => 'str' in item ? item.str : '').join(' ') + '\n';
        }
        
        const extractedText = textContent.trim();
        
        // If not enough text is extracted, assume it's a scanned/image-based PDF and try OCR
        if (extractedText.length < 100) {
          setParsingMessage('Scanned document detected. Performing OCR...');
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const imageParts = [];
          
          const numPagesToOcr = Math.min(pdf.numPages, 3); // Limit OCR to first 3 pages

          for (let i = 1; i <= numPagesToOcr; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            if (context) {
              await page.render({ canvasContext: context, viewport: viewport }).promise;
              const base64ImageData = canvas.toDataURL('image/jpeg').split(',')[1];
              imageParts.push({
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64ImageData,
                },
              });
            }
          }

          if (imageParts.length > 0) {
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: {
                parts: [
                  { text: "You are an expert Optical Character Recognition (OCR) service. Extract all text from the following resume image(s). Combine the text from all pages into a single, coherent block of text exactly as it appears." },
                  ...imageParts,
                ],
              },
            });
            const ocrText = response.text.trim();
            if (ocrText) {
              setResumeText(ocrText);
            } else {
              setError('OCR failed to extract text from the PDF. The document might be blank or unreadable.');
              setFileName('');
              setResumeText('');
            }
          } else {
             setError('Could not extract text from the PDF. It appears to be an image, but we failed to process it.');
             setFileName('');
             setResumeText('');
          }
        } else {
          setResumeText(extractedText);
        }

      } catch (err) {
        console.error('Error parsing PDF:', err);
        setError('Failed to read the PDF file. It might be corrupted or protected.');
        setFileName('');
        setResumeText('');
      } finally {
        setIsParsing(false);
      }
    };
    reader.onerror = () => {
        setError("An error occurred while reading the file.");
        setIsParsing(false);
        setFileName('');
        setResumeText('');
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!resumeText || !jobDescription) {
      setError('Please upload a resume and provide a job description.');
      return;
    }
    setError('');
    setIsAnalyzing(true);
    setAnalysisResult('');

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const prompt = `
        Analyze the following resume and determine its suitability for the provided job description. 
        Provide a detailed analysis in Markdown format.

        Structure your response as follows:
        ### Overall Suitability Score
        - Provide a score from 1 to 10 and a brief justification.

        ### Strengths
        - List the key qualifications, skills, and experiences from the resume that directly match the job description.

        ### Weaknesses & Gaps
        - Identify areas where the resume is weak or missing requirements mentioned in the job description.

        ### Tone & Professionalism Analysis
        - Review the resume's language. Identify any sections that may be considered unprofessional or could be phrased better. Suggest alternative phrasing to maintain a formal and appropriate tone.

        ### Suggestions for Improvement
        - Offer specific, actionable advice on how to tailor the resume for this role. Suggest keywords to add, projects to highlight, or formatting changes.

        ---
        **Resume Text:**
        ${resumeText}

        ---
        **Job Description:**
        ${jobDescription}
        ---
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        setAnalysisResult(response.text);
    } catch (err) {
      console.error('Error with Gemini API:', err);
      setError('An error occurred while analyzing. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [resumeText, jobDescription]);

  const handleDownloadReport = useCallback(() => {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = margin;

    const addSimpleText = (text: string, options: { 
        fontSize?: number, 
        fontStyle?: 'normal' | 'bold', 
        align?: 'left' | 'center',
        spacing?: number
    } = {}) => {
        if (!text.trim()) return;
        const pageHeight = doc.internal.pageSize.getHeight();
        const { fontSize = 12, fontStyle = 'normal', align = 'left', spacing = 5 } = options;
        doc.setFont('helvetica', fontStyle as string);
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

        doc.text(textLines, x, y, { align: align === 'center' ? align : undefined });
        y += textHeight + spacing;
        return y;
    };
    
    addSimpleText("Resume Analysis Report", { fontSize: 18, fontStyle: 'bold', align: 'center', spacing: 10 });

    addSimpleText("Job Description", { fontSize: 14, fontStyle: 'bold', spacing: 8 });
    jobDescription.split('\n').forEach(p => addSimpleText(p.trim(), {fontSize: 10, spacing: 4}));
    y += 5;
    
    addSimpleText("AI Analysis", { fontSize: 14, fontStyle: 'bold', spacing: 8 });
    
    // Using the renderMarkdownToPdf from Technical.tsx for consistency
    const { renderMarkdownToPdf: technicalRenderMarkdownToPdf } = require('./Technical');
    technicalRenderMarkdownToPdf(doc, analysisResult, y);

    doc.save("resume-analysis-report.pdf");
  }, [jobDescription, analysisResult]);

  return (
    <div className="bg-white dark:bg-dark-card p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Resume Analyzer</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Inputs */}
        <div className="space-y-6">
          <div>
            <label htmlFor="resume-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              1. Upload Your Resume (PDF)
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                {isParsing ? (
                  <LoadingSpinner text={parsingMessage} />
                ) : (
                  <>
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="flex text-sm text-gray-600 dark:text-gray-400">
                      <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-dark-card rounded-md font-medium text-brand-secondary hover:text-blue-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-brand-secondary">
                        <span>Upload a file</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".pdf" onChange={handleFileChange} disabled={isParsing} />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">PDF up to 10MB</p>
                    {fileName && resumeText && !error && (
                        <p className="text-sm mt-2 text-green-600 dark:text-green-400">{fileName} uploaded successfully.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <div>
            <label htmlFor="job-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              2. Paste Job Description
            </label>
            <textarea
              id="job-description"
              rows={10}
              className="mt-2 shadow-sm block w-full sm:text-sm border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-brand-secondary focus:border-brand-secondary"
              placeholder="Paste the full job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || isParsing || !resumeText || !jobDescription}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-secondary hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
          >
            {isAnalyzing ? <LoadingSpinner text="Analyzing..." /> : 'Analyze Resume'}
          </button>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>

        {/* Right Column: Output */}
        <div>
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              3. AI Analysis
            </label>
            <button 
              onClick={handleDownloadReport}
              disabled={!analysisResult || isAnalyzing || isParsing}
              className="px-4 py-1 text-sm bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
                Download Report
            </button>
          </div>
          <div className="mt-2 p-4 h-[35rem] overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
            {isAnalyzing ? (
                 <div className="flex items-center justify-center h-full text-gray-500">
                    <LoadingSpinner text="Analyzing..." />
                </div>
            ) : analysisResult ? (
              <MarkdownReport text={analysisResult} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Your analysis will appear here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumeAnalyzer;
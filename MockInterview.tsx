import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAIBlob } from '@google/genai';
import { Author, TranscriptionEntry } from '../types';
import { MarkdownReport } from './ResumeAnalyzer'; // Use MarkdownReport from ResumeAnalyzer
import { renderMarkdownToPdf } from './Technical'; // Use renderMarkdownToPdf from Technical as it handles code blocks for PDF

// Enums
enum InterviewState {
    SETUP = 'setup',
    CONVERSATIONAL = 'conversational',
    TECHNICAL_GENERATING = 'technical_generating',
    TECHNICAL_SOLVING = 'technical_solving',
    REPORT_GENERATING = 'report_generating',
    COMPLETE = 'complete'
}
type FeedbackTiming = 'INSTANT' | 'FINAL';

// Audio Helpers
const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64); const len = binaryString.length; const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); } return bytes;
};
const encode = (bytes: Uint8Array): string => {
  let binary = ''; const len = bytes.byteLength; for (let i = 0; i < len; i++) { binary += String.fromCharCode(bytes[i]); } return btoa(binary);
};
const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer); const frameCount = dataInt16.length / numChannels; const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) { channelData[i] = dataInt16[i * numChannels + channel] / 32768.0; }
  } return buffer;
};
const createBlob = (data: Float32Array): GenAIBlob => {
  const l = data.length; const int16 = new Int16Array(l); for (let i = 0; i < l; i++) { int16[i] = data[i] * 32768; }
  return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
};

// Component
const LoadingSpinner: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex justify-center items-center space-x-2">
        <div className="w-4 h-4 border-2 border-brand-secondary rounded-full animate-spin border-t-transparent"></div>
        <span className="text-gray-600 dark:text-gray-300">{text}</span>
    </div>
);

const MockInterview: React.FC = () => {
    // --- State Management ---
    const [interviewState, setInterviewState] = useState<InterviewState>(InterviewState.SETUP);
    const [feedbackTiming, setFeedbackTiming] = useState<FeedbackTiming>('FINAL');
    
    // Setup State
    const [resumeText, setResumeText] = useState<string>('');
    const [jobDescription, setJobDescription] = useState<string>('');
    const [isParsing, setIsParsing] = useState<boolean>(false);
    const [parsingMessage, setParsingMessage] = useState<string>('Parsing resume...');
    const [fileName, setFileName] = useState<string>('');
    const [error, setError] = useState<string>('');

    // Conversational State
    const [transcription, setTranscription] = useState<TranscriptionEntry[]>([]);
    const [questionCount, setQuestionCount] = useState(0); // Tracks current question number (1-10)
    const [isSessionActive, setIsSessionActive] = useState(false);
    
    // Technical State
    const [technicalQuestion, setTechnicalQuestion] = useState<string>('');
    const [technicalCode, setTechnicalCode] = useState<string>('');
    const [technicalLanguage, setTechnicalLanguage] = useState<string>('javascript');
    
    // Report State
    const [finalReport, setFinalReport] = useState<string>('');

    // --- Refs ---
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    // Fix: Initialize mediaStreamSourceRef with null to match its type `MediaStreamAudioSourceNode | null`.
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const isMicConnectedRef = useRef(false); // Indicates if "Microphone connected" message has been shown
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');
    const nextStartTimeRef = useRef(0); // For sequential audio playback
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set()); // For stopping audio on interruption
    
    // --- Handlers ---
    const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]; if (!file) return;
        if (file.type !== 'application/pdf') { setError('Please select a PDF file.'); setResumeText(''); setFileName(''); return; }
        const pdfjsLib = (globalThis as any).pdfjsLib; if (!pdfjsLib) { setError('PDF library failed to load.'); return; return; }
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.js`;
        setError(''); setIsParsing(true); setParsingMessage('Parsing resume...'); setFileName(file.name); setResumeText('');
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (!e.target?.result) throw new Error("Could not read file.");
                const typedArray = new Uint8Array(e.target.result as ArrayBuffer);
                const pdf = await pdfjsLib.getDocument(typedArray).promise;
                let textContent = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const text = await page.getTextContent();
                    textContent += text.items.map((item: any) => 'str' in item ? item.str : '').join(' ') + '\n';
                }
                const extractedText = textContent.trim();
                if (extractedText.length < 100) {
                    setParsingMessage('Scanned PDF detected. Performing OCR...');
                    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                    const imageParts = [];
                    for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
                        const page = await pdf.getPage(i);
                        const viewport = page.getViewport({ scale: 2.0 });
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        if (context) {
                            await page.render({ canvasContext: context, viewport }).promise;
                            const base64ImageData = canvas.toDataURL('image/jpeg').split(',')[1];
                            imageParts.push({ inlineData: { mimeType: 'image/jpeg', data: base64ImageData } });
                        }
                    }
                    if (imageParts.length > 0) {
                        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ text: "Extract all text from the following resume image(s)." }, ...imageParts] });
                        if (response.text) setResumeText(response.text.trim()); else setError('OCR failed.');
                    }
                } else { setResumeText(extractedText); }
            } catch (err) { setError('Failed to read the PDF.'); console.error(err); } finally { setIsParsing(false); }
        };
        reader.readAsArrayBuffer(file);
    }, []);

    const cleanupAudio = useCallback(() => {
        if (sessionPromiseRef.current) { sessionPromiseRef.current.then(s => s.close()).catch(e => console.error("Error closing session:", e)); sessionPromiseRef.current = null; }
        mediaStreamRef.current?.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null;
        scriptProcessorRef.current?.disconnect(); scriptProcessorRef.current = null;
        mediaStreamSourceRef.current?.disconnect(); mediaStreamSourceRef.current = null;
        
        // Check if contexts are not null and not already closed before attempting to close
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close().catch(e => console.error("Error closing input audio context:", e));
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close().catch(e => console.error("Error closing output audio context:", e));
        }
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        
        for(const source of audioSourcesRef.current.values()){
            source.stop();
        }
        audioSourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        isMicConnectedRef.current = false; // Reset the flag

        setIsSessionActive(false);
    }, []);

    const generateTechnicalQuestion = useCallback(async () => {
        setInterviewState(InterviewState.TECHNICAL_GENERATING);
        setTechnicalQuestion('');
        setError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `You are an AI interviewer. Generate a medium-difficulty LeetCode-style programming challenge suitable for a candidate applying to a role described by the following job description. Provide a clear problem description, one or two illustrative examples with inputs and outputs, and the constraints for the problem. Format the output in Markdown.

            ---
            **Job Description:**
            ${jobDescription}
            ---`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
            });
            
            setTechnicalQuestion(response.text);
            setInterviewState(InterviewState.TECHNICAL_SOLVING);
        } catch (err) {
            console.error("Error generating technical question:", err);
            setError("Failed to generate a technical question. Please try again.");
            setInterviewState(InterviewState.SETUP); // Fallback to setup
        }
    }, [jobDescription]);

    const startConversational = useCallback(async () => {
        setInterviewState(InterviewState.CONVERSATIONAL);
        setTranscription([{ author: Author.SYSTEM, text: "Connecting to AI Interviewer..." }]);
        setQuestionCount(0); // Reset for new session
        isMicConnectedRef.current = false; // Reset for new session
        setError('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const feedbackInstructionText = feedbackTiming === 'INSTANT' 
                ? "After each of the user's answers, provide brief, constructive feedback on their response, and then immediately ask the next numbered question (e.g., 'Good point about X. Now, Question 2: [Your second question]')."
                : "Do not provide any feedback during the interview. Simply ask the next numbered question (e.g., 'Question 2: [Your second question]').";

            const systemInstruction = `You are an AI hiring manager named Alex. Your first action must be to introduce yourself and immediately ask "Question 1: [Your first question]". Your introduction should be friendly and professional, like "Hello, my name is Alex, and I'll be conducting your interview today. Let's begin. Question 1: [Your first question]". You will ask exactly 10 behavioral and situational questions based on the candidate's resume and the provided job description. Each subsequent question must be explicitly numbered (e.g., "Question 2: [Your second question]", "Question 3: [Your third question]", up to "Question 10: [Your tenth question]"). ${feedbackInstructionText} After the user responds to Question 10, your *final* response in this section must be "That concludes our behavioral section. Please proceed to the next stage." Do not ask any further questions after this concluding statement.

            ---
            **Job Description:**
            ${jobDescription}
            ---
            **Candidate's Resume:**
            ${resumeText}
            ---
            `;

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    inputAudioTranscription: {}, 
                    outputAudioTranscription: {},
                    systemInstruction: systemInstruction,
                },
                callbacks: {
                    onopen: () => {
                        const inputCtx = inputAudioContextRef.current;
                        if (!inputCtx || !mediaStreamRef.current) {
                            console.error("Audio context or media stream not available on open.");
                            setError("Failed to initialize audio. Please refresh.");
                            cleanupAudio();
                            return;
                        }

                        const source = inputCtx.createMediaStreamSource(mediaStreamRef.current);
                        mediaStreamSourceRef.current = source;
                        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputCtx.destination); 
                        
                        scriptProcessor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            sessionPromiseRef.current?.then((s) => {
                                s.sendRealtimeInput({ media: createBlob(inputData) });
                            }).catch(err => {
                                // Log error but don't stop the session for every send error, as it might be transient.
                                console.warn("Error sending realtime input:", err);
                            });
                        };

                        setIsSessionActive(true);
                        // The very first AI response will trigger the "Microphone connected" message.
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        
                        if (message.serverContent?.inputTranscription) { currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text; }
                        if (message.serverContent?.outputTranscription) { currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text; }
                        
                        if (base64Audio && outputAudioContextRef.current) {
                            const outputCtx = outputAudioContextRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime); 
                            try {
                                const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                                const source = outputCtx.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(outputCtx.destination);
                                source.addEventListener('ended', () => {
                                    audioSourcesRef.current.delete(source);
                                });
                                source.start(nextStartTimeRef.current);
                                nextStartTimeRef.current += audioBuffer.duration;
                                audioSourcesRef.current.add(source);
                            } catch (audioErr) {
                                console.error("Error decoding or playing audio:", audioErr);
                            }
                        }

                        if (message.serverContent?.turnComplete) {
                            const userInput = currentInputTranscriptionRef.current.trim();
                            const modelOutput = currentOutputTranscriptionRef.current.trim();
                            
                            setTranscription(prev => {
                                const newLog = [...prev];
                                
                                // Add "Microphone connected" message after AI's intro/first audio turn
                                // Check if modelOutput actually contains content, and if the message hasn't been added yet
                                if (!isMicConnectedRef.current && modelOutput && !newLog.some(entry => entry.text.includes("Microphone connected"))) {
                                    newLog.push({ author: Author.SYSTEM, text: "Microphone connected. Please respond." });
                                    isMicConnectedRef.current = true;
                                }

                                if (userInput) {
                                    newLog.push({ author: Author.USER, text: userInput });
                                }
                                if (modelOutput) {
                                    newLog.push({ author: Author.MODEL, text: modelOutput });

                                    // Update questionCount based on explicit numbering from the AI
                                    const questionMatch = modelOutput.match(/Question (\d+):/);
                                    if (questionMatch && questionMatch[1]) {
                                        const num = parseInt(questionMatch[1], 10);
                                        // Use functional update for setQuestionCount to ensure latest state
                                        setQuestionCount(prevCount => Math.max(prevCount, num));
                                    }
                                }
                                return newLog;
                            });

                            currentInputTranscriptionRef.current = '';
                            currentOutputTranscriptionRef.current = '';
                            
                            // Check for the concluding phrase to transition to technical section
                            if (modelOutput.includes("That concludes our behavioral section. Please proceed to the next stage.")) {
                                console.log("Behavioral section concluded. Initiating technical phase.");
                                cleanupAudio();
                                generateTechnicalQuestion();
                                return; // Exit early as the conversational session is ending
                            }
                        }
                        
                        if (message.serverContent?.interrupted) {
                            for(const source of audioSourcesRef.current.values()){
                                source.stop();
                                audioSourcesRef.current.delete(source);
                            }
                            nextStartTimeRef.current = 0; // Reset playback time
                            console.log("Audio playback interrupted.");
                        }
                    },
                    onerror: (e: ErrorEvent) => { console.error('Live session error:', e); cleanupAudio(); setError(`Live session failed: ${e.message}. Please try again.`); setInterviewState(InterviewState.SETUP); },
                    onclose: (e: CloseEvent) => { console.log("Live session closed:", e); cleanupAudio(); 
                        if (interviewState === InterviewState.CONVERSATIONAL) {
                            // If session closes unexpectedly during conversational, go back to setup
                            setError("Conversational session ended unexpectedly.");
                            setInterviewState(InterviewState.SETUP); 
                        }
                    }
                },
            });
        } catch (err: any) { console.error("Failed to start conversational session:", err); setError(`Mic access failed: ${err.message}. Please ensure microphone permissions are granted.`); setInterviewState(InterviewState.SETUP); }
    }, [resumeText, jobDescription, feedbackTiming, cleanupAudio, generateTechnicalQuestion, questionCount, interviewState]); // Added questionCount and interviewState to dependency array for useCallback

    const submitTechnicalSolution = useCallback(async () => {
        setInterviewState(InterviewState.REPORT_GENERATING);
        setError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const transcriptText = transcription
                                    .filter(entry => entry.author !== Author.SYSTEM) // Filter out system messages
                                    .map(e => `${e.author.toUpperCase()}: ${e.text}`)
                                    .join('\n');
            
            const prompt = `As an expert career coach, analyze the entire mock interview session provided below. Provide a comprehensive, holistic performance report in Markdown format.

            The report must include:
            ### Overall Performance Summary
            - A brief paragraph summarizing the candidate's key strengths and primary areas for improvement across both conversational and technical sections, in context of their resume and the job description.

            ### Conversational Interview Analysis
            - **Clarity and Conciseness:** Evaluate how clearly and concisely the candidate answered questions. Were their points easy to follow?
            - **Tone and Professionalism:** Assess the candidate's tone. Did they sound confident, engaged, and professional?
            - **Use of Filler Words:** Note any significant use of filler words (e.g., "um," "uh," "like") and its impact.
            - **STAR Method Application:** For behavioral questions, analyze if the candidate effectively used the STAR (Situation, Task, Action, Result) method to structure their answers.

            ### Technical Challenge Analysis
            - **Code Correctness:** Does the code solve the problem correctly? Does it handle edge cases? Point out any logical errors.
            - **Efficiency & Complexity:** Analyze the time and space complexity of the solution. Is it optimal? Can it be improved?
            - **Code Style & Readability:** Comment on the code's style, clarity, and use of best practices for ${technicalLanguage}. Suggest improvements for readability.

            ### Overall Feedback
            - Provide a summary of your evaluation and suggest a direction for the candidate to improve their solution.

            ### Actionable Next Steps
            - Provide 3-5 specific, actionable tips for the candidate to work on for their next interview, covering both communication and technical skills.

            ---
            **Job Description:**\n${jobDescription}
            **Candidate's Resume:**\n${resumeText}
            **Conversational Transcript:**\n${transcriptText}
            **Technical Problem:**\n${technicalQuestion}
            **Candidate's Code (${technicalLanguage}):**\n\`\`\`${technicalLanguage}\n${technicalCode}\n\`\`\`
            ---`;

            const response = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: prompt });
            setFinalReport(response.text);
            setInterviewState(InterviewState.COMPLETE);

        } catch (err) {
            console.error("Error generating final report:", err);
            setError("Failed to generate the final report. Please try again.");
            setInterviewState(InterviewState.TECHNICAL_SOLVING); // Fallback to technical solving
        }
    }, [transcription, technicalQuestion, technicalCode, technicalLanguage, resumeText, jobDescription]);

    const handleDownloadReport = useCallback(() => {
        const { jsPDF } = (window as any).jspdf;
        const doc = new jsPDF();
        let y = 15;
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;

        // Helper function for adding simple text
        const addSimpleText = (text: string, options: { 
            fontSize?: number, 
            fontStyle?: 'normal' | 'bold' | 'italic', 
            align?: 'left' | 'center',
            isCode?: boolean,
            spacing?: number
        } = {}) => {
            const pageHeight = doc.internal.pageSize.getHeight();
            const { fontSize = 12, fontStyle = 'normal', align = 'left', isCode = false, spacing = 5 } = options;
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

            doc.text(textLines, x, y, { align: align === 'center' ? align : undefined });
            y += textHeight + spacing;
            return y;
        };

        // Title
        y = addSimpleText("Mock Interview Report", { fontSize: 18, fontStyle: 'bold', align: 'center', spacing: 10 });

        // Job Description
        y = addSimpleText("Job Description", { fontSize: 14, fontStyle: 'bold' });
        y = addSimpleText(jobDescription, { fontSize: 10, spacing: 5 }); y += 5;
        
        // Conversational Transcript
        y = addSimpleText("Conversational Interview Transcript", { fontSize: 14, fontStyle: 'bold' });
        const conversationalTranscriptText = transcription
                                            .filter(entry => entry.author !== Author.SYSTEM)
                                            .map(e => `${e.author.toUpperCase()}: ${e.text}`)
                                            .join('\n');
        y = addSimpleText(conversationalTranscriptText, { fontSize: 10, spacing: 4 }); y += 5;

        // Technical Challenge Problem
        y = addSimpleText("Technical Challenge Problem", { fontSize: 14, fontStyle: 'bold' });
        y = renderMarkdownToPdf(doc, technicalQuestion, y); y += 5; // Use the exported renderMarkdownToPdf
        
        // Candidate's Solution
        y = addSimpleText("Your Submitted Solution", { fontSize: 14, fontStyle: 'bold' });
        y = addSimpleText(`Language: ${technicalLanguage}\n`, { fontSize: 10, spacing: 2 });
        y = addSimpleText(technicalCode, { fontSize: 10, isCode: true, spacing: 5 }); y += 5;

        // Final Performance Report
        y = addSimpleText("Final Performance Report", { fontSize: 14, fontStyle: 'bold' });
        y = renderMarkdownToPdf(doc, finalReport, y); // Use the exported renderMarkdownToPdf

        doc.save("mock-interview-report.pdf");
    }, [jobDescription, transcription, technicalQuestion, technicalCode, technicalLanguage, finalReport]);

    const handleStartNewInterview = useCallback(() => {
        // Reset all states to initial values
        setInterviewState(InterviewState.SETUP);
        setFeedbackTiming('FINAL');
        setResumeText('');
        setJobDescription('');
        setIsParsing(false);
        setParsingMessage('Parsing resume...');
        setFileName('');
        setError('');
        setTranscription([]);
        setQuestionCount(0);
        setIsSessionActive(false);
        setTechnicalQuestion('');
        setTechnicalCode('');
        setTechnicalLanguage('javascript');
        setFinalReport('');
        cleanupAudio(); // Ensure any lingering audio resources are cleaned
    }, [cleanupAudio]);
    
    // --- Render Logic ---
    const renderSetup = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">1. Upload Resume (PDF)</label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md text-center">
                        {isParsing ? <LoadingSpinner text={parsingMessage} /> : (
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <label htmlFor="file-upload" className="cursor-pointer font-medium text-brand-secondary hover:text-blue-700">
                                        <span>Upload a file</span>
                                        <input id="file-upload" type="file" className="sr-only" accept=".pdf" onChange={handleFileChange} />
                                    </label>
                                </p>
                                {fileName && resumeText && <p className="text-sm mt-2 text-green-600">{fileName} uploaded.</p>}
                            </div>
                        )}
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">2. Paste Job Description</label>
                    <textarea rows={8} className="mt-2 shadow-sm block w-full sm:text-sm border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-white" value={jobDescription} onChange={e => setJobDescription(e.target.value)} />
                </div>
            </div>
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">3. Select Feedback Timing</label>
                    <div className="flex space-x-4 rounded-lg bg-gray-100 dark:bg-gray-800 p-2">
                        <button type="button" onClick={() => setFeedbackTiming('FINAL')} className={`w-full p-2 rounded-md text-sm ${feedbackTiming === 'FINAL' ? 'bg-brand-secondary text-white shadow' : 'text-gray-700 dark:text-gray-300'}`}>At End of Interview</button>
                        <button type="button" onClick={() => setFeedbackTiming('INSTANT')} className={`w-full p-2 rounded-md text-sm ${feedbackTiming === 'INSTANT' ? 'bg-brand-secondary text-white shadow' : 'text-gray-700 dark:text-gray-300'}`}>After Each Question</button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{feedbackTiming === 'FINAL' ? 'You will receive one comprehensive report after both interview sections.' : 'The AI will provide brief feedback after each of your 10 conversational answers.'}</p>
                </div>
                <button type="button" onClick={startConversational} disabled={!resumeText || !jobDescription || isParsing} className="w-full py-3 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-brand-secondary hover:bg-blue-700 disabled:bg-gray-400">
                    Start Mock Interview
                </button>
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>
        </div>
    );

    const renderConversational = () => (
        <div>
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-center mb-4">
                <p className="font-medium text-gray-700 dark:text-gray-300">Conversational Interview In Progress: Question {questionCount > 10 ? 10 : questionCount} of 10</p>
                {isSessionActive ? (
                    <div className="mt-2 flex justify-center items-center text-green-500">
                        <span className="relative flex h-3 w-3 mr-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <span>Listening...</span>
                    </div>
                ) : (
                    <p className="font-medium text-gray-700 dark:text-gray-300">Initializing audio session...</p>
                )}
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>
            <div className="h-96 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                {transcription.map((entry, index) => (
                    <div key={index} className={`flex ${entry.author === Author.USER ? 'justify-end' : 'justify-start'} my-2`}>
                        <div className={`max-w-md p-3 rounded-lg ${entry.author === Author.USER ? 'bg-blue-500 text-white' : (entry.author === Author.SYSTEM ? 'bg-gray-300 text-gray-800 italic' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200')}`}>
                            <p className="font-bold capitalize">{entry.author}</p><p className="whitespace-pre-wrap">{entry.text}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
    
    const renderTechnical = () => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-4 h-[35rem] overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-md border">
                <h3 className="text-lg font-bold mb-2 text-gray-800 dark:text-white">Technical Challenge Problem</h3>
                {technicalQuestion ? (
                    <MarkdownReport text={technicalQuestion} />
                ) : (
                    <LoadingSpinner text="Generating technical question..." />
                )}
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <label htmlFor="technical-language-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Language:
                    </label>
                    <select
                        id="technical-language-select"
                        value={technicalLanguage}
                        onChange={e => setTechnicalLanguage(e.target.value)}
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
                    value={technicalCode} 
                    onChange={e => setTechnicalCode(e.target.value)} 
                    className="w-full p-2 rounded-md dark:bg-gray-800 border dark:border-gray-600 dark:text-white font-mono"
                    placeholder={`// Write your ${technicalLanguage} code here...`}
                />
                <button 
                    type="button"
                    onClick={submitTechnicalSolution} 
                    disabled={!technicalCode || !technicalQuestion || interviewState === InterviewState.REPORT_GENERATING} 
                    className="w-full py-2 rounded-md text-white bg-brand-secondary hover:bg-blue-700 disabled:bg-gray-400"
                >
                    {interviewState === InterviewState.REPORT_GENERATING ? <LoadingSpinner text="Generating report..." /> : 'Submit & Get Final Report'}
                </button>
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>
        </div>
    );
    
    const renderReport = () => (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Final Performance Report</h3>
                <div className="flex space-x-2">
                    <button type="button" onClick={handleDownloadReport} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">Download Report</button>
                    <button type="button" onClick={handleStartNewInterview} className="px-6 py-2 bg-brand-primary text-white font-semibold rounded-lg shadow-md hover:bg-indigo-800">Start New Interview</button>
                </div>
            </div>
            <div className="p-4 h-[40rem] overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-md border dark:border-gray-700">
                <MarkdownReport text={finalReport} />
            </div>
        </div>
    );

    const renderLoading = (text: string) => (
        <div className="flex justify-center items-center h-96">
            <LoadingSpinner text={text} />
        </div>
    )

    const renderContent = () => {
        switch (interviewState) {
            case InterviewState.SETUP: return renderSetup();
            case InterviewState.CONVERSATIONAL: return renderConversational();
            case InterviewState.TECHNICAL_GENERATING: return renderLoading("Generating your technical question...");
            case InterviewState.TECHNICAL_SOLVING: return renderTechnical();
            case InterviewState.REPORT_GENERATING: return renderLoading("Generating your final performance report...");
            case InterviewState.COMPLETE: return renderReport();
            default: return renderSetup();
        }
    }

    return (
        <div className="bg-white dark:bg-dark-card p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Mock Interview</h2>
            {renderContent()}
        </div>
    );
};

export default MockInterview;
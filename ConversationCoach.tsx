import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAIBlob } from '@google/genai';
import { Author, TranscriptionEntry } from '../types';
import { MarkdownReport } from './ResumeAnalyzer'; // Keep MarkdownReport for display
// Import renderMarkdownToPdf from Technical for PDF generation consistency
import { renderMarkdownToPdf } from './Technical';

// Audio helper functions
const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const encode = (bytes: Uint8Array): string => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

const createBlob = (data: Float32Array): GenAIBlob => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
};

// --- Component ---

const ConversationCoach: React.FC = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [transcription, setTranscription] = useState<TranscriptionEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState("Click 'Start Session' to begin your mock interview.");
  const [feedbackReport, setFeedbackReport] = useState<string>('');
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState<boolean>(false);

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const handleStartSession = useCallback(async () => {
    if (isSessionActive) return;

    try {
      setFeedbackReport(''); // Clear previous feedback
      setStatusMessage("Initializing...");
      setTranscription([{ author: Author.SYSTEM, text: "Connecting to AI Coach..." }]);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: "You are a professional communication coach conducting a mock job interview. Ask a mix of typical interview questions, including questions about ethical dilemmas, teamwork scenarios, company culture fit, and conceptual coding concepts (do not ask for actual code, but for explanations of concepts like 'What is a closure in JavaScript?' or 'Explain the difference between an abstract class and an interface.'). After the user responds, provide a conversational follow-up and ask the next question. Do not provide any feedback during the interview. Keep the conversation flowing naturally from one question to the next."
        },
        callbacks: {
          onopen: () => {
            const inputCtx = inputAudioContextRef.current;
            if (!inputCtx) return;

            const source = inputCtx.createMediaStreamSource(stream);
            mediaStreamSourceRef.current = source;
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              }
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
            setStatusMessage("Listening... Speak now.");
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
                currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
                currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
            }

            if(message.serverContent?.turnComplete) {
                const userInput = currentInputTranscriptionRef.current.trim();
                const modelOutput = currentOutputTranscriptionRef.current.trim();

                setTranscription(prev => {
                    const newLog = [...prev];
                    if(userInput) newLog.push({ author: Author.USER, text: userInput });
                    if(modelOutput) newLog.push({ author: Author.MODEL, text: modelOutput });
                    return newLog;
                });

                currentInputTranscriptionRef.current = '';
                currentOutputTranscriptionRef.current = '';
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
                const outputCtx = outputAudioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
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
            }

            if(message.serverContent?.interrupted){
                for(const source of audioSourcesRef.current.values()){
                    source.stop();
                    audioSourcesRef.current.delete(source);
                }
                nextStartTimeRef.current = 0;
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Session error:', e);
            setStatusMessage(`Error: ${e.message}. Please try again.`);
            handleStopSession();
          },
          onclose: (e: CloseEvent) => {
            handleStopSession();
          },
        },
      });
      setIsSessionActive(true);
    } catch (error) {
      console.error('Failed to start session:', error);
      setStatusMessage("Failed to access microphone. Please grant permission and try again.");
    }
  }, [isSessionActive]);

  const handleStopSession = useCallback(async () => {
    if (!isSessionActive && !sessionPromiseRef.current) return;
    
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
        sessionPromiseRef.current = null;
    }
    
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }

    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }

    if(mediaStreamSourceRef.current){
        mediaStreamSourceRef.current.disconnect();
        mediaStreamSourceRef.current = null;
    }

    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        inputAudioContextRef.current.close();
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        outputAudioContextRef.current.close();
    }
    
    for(const source of audioSourcesRef.current.values()){
        source.stop();
    }
    audioSourcesRef.current.clear();

    setIsSessionActive(false);

    if (transcription.length > 1) {
      setIsGeneratingFeedback(true);
      setStatusMessage("Session ended. Generating your performance feedback...");
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          const transcriptText = transcription
              .filter(entry => entry.author !== Author.SYSTEM)
              .map(entry => `${entry.author.toUpperCase()}: ${entry.text}`)
              .join('\n');

          const prompt = `
          As an expert interview coach, analyze the following interview transcript and provide a comprehensive performance report in Markdown format. The user was the candidate.

          Structure your feedback with the following sections:
          ### Overall Performance Summary
          - A brief paragraph summarizing the candidate's key strengths and primary areas for improvement.

          ### Detailed Analysis
          - **Clarity and Conciseness:** Evaluate how clearly and concisely the candidate answered the questions. Were their points easy to follow?
          - **Tone and Professionalism:** Assess the candidate's tone. Did they sound confident, engaged, and professional?
          - **Use of Filler Words:** Note any significant use of filler words (e.g., "um," "uh," "like") and its impact.
          - **STAR Method Application:** For behavioral questions, analyze if the candidate effectively used the STAR (Situation, Task, Action, Result) method to structure their answers.

          ### Actionable Next Steps
          - Provide 3-5 specific, actionable tips for the candidate to work on for their next interview.

          ---
          **Interview Transcript:**
          ${transcriptText}
          ---
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-2.5-pro',
              contents: prompt,
          });

          setFeedbackReport(response.text);
          setStatusMessage("Feedback report generated. Click 'Start Session' to practice again.");
      } catch (err) {
          console.error("Error generating feedback:", err);
          setStatusMessage("Could not generate feedback report. Please try another session.");
      } finally {
          setIsGeneratingFeedback(false);
      }
    } else {
        setStatusMessage("Session ended. Click 'Start Session' to practice again.");
    }
  }, [isSessionActive, transcription]);

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
        spacing?: number
    } = {}) => {
        if (!text.trim()) return;

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

        doc.text(textLines, x, y, { align: align === 'center' ? 'center' : undefined });
        y += textHeight + spacing;
        return y;
    };

    y = addText("Interview Transcript & Feedback", { fontSize: 18, fontStyle: 'bold', align: 'center', spacing: 10 });

    transcription.forEach(entry => {
        if (entry.author === Author.SYSTEM) return;
        const line = `${entry.author.charAt(0).toUpperCase() + entry.author.slice(1)}: ${entry.text}`;
        y = addText(line, { fontStyle: entry.author === Author.USER ? 'bold' : 'normal', fontSize: 10 });
    });

    if (feedbackReport) {
        y += 10;
        y = addText("Performance Feedback", { fontSize: 16, fontStyle: 'bold', align: 'center', spacing: 10 });
        
        // Using the renderMarkdownToPdf from Technical.tsx for consistency
        const { renderMarkdownToPdf: technicalRenderMarkdownToPdf } = require('./Technical');
        technicalRenderMarkdownToPdf(doc, feedbackReport, y);
    }

    doc.save("interview-report.pdf");
  }, [transcription, feedbackReport]);
  
  return (
    <div className="bg-white dark:bg-dark-card p-6 rounded-lg shadow-lg">
      <div className="flex flex-col md:flex-row items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4 md:mb-0">Interview Practice</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleStartSession}
            disabled={isSessionActive || isGeneratingFeedback}
            className="px-6 py-2 bg-brand-secondary text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Start Session
          </button>
          <button
            onClick={handleStopSession}
            disabled={!isSessionActive || isGeneratingFeedback}
            className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Stop Session
          </button>
           <button
            onClick={handleDownloadReport}
            disabled={isSessionActive || isGeneratingFeedback || transcription.length <= 1}
            className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Download Report
          </button>
        </div>
      </div>

      <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
        <p className="font-medium text-gray-700 dark:text-gray-300">{statusMessage}</p>
        {isSessionActive && (
          <div className="mt-2 flex justify-center items-center">
             <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="ml-2 text-green-500">Live</span>
          </div>
        )}
      </div>

      <div className="mt-6 h-80 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="space-y-4">
          {transcription.map((entry, index) => (
            <div key={index} className={`flex ${entry.author === Author.USER ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-md p-3 rounded-lg ${entry.author === Author.USER ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
                <p className="font-bold capitalize">{entry.author}</p>
                <p className="whitespace-pre-wrap">{entry.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {(isGeneratingFeedback || feedbackReport) && (
        <div className="mt-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Performance Feedback</h3>
            <div className="p-4 h-80 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
                {isGeneratingFeedback ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="w-6 h-6 border-4 border-brand-secondary rounded-full animate-spin border-t-transparent"></div>
                        <span className="ml-3">Generating your report...</span>
                    </div>
                ) : (
                    <MarkdownReport text={feedbackReport} />
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default ConversationCoach;
import React, { useState, useEffect } from 'react';
import { UploadZone } from './components/UploadZone';
import { ProcessingStatus } from './components/ProcessingStatus';
import { ProcessingState, ProcessingStep, UploadedFile, GeneratedPage } from './types';
import { transcribeMathProblem, solveMathProblem, generateHandwrittenPage, setApiKey, validateSolution } from './services/geminiService';
import { generatePDF } from './services/pdfService';
import { Download, RefreshCcw, Key, Zap, ChevronRight } from 'lucide-react';

const App: React.FC = () => {
  const [isKeySelected, setIsKeySelected] = useState<boolean>(false);
  const [showManualEntry, setShowManualEntry] = useState<boolean>(false);
  const [manualKey, setManualKey] = useState<string>('');
  const [hasAiStudio, setHasAiStudio] = useState<boolean>(false);
  
  const [questionImage, setQuestionImage] = useState<UploadedFile | null>(null);
  const [handwritingImage, setHandwritingImage] = useState<UploadedFile | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    step: ProcessingStep.IDLE,
    message: '',
    progress: 0
  });
  const [generatedPages, setGeneratedPages] = useState<GeneratedPage[]>([]);
  const [terminalCursor, setTerminalCursor] = useState(true);

  // Blinking cursor effect
  useEffect(() => {
    const interval = setInterval(() => setTerminalCursor(c => !c), 500);
    return () => clearInterval(interval);
  }, []);

  // Check for API key on mount
  useEffect(() => {
    const checkKey = async () => {
      if ((window as any).aistudio) {
        setHasAiStudio(true);
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (hasKey) setIsKeySelected(true);
      } else {
        // If not in AI Studio environment (e.g. GitHub Pages), default to manual entry
        setShowManualEntry(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setIsKeySelected(true);
    }
  };

  const handleManualKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualKey.trim()) {
      setApiKey(manualKey.trim());
      setIsKeySelected(true);
    }
  };

  const handleFileSelect = (file: File, type: 'question' | 'handwriting') => {
    const previewUrl = URL.createObjectURL(file);
    if (type === 'question') {
      setQuestionImage({ file, previewUrl });
    } else {
      setHandwritingImage({ file, previewUrl });
    }
  };

  const clearFiles = () => {
    if (questionImage) URL.revokeObjectURL(questionImage.previewUrl);
    if (handwritingImage) URL.revokeObjectURL(handwritingImage.previewUrl);
    setQuestionImage(null);
    setHandwritingImage(null);
    setGeneratedPages([]);
    setProcessingState({ step: ProcessingStep.IDLE, message: '', progress: 0 });
  };

  const handleProcess = async () => {
    if (!questionImage || !handwritingImage) return;

    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    let success = false;

    // Clear previous results
    setGeneratedPages([]);

    while (attempts < MAX_ATTEMPTS && !success) {
      attempts++;
      try {
        // 1. Transcribe
        setProcessingState({
          step: ProcessingStep.ANALYZING,
          message: `Reading problem (Attempt ${attempts})...`,
          progress: 10
        });
        const problemText = await transcribeMathProblem(questionImage.file);

        // 2. Solve
        setProcessingState({
          step: ProcessingStep.SOLVING,
          message: 'Solving problem step-by-step...',
          progress: 30
        });
        const solutionSteps = await solveMathProblem(problemText);

        if (solutionSteps.length === 0) {
           if (attempts === MAX_ATTEMPTS) throw new Error("Could not solve the problem.");
           continue; // Retry
        }

        // 3. Generate Pages
        const currentPages: GeneratedPage[] = [];
        const totalSteps = solutionSteps.length;
        
        for (let i = 0; i < totalSteps; i++) {
          setProcessingState({
            step: ProcessingStep.GENERATING_PAGES,
            message: `Writing page ${i + 1}/${totalSteps}...`,
            progress: 40 + ((i / totalSteps) * 40)
          });

          const imageUrl = await generateHandwrittenPage(
            handwritingImage.file,
            solutionSteps[i],
            i
          );
          currentPages.push({ imageUrl, pageNumber: i + 1 });
        }

        // 4. Validate
        setProcessingState({
          step: ProcessingStep.VALIDATING,
          message: 'Verifying solution quality...',
          progress: 90
        });
        
        const validation = await validateSolution(questionImage.file, currentPages.map(p => p.imageUrl));

        if (validation.valid) {
          success = true;
          setGeneratedPages(currentPages);
          setProcessingState({
            step: ProcessingStep.COMPLETED,
            message: 'Sequence Complete. Output Verified.',
            progress: 100
          });
        } else {
          console.warn(`Attempt ${attempts} failed validation: ${validation.reason}`);
          if (attempts === MAX_ATTEMPTS) {
            throw new Error(`Validation failed: ${validation.reason || 'Output illegible'}`);
          }
          // Loop continues to retry
        }

      } catch (error: any) {
        console.error("Processing Error:", error);
        const errString = JSON.stringify(error);
        const errMessage = error?.message || '';

        // If permission error, stop immediately
        if (
          errString.includes("403") || 
          errString.includes("PERMISSION_DENIED") || 
          errMessage.includes("403") ||
          errMessage.includes("permission")
        ) {
          setIsKeySelected(false);
          setProcessingState({
            step: ProcessingStep.ERROR,
            message: 'ACCESS DENIED: API Key invalid.',
            progress: 0
          });
          return;
        }

        // Only show error state if we are out of attempts
        if (attempts === MAX_ATTEMPTS) {
          setProcessingState({
            step: ProcessingStep.ERROR,
            message: 'SYSTEM FAILURE: ' + (errMessage || 'Unknown error.'),
            progress: 0
          });
        }
      }
    }
  };

  const handleDownloadPDF = () => {
    if (generatedPages.length === 0) return;
    const blob = generatePDF(generatedPages.map(p => p.imageUrl));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'MathSolution.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- LANDING (Key Selection) ---
  if (!isKeySelected) {
    return (
      <div className="min-h-screen bg-retro-grid flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 text-center relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500"></div>
          <div className="inline-flex items-center justify-center p-4 bg-black rounded-full mb-6 border-2 border-white shadow-lg">
             <Key className="w-8 h-8 text-[#ccff00]" />
          </div>
          <h1 className="text-4xl font-press text-black mb-4">MathMimic</h1>
          <p className="text-xl text-gray-600 mb-8 font-mono">
            System requires authorization. Please insert coin or select API Key.
          </p>
          
          {!showManualEntry && hasAiStudio ? (
            <div className="space-y-4 font-mono">
              <button
                onClick={handleSelectKey}
                className="w-full py-4 px-6 bg-[#ccff00] text-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold text-xl hover:translate-y-1 hover:shadow-none transition-all"
              >
                SELECT PROJECT
              </button>
              
              <button
                onClick={() => setShowManualEntry(true)}
                className="text-lg text-gray-500 hover:text-black hover:underline transition-colors block w-full"
              >
                [ Enter Manual Key ]
              </button>
            </div>
          ) : (
            <form onSubmit={handleManualKeySubmit} className="space-y-4">
              <div className="text-left">
                <label className="block text-lg font-bold text-black mb-1 font-mono">API_KEY:</label>
                <input 
                  type="password"
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value)}
                  placeholder="Paste key here..."
                  className="w-full px-4 py-3 border-2 border-black bg-gray-50 font-mono focus:ring-2 focus:ring-[#ccff00] focus:border-black outline-none"
                  required
                />
              </div>
              <div className="flex gap-3 font-mono">
                 {hasAiStudio && (
                   <button
                    type="button"
                    onClick={() => setShowManualEntry(false)}
                    className="flex-1 py-2 px-4 bg-gray-200 text-black border-2 border-black hover:bg-gray-300 font-bold"
                  >
                    BACK
                  </button>
                 )}
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-black text-white border-2 border-black hover:bg-gray-800 font-bold flex items-center justify-center gap-2"
                >
                  ENTER <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- MAIN APP (Retro Cyberpunk Design) ---
  return (
    <div className="flex h-screen bg-retro-grid overflow-hidden font-mono relative text-slate-900">
      
      {/* Sidebar */}
      <div className="w-16 bg-black text-white flex flex-col items-center py-8 gap-20 select-none relative z-20 border-r-4 border-white/10">
        <div className="flex-1 flex flex-col items-center justify-center gap-24">
          <div className="text-vertical tracking-widest text-gray-500 hover:text-white cursor-pointer transition-colors text-lg">HISTORY</div>
          <div className="text-vertical tracking-widest text-[#ccff00] font-bold text-lg shadow-[0_0_10px_#ccff00]">NEW_PROBLEM</div>
          <div className="text-vertical tracking-widest text-gray-500 hover:text-white cursor-pointer transition-colors text-lg">SETTINGS</div>
          <div className="text-vertical tracking-widest text-gray-500 hover:text-white cursor-pointer transition-colors text-lg">CHAT_LOG</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative flex flex-col h-full">
        
        {/* Header */}
        <div className="pt-8 pb-4 text-center z-10">
          <h1 className="text-6xl md:text-7xl font-press italic text-white text-shadow-retro stroke-black" 
              style={{ WebkitTextStroke: '2px black', textShadow: '4px 4px 0px #d946ef' }}>
            Math<span className="text-[#ccff00]">Mimic</span>
          </h1>
        </div>

        {/* Workspace */}
        <div className="flex-1 relative p-6 md:p-12 overflow-y-auto">
          
          {/* Decorative Stickers/Elements */}
          <div className="absolute top-10 left-10 w-24 h-24 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-32 h-32 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none"></div>

          {processingState.step === ProcessingStep.IDLE ? (
            <div className="w-full h-full relative max-w-7xl mx-auto">
              {/* Top Right: User Question */}
              <div className="absolute top-0 right-0 md:right-10 w-full md:w-1/2 lg:w-5/12 z-20 transition-all duration-500">
                <div className="relative">
                  <UploadZone
                    label="Solve: upload problem..."
                    description="on my paper."
                    file={questionImage?.file || null}
                    previewUrl={questionImage?.previewUrl || null}
                    onFileSelect={(f) => handleFileSelect(f, 'question')}
                    onClear={() => setQuestionImage(null)}
                    variant="retro-question"
                  />
                  {/* Speech Bubble Tail */}
                  <div className="hidden md:block absolute top-10 -left-4 w-0 h-0 border-t-[20px] border-t-transparent border-r-[20px] border-r-black border-b-[20px] border-b-transparent"></div>
                  <div className="hidden md:block absolute top-10 -left-[14px] w-0 h-0 border-t-[16px] border-t-transparent border-r-[16px] border-r-[#ccff00] border-b-[16px] border-b-transparent"></div>
                </div>
              </div>

              {/* Bottom Left: Handwriting Ref */}
              <div className="absolute top-[280px] md:top-[180px] left-0 md:left-20 w-full md:w-5/12 lg:w-1/3 z-10 transition-all duration-500">
                <div className="relative">
                  <div className="bg-[#5c2bfb] text-white px-3 py-1 inline-block font-bold text-xl mb-1 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -rotate-2">
                    MATHMIMIC: Solution generating..
                  </div>
                  <div className="mt-4">
                    <UploadZone
                      label="Handwriting"
                      description=""
                      file={handwritingImage?.file || null}
                      previewUrl={handwritingImage?.previewUrl || null}
                      onFileSelect={(f) => handleFileSelect(f, 'handwriting')}
                      onClear={() => setHandwritingImage(null)}
                      variant="retro-handwriting"
                    />
                  </div>
                </div>
              </div>

              {/* Execute Button */}
              <div className="absolute bottom-10 right-0 md:right-10 z-30">
                <button
                  onClick={handleProcess}
                  disabled={!questionImage || !handwritingImage}
                  className={`
                    group relative px-8 py-3 font-black text-2xl uppercase tracking-widest
                    border-4 border-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]
                    flex items-center gap-3 transition-all active:translate-y-1 active:shadow-none
                    ${(!questionImage || !handwritingImage) 
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed border-gray-500' 
                      : 'bg-[#d946ef] text-white hover:bg-[#c026d3] hover:scale-105'}
                  `}
                >
                  EXECUTE <Zap className="w-6 h-6 fill-current group-hover:animate-bounce" />
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-start pt-10">
              <ProcessingStatus status={processingState} />

              {/* Results View */}
              {generatedPages.length > 0 && processingState.step === ProcessingStep.COMPLETED && (
                <div className="mt-8 w-full max-w-4xl animate-[slideIn_0.5s_ease-out]">
                   <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-black p-4 border-2 border-white/50 gap-4">
                      <h2 className="text-[#ccff00] text-xl font-bold">>>> OUTPUT_GENERATED_SUCCESSFULLY</h2>
                      <div className="flex gap-4">
                        <button 
                          onClick={clearFiles} 
                          className="bg-white text-black font-bold px-4 py-2 border-2 border-black hover:bg-[#ccff00] hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.5)] transition-all flex items-center gap-2"
                        >
                          <RefreshCcw className="w-4 h-4" /> GENERATE NEXT
                        </button>
                        <button 
                          onClick={handleDownloadPDF} 
                          className="bg-[#ccff00] text-black font-bold px-4 py-2 border-2 border-black hover:bg-white hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.5)] transition-all flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" /> SAVE_PDF
                        </button>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-20">
                    {generatedPages.map((page, idx) => (
                      <div key={idx} className="bg-white p-2 shadow-2xl rotate-1 first:rotate-[-1deg] border border-gray-300">
                        <div className="relative aspect-[3/4] overflow-hidden bg-slate-100 border border-gray-200">
                           <img src={page.imageUrl} className="w-full h-full object-cover" alt="Solution Page" />
                        </div>
                        <div className="text-center font-handwriting text-gray-500 mt-2">Page_{page.pageNumber}</div>
                      </div>
                    ))}
                   </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Terminal */}
        <div className="bg-black text-[#0f0] h-12 flex items-center px-4 font-mono text-lg border-t-4 border-[#333] z-30">
          <span className="mr-2">C:\&gt;</span>
          <span>{processingState.message || "ENTER_COMMAND_"}</span>
          <span className={`${terminalCursor ? 'opacity-100' : 'opacity-0'} ml-1 block w-3 h-5 bg-[#0f0]`}></span>
        </div>
      </div>
    </div>
  );
};

export default App;
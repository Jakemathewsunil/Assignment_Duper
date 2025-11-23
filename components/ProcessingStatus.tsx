import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Terminal } from 'lucide-react';
import { ProcessingState, ProcessingStep } from '../types';

interface ProcessingStatusProps {
  status: ProcessingState;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ status }) => {
  if (status.step === ProcessingStep.IDLE) return null;

  const isError = status.step === ProcessingStep.ERROR;
  const isComplete = status.step === ProcessingStep.COMPLETED;

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 relative z-20">
      <div className="bg-[#1a1a1a] p-4 border-4 border-[#ccff00] shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between mb-4 font-mono">
          <div className="flex items-center gap-3">
            {isError ? (
              <AlertCircle className="w-6 h-6 text-red-500" />
            ) : isComplete ? (
              <CheckCircle2 className="w-6 h-6 text-[#ccff00]" />
            ) : (
              <Loader2 className="w-6 h-6 text-[#ccff00] animate-spin" />
            )}
            
            <div>
              <h3 className={`text-xl uppercase tracking-wider ${isError ? 'text-red-500' : 'text-[#ccff00]'}`}>
                {isError ? 'SYSTEM ERROR' : isComplete ? 'PROCESS COMPLETED' : 'PROCESSING...'}
              </h3>
              <p className="text-sm text-gray-400 font-mono">
                <span className="mr-2">&gt;</span>{status.message}
              </p>
            </div>
          </div>
          <span className="text-2xl font-bold text-white">{Math.round(status.progress)}%</span>
        </div>

        {/* Retro Progress Bar */}
        <div className="h-6 w-full bg-[#333] border-2 border-white/20 p-1">
          <div 
            className={`h-full transition-all duration-300 ease-linear ${
              isError ? 'bg-red-500' : 'bg-[#ccff00]'
            }`}
            style={{ 
              width: `${status.progress}%`,
              backgroundImage: 'linear-gradient(45deg, rgba(0,0,0,0.1) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1) 75%, transparent 75%, transparent)',
              backgroundSize: '20px 20px'
            }}
          />
        </div>
      </div>
    </div>
  );
};
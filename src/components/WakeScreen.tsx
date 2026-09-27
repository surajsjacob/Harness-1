import React from "react";
import { Loader2, AlertCircle } from "lucide-react";

interface WakeScreenProps {
  failed?: boolean;
}

export const WakeScreen: React.FC<WakeScreenProps> = ({ failed }) => {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#F9FAFB] p-6 text-center">
      <div className="flex flex-col items-center max-w-sm w-full bg-white rounded-xl border border-[#E5E7EB] p-8 shadow-sm">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#4F46E5] text-white font-bold text-xl mb-6 shadow-sm">
          H
        </div>
        {failed ? (
          <>
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-50 text-[#DC2626] mb-3">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h2 className="text-base font-semibold text-[#111827] mb-2">Server Not Responding</h2>
            <p className="text-sm text-[#6B7280] mb-5">
              Server not responding. Refresh the page in a minute.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-lg transition-colors cursor-pointer"
            >
              Refresh Page
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 text-[#4F46E5] animate-spin mb-4" />
            <h2 className="text-base font-semibold text-[#111827] mb-2">Connecting to Server</h2>
            <p className="text-sm text-[#6B7280]">
              Waking up the server... this takes up to a minute on the free plan.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

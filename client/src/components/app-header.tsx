import { Receipt } from "lucide-react";

interface AppHeaderProps {
  showBackButton?: boolean;
  onBackClick?: () => void;
  title?: string;
}

export default function AppHeader({ showBackButton = false, onBackClick, title }: AppHeaderProps) {
  return (
    <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-100">
      {showBackButton && onBackClick ? (
        <button onClick={onBackClick} className="p-2">
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      ) : (
        <div />
      )}
      
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-3 mb-1">
          <Receipt className="w-8 h-8 text-green-600" />
          <h1 className="text-xl font-bold text-green-800">Digital Receipts</h1>
        </div>
        {!title && (
          <p className="text-xs text-gray-600">OneTap Receipts. Zero Paper.</p>
        )}
        {title && (
          <p className="text-sm font-medium text-gray-700">{title}</p>
        )}
      </div>

      <div className="w-9" /> {/* Spacer for centering */}
    </div>
  );
}
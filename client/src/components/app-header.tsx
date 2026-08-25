import { ArrowLeft } from "lucide-react";

interface AppHeaderProps {
  showBackButton?: boolean;
  onBackClick?: () => void;
  title?: string;
  visualSystem?: boolean;
}

export default function AppHeader({
  showBackButton = false,
  onBackClick,
  title,
  visualSystem = false,
}: AppHeaderProps) {
  if (!visualSystem) {
    return (
      <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-100">
        {showBackButton && onBackClick ? (
          <button onClick={onBackClick} className="p-2 w-9" aria-label="Go back">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
        ) : (
          <div className="w-9" />
        )}

        <div className="flex flex-col items-center">
          <h1 className="text-2xl font-bold text-green-800">Receiptify</h1>
          {!title && <p className="text-xs text-gray-600">Your Digital Wallet</p>}
          {title && <p className="text-sm font-medium text-gray-700">{title}</p>}
        </div>

        <div className="w-9" />
      </div>
    );
  }

  return (
    <header className="receiptify-header">
      {showBackButton && onBackClick ? (
        <button onClick={onBackClick} className="receiptify-header-back" aria-label="Go back">
          <ArrowLeft className="h-4 w-4" />
        </button>
      ) : (
        <div className="receiptify-header-spacer" />
      )}
      
      <div className="receiptify-brand">
        <div>
          <h1>Receiptify</h1>
        </div>
      </div>

      <div className="receiptify-header-spacer" />
    </header>
  );
}
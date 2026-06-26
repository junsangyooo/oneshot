import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, PhaseBanner } from "../ui-kit";
import { useRoomStore } from "./useRoomStore";

export const ErrorScreen = ({ message, retryable }: { message: string; retryable: boolean }) => {
  const clearScreenError = useRoomStore((state) => state.clearScreenError);

  return (
    <main className="app-screen error-screen">
      <PhaseBanner icon={<AlertTriangle size={32} />} title="입장 실패" body={message} />
      <div className="error-actions">
        <Button variant={retryable ? "primary" : "secondary"} onClick={clearScreenError}>
          <RotateCcw size={18} />
          다시 시도
        </Button>
      </div>
    </main>
  );
};

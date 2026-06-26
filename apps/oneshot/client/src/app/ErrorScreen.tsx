import { useT } from "../i18n";
import { StatusScreen } from "../ui/StatusScreen";
import { useRoomStore } from "./useRoomStore";

export const ErrorScreen = ({ message, retryable }: { message: string; retryable: boolean }) => {
  const t = useT();
  const clearScreenError = useRoomStore((state) => state.clearScreenError);

  return (
    <StatusScreen
      code="LINK // ERR"
      accent="red"
      icon="⚠"
      glitch
      title={t("error.title")}
      message={message}
      actions={retryable ? [{ label: `↻ ${t("error.retry")}`, primary: true, onClick: clearScreenError }] : [{ label: t("error.retry"), onClick: clearScreenError }]}
    />
  );
};

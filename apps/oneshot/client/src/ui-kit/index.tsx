import { useEffect, useState } from "react";
import type React from "react";
import QRCode from "qrcode";
import type { GameCatalogItem, PublicPlayerState } from "@oneshot/shared";
import {
  X,
  Crown,
  LogOut,
  Play,
  QrCode,
  Shield,
  UserMinus,
  Wifi,
  WifiOff,
} from "lucide-react";

type ButtonProps = {
  children: React.ReactNode;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
};

export const Button = ({
  children,
  type = "button",
  variant = "primary",
  disabled,
  title,
  onClick,
}: ButtonProps) => (
  <button
    className={`button button--${variant}`}
    type={type}
    disabled={disabled}
    title={title}
    onClick={onClick}
  >
    {children}
  </button>
);

type IconButtonProps = {
  label: string;
  icon: React.ReactNode;
  variant?: "ghost" | "danger" | "secondary";
  disabled?: boolean;
  onClick?: () => void;
};

export const IconButton = ({
  label,
  icon,
  variant = "ghost",
  disabled,
  onClick,
}: IconButtonProps) => (
  <button
    className={`icon-button icon-button--${variant}`}
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={onClick}
  >
    {icon}
  </button>
);

type TextFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  maxLength?: number;
  onChange: (value: string) => void;
};

export const TextField = ({
  label,
  value,
  placeholder,
  inputMode,
  autoComplete,
  maxLength,
  onChange,
}: TextFieldProps) => (
  <label className="field">
    <span>{label}</span>
    <input
      value={value}
      placeholder={placeholder}
      inputMode={inputMode}
      autoComplete={autoComplete}
      maxLength={maxLength}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  </label>
);

export const HostBadge = () => (
  <span className="badge badge--host">
    <Crown size={14} />
    방장
  </span>
);

export const ConnectionBadge = ({ status }: { status: PublicPlayerState["connectionStatus"] }) => (
  <span className={`badge badge--${status}`}>
    {status === "online" ? <Wifi size={14} /> : <WifiOff size={14} />}
    {status === "online" ? "온라인" : status === "reconnecting" ? "복귀 중" : "오프라인"}
  </span>
);

export const PlayerBadge = ({ player }: { player: PublicPlayerState }) => (
  <span className="player-badge">
    <span className={`avatar avatar--${player.avatarKey}`} />
    <span>{player.nickname}</span>
  </span>
);

type PlayerListProps = {
  players: PublicPlayerState[];
  currentPlayerId: string | null;
  canKick: boolean;
  onKick: (playerId: string) => void;
};

export const PlayerList = ({ players, currentPlayerId, canKick, onKick }: PlayerListProps) => (
  <div className="player-list">
    {players.map((player) => (
      <div className="player-row" key={player.id}>
        <PlayerBadge player={player} />
        <div className="player-row__meta">
          {player.isHost ? <HostBadge /> : null}
          <ConnectionBadge status={player.connectionStatus} />
          {canKick && player.id !== currentPlayerId ? (
            <IconButton
              label={`${player.nickname} 내보내기`}
              icon={<UserMinus size={18} />}
              variant="danger"
              onClick={() => onKick(player.id)}
            />
          ) : null}
        </div>
      </div>
    ))}
  </div>
);

export const RoomCode = ({ code }: { code: string }) => (
  <div className="room-code" aria-label={`방 코드 ${code}`}>
    {code.split("").map((character, index) => (
      <span key={`${character}-${index}`}>{character}</span>
    ))}
  </div>
);

export const QRPanel = ({ value }: { value: string }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(value, {
      margin: 1,
      width: 220,
      color: { dark: "#111827", light: "#F7F1E8" },
    })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div className="qr-panel">
      <div className="qr-panel__title">
        <QrCode size={18} />
        QR
      </div>
      {qrDataUrl ? <img src={qrDataUrl} alt="입장 QR" /> : <div className="qr-panel__loading" />}
    </div>
  );
};

type GameCatalogProps = {
  games: GameCatalogItem[];
  selectedGameId: string;
  playerCount: number;
  isHost: boolean;
  onSelect: (gameId: GameCatalogItem["id"]) => void;
};

export const GameCatalog = ({
  games,
  selectedGameId,
  playerCount,
  isHost,
  onSelect,
}: GameCatalogProps) => (
  <div className="game-catalog">
    {games.map((game) => {
      const available = game.status === "available";
      const enoughPlayers = playerCount >= game.minPlayers;
      const selected = selectedGameId === game.id;
      return (
        <button
          className={`game-card ${selected ? "game-card--selected" : ""}`}
          type="button"
          key={game.id}
          disabled={!isHost || !available}
          onClick={() => onSelect(game.id)}
        >
          <span className="game-card__title">{game.title}</span>
	          <span className="game-card__meta">
	            {game.maxPlayers === null
	              ? `${game.minPlayers}명 이상`
	              : `${game.minPlayers}-${game.maxPlayers}명`}{" "}
	            · 난이도 {game.complexity}
	          </span>
          <span className={`game-card__status ${available ? "is-ready" : ""}`}>
            {available ? (enoughPlayers ? "시작 가능" : "인원 대기") : "준비 중"}
          </span>
        </button>
      );
    })}
  </div>
);

export const PhaseBanner = ({
  icon,
  title,
  body,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
}) => (
  <div className="phase-banner">
    {icon ? <div className="phase-banner__icon">{icon}</div> : null}
    <div>
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
    </div>
  </div>
);

export const ActionBar = ({ children }: { children: React.ReactNode }) => (
  <div className="action-bar">{children}</div>
);

export const Toast = ({ message, onClose }: { message: string | null; onClose: () => void }) =>
  message ? (
    <button className="toast" type="button" onClick={onClose}>
      {message}
    </button>
  ) : null;

export const Dialog = ({
  title,
  children,
  open,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
}) =>
  open ? (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog__header">
          <h2>{title}</h2>
          <IconButton label="닫기" icon={<X size={18} />} onClick={onClose} />
        </div>
        <div className="dialog__body">{children}</div>
      </section>
    </div>
  ) : null;

export const ResultTable = ({
  playersById,
  ranking,
}: {
  playersById: Record<string, PublicPlayerState>;
  ranking: Array<{ playerId: string; rank: number; scoreDelta?: number }>;
}) => (
  <div className="result-table">
    {ranking.map((row) => {
      const player = playersById[row.playerId];
      return (
        <div className="result-row" key={row.playerId}>
          <span className="result-row__rank">{row.rank}</span>
          <span>{player?.nickname ?? "알 수 없음"}</span>
          <span>{row.scoreDelta ?? 0}</span>
        </div>
      );
    })}
  </div>
);

export const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <div className="empty-state">
    <Shield size={22} />
    <span>{children}</span>
  </div>
);

export const LeaveButton = ({ onClick }: { onClick: () => void }) => (
  <IconButton label="나가기" icon={<LogOut size={18} />} variant="secondary" onClick={onClick} />
);

export const StartIcon = () => <Play size={18} />;

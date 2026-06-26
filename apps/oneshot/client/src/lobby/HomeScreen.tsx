import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, Plus } from "lucide-react";
import { storage } from "../app/storage";
import { useRoomStore } from "../app/useRoomStore";
import { Button, TextField } from "../ui-kit";

type HomeScreenProps = {
  initialRoomCode: string;
};

export const HomeScreen = ({ initialRoomCode }: HomeScreenProps) => {
  const createRoom = useRoomStore((state) => state.createRoom);
  const joinRoom = useRoomStore((state) => state.joinRoom);
  const connectionState = useRoomStore((state) => state.connectionState);
  const [nickname, setNickname] = useState(storage.getNickname());
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const connecting = connectionState === "connecting";
  const normalizedRoomCode = useMemo(
    () => roomCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6),
    [roomCode],
  );

  const onCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void createRoom(nickname.trim());
  };

  const onJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void joinRoom(normalizedRoomCode, nickname.trim());
  };

  return (
    <main className="home-screen">
      <section className="home-hero">
        <div className="brand-lockup">
          <img src="/assets/oneshot-mark.svg" alt="" />
          <div>
            <p>OneShot</p>
            <h1>원샷</h1>
          </div>
        </div>
        <div className="home-forms">
          <form className="panel" onSubmit={onCreate}>
            <TextField
              label="닉네임"
              value={nickname}
              maxLength={16}
              autoComplete="nickname"
              placeholder="예: 민수"
              onChange={setNickname}
            />
            <Button type="submit" disabled={connecting || nickname.trim().length === 0}>
              <Plus size={18} />
              방 만들기
            </Button>
          </form>

          <form className="panel" onSubmit={onJoin}>
            <TextField
              label="방 코드"
              value={normalizedRoomCode}
              maxLength={6}
              inputMode="text"
              placeholder="ABCDE"
              onChange={setRoomCode}
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={connecting || nickname.trim().length === 0 || normalizedRoomCode.length < 4}
            >
              <Link size={18} />
              입장하기
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
};

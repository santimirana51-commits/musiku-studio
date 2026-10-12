import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlayerProvider, usePlayer } from "@/components/player-context";
import { VideoCard } from "@/components/video-card";

// PlayerProvider memakai useRouter/usePathname (navigasi ke /watch saat play).
// Mock agar bisa dirender di jsdom tanpa App Router.
const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/",
}));

const video = {
  videoId: "dQw4w9WgXcQ",
  title: "Lagu Tes",
  channelTitle: "Channel Tes",
  thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
};

function StatusProbe() {
  const p = usePlayer();
  return (
    <div>
      <span data-testid="current">{p.current?.title ?? "kosong"}</span>
      <button onClick={() => p.playOne(video)}>mainkan</button>
    </div>
  );
}

function QueueProbe() {
  const p = usePlayer();
  return (
    <div>
      <button onClick={() => p.playQueue([video], 0)}>antrekan</button>
    </div>
  );
}

describe("player", () => {
  it("menampilkan video terpilih setelah playOne", () => {
    render(
      <PlayerProvider>
        <StatusProbe />
      </PlayerProvider>
    );
    expect(screen.getByTestId("current")).toHaveTextContent("kosong");
    fireEvent.click(screen.getByText("mainkan"));
    expect(screen.getByTestId("current")).toHaveTextContent("Lagu Tes");
  });

  it("kartu video memicu onPlay", () => {
    let played = 0;
    render(
      <PlayerProvider>
        <VideoCard video={video} onPlay={() => (played += 1)} />
      </PlayerProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /putar lagu tes/i }));
    expect(played).toBe(1);
  });

  it("playOne navigasi ke /watch dari halaman lain", () => {
    pushMock.mockClear();
    render(
      <PlayerProvider>
        <StatusProbe />
      </PlayerProvider>
    );
    fireEvent.click(screen.getByText("mainkan"));
    expect(pushMock).toHaveBeenCalledWith("/watch?v=dQw4w9WgXcQ");
  });

  it("playQueue navigasi ke video awal", () => {
    pushMock.mockClear();
    render(
      <PlayerProvider>
        <QueueProbe />
      </PlayerProvider>
    );
    fireEvent.click(screen.getByText("antrekan"));
    expect(pushMock).toHaveBeenCalledWith("/watch?v=dQw4w9WgXcQ");
  });
});

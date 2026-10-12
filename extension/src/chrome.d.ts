// Deklarasi minimal API Chrome yang dipakai ekstensi (agar tanpa @types/chrome).
// Hanya subset yang benar-benar dipanggil — lihat docs di extension/README.md.

declare namespace chrome {
  namespace tabs {
    interface Tab {
      id?: number;
      title?: string;
      url?: string;
      audible?: boolean;
      mutedInfo?: { muted: boolean };
      active?: boolean;
    }
    interface QueryInfo {
      audible?: boolean;
      url?: string;
    }
    function query(q: QueryInfo): Promise<Tab[]>;
    function update(tabId: number, props: { active?: boolean; muted?: boolean }): Promise<Tab>;
    function get(tabId: number): Promise<Tab>;
    function sendMessage<T = unknown>(tabId: number, msg: unknown): Promise<T>;
    const onUpdated: {
      addListener(cb: (tabId: number, info: { audible?: boolean; status?: string }) => void): void;
    };
    const onRemoved: {
      addListener(cb: (tabId: number) => void): void;
    };
  }
  namespace runtime {
    interface MessageSender {
      tab?: tabs.Tab;
    }
    function sendMessage<T = unknown>(msg: unknown): Promise<T>;
    function getManifest(): { version: string };
    const onMessage: {
      addListener(
        cb: (
          msg: unknown,
          sender: MessageSender,
          respond: (r: unknown) => void
        ) => boolean | void | Promise<unknown>
      ): void;
    };
    const lastError: { message: string } | undefined;
  }
  namespace storage {
    interface Area {
      get(keys: string | string[] | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    }
    const local: Area;
    const session: Area;
  }
  namespace scripting {
    interface InjectionTarget {
      tabId: number;
    }
    function executeScript(args: {
      target: InjectionTarget;
      files?: string[];
      func?: (...a: never[]) => unknown;
      args?: unknown[];
      world?: "ISOLATED" | "MAIN";
    }): Promise<Array<{ result: unknown }>>;
  }
  namespace offscreen {
    enum Reason {
      AUDIO_PLAYBACK = "AUDIO_PLAYBACK",
    }
    function createDocument(args: {
      url: string;
      reasons: Reason[];
      justification: string;
    }): Promise<void>;
    function closeDocument(): Promise<void>;
    function hasDocument(): Promise<boolean>;
  }
  namespace permissions {
    function request(perms: { origins?: string[] }): Promise<boolean>;
    function contains(perms: { origins?: string[] }): Promise<boolean>;
  }
  namespace tabCapture {
    function getMediaStreamId(opts: { targetTabId: number }): Promise<string>;
  }
}

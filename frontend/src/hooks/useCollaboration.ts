import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import * as encoding from "lib0/encoding";
import { useCanvasStore } from "../store/canvasStore";
import api, { getErrorMessage } from "../utils/api";
import { useToastStore } from "../store/toastStore";

const WS_BASE =
  (import.meta.env.VITE_API_URL ?? "http://localhost:8080/api")
    .replace(/^http/, "ws")
    .replace(/\/api\/?$/, "");

export const CURSOR_COLORS = [
  "#3B82F6", "#22C55E", "#F97316", "#A855F7",
  "#EC4899", "#06B6D4", "#F59E0B", "#EF4444",
];

export interface RemoteCursor {
  clientId: number;
  name: string;
  color: string;
  x: number;
  y: number;
}

export interface RemoteUser {
  clientId: number;
  name: string;
  color: string;
}

interface CollabState {
  connected: boolean;
  remoteCursors: RemoteCursor[];
  remoteUsers: RemoteUser[];
  provider: WebsocketProvider | null;
  yDoc: Y.Doc;
  syncToYjs: () => void;
}

const collabStateRef: { current: CollabState | null } = { current: null };

export function getCollabState(): CollabState | null {
  return collabStateRef.current;
}

export function useCollaboration(projectId: string) {
  const yDocRef = useRef<Y.Doc>(null!);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const initialPopulatedRef = useRef(false);
  const yCanvasRef = useRef<Y.Map<string> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [connected, setConnected] = useState(false);

  if (!yDocRef.current) {
    yDocRef.current = new Y.Doc();
  }

  const getCanvas = useCallback(() => {
    if (!yCanvasRef.current) {
      yCanvasRef.current = yDocRef.current.getMap("canvas");
    }
    return yCanvasRef.current;
  }, []);

  const syncToYjs = useCallback(() => {
    const doc = yDocRef.current;
    const yCanvas = getCanvas();
    const { nodes, edges } = useCanvasStore.getState();
    doc.transact(() => {
      yCanvas.set("nodes", JSON.stringify(nodes));
      yCanvas.set("edges", JSON.stringify(edges));
    }, "local");
  }, [getCanvas]);

  const debouncedSync = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncToYjs();
    }, 200);
  }, [syncToYjs]);

  const persistState = useCallback(() => {
    const provider = providerRef.current;
    if (!provider?.ws || provider.ws.readyState !== WebSocket.OPEN) return;
    const doc = yDocRef.current;
    const state = Y.encodeStateAsUpdate(doc);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0);
    encoding.writeVarUint(encoder, 1);
    encoding.writeVarUint8Array(encoder, state);
    provider.ws.send(encoding.toUint8Array(encoder));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.post("/auth/ws-ticket");
        if (cancelled) return;

        const wsUrl = `${WS_BASE}/ws/yjs`;
        const doc = yDocRef.current;
        const provider = new WebsocketProvider(wsUrl, projectId, doc, {
          params: { ticket: data.ticket },
          connect: true,
        });

        providerRef.current = provider;
        const yCanvas = getCanvas();

        provider.on("status", (event: { status: string }) => {
          const isConnected = event.status === "connected";
          setConnected(isConnected);
          if (isConnected) {
            useCanvasStore.setState({ collabConnected: true });
          } else if (event.status === "disconnected") {
            useCanvasStore.setState({ collabConnected: false });
          }
        });

        provider.on("sync", (isSynced: boolean) => {
          if (isSynced && !initialPopulatedRef.current) {
            initialPopulatedRef.current = true;
            const hasRemoteData = yCanvas.get("nodes") !== undefined;
            if (!hasRemoteData) {
              const { nodes, edges } = useCanvasStore.getState();
              if (nodes.length > 0 || edges.length > 0) {
                doc.transact(() => {
                  yCanvas.set("nodes", JSON.stringify(nodes));
                  yCanvas.set("edges", JSON.stringify(edges));
                }, "local");
              }
            }
            persistState();
          }
        });

        yCanvas.observe((event: Y.YMapEvent<string>) => {
          if (event.transaction.origin === "local") return;
          const nodesStr = yCanvas.get("nodes");
          const edgesStr = yCanvas.get("edges");
          if (nodesStr !== undefined) {
            try {
              const nodes = JSON.parse(nodesStr);
              const edges = edgesStr ? JSON.parse(edgesStr) : [];
              useCanvasStore.setState({ nodes, edges });
            } catch { /* skip malformed */ }
          }
        });

        const awareness = provider.awareness;
        awareness.on("change", () => {
          const states = awareness.getStates();
          const cursors: RemoteCursor[] = [];
          const users: RemoteUser[] = [];
          const localId = doc.clientID;
          states.forEach((state: any, clientId: number) => {
            if (clientId === localId) return;
            if (state.cursor && state.cursor.x !== undefined) {
              cursors.push({
                clientId,
                name: state.name ?? "Anonymous",
                color: state.color ?? "#3B82F6",
                x: state.cursor.x,
                y: state.cursor.y,
              });
            }
            if (state.name) {
              users.push({
                clientId,
                name: state.name,
                color: state.color ?? "#3B82F6",
              });
            }
          });
          setRemoteCursors(cursors);
          setRemoteUsers(users);
        });

        persistTimerRef.current = setInterval(() => {
          persistState();
        }, 30000);

        collabStateRef.current = {
          connected: true,
          remoteCursors: [],
          remoteUsers: [],
          provider,
          yDoc: doc,
          syncToYjs,
        };
      } catch (err: any) {
        const msg = getErrorMessage(err, "Could not connect to collaboration service.");
        useToastStore.getState().addToast({ type: "error", title: "Collaboration failed", message: msg, duration: 5000 });
      }
    })();

    return () => {
      cancelled = true;
      if (persistTimerRef.current) {
        clearInterval(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
      initialPopulatedRef.current = false;
      setConnected(false);
      setRemoteCursors([]);
      setRemoteUsers([]);
      useCanvasStore.setState({ collabConnected: false });
      collabStateRef.current = null;
      if (yDocRef.current) {
        yDocRef.current.destroy();
        yDocRef.current = null!;
      }
    };
  }, [projectId, getCanvas, syncToYjs, persistState]);

  return {
    connected,
    remoteCursors,
    remoteUsers,
    syncToYjs,
    debouncedSync,
    persistState,
    provider: providerRef.current,
    yDoc: yDocRef.current,
  };
}

import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import {
  Alert,
  AppBar,
  Avatar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FileUploadRoundedIcon from "@mui/icons-material/FileUploadRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import QrCodeScannerRoundedIcon from "@mui/icons-material/QrCodeScannerRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import { BrowserQRCodeReader } from "@zxing/browser";
import { QRCodeCanvas } from "qrcode.react";
import type { ExpensePayload, LedgerEvent, LedgerPayload, PeerIdentity } from "./lib/crypto";
import {
  createLedgerEvent,
  createPeerIdentity,
  createRoomKey,
  decryptBackup,
  decryptPayload,
  encryptBackup,
  verifyLedgerEvent,
} from "./lib/crypto";
import { getEvents, getRooms, loadIdentity, saveEvents, saveIdentity, saveRoom } from "./lib/storage";
import type { PublicPeer, RoomInvite } from "./lib/p2p";
import { P2PTransport } from "./lib/p2p";
import type { RoomRecord } from "./lib/storage";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#635bff" },
    secondary: { main: "#ef8354" },
    background: { default: "#f5f6fb", paper: "#ffffff" },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
    button: { textTransform: "none", fontWeight: 700 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: { styleOverrides: { root: { boxShadow: "0 10px 30px rgba(28, 35, 66, .06)" } } },
    MuiTextField: { defaultProps: { variant: "outlined", size: "small" } },
  },
});

type Screen = "home" | "room";
type RoomTab = "ledger" | "members";
type ExpenseRow = { event: LedgerEvent; payload: ExpensePayload };
type DecodedEvent = { event: LedgerEvent; payload: LedgerPayload };
type BackupData = { version: 1; room: RoomRecord; events: LedgerEvent[] };

function makeRoomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `room_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function publicPeer(identity: PeerIdentity): PublicPeer {
  return { peerId: identity.peerId, alias: identity.alias, publicKey: identity.publicKey };
}

function money(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function shortId(value: string): string {
  return value.slice(-6).toUpperCase();
}

function heads(events: LedgerEvent[]): string[] {
  const referenced = new Set(events.flatMap((event) => event.parents));
  return events.map((event) => event.eventId).filter((id) => !referenced.has(id));
}

export default function App() {
  const [identity, setIdentity] = useState<PeerIdentity | null>(null);
  const identityRef = useRef<PeerIdentity | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [roomTab, setRoomTab] = useState<RoomTab>("ledger");
  const [room, setRoom] = useState<RoomRecord | null>(null);
  const roomRef = useRef<RoomRecord | null>(null);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const eventsRef = useRef<LedgerEvent[]>([]);
  const [members, setMembers] = useState<PublicPeer[]>([]);
  const [transportStatus, setTransportStatus] = useState("尚未连接");
  const [inviteText, setInviteText] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [joinInviteText, setJoinInviteText] = useState("");
  const [hostAnswerText, setHostAnswerText] = useState("");
  const [alias, setAlias] = useState("");
  const [roomName, setRoomName] = useState("周末聚餐");
  const [payerId, setPayerId] = useState("");
  const [payeeId, setPayeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupMode, setBackupMode] = useState<"export" | "import">("export");
  const [backupPassword, setBackupPassword] = useState("");
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [voidTarget, setVoidTarget] = useState<ExpenseRow | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<"invite" | "answer">("invite");
  const [snackbar, setSnackbar] = useState("");
  const [error, setError] = useState("");
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const transportRef = useRef<P2PTransport | null>(null);

  useEffect(() => {
    void Promise.all([loadIdentity(), getRooms()]).then(([storedIdentity, storedRooms]) => {
      if (storedIdentity) {
        setIdentity(storedIdentity);
        identityRef.current = storedIdentity;
        setAlias(storedIdentity.alias);
      }
      setRooms(storedRooms);
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "无法读取本地数据");
    });
    return () => transportRef.current?.close();
  }, []);

  const [decodedEvents, setDecodedEvents] = useState<DecodedEvent[]>([]);

  useEffect(() => {
    if (!room) {
      setDecodedEvents([]);
      return;
    }
    let active = true;
    void Promise.all(
      events.map(async (event) => {
        try {
          const payload = await decryptPayload(room.roomKey, event);
          return { event, payload };
        } catch {
          return null;
        }
      })
    ).then((result) => {
      if (active) setDecodedEvents(result.filter((value): value is DecodedEvent => value !== null));
    });
    return () => {
      active = false;
    };
  }, [events, room]);

  const voidedEventIds = useMemo(() => new Set(
    decodedEvents.flatMap(({ payload }) => payload.kind === "expense.voided" ? [payload.targetEventId] : [])
  ), [decodedEvents]);
  const rows = useMemo<ExpenseRow[]>(() => decodedEvents
    .filter((item): item is ExpenseRow => item.payload.kind === "expense" && !voidedEventIds.has(item.event.eventId))
    .sort((left, right) => left.event.createdAt - right.event.createdAt), [decodedEvents, voidedEventIds]);

  const membersById = useMemo(() => new Map(members.map((member) => [member.peerId, member])), [members]);
  const balances = useMemo(() => {
    const result = new Map<string, number>();
    for (const member of members) result.set(member.peerId, 0);
    for (const row of rows) {
      result.set(row.payload.payerId, (result.get(row.payload.payerId) ?? 0) - row.payload.amountCents);
      result.set(row.payload.payeeId, (result.get(row.payload.payeeId) ?? 0) + row.payload.amountCents);
    }
    return result;
  }, [members, rows]);

  function showError(reason: unknown) {
    setError(reason instanceof Error ? reason.message : "操作失败");
  }

  function addMember(peer: PublicPeer) {
    setMembers((current) => {
      if (current.some((member) => member.peerId === peer.peerId)) {
        return current.map((member) => member.peerId === peer.peerId ? peer : member);
      }
      return [...current, peer];
    });
  }

  function setActiveRoom(nextRoom: RoomRecord, nextIdentity: PeerIdentity, nextEvents: LedgerEvent[], nextMembers: PublicPeer[]) {
    setRoom(nextRoom);
    roomRef.current = nextRoom;
    setIdentity(nextIdentity);
    identityRef.current = nextIdentity;
    setEvents(nextEvents);
    eventsRef.current = nextEvents;
    setMembers(nextMembers);
    setInviteText(nextRoom.inviteText ?? "");
    setAnswerText(nextRoom.answerText ?? "");
    setPayerId(nextIdentity.peerId);
    setPayeeId(nextMembers.find((member) => member.peerId !== nextIdentity.peerId)?.peerId ?? "");
    setScreen("room");
    setRoomTab("ledger");
  }

  function createTransport(nextRoom: RoomRecord, nextIdentity: PeerIdentity): P2PTransport {
    const transport = new P2PTransport({
      role: nextRoom.role,
      roomId: nextRoom.roomId,
      identity: nextIdentity,
      getEvents: () => getEvents(nextRoom.roomId),
      onEvents: (incoming) => {
        void mergeEvents(nextRoom, incoming);
      },
      onPeer: addMember,
      onStatus: setTransportStatus,
    });
    transportRef.current = transport;
    return transport;
  }

  async function mergeEvents(activeRoom: RoomRecord, incoming: LedgerEvent[]) {
    const existing = new Set(eventsRef.current.map((event) => event.eventId));
    const candidates = incoming.filter((event) => !existing.has(event.eventId));
    const verified: LedgerEvent[] = [];
    for (const event of candidates) {
      if (!(await verifyLedgerEvent(event, activeRoom.roomId))) continue;
      try {
        await decryptPayload(activeRoom.roomKey, event);
        verified.push(event);
      } catch {
        setTransportStatus("收到无法解密的账单，已忽略");
      }
    }
    if (!verified.length) return;
    const next = [...eventsRef.current, ...verified].sort((left, right) => left.createdAt - right.createdAt);
    eventsRef.current = next;
    setEvents(next);
    await saveEvents(verified);
  }

  async function ensureIdentity(nextAlias: string): Promise<PeerIdentity> {
    const cleanAlias = nextAlias.trim();
    if (!cleanAlias) throw new Error("请先输入一个代号");
    const current = identityRef.current;
    const next = current ? { ...current, alias: cleanAlias } : await createPeerIdentity(cleanAlias);
    await saveIdentity(next);
    setIdentity(next);
    identityRef.current = next;
    setAlias(cleanAlias);
    return next;
  }

  async function createRoom() {
    try {
      const nextIdentity = await ensureIdentity(alias);
      const nextRoom: RoomRecord = {
        roomId: makeRoomId(),
        name: roomName.trim() || "临时账本",
        roomKey: await createRoomKey(),
        role: "host",
        createdAt: Date.now(),
        hostPeerId: nextIdentity.peerId,
        hostAlias: nextIdentity.alias,
        hostPublicKey: nextIdentity.publicKey,
      };
      await saveRoom(nextRoom);
      const transport = createTransport(nextRoom, nextIdentity);
      setActiveRoom(nextRoom, nextIdentity, [], [publicPeer(nextIdentity)]);
      setCreateOpen(false);
      const nextInvite = await transport.createHostInvite({
        roomId: nextRoom.roomId,
        roomName: nextRoom.name,
        roomKey: nextRoom.roomKey,
      });
      const savedRoom = { ...nextRoom, inviteText: nextInvite, lastOpenedAt: Date.now() };
      await saveRoom(savedRoom);
      setRoom(savedRoom);
      roomRef.current = savedRoom;
      setInviteText(nextInvite);
      setRooms(await getRooms());
    } catch (reason) {
      showError(reason);
    }
  }

  async function joinRoom(rawInvite = joinInviteText) {
    try {
      const nextIdentity = await ensureIdentity(alias);
      const invite = JSON.parse(rawInvite) as RoomInvite;
      if (invite.kind !== "ledger.offer" || !invite.roomId || !invite.roomKey) {
        throw new Error("邀请文本格式不正确");
      }
      const nextRoom: RoomRecord = {
        roomId: invite.roomId,
        name: invite.roomName,
        roomKey: invite.roomKey,
        role: "guest",
        createdAt: Date.now(),
        hostPeerId: invite.host.peerId,
        hostAlias: invite.host.alias,
        hostPublicKey: invite.host.publicKey,
      };
      const previousEvents = await getEvents(nextRoom.roomId);
      await saveRoom(nextRoom);
      const transport = createTransport(nextRoom, nextIdentity);
      const result = await transport.joinFromInvite(rawInvite);
      const savedRoom = { ...nextRoom, inviteText: rawInvite, answerText: result.answer, lastOpenedAt: Date.now() };
      await saveRoom(savedRoom);
      setActiveRoom(savedRoom, nextIdentity, previousEvents, [invite.host, publicPeer(nextIdentity)]);
      setJoinInviteText("");
      setJoinOpen(false);
    } catch (reason) {
      showError(reason);
    }
  }

  async function openSavedRoom(savedRoom: RoomRecord) {
    try {
      const activeIdentity = identityRef.current;
      if (!activeIdentity) throw new Error("本机身份还没有准备好");
      transportRef.current?.close();
      const previousEvents = await getEvents(savedRoom.roomId);
      const reopenedRoom = { ...savedRoom, lastOpenedAt: Date.now() };
      const transport = createTransport(reopenedRoom, activeIdentity);
      const initialMembers: PublicPeer[] = [
        { peerId: reopenedRoom.hostPeerId, alias: reopenedRoom.hostAlias, publicKey: reopenedRoom.hostPublicKey ?? activeIdentity.publicKey },
        ...(reopenedRoom.hostPeerId === activeIdentity.peerId ? [] : [publicPeer(activeIdentity)]),
      ];
      if (reopenedRoom.role === "host") {
        const nextInvite = await transport.createHostInvite({
          roomId: reopenedRoom.roomId,
          roomName: reopenedRoom.name,
          roomKey: reopenedRoom.roomKey,
        });
        const nextRoom = { ...reopenedRoom, inviteText: nextInvite };
        await saveRoom(nextRoom);
        setActiveRoom(nextRoom, activeIdentity, previousEvents, [publicPeer(activeIdentity)]);
        setInviteText(nextInvite);
      } else {
        setActiveRoom(reopenedRoom, activeIdentity, previousEvents, initialMembers);
        if (reopenedRoom.inviteText) {
          const result = await transport.joinFromInvite(reopenedRoom.inviteText);
          const nextRoom = { ...reopenedRoom, answerText: result.answer };
          await saveRoom(nextRoom);
          setRoom(nextRoom);
          roomRef.current = nextRoom;
          setAnswerText(result.answer);
        }
      }
      setRooms(await getRooms());
    } catch (reason) {
      showError(reason);
    }
  }

  async function acceptHostAnswer(rawAnswer = hostAnswerText) {
    try {
      await transportRef.current?.acceptHostAnswer(rawAnswer);
      setHostAnswerText("");
      setSnackbar("成员正在连接");
    } catch (reason) {
      showError(reason);
    }
  }

  async function addExpense() {
    try {
      const activeRoom = roomRef.current;
      const activeIdentity = identityRef.current;
      const numericAmount = Number(amount);
      if (!activeRoom || !activeIdentity) throw new Error("当前没有打开的房间");
      if (!payerId || !payeeId) throw new Error("请选择付款人和收款人");
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error("请输入有效金额");
      const amountCents = Math.round(numericAmount * 100);
      if (amountCents <= 0) throw new Error("金额必须大于 0.01");
      const payload: LedgerPayload = { kind: "expense", payerId, payeeId, amountCents, note: note.trim() };
      const event = await createLedgerEvent({
        roomId: activeRoom.roomId,
        roomKey: activeRoom.roomKey,
        identity: activeIdentity,
        parents: heads(eventsRef.current),
        kind: "expense.added",
        payload,
      });
      await mergeEvents(activeRoom, [event]);
      transportRef.current?.broadcastEvents([event]);
      setAmount("");
      setNote("");
      setSnackbar("账单已加密并广播");
    } catch (reason) {
      showError(reason);
    }
  }

  async function voidExpense(row: ExpenseRow) {
    try {
      const activeRoom = roomRef.current;
      const activeIdentity = identityRef.current;
      if (!activeRoom || !activeIdentity) throw new Error("当前没有打开的房间");
      const event = await createLedgerEvent({
        roomId: activeRoom.roomId,
        roomKey: activeRoom.roomKey,
        identity: activeIdentity,
        parents: heads(eventsRef.current),
        kind: "expense.voided",
        payload: { kind: "expense.voided", targetEventId: row.event.eventId, reason: "成员撤销" },
      });
      await mergeEvents(activeRoom, [event]);
      transportRef.current?.broadcastEvents([event]);
      setSnackbar("账单已撤销，历史事件仍保留");
    } catch (reason) {
      showError(reason);
    }
  }

  function leaveRoom() {
    transportRef.current?.close();
    transportRef.current = null;
    roomRef.current = null;
    eventsRef.current = [];
    setRoom(null);
    setEvents([]);
    setMembers([]);
    setInviteText("");
    setAnswerText("");
    setHostAnswerText("");
    setScreen("home");
    void getRooms().then(setRooms).catch(showError);
  }

  function openBackup(mode: "export" | "import") {
    setBackupMode(mode);
    setBackupPassword("");
    setBackupFile(null);
    setBackupOpen(true);
  }

  function openScanner(target: "invite" | "answer") {
    setScanTarget(target);
    setScannerOpen(true);
  }

  async function exportLedger(password: string) {
    if (!room) return;
    const content = await encryptBackup(password, { version: 1, room, events } satisfies BackupData);
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${room.name}-${room.roomId}.ledger-backup.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setBackupOpen(false);
    setSnackbar("已导出加密备份");
  }

  async function importLedger(password: string, file: File) {
    const content = await file.text();
    const backup = await decryptBackup<BackupData>(password, content);
    if (backup.version !== 1 || !backup.room?.roomId || !backup.room.roomKey || !Array.isArray(backup.events)) {
      throw new Error("备份内容不完整");
    }
    const validEvents = [] as LedgerEvent[];
    for (const event of backup.events) {
      if (!(await verifyLedgerEvent(event, backup.room.roomId))) throw new Error("备份中包含无法验证的账单事件");
      validEvents.push(event);
    }
    await saveRoom({ ...backup.room, lastOpenedAt: Date.now() });
    await saveEvents(validEvents);
    setRooms(await getRooms());
    setBackupOpen(false);
    setSnackbar("备份已导入到本机");
  }

  const currentAlias = identity?.alias ?? alias;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {screen === "home" ? (
        <HomeScreen
          alias={currentAlias}
          setAlias={setAlias}
          rooms={rooms}
          onCreate={() => setCreateOpen(true)}
          onJoin={() => setJoinOpen(true)}
          onOpenRoom={(savedRoom) => void openSavedRoom(savedRoom)}
          onImportBackup={() => openBackup("import")}
        />
      ) : room && identity ? (
        <RoomScreen
          room={room}
          identity={identity}
          members={members}
          membersById={membersById}
          balances={balances}
          rows={rows}
          tab={roomTab}
          setTab={setRoomTab}
          inviteText={inviteText}
          setInviteText={setInviteText}
          answerText={answerText}
          hostAnswerText={hostAnswerText}
          setHostAnswerText={setHostAnswerText}
          transportStatus={transportStatus}
          payerId={payerId}
          setPayerId={setPayerId}
          payeeId={payeeId}
          setPayeeId={setPayeeId}
          amount={amount}
          setAmount={setAmount}
          note={note}
          setNote={setNote}
          onAcceptAnswer={() => void acceptHostAnswer()}
          onScanAnswer={() => openScanner("answer")}
          onAddExpense={() => void addExpense()}
          onVoidExpense={(row) => setVoidTarget(row)}
          onCopy={(message) => setSnackbar(message)}
          onExport={() => openBackup("export")}
          onLeave={leaveRoom}
          onNewInvite={() => {
            void (async () => {
              try {
                const activeRoom = roomRef.current;
                const activeIdentity = identityRef.current;
                const transport = transportRef.current;
                if (!activeRoom || !activeIdentity || !transport) return;
                setInviteText(await transport.createHostInvite({ roomId: activeRoom.roomId, roomName: activeRoom.name, roomKey: activeRoom.roomKey }));
              } catch (reason) {
                showError(reason);
              }
            })();
          }}
        />
      ) : null}

      <DialogForm
        open={createOpen}
        title="创建本地账本"
        description="不需要账号。代号只存在于你的设备和房间事件中。"
        action="生成邀请"
        onClose={() => setCreateOpen(false)}
        onSubmit={() => void createRoom()}
      >
        <TextField label="我的代号" value={alias} onChange={(event) => setAlias(event.target.value)} autoFocus fullWidth slotProps={{ htmlInput: { maxLength: 16 } }} />
        <TextField label="账本名称" value={roomName} onChange={(event) => setRoomName(event.target.value)} fullWidth slotProps={{ htmlInput: { maxLength: 24 } }} />
      </DialogForm>

      <BackupDialog
        open={backupOpen}
        mode={backupMode}
        password={backupPassword}
        file={backupFile}
        onPasswordChange={setBackupPassword}
        onFileChange={setBackupFile}
        onClose={() => setBackupOpen(false)}
        onSubmit={() => void (backupMode === "export"
          ? exportLedger(backupPassword).catch(showError)
          : backupFile
            ? importLedger(backupPassword, backupFile).catch(showError)
            : Promise.reject(new Error("请选择备份文件"))).catch(showError)}
      />

      <Dialog open={Boolean(voidTarget)} onClose={() => setVoidTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>撤销这笔账单？</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">历史事件不会删除，只会新增一条撤销事件。其他成员同步后，余额会自动回滚。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVoidTarget(null)}>保留</Button>
          <Button color="warning" variant="contained" onClick={() => {
            if (voidTarget) void voidExpense(voidTarget);
            setVoidTarget(null);
          }}>确认撤销</Button>
        </DialogActions>
      </Dialog>

      <DialogForm
        open={joinOpen}
        title="加入本地账本"
        description="输入代号后，扫描房主展示的房间二维码。"
        action="扫描二维码"
        onClose={() => setJoinOpen(false)}
        onSubmit={() => openScanner("invite")}
      >
        <TextField label="我的代号" value={alias} onChange={(event) => setAlias(event.target.value)} autoFocus fullWidth slotProps={{ htmlInput: { maxLength: 16 } }} />
        <Alert severity="info">让房主在另一台设备展示房间二维码。扫描成功后会自动加入，不需要复制文本。</Alert>
      </DialogForm>

      <QrScannerDialog
        open={scannerOpen}
        title={scanTarget === "invite" ? "扫描房间邀请" : "扫描成员回答"}
        onClose={() => setScannerOpen(false)}
        onDetected={(value) => {
          setScannerOpen(false);
          if (scanTarget === "invite") {
            setJoinInviteText(value);
            void joinRoom(value);
          } else {
            setHostAnswerText(value);
            void acceptHostAnswer(value);
          }
        }}
      />

      <Snackbar open={Boolean(snackbar)} autoHideDuration={2400} message={snackbar} onClose={() => setSnackbar("")} />
      <Snackbar open={Boolean(error)} autoHideDuration={5000} message={error} onClose={() => setError("")} />
    </ThemeProvider>
  );
}

function DialogForm(props: {
  open: boolean;
  title: string;
  description: string;
  action: string;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="xs">
      <DialogTitle>{props.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">{props.description}</Typography>
          {props.children}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>取消</Button>
        <Button variant="contained" onClick={props.onSubmit}>{props.action}</Button>
      </DialogActions>
    </Dialog>
  );
}

function BackupDialog(props: {
  open: boolean;
  mode: "export" | "import";
  password: string;
  file: File | null;
  onPasswordChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="xs">
      <DialogTitle>{props.mode === "export" ? "导出加密备份" : "导入加密备份"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="warning">密码不会保存，也不会通过网络发送。忘记密码无法恢复备份。</Alert>
          <TextField
            label="备份密码"
            type="password"
            value={props.password}
            onChange={(event) => props.onPasswordChange(event.target.value)}
            helperText="至少 6 位"
            autoFocus
            fullWidth
          />
          {props.mode === "import" && (
            <Button component="label" variant="outlined" startIcon={<FileUploadRoundedIcon />}>
              {props.file?.name ?? "选择备份文件"}
              <input hidden type="file" accept="application/json,.json" onChange={(event) => props.onFileChange(event.target.files?.[0] ?? null)} />
            </Button>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>取消</Button>
        <Button variant="contained" disabled={props.password.length < 6 || (props.mode === "import" && !props.file)} onClick={props.onSubmit}>
          {props.mode === "export" ? "导出文件" : "导入账本"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function QrScannerDialog(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  onDetected: (value: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [scannerError, setScannerError] = useState("");
  const { open, onDetected } = props;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let controls: { stop: () => void } | undefined;
    let frame = 0;
    let activeVideoElement: HTMLVideoElement | null = null;

    async function waitForVideoElement(): Promise<HTMLVideoElement | null> {
      for (let attempt = 0; attempt < 60; attempt += 1) {
        if (cancelled) return null;
        const videoElement = videoRef.current;
        if (videoElement) return videoElement;
        await new Promise<void>((resolve) => {
          frame = window.requestAnimationFrame(() => resolve());
        });
      }
      return null;
    }

    async function startScanner() {
      setScannerError("");
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerError("当前环境无法访问摄像头，请使用 HTTPS 或 localhost。");
        return;
      }
      const videoElement = await waitForVideoElement();
      if (cancelled) return;
      if (!videoElement) {
        setScannerError("相机预览未能启动，请关闭后重试。");
        return;
      }
      activeVideoElement = videoElement;
      try {
        const reader = new BrowserQRCodeReader();
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoElement,
          (result) => {
            if (cancelled || !result) return;
            cancelled = true;
            onDetected(result.getText());
          },
        );
      } catch (reason) {
        if (cancelled) return;
        if (reason instanceof DOMException && reason.name === "NotAllowedError") {
          setScannerError("摄像头权限被拒绝。请在浏览器地址栏的网站权限中允许摄像头，然后重试。");
        } else if (reason instanceof DOMException && (reason.name === "NotFoundError" || reason.name === "DevicesNotFoundError")) {
          setScannerError("没有检测到可用摄像头。");
        } else if (reason instanceof DOMException && reason.name === "NotReadableError") {
          setScannerError("摄像头正被其他应用占用，请关闭其他相机应用后重试。");
        } else {
          setScannerError("无法启动摄像头，请检查网站权限或关闭正在使用摄像头的应用后重试。");
        }
      }
    }

    void startScanner();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      controls?.stop();
      if (activeVideoElement) activeVideoElement.srcObject = null;
    };
  }, [open, onDetected]);

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="xs">
      <DialogTitle>{props.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Box sx={{ overflow: "hidden", borderRadius: 3, bgcolor: "#111", aspectRatio: "1 / 1" }}>
            <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </Box>
          <Typography variant="body2" color="text.secondary">把二维码放在取景框内，识别成功后会自动完成连接。</Typography>
          {scannerError && <Alert severity="warning">{scannerError}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={props.onClose}>关闭</Button></DialogActions>
    </Dialog>
  );
}

function HomeScreen(props: {
  alias: string;
  setAlias: (value: string) => void;
  rooms: RoomRecord[];
  onCreate: () => void;
  onJoin: () => void;
  onOpenRoom: (room: RoomRecord) => void;
  onImportBackup: () => void;
}) {
  return (
    <Box sx={{ minHeight: "100dvh", background: "linear-gradient(180deg, #edeaff 0%, #f5f6fb 38%)" }}>
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar>
          <LockRoundedIcon sx={{ color: "primary.main", mr: 1 }} />
          <Typography variant="h6" color="text.primary" sx={{ fontWeight: 800 }}>随手记账</Typography>
          <Box sx={{ flex: 1 }} />
          <Chip size="small" icon={<WifiRoundedIcon />} label="P2P" color="primary" variant="outlined" />
        </Toolbar>
      </AppBar>
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Box sx={{ px: 1, pt: 3 }}>
            <Typography variant="h3" sx={{ maxWidth: 420, fontWeight: 900, letterSpacing: "-0.05em" }}>
              不用注册，和朋友一起把账记清楚。
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 430, lineHeight: 1.8 }}>
              每个人用一个代号进入房间。账单在设备之间加密广播，本地保存，不经过中心化业务服务器。
            </Typography>
          </Box>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <TextField label="我的代号" value={props.alias} onChange={(event) => props.setAlias(event.target.value)} placeholder="例如：小王" fullWidth />
                <Button size="large" variant="contained" startIcon={<AddRoundedIcon />} onClick={props.onCreate}>创建本地账本</Button>
                <Button size="large" variant="outlined" startIcon={<GroupsRoundedIcon />} onClick={props.onJoin}>加入朋友的账本</Button>
                <Button size="small" startIcon={<FileUploadRoundedIcon />} onClick={props.onImportBackup}>导入加密备份</Button>
              </Stack>
            </CardContent>
          </Card>
          <Alert icon={<LockRoundedIcon />} severity="info">
            账单使用房间密钥加密，并带有创建者签名和事件哈希。请用 HTTPS 或 localhost 打开。
          </Alert>
          {props.rooms.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>本机曾打开的账本</Typography>
              <Card variant="outlined">
                <List disablePadding>
                  {props.rooms.slice(0, 3).map((room) => (
                    <ListItem key={room.roomId} secondaryAction={<Button size="small" onClick={() => props.onOpenRoom(room)}>打开</Button>}>
                      <ListItemAvatar><Avatar sx={{ bgcolor: "primary.light" }}><ReceiptLongRoundedIcon /></Avatar></ListItemAvatar>
                      <ListItemText primary={room.name} secondary={`${room.role === "host" ? "房主" : "成员"} · ${shortId(room.roomId)}`} />
                    </ListItem>
                  ))}
                </List>
              </Card>
            </Box>
          )}
        </Stack>
      </Container>
    </Box>
  );
}

function RoomScreen(props: {
  room: RoomRecord;
  identity: PeerIdentity;
  members: PublicPeer[];
  membersById: Map<string, PublicPeer>;
  balances: Map<string, number>;
  rows: ExpenseRow[];
  tab: RoomTab;
  setTab: (value: RoomTab) => void;
  inviteText: string;
  setInviteText: (value: string) => void;
  answerText: string;
  hostAnswerText: string;
  setHostAnswerText: (value: string) => void;
  transportStatus: string;
  payerId: string;
  setPayerId: (value: string) => void;
  payeeId: string;
  setPayeeId: (value: string) => void;
  amount: string;
  setAmount: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  onAcceptAnswer: () => void;
  onScanAnswer: () => void;
  onAddExpense: () => void;
  onVoidExpense: (row: ExpenseRow) => void;
  onCopy: (message: string) => void;
  onExport: () => void;
  onLeave: () => void;
  onNewInvite: () => void;
}) {
  return (
    <Box sx={{ minHeight: "100dvh", pb: 9 }}>
      <AppBar position="sticky" elevation={0}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={props.onLeave} aria-label="返回"><ArrowBackRoundedIcon /></IconButton>
          <Box sx={{ ml: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 800 }}>{props.room.name}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.78 }}>{props.identity.alias} · {props.transportStatus}</Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            <Chip size="small" label={shortId(props.room.roomId)} sx={{ color: "white", borderColor: "rgba(255,255,255,.5)" }} variant="outlined" />
            <Chip size="small" label={`${props.members.length} 人`} sx={{ color: "white", borderColor: "rgba(255,255,255,.5)" }} variant="outlined" />
          </Stack>
        </Toolbar>
      </AppBar>
      <Container maxWidth="sm" sx={{ pt: 2, pb: 14 }}>
        <Stack spacing={2}>
          <ConnectionCard {...props} />
          {props.tab === "ledger" ? <LedgerTab {...props} /> : <MembersTab {...props} />}
        </Stack>
      </Container>
      <Paper sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10, borderRadius: 0 }} elevation={8}>
        <BottomNavigation value={props.tab} onChange={(_, value: RoomTab) => props.setTab(value)} showLabels>
          <BottomNavigationAction value="ledger" label="账单" icon={<ReceiptLongRoundedIcon />} />
          <BottomNavigationAction value="members" label="成员与同步" icon={<GroupsRoundedIcon />} />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}

function ConnectionCard(props: Pick<RoomScreenProps, "room" | "inviteText" | "answerText" | "onScanAnswer" | "onNewInvite" | "transportStatus">) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const connected = props.transportStatus === "P2P 已连接";
  const hostLinkInterrupted = props.transportStatus === "直连暂时中断，账本仍保存在本地";
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <WifiRoundedIcon color="primary" />
            <Box>
              <Typography sx={{ fontWeight: 800 }}>端到端连接</Typography>
              <Typography variant="caption" color="text.secondary">WebRTC 点对点 · {props.transportStatus}</Typography>
            </Box>
            {connected && <Button size="small" onClick={() => setDetailsOpen((current) => !current)}>{detailsOpen ? "收起" : "连接设置"}</Button>}
          </Stack>
          {connected && !detailsOpen ? (
            <Alert severity="success" icon={<CheckCircleRoundedIcon />}>连接正常，账单会自动同步到房间成员。</Alert>
          ) : props.room.role === "host" ? (
            <>
              <Typography variant="body2" color="text.secondary">让朋友扫描这张二维码加入房间。每位朋友需要单独建立一次连接。</Typography>
              {props.inviteText && <Box sx={{ display: "flex", justifyContent: "center", p: 1, bgcolor: "white", borderRadius: 2 }}><QRCodeCanvas value={props.inviteText} size={240} level="L" includeMargin /></Box>}
              <Button size="small" variant="outlined" onClick={props.onNewInvite}>刷新邀请二维码</Button>
              <Divider />
              <Typography variant="body2" color="text.secondary">成员加入后，让他展示手机上的回答二维码。</Typography>
              <Button variant="contained" startIcon={<QrCodeScannerRoundedIcon />} onClick={props.onScanAnswer}>扫描成员二维码</Button>
            </>
          ) : (
            <>
              <Alert severity={hostLinkInterrupted ? "warning" : props.answerText ? "success" : "info"} icon={hostLinkInterrupted ? undefined : props.answerText ? <CheckCircleRoundedIcon /> : undefined}>
                {hostLinkInterrupted ? "房主连接已断开；已建立的成员直连仍可继续同步。新成员加入需要房主重新在线。" : props.answerText ? "请让房主扫描这张二维码。" : "等待房主建立连接。"}
              </Alert>
              {props.answerText && <Box sx={{ display: "flex", justifyContent: "center", p: 1, bgcolor: "white", borderRadius: 2 }}><QRCodeCanvas value={props.answerText} size={240} level="L" includeMargin /></Box>}
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

type RoomScreenProps = ComponentProps<typeof RoomScreen>;

function LedgerTab(props: Pick<RoomScreenProps, "members" | "membersById" | "balances" | "rows" | "payerId" | "setPayerId" | "payeeId" | "setPayeeId" | "amount" | "setAmount" | "note" | "setNote" | "onAddExpense" | "onVoidExpense">) {
  const totalSpent = props.rows.reduce((sum, row) => sum + row.payload.amountCents, 0);
  return (
    <>
      <Card>
        <CardContent>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-end", mb: 1.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">累计支出</Typography>
              <Typography variant="h4" sx={{ fontWeight: 850, letterSpacing: "-0.04em" }}>{money(totalSpent)}</Typography>
            </Box>
            <Chip size="small" label={`${props.rows.length} 笔有效账单`} variant="outlined" />
          </Stack>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>当前净余额</Typography>
          <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 1 }}>
            {props.members.map((member) => {
              const balance = props.balances.get(member.peerId) ?? 0;
              return <Chip key={member.peerId} label={`${member.alias} ${balance >= 0 ? "+" : ""}${money(balance)}`} color={balance > 0 ? "success" : balance < 0 ? "warning" : "default"} />;
            })}
          </Stack>
          <Typography variant="caption" color="text.secondary">正数表示应收，负数表示应付。余额由账单事件实时重算。</Typography>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><AddRoundedIcon color="primary" /><Typography sx={{ fontWeight: 800 }}>新增一笔</Typography></Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <MemberSelect label="谁先付" value={props.payerId} onChange={props.setPayerId} members={props.members} />
              <MemberSelect label="记给谁" value={props.payeeId} onChange={props.setPayeeId} members={props.members} />
            </Stack>
            <TextField label="金额" value={props.amount} onChange={(event) => props.setAmount(event.target.value)} type="number" slotProps={{ htmlInput: { min: 0, step: "0.01", inputMode: "decimal" }, input: { startAdornment: <InputAdornment position="start">¥</InputAdornment> } }} fullWidth />
            <TextField label="备注（可选）" value={props.note} onChange={(event) => props.setNote(event.target.value)} placeholder="例如：火锅、打车、住宿" fullWidth />
            <Button size="large" variant="contained" onClick={props.onAddExpense}>加密并广播账单</Button>
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent sx={{ pb: 1 }}><Typography sx={{ fontWeight: 800 }}>账单流水</Typography></CardContent>
        <List disablePadding>
          {props.rows.length === 0 ? <ListItem><ListItemText primary="还没有账单" secondary="添加第一笔共同支出吧" /></ListItem> : props.rows.slice().reverse().map((row) => {
            const payer = props.membersById.get(row.payload.payerId)?.alias ?? shortId(row.payload.payerId);
            const payee = props.membersById.get(row.payload.payeeId)?.alias ?? shortId(row.payload.payeeId);
            return <ListItem key={row.event.eventId} divider secondaryAction={<IconButton edge="end" aria-label="撤销账单" title="撤销账单" onClick={() => props.onVoidExpense(row)}><UndoRoundedIcon /></IconButton>}><ListItemAvatar><Avatar sx={{ bgcolor: "secondary.light" }}><ReceiptLongRoundedIcon /></Avatar></ListItemAvatar><ListItemText primary={`${payer} → ${payee}  ${money(row.payload.amountCents)}`} secondary={`${row.payload.note || "共同支出"} · ${row.event.actorAlias} · ${formatDate(row.event.createdAt)}`} /></ListItem>;
          })}
        </List>
      </Card>
    </>
  );
}

function MembersTab(props: Pick<RoomScreenProps, "members" | "identity" | "onExport">) {
  return (
    <>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography sx={{ fontWeight: 800 }}>房间成员</Typography>
            <List disablePadding>
              {props.members.map((member) => <ListItem key={member.peerId} disableGutters><ListItemAvatar><Avatar>{member.alias.slice(0, 1)}</Avatar></ListItemAvatar><ListItemText primary={member.alias === props.identity.alias ? `${member.alias}（我）` : member.alias} secondary={`身份指纹 ${shortId(member.peerId)}`} /></ListItem>)}
            </List>
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography sx={{ fontWeight: 800 }}>账本安全</Typography>
            <Typography variant="body2" color="text.secondary">每笔账单都使用房间密钥加密，并由创建者设备签名。所有成员本地保存事件副本，广播重复消息会自动去重。</Typography>
            <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={props.onExport}>导出本地账本</Button>
          </Stack>
        </CardContent>
      </Card>
    </>
  );
}

function MemberSelect(props: { label: string; value: string; onChange: (value: string) => void; members: PublicPeer[] }) {
  return (
    <FormControl fullWidth size="small">
      <InputLabel>{props.label}</InputLabel>
      <Select label={props.label} value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {props.members.map((member) => <MenuItem key={member.peerId} value={member.peerId}>{member.alias}</MenuItem>)}
      </Select>
    </FormControl>
  );
}

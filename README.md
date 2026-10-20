# 随手记账（mahjong）

打牌、聚餐、出游时用的多人记账 Web App。无需注册登录，也不需要业务服务器：同一房间的手机通过 WebRTC 直接互联，账单加密后在成员之间点对点同步，数据只保存在各自的设备上。

**在线使用：** https://mahjong.b1gben.org

## 特点

- **免账号**：输入一个代号就能创建或加入账本。
- **扫码入房**：房主展示邀请二维码，成员扫码后生成回答二维码，房主再扫一次即可建立连接。
- **点对点同步**：成员之间全互联（mesh），账单事件通过去重 gossip 传播，不经过房主中转；房主离线后已连接的成员仍可继续同步。
- **端到端加密**：账单内容用房间密钥 AES-GCM 加密，每个事件带 ECDSA P-256 签名和 SHA-256 哈希，防篡改、可去重。
- **只追加的账本**：撤销账单会生成一条撤销事件，不删除历史；余额由全部事件重算。
- **本地存储与备份**：身份、房间和事件保存在 IndexedDB；支持用密码加密导出备份（PBKDF2-SHA-256 210,000 次 + AES-GCM）并导入恢复。
- **移动端界面**：Material UI，底部导航分“账单”和“成员与同步”两页。

## 使用流程

1. 输入自己的代号和账本名称，创建本地账本。
2. 房主打开邀请二维码，成员扫码，自动生成回答二维码。
3. 房主扫描回答二维码，双方建立 WebRTC 连接。
4. 任意成员记一笔：选择“谁先付”“记给谁”、金额和备注，事件加密后广播给所有成员。
5. 账单页实时显示每个人的余额。

## 本地开发

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173，已开启 host: true
```

根目录的 `package.json` 也提供了转发脚本：`npm run dev` / `npm run build` / `npm run lint`。

> 通过 `http://localhost` 访问时可以正常使用。从局域网其他设备访问必须走 HTTPS：Web Crypto 和摄像头扫码都要求安全上下文。

## 部署

应用是纯静态前端，不需要数据库或后端：

```bash
cd frontend
npm run build      # 输出 frontend/dist
```

把 `frontend/dist` 放到任意 HTTPS 静态站点（Nginx、Caddy 等）即可。

### ICE / TURN 配置

设备在同一 Wi-Fi 下通常不需要任何 ICE Server。需要跨网络连接时，在构建前通过 `VITE_ICE_SERVERS` 传入 `RTCPeerConnection` 的 `iceServers` 数组（示例见 `frontend/.env.example`）：

```bash
VITE_ICE_SERVERS='[{"urls":["stun:stun.example.com:3478"]},{"urls":["turns:turn.example.com:5349"],"username":"临时用户名","credential":"临时密码"}]'
```

TURN 凭证应由服务端按短时效动态生成，不要把长期账号密码提交到前端或 Git。

## 限制

- 跨网络、复杂 NAT 或开启了 Wi-Fi 客户端隔离时可能需要 TURN，甚至无法直连。
- 全互联的连接数按 `n × (n − 1) / 2` 增长，适合小型面对面房间，不适合大群组。
- 新成员加入需要房主在线完成信令；目前通过二维码手动交换信令。若要实现“输入房间码自动加入”，还需要一个只保存临时连接状态的 WSS 信令服务。
- 邀请二维码包含房间密钥，相当于入场凭证，不要发到公开渠道。

## 技术栈

React 18 · TypeScript · Vite 5 · Material UI · WebRTC DataChannel · Web Crypto · IndexedDB · `@zxing/browser`（扫码）· `qrcode.react`

## 目录结构

```
frontend/
├── src/
│   ├── App.tsx            # 界面与房间 / 账单逻辑
│   └── lib/
│       ├── crypto.ts      # 身份、签名、事件加解密、备份加密
│       ├── p2p.ts         # WebRTC 连接、信令编码、mesh 广播
│       └── storage.ts     # IndexedDB 读写
├── .env.example           # VITE_ICE_SERVERS 示例
└── vite.config.ts
```

# PRD｜抢票裁定引擎 MVP（Ticket Allocation Engine）V1.1

---

## 0. 文档信息

- **目的**：定义 MVP 产品模型、页面功能与验收标准，反映当前已实现状态。
- **范围**：Hackathon MVP（3 主要页面 + 详情页）
- **状态**：**已实现 (Implemented)**
- **版本**：V1.1 (Post-Implementation Update)

---

## 1. 一句话定义

**抢票裁定引擎**是一个基于 **Monad Testnet** 的去中心化抢票应用。它利用区块链智能合约（Smart Contract）确保高并发下的抢票公平性与结果透明性。每次成功抢票都会铸造一枚唯一的 **ERC721 NFT 门票**。

---

## 2. 背景与解决问题

### 2.1 场景与痛点
- **稀缺性争抢**：同一时刻大量用户争抢有限名额。
- **信任问题**：传统中心化系统可能存在暗箱操作或数据回滚，用户难以验证剩余票数和结果的真实性。
- **并发挑战**：高并发下如何保证“不超卖”和“状态一致性”。

### 2.2 解决方案
- **透明裁定**：剩余票数、抢票结果全链上公开，不可篡改。
- **原子性交易**：智能合约保证并发请求的序列化执行，杜绝超卖。
- **资产化凭证**：成功的抢票结果直接转化为 NFT，可流通、可验证且永久存于钱包。

---

## 3. 产品目标

### 3.1 已达成目标 (Implemented)
- **G1. 活动广场**：首页实时展示所有活动列表，包括倒计时、剩余票数、状态。
- **G2. 核心抢票流程**：详情页支持“立即抢票”交互，合约实时反馈成功/失败/限购结果。
- **G3. 主办方自助发布**：无需代码，主办方通过前端即可创建并上链发布新票务活动。
- **G4. 个人资产中心**：用户可查看“我的票夹”（NFT展示）和“参与记录”（链上交互历史）。
- **G5. 实时动态可视化**：详情页展示最近 5 条成功抢票记录（Enhance Trust）。

### 3.2 技术特性
- **ERC721 标准**：门票符合 NFT 标准，可在钱包（如 MetaMask）或其他 NFT 市场查看。
- **SVG 链上渲染**：NFT 图片由合约动态生成 SVG，包含活动名和票号，无需去中心化存储。
- **防机器人/限购**：合约层强制校验 `msg.sender`，单地址单活动限购 1 张。

---

## 4. 产品模型（技术视角）

### 4.1 核心对象 (Smart Contract Structs)

- **活动 Event**
    - `id`: 唯一标识
    - `title`: 活动标题
    - `startTime`: 开始时间戳
    - `totalTickets`: 总票数
    - `remainingTickets`: 剩余票数（随抢票递减）
    - `status`: 计算属性（未开始/进行中/已售罄）

- **门票 Ticket (NFT)**
    - `id`: 全局唯一 Ticket ID (Token ID)
    - `eventId`: 所属活动 ID
    - `owner`: 归属地址
    - `acquiredAt`: 获取时间

- **参与记录 Attempt**
    - `eventId`: 目标活动
    - `result`: 结果枚举 (Success / AlreadyOwns / SoldOut / NotStarted)
    - `timestamp`: 发生时间

---

## 5. 核心业务流程

### 5.1 智能合约逻辑
```solidity
function grabTicket(uint256 _eventId) {
    1. 检查活动是否存在
    2. 检查活动是否开始 (block.timestamp >= startTime)
    3. 检查用户是否已持有该活动门票 (防复购)
    4. 检查剩余票数 > 0 (防超卖)
    5. 票数 - 1
    6. 铸造 NFT (Mint ERC721)
    7. 记录成功结果 & 抛出 TicketGrabbed 事件
}
```

### 5.2 用户交互流
1. **连接钱包**：用户进入 DApp，连接钱包并切换至 Monad Testnet。
2. **浏览/等待**：在首页或详情页查看活动，未开始则等待倒计时结束。
3. **发起抢票**：点击“立即抢票”，钱包弹出签名确认。
4. **交易确认**：区块链确认交易，合约执行裁定逻辑。
5. **结果反馈**：前端根据交易回执显示“抢票成功（获得票号 #xx）”或“失败”。
6. **资产查看**：成功后，在“我的票夹”查看生成的 NFT 票面。

---

## 6. 页面功能规格 (Implemented)

### 6.1 首页 (Home)
- **顶部**：Logo, "Create Event", "Me" (Profile), Wallet Connect.
- **列表**：活动卡片流。
- **卡片内容**：
    - 标题, 开始时间 (格式化日期)
    - 倒计时 (若未开始)
    - 进度条 (已抢/总量)
    - 状态标签 (Not Started / Live / Sold Out)
    - CTA 按钮 (Detail / Grab / View)

### 6.2 创建活动页 (Create Event)
- **表单**：此页面用于上链创建新活动。
    - 标题 (Title)
    - 开始时间 (Start Time)
    - 总票数 (Total Tickets)
- **反馈**：提交后等待钱包确认，成功后自动跳转回首页。

### 6.3 活动详情页 (Event Detail)
- **核心面板**：
    - 大字号展示实时剩余票数。
    - 动态按钮：根据状态变灰或高亮。
- **实时动态 (Recent Activity)**：
    - 列表展示最近成功的抢票者地址（脱敏）及抢到的票号。
    - 证明活动的真实性和活跃度。
- **交互反馈**：
    - 成功：弹出庆祝弹窗，展示 NFT 预览。
    - 失败：Toast 提示具体原因 (e.g. "Sold Out", "One ticket per user").

### 6.4 个人中心 (Me)
- **我的票夹**：展示当前地址持有的所有 Ticket NFT，以票样形式展示（含活动名与票号）。
- **参与历史**：展示历史抢票尝试，包括失败的记录，方便用户复盘。

---

## 7. 验收标准与当前状态

| 功能点 | 验收标准 | 状态 |
| :--- | :--- | :--- |
| **合约部署** | 合约成功部署在 Monad Testnet，所有 Read/Write 函数可用 | ✅ Done |
| **活动创建** | 主办方可创建活动，数据正确上链 | ✅ Done |
| **抢票逻辑** | 时间未到不可抢；票数归零不可抢；单人不可复抢 | ✅ Done |
| **NFT 铸造** | 抢票成功后钱包内增加 NFT，且 metadata 正确 | ✅ Done |
| **UI 状态同步** | 倒计时结束无需刷新自动变状态；票数实时更新 | ✅ Done |
| **异常处理** | 对网络错误、拒绝签名的友好提示 | ✅ Done |

---

## 8. 技术栈 (Tech/Stack)

- **Blockchain**: Monad Testnet (EVM Compatible)
- **Framework**: Scaffold-ETH 2
- **Frontend**: Next.js, TailwindCSS, DaisyUI, RainbowKit, Wagmi
- **Smart Contract**: Solidity v0.8.20, OpenZeppelin (ERC721, ReentrancyGuard)
- **Deployment**: Vercel (Frontend), Hardhat (Contract)
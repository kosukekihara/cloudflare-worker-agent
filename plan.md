# エージェント管理機能 実装計画

## Context

現在、AIエージェントの種別（gemini_default/casual/praiser/denier）とモデル・インストラクション・ツールはコードにハードコードされている。ユーザーがUIから自由にエージェントを作成・編集し、チャットパネルで選択して使えるようにする。サブエージェント呼び出し（callPraiserAgent/callDenierAgent）は削除する。

---

## 実装ステップ

### Step 1: Prismaスキーマ追加

新規ファイル: `src/infrastructure/database/prisma/agent.prisma`

```prisma
/// @namespace Agent
/// @namespace Overview
model Agent {
  id           String   @id @default(cuid())
  name         String
  modelId      String   @map("model_id")
  instruction  String
  enabledTools String[] @map("enabled_tools")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@map("agents")
}
```

マイグレーションSQL: `src/infrastructure/database/prisma/migrations/YYYYMMDDHHMMSS_create_agents/migration.sql`

### Step 2: Domain層

**`src/domain/entities/agent.entity.ts`** — `UserEntity` と同パターン。`IAgentEntity`（Date型）+ `IAgentSerializedEntity`（string型）+ `AgentEntity` クラス。`enabledTools: string[]` はシリアライズ前後で型変化なし。

**`src/domain/errors/agent-not-found.error.ts`** — `DomainError` を継承。

### Step 3: Application Port

**`src/application/ports/repositories/agent/agent.repository.ts`**

```typescript
export interface AgentRecord {
  id;
  name;
  modelId;
  instruction;
  enabledTools: string[];
  createdAt;
  updatedAt;
}
export interface SaveAgentInput {
  name;
  modelId;
  instruction;
  enabledTools: string[];
}
export interface UpdateAgentInput {
  name?;
  modelId?;
  instruction?;
  enabledTools?: string[];
}
export interface AgentRepository {
  findById(id: string): Promise<AgentRecord | null>;
  findAll(): Promise<AgentRecord[]>;
  save(input: SaveAgentInput): Promise<AgentRecord>;
  updateById(id: string, data: UpdateAgentInput): Promise<AgentRecord>;
  deleteById(id: string): Promise<void>;
}
```

### Step 4: Application Use Cases

`src/application/use-cases/agent/` 配下に5ファイル。各Use Caseは `RegisterUserUseCase` と同パターン（Input/Output型のco-locate + constructor DI + execute()）。

- `create-agent.use-case.ts` → `AgentRepository.save()`
- `get-agents.use-case.ts` → `AgentRepository.findAll()`（Output: `{ agents: IAgentSerializedEntity[] }`）
- `get-agent.use-case.ts` → `findById()` + 存在しなければ `AgentNotFoundError` スロー
- `update-agent.use-case.ts` → `findById()` 確認 + `updateById()`
- `delete-agent.use-case.ts` → `findById()` 確認 + `deleteById()`

### Step 5: Infrastructure Repository

**`src/infrastructure/repositories/agent/agent.repository.ts`** — `PrismaAgentRepository implements AgentRepository`。`PrismaUserRepository` と同パターン（`AGENT_SELECT` 定数でフィールド明示）。

### Step 6: DI Container更新

**`container.infrastructure.ts`**: `InfrastructureService` に `AgentRepository: AgentRepository` を追加し `.registerSingleton('AgentRepository', () => new PrismaAgentRepository(prismaClient))` で登録。

**`container.application.ts`**: `ApplicationService` に5つのUse Caseを追加し、すべて `registerTransient` で登録。

### Step 7: ChatIntegration Port変更

**`src/application/ports/integrations/chat/chat.integration.ts`** に `ChatAgentConfig` を追加し、`streamReply` の第2引数として渡す。

```typescript
export interface ChatAgentConfig {
  readonly modelId: string;
  readonly instruction: string;
  readonly enabledTools: string[];
}

export interface ChatIntegration {
  streamReply(
    messages: ChatIntegrationMessage[],
    agentConfig: ChatAgentConfig,
  ): AsyncGenerator<ChatStreamEvent, void, unknown>;
}
```

### Step 8: GeminiChatIntegrationのリファクタリング

**`src/infrastructure/integrations/ai/ai-chat.integration.ts`** を変更:

- `agentKind`・`agent` フィールドを削除
- コンストラクタから `agentKindOverride` 引数を削除
- `buildAgent()` を削除
- サブエージェントツール（`callPraiserAgent`/`callDenierAgent`）の組み込みを削除
- `streamReply(messages, agentConfig)` 内で毎回エージェントをビルドする

ツール絞り込みのロジック（`streamReply` 内）:

```typescript
const allTools = buildGeminiChatToolSet({ ...deps });
const enabledSet = new Set(agentConfig.enabledTools);
const filteredTools = Object.fromEntries(Object.entries(allTools).filter(([key]) => enabledSet.has(key)));
const google = createGoogleGenerativeAI({ apiKey: this.apiKey });
const model = google(agentConfig.modelId);
const agent = buildDynamicChatAgent(model, filteredTools, agentConfig.instruction);
```

**`src/infrastructure/integrations/ai/agents/`** に `dynamic-chat.agent.ts` を追加（汎用ビルダー）。他のエージェントビルダーファイル（casual, praiser, denier, gemini）は不要になるため削除。

**`src/infrastructure/integrations/ai/ai-chat-agent-kind.ts`** は不要になるため削除。

### Step 9: SendChatMessageUseCaseの変更

**`src/application/use-cases/conversation/send-chat-message.use-case.ts`** の `SendChatMessageInput` に `agentConfig: ChatAgentConfig` を追加し、`streamReply(messages, input.agentConfig)` で渡す。

### Step 10: APIエンドポイント変更

**`src/infrastructure/ui/routes/api/chat/index.ts`** のリクエストボディに `agentId: string` を追加。ハンドラー内で `GetAgentUseCase` を呼び出してエージェント設定を解決し、`SendChatMessageUseCase` に渡す。

```typescript
const body = await requestEvent.request.json<{
  conversationId: string | null;
  content: string;
  agentId: string;
}>();
// ... GetAgentUseCase で解決 → agentConfig に変換 → sendUseCase.execute({ ..., agentConfig })
```

### Step 11: UIルート実装

```
src/infrastructure/ui/routes/agents/
├── index.tsx          # 一覧ページ
├── index.server.ts    # getAgentsHandler
├── new/
│   ├── index.tsx      # 新規作成ページ
│   └── index.server.ts
└── [id]/
    └── edit/
        ├── index.tsx  # 編集ページ
        └── index.server.ts
```

各ページは `routeLoader$` / `routeAction$` + `.server.ts` 分離パターン（Qwikルール準拠）。

**利用可能なモデル一覧** と **ツール名一覧** はUIの定数として保持:

```typescript
// UIで使う定数（サーバー情報には依存しない）
const AVAILABLE_MODELS = [{ id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite' }];
const AVAILABLE_TOOLS = [
  'postalCodeLookup',
  'weather',
  'createUser',
  'getUsers',
  'updateUser',
  'deleteUser',
  'searchSimilarMessages',
];
```

**バリデーション（routeAction$ + zod$）**:

```typescript
zod$(z =>
  z.object({
    name: z.string().min(1).max(100),
    modelId: z.string().min(1),
    instruction: z.string().min(1),
    enabledTools: z
      .union([z.string(), z.array(z.string())])
      .transform(v => (Array.isArray(v) ? v : [v]))
      .optional()
      .default([]),
  }),
);
```

※ HTMLチェックボックスは1つ選択時にstring、複数選択時にstring[]になるためtransformが必要。

### Step 12: layout.tsx + ChatDrawer変更

**`src/infrastructure/ui/routes/layout.server.ts`** を新規作成し、`GetAgentsUseCase` でエージェント一覧を取得するハンドラーを定義。

**`src/infrastructure/ui/routes/layout.tsx`** に `routeLoader$`（`useAgents`）を追加し、`ChatDrawer` にpropsとして渡す。

**`src/infrastructure/ui/components/primitives/chat-drawer/ChatDrawer.tsx`** を変更:

- `agents: IAgentSerializedEntity[]` をpropsとして受け取る
- `selectedAgentId` シグナルを追加（初期値: `agents[0]?.id ?? ''`）
- ヘッダー部にエージェント選択 `<select>` を追加
- `fetch('/api/chat')` のボディに `agentId: selectedAgentId.value` を追加

エージェントが0件の場合はチャット入力を無効化し、エージェント管理画面へのリンクを表示する。

---

## 削除するファイル

- `src/infrastructure/integrations/ai/ai-chat-agent-kind.ts`
- `src/infrastructure/integrations/ai/build-sub-agent-tool.ts`
- `src/infrastructure/integrations/ai/agents/casual-chat.agent.ts`
- `src/infrastructure/integrations/ai/agents/praiser-chat.agent.ts`
- `src/infrastructure/integrations/ai/agents/denier-chat.agent.ts`
- `src/infrastructure/integrations/ai/agents/gemini-chat.agent.ts`（→ `dynamic-chat.agent.ts` に置き換え）

---

## 変更が必要な主要ファイル

| ファイル                                                                 | 変更内容                                       |
| ------------------------------------------------------------------------ | ---------------------------------------------- |
| `src/application/ports/integrations/chat/chat.integration.ts`            | `ChatAgentConfig` 追加、`streamReply` 引数追加 |
| `src/infrastructure/integrations/ai/ai-chat.integration.ts`              | 動的エージェントビルド方式に変更               |
| `src/application/use-cases/conversation/send-chat-message.use-case.ts`   | `agentConfig` フィールド追加                   |
| `src/infrastructure/ui/routes/api/chat/index.ts`                         | `agentId` 受け取り + エージェント解決          |
| `src/infrastructure/ui/routes/layout.tsx`                                | `routeLoader$` 追加                            |
| `src/infrastructure/ui/components/primitives/chat-drawer/ChatDrawer.tsx` | エージェント選択UI追加                         |
| `src/container.application.ts`                                           | 5つのUse Case登録追加                          |
| `src/container.infrastructure.ts`                                        | `AgentRepository` 登録追加                     |
| `test/` 配下のモックファイル                                             | `streamReply` シグネチャ変更に追従             |

---

## 検証方法

1. `bun run verify`（format + lint + typecheck + test）でエラーゼロを確認
2. ローカル起動後、`/agents` で一覧表示・新規作成・編集・削除が動作することを確認
3. エージェントを作成し、ChatDrawerのセレクトボックスで選択 → チャットが動作することを確認
4. ツールON/OFFが反映されることを確認（ONのツールのみLLMが呼び出せる）

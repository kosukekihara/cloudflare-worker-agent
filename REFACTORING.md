# リファクタリング分析レポート

**分析日時**: 2026-04-07
**スコープ**: `src/`（プロダクション）および `test/`（テスト品質）
**検出件数**: Critical: 8 / Warning: 11 / Suggestion: 17
**自動修正可能件数**: 13 件（下記チェックリスト内「自動修正可能: はい」）

---

## ステータス凡例

- `[ ]` 未対応
- `[x]` 対応済み
- `[-]` スキップ (設計変更を伴うため手動対応が必要)

---

## Critical (即座に対応が必要)

### [Arch] アーキテクチャ

- [ ] **ARCH-1: ChatDrawer が Markdown 統合具象を直接 import し Port を迂回** -- `src/infrastructure/ui/components/primitives/chat-drawer/ChatDrawer.tsx:3-14`
  - 問題: `MarkdownItIntegration` を UI から直接 `new` しており、`MarkdownIntegration` Port / DI を経由しない。インバウンドでの I/O 迂回にあたる。
  - 影響: 差し替え不能、バンドル・環境差、セキュリティ方針の分岐リスク。
  - 修正案: サーバー側で Port 経由レンダリング、または Qwik 規約に沿った境界ファイルへ分離。
  - 自動修正可能: いいえ

### [Sec] セキュリティ

- [ ] **SEC-1: mermaid フェンス内の未エスケープ HTML（XSS）** -- `src/infrastructure/integrations/markdown/markdown-it.integration.ts:57`
  - 問題: フェンスが `<pre class="mermaid">${token.content}</pre>` を直挿し、`ChatDrawer` の `dangerouslySetInnerHTML` 経由でスクリプト混入の余地がある。
  - 影響: 同一オリジン上のスクリプト実行・表示改ざん。
  - 修正案: フェンス内容の HTML エスケープ、長さ上限、サニタイズ方針の明文化。
  - 自動修正可能: はい

- [ ] **SEC-2: `/api/chat` 未認証・会話の認可なし（IDOR）** -- `src/infrastructure/ui/routes/api/chat/index.ts:13-35` / `src/application/use-cases/conversation/send-chat-message.use-case.ts:44-48`
  - 問題: 認証なしで `conversationId` を知れば送信可能。`userId` と主体の突合がない。固定メール紐付け。LLM ツールに特権操作が含まれる。
  - 影響: 任意会話への書き込み、ツール経由のデータ操作リスク。
  - 修正案: 認証必須、認可サービスで会話所有者検証、固定メールの撤廃。
  - 自動修正可能: いいえ

- [ ] **SEC-3: トップページのユーザー CRUD が未認証** -- `src/infrastructure/ui/routes/index.server.ts:6-35` / `src/infrastructure/ui/routes/index.tsx:48-49`
  - 問題: `routeLoader$` / `routeAction$` に認証・認可ガードがない。
  - 影響: 匿名での一覧・登録・削除。
  - 修正案: レイアウト/プラグインで認証、必要に応じ ReBAC。
  - 自動修正可能: いいえ

### [Test] テスト品質

- [ ] **TEST-1: markdown-it 統合テストが存在確認のみ** -- `test/unit/infrastructure/integrations/markdown/markdown-it.integration.spec.ts:126`
  - 問題: `expect(result).toBeDefined()` のみでフォールバック時の HTML 形状を検証していない。
  - 影響: 実装劣化にテストが気づかない。
  - 修正案: 期待 HTML 断片を `toContain` / `toMatch` 等で検証。
  - 自動修正可能: いいえ

- [ ] **TEST-2: Entity serialize テストがインスタンス性のみ** -- `test/unit/domain/entities/user.entity.spec.ts:44`
  - 問題: `not.toBeInstanceOf(UserEntity)` のみでビジネス価値が低い。
  - 影響: 誤った安心感。
  - 修正案: 直前ケースと統合または削除。
  - 自動修正可能: はい

- [ ] **TEST-3: Entity serialize テストがインスタンス性のみ（Conversation）** -- `test/unit/domain/entities/conversation.entity.spec.ts:44`
  - 問題: 同上。
  - 影響: 同上。
  - 修正案: 同上。
  - 自動修正可能: はい

- [ ] **TEST-4: Entity serialize テストがインスタンス性のみ（Message）** -- `test/unit/domain/entities/message.entity.spec.ts:61`
  - 問題: 同上。
  - 影響: 同上。
  - 修正案: 同上。
  - 自動修正可能: はい

---

## Warning (早期に対応推奨)

### [Arch] アーキテクチャ

- [ ] **ARCH-2: `interface/` 層と実装配置のドキュメントずれ** -- `src/interface/`（実質未使用）
  - 問題: ルール上の Inbound は `interface/` だが実装は `infrastructure/ui` に集約。
  - 影響: レビュー・オンボーディング時の迷い。
  - 修正案: 移行または文書を実態に合わせて更新。
  - 自動修正可能: いいえ

### [Maint] 保守性

- [ ] **MAINT-1: `biome-ignore` によるルール無効化** -- `src/infrastructure/integrations/ai/build-sub-agent-tool.ts:31`、`src/infrastructure/database/prisma/seed/index.ts` / `user.seed.ts` 等
  - 問題: 品質ゲート迂回に相当しうる。
  - 影響: 禁止パターンの持ち込み。
  - 修正案: ロガー抽象化、コード側整理（設定緩和は最終手段）。
  - 自動修正可能: いいえ

- [ ] **MAINT-2: 公開 API の JSDoc / `@throws` の不足・不整合** -- `src/container.ts`、`container.*.ts`、`index.server.ts`、`index.tsx`、複数 UseCase / Integration 等
  - 問題: `javascript.md` の `@param` / `@returns` / `@throws {型}` 形式が揃わない箇所がある。`throw` 可能な Integration に `@throws` がない。
  - 影響: 呼び出し側の契約把握困難。
  - 修正案: 公開関数・メソッド単位で JSDoc を整備。
  - 自動修正可能: いいえ

### [Perf] パフォーマンス

- [ ] **PERF-1: 会話ごと全メッセージ読込** -- `src/application/use-cases/conversation/send-chat-message.use-case.ts:50`
  - 問題: 送信のたびに全会話履歴を取得。
  - 影響: 長会話でレイテンシ・コスト増。
  - 修正案: 直近 N 件、要約＋履歴など。
  - 自動修正可能: いいえ

- [ ] **PERF-2: ユーザー一覧がページネーションなし全件取得** -- `src/infrastructure/repositories/user/user.repository.ts:58-62` / `src/application/use-cases/user/get-users.use-case.ts:28`
  - 問題: `findMany` に制限なし。
  - 影響: ユーザー増で線形悪化。
  - 修正案: `take`/`skip` またはカーソル。
  - 自動修正可能: いいえ

### [Type] 型安全性

- [ ] **TYPE-1: Prisma クライアントの二重 `as`** -- `src/container.infrastructure.ts:44`
  - 問題: `as unknown as PrismaClient` で型チェック迂回。
  - 影響: API 変更の検出遅れ。
  - 修正案: 公式の拡張後型付けや Port 側の型設計。
  - 自動修正可能: いいえ

- [ ] **TYPE-2: チャットエージェント戻り値の `as ToolLoopStreamAdapter`** -- `src/infrastructure/integrations/ai/agents/*.agent.ts`（4 ファイル）
  - 問題: SDK 戻り値を固定アサーション。
  - 影響: 実行時まで型ずれが埋もれる。
  - 修正案: 型安全なアダプタ層。
  - 自動修正可能: いいえ

- [ ] **TYPE-3: DB role の `as MessageRole`** -- `src/infrastructure/repositories/message/message.repository.ts:50,67,98`
  - 問題: 値の検証なしで列挙型に付け替え。
  - 影響: 不正値のランタイム不整合。
  - 修正案: マッピング関数＋検証。
  - 自動修正可能: いいえ

### [Sec] セキュリティ

- [ ] **SEC-4: `/api/chat` の JSON にスキーマ検証なし** -- `src/infrastructure/ui/routes/api/chat/index.ts:14`
  - 問題: `request.json` のみ。
  - 影響: 巨大ペイロード・想定外フィールド。
  - 修正案: Zod 等で長さ・形式を検証。
  - 自動修正可能: はい

- [ ] **SEC-5: サブエージェント入力の `console.debug`** -- `src/infrastructure/integrations/ai/build-sub-agent-tool.ts:32`
  - 問題: 機微情報がログに残る可能性。
  - 影響: ログ漏えい。
  - 修正案: 本番無効化またはメタデータのみ。
  - 自動修正可能: はい

- [ ] **SEC-6: SSE エラーで内部メッセージをそのまま返却** -- `src/infrastructure/ui/routes/api/chat/index.ts:46-54`
  - 問題: `error.message` をクライアントへ。
  - 影響: 情報漏えいの手がかり。
  - 修正案: 汎用メッセージ＋サーバー側のみ詳細。
  - 自動修正可能: はい

---

## Suggestion (改善提案)

### [Arch] アーキテクチャ

- [ ] **ARCH-3: ChatDrawer を `primitives/` ではなく機能ディレクトリへ** -- `src/infrastructure/ui/components/primitives/chat-drawer/ChatDrawer.tsx:1`
  - 問題: チャット特化 UI が primitive 分類とズレる。
  - 影響: フォルダ探索の迷い。
  - 修正案: 例 `components/chat/chat-drawer/`。
  - 自動修正可能: はい

### [Maint] 保守性

- [ ] **MAINT-3: `@param` 表記の一貫性** -- `src/infrastructure/integrations/ai/build-sub-agent-tool.ts:19`
  - 問題: `@param x -` 形式と他ファイルの形式が混在。
  - 影響: 可読性。
  - 修正案: ハイフンなしに統一。
  - 自動修正可能: はい

- [ ] **MAINT-4: `container.infrastructure` の型アサーション方針** -- `src/container.infrastructure.ts:44`
  - 問題: `unknown` 二重キャスト。
  - 影響: 保守性。
  - 修正案: 型設計の見直し。
  - 自動修正可能: いいえ

### [Perf] パフォーマンス

- [ ] **PERF-3: ChatDrawer のストリーム更新で全件 map** -- `src/infrastructure/ui/components/primitives/chat-drawer/ChatDrawer.tsx:156-161` 他
  - 問題: チャンクごとに配列全体を走査。
  - 影響: 長文ストリーミング時の負荷。
  - 修正案: 末尾メッセージのみ更新など。
  - 自動修正可能: いいえ

- [ ] **PERF-4: mermaid の再初期化頻度** -- `src/infrastructure/ui/components/primitives/chat-drawer/ChatDrawer.tsx:39-48`
  - 問題: メッセージ変更のたびに初期化・run が走りうる。
  - 影響: 不要な DOM 走査。
  - 修正案: 初回のみ initialize、run はデバウンス等。
  - 自動修正可能: はい

- [ ] **PERF-5: 一覧の日付を描画パスで毎回フォーマット** -- `src/infrastructure/ui/routes/index.tsx:111-117`
  - 問題: `map` 内で `toLocaleDateString`。
  - 影響: スケール時の無駄。
  - 修正案: Loader 側で文字列化。
  - 自動修正可能: はい

- [ ] **PERF-6: `root.css` のユニバーサルセレクタ** -- `src/infrastructure/ui/root.css:2-6`
  - 問題: `css.md` では `*` の回避を SHOULD。
  - 影響: 理論上のスタイル計算コスト。
  - 修正案: `:where(*)` 等、または意図の文書化。
  - 自動修正可能: はい（回帰確認前提）

- [ ] **PERF-7: WritableStream の `finally` と `using` 検討** -- `src/infrastructure/ui/routes/api/chat/index.ts:55-57`
  - 問題: `using` 代替の可否は環境次第。
  - 影響: 小。
  - 修正案: プロジェクト方針で統一。
  - 自動修正可能: いいえ

### [Type] 型安全性

- [ ] **TYPE-4: SSE JSON の `as Record`** -- `src/infrastructure/ui/components/primitives/chat-drawer/ChatDrawer.tsx:151`
  - 問題: パース直後の検証が薄い。
  - 影響: 想定外イベント形状。
  - 修正案: Zod または型ガード。
  - 自動修正可能: いいえ

### [Sec] セキュリティ

- [ ] **SEC-7: API ルートの固定メール** -- `src/infrastructure/ui/routes/api/chat/index.ts:4-5`
  - 問題: 個人メールのハードコード。
  - 影響: 運用・プライバシー。
  - 修正案: 認証主体に置換。
  - 自動修正可能: いいえ

- [ ] **SEC-8: markdown-it linkify の URL スキーム** -- `src/infrastructure/integrations/markdown/markdown-it.integration.ts:21`
  - 問題: `javascript:` 等の議論がありうる。
  - 影響: 低〜中（版依存）。
  - 修正案: 許可スキーム、`rel` 付与。
  - 自動修正可能: いいえ

- [ ] **SEC-9: 空オブジェクト LLM スキーマの方針** -- `src/infrastructure/integrations/ai/gemini-chat-tool-set.ts:78` 等
  - 問題: フィールド 0 件時の `.describe()` 解釈。
  - 影響: ルール解釈の揺れ。
  - 修正案: ドキュメント化。
  - 自動修正可能: いいえ

### [Test] テスト品質

- [ ] **TEST-5: `*.integration.spec.ts` の配置方針** -- `test/unit/infrastructure/integrations/**/*.integration.spec.ts`
  - 問題: 規約では `test/integration/` との説明がある。
  - 影響: ディレクトリ方針の一貫性。
  - 修正案: 移動または規約の明文化。
  - 自動修正可能: はい（移動のみなら）

- [ ] **TEST-6: Gemini/OpenAI 統合 spec の重複** -- `test/unit/infrastructure/integrations/ai/ai-chat.integration.spec.ts` / `chat/openai.integration.spec.ts`
  - 問題: シナリオが二重化。
  - 影響: 二重メンテ。
  - 修正案: パラメータ化ヘルパー等。
  - 自動修正可能: いいえ

- [ ] **TEST-7: Repository 実装の spec 空白** -- `user.repository.ts` / `conversation.repository.ts` 等
  - 問題: Prisma 実装向け spec が薄い/なし。
  - 影響: 回帰検出の穴。
  - 修正案: 統合テストまたはリポジトリ単体テストの追加（方針次第）。
  - 自動修正可能: いいえ

---

## 良好な項目

### [Arch]

- Domain/Application から Infrastructure への違法 import は検出されず。UseCase は Port のみ参照。Entity は `IEntity` / `serialize()` に準拠。コンテナ合成順・Prisma の扱いは規約に沿う。

### [Maint]

- 三項演算子、`any`、非 null `!`、`forEach`、パラメータプロパティ、主要禁止事項はプロダクション `src` で未検出。フォームに `zod$` あり。

### [Perf]

- Repository 内のループ中 Prisma N+1、`return await` は未検出。

### [Type]

- `any`、非 null `!`、パラメータプロパティ、JSDoc 型重複 `@param {` は未検出。

### [Sec]

- `eval` / `new Function` なし。`process.env` / `requestEvent.env.get()` なし。生 SQL はパラメータ化。ハードコード API キーなし。`.tsx` から `~/container` 静的 import なし。

### [Test]

- カバレッジ除外コメント、スキップ放置、`*.server` 直接 import はなし。主要 UseCase に対応 spec あり。`@throws` と spec の対応は主要箇所で確認。

---

## 統計サマリー

| エージェント    | 分析ファイル数 | Critical | Warning | Suggestion |
| :-------------- | :------------- | :------- | :------ | :--------- |
| Architecture    | 74             | 1        | 1       | 1          |
| Maintainability | 75             | 0        | 2       | 4          |
| Performance     | 75             | 0        | 2       | 5          |
| Type Safety     | 74             | 0        | 3       | 1          |
| Security        | 67             | 3        | 3       | 3          |
| Test Quality    | 17             | 4        | 0       | 3          |
| **合計**        | （src / test 別掲） | **8**    | **11**  | **17**     |

---

## 次の AI エージェントへの引き継ぎ事項

- **残件数**: Critical: 8 / Warning: 11 / Suggestion: 17（いずれも未チェック）
- **自動修正待ち**: 13 件（上記「自動修正可能: はい」）
- **手動対応待ち**: 多数（Critical の認証/認可・テスト期待値、Warning の JSDoc 等）
- **設計変更必要**: 0 件（`[-]` 未使用）
- **注意点**: Security の XSS 修正と Architecture の `ChatDrawer` 責務分割は連動しやすい。`bun audit` は別途（サブエージェント報告: 20 vulnerabilities）確認推奨。
- **最終更新**: 2026-04-07

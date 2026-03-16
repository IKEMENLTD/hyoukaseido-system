// =============================================================================
// 使い方ガイド - 1から100まで完全マニュアル
// 初参加メンバーが評価サイクル全体を理解するためのステップバイステップガイド
// =============================================================================

import { getCurrentMember } from '@/lib/auth/get-member';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// ガイドデータ
// ---------------------------------------------------------------------------

interface GuideStep {
  number: number;
  title: string;
  who: string;
  where: string;
  href: string;
  what: string;
  why: string;
  next: string;
}

interface GuidePhase {
  id: string;
  title: string;
  timing: string;
  color: string;
  description: string;
  steps: GuideStep[];
}

const GUIDE_PHASES: GuidePhase[] = [
  // =========================================================================
  // Phase 0: 初期セットアップ
  // =========================================================================
  {
    id: 'setup',
    title: '初期セットアップ',
    timing: 'システム導入時（1回だけ）',
    color: 'border-[#737373]',
    description: '管理者がシステムの土台を作ります。全社員が使い始める前に完了させてください。',
    steps: [
      {
        number: 1,
        title: '組織情報を設定する',
        who: '代表（G5）',
        where: '管理 > システム設定',
        href: '/admin/settings',
        what: '組織名と会計年度の開始月（4月）を設定します。等級（G1〜G5）の名称・給与レンジ・バリュー項目もここで定義します。',
        why: 'すべての評価計算の基盤になる設定です。ランク判定の閾値（S=90点以上等）や昇給額もここで決めます。',
        next: '次は事業部を作成します。',
      },
      {
        number: 2,
        title: '事業部を作成する',
        who: '代表（G5）/ 事業部長（G4）',
        where: '管理 > 事業部管理',
        href: '/admin/divisions',
        what: '会社の事業部（例: システム開発事業部、ASP事業部）を登録します。各事業部に「黒字」か「投資中（赤字）」のフェーズを設定します。',
        why: 'フェーズによって評価の配分が変わります。黒字事業部は数字（定量KPI）重視、投資中は行動（定性評価）重視になります。',
        next: '次はメンバーを登録します。',
      },
      {
        number: 3,
        title: 'メンバーを登録する',
        who: '代表（G5）/ 事業部長（G4）',
        where: '管理 > メンバー管理',
        href: '/admin/members',
        what: '全社員の名前・Googleメールアドレス・等級（G1〜G5）・月給を登録し、事業部に配属します。事業部長は「事業部長フラグ」をONにします。',
        why: 'メールアドレスを登録しておくと、社員がGoogleログインしたとき自動的にアカウントが紐づきます。ここで登録しないとシステムを使えません。',
        next: '次はKPIテンプレートを作ります。',
      },
      {
        number: 4,
        title: 'KPI評価項目を定義する',
        who: '代表（G5）/ 事業部長（G4）',
        where: '管理 > KPIテンプレート',
        href: '/admin/kpi-templates',
        what: '事業部×職種ごとに、評価するKPI項目（例: 受注売上、顧客満足度）とウェイト・ランク閾値を定義します。行動評価項目やバリュー項目もここで設定します。',
        why: 'ここで定義した項目が、社員の自己評価・上長評価の入力フォームに自動表示されます。事業部の戦略に合った指標を設定しましょう。',
        next: '次は通知チャンネルを設定します。',
      },
      {
        number: 5,
        title: '通知チャンネルを設定する',
        who: '代表（G5）/ 事業部長（G4）',
        where: '管理 > 通知管理',
        href: '/admin/notifications',
        what: 'Slack・LINE・ChatWorkのWebhook URLを登録し、どのイベント（評価開始、OKRリマインド等）で通知を飛ばすか設定します。',
        why: '設定しておくと、評価期間の開始や提出リマインドが自動でチャットに届きます。設定しなくてもシステムは使えますが、通知があると運用がスムーズです。',
        next: '初期セットアップ完了です。次は評価期間を作成します。',
      },
    ],
  },

  // =========================================================================
  // Phase 1: 期間設定と目標設定
  // =========================================================================
  {
    id: 'planning',
    title: '期間設定と目標設定',
    timing: '半期の開始時（4月・10月）',
    color: 'border-[#f59e0b]',
    description: '新しい半期が始まったら、評価期間とOKR期間を作成し、全社員が目標を設定します。',
    steps: [
      {
        number: 6,
        title: '評価期間を作成する',
        who: '代表（G5）/ 事業部長（G4）',
        where: '管理 > 評価期間管理',
        href: '/admin/eval-periods',
        what: '新しい半期（例: 2026年度 H1）を作成し、開始日・終了日を設定します。ステータスを「準備中」→「目標設定」に進めます。',
        why: '評価期間を作らないと、社員の自己評価や上長評価が開始できません。全評価プロセスの起点です。',
        next: '次にOKR期間も作ります。',
      },
      {
        number: 7,
        title: 'OKR期間を作成して紐付ける',
        who: '代表（G5）/ 事業部長（G4）',
        where: '管理 > OKR期間管理 → 評価期間管理',
        href: '/admin/okr-periods',
        what: '四半期のOKR期間（例: 2026 Q1）を作成します。その後「評価期間管理」の「OKR」ボタンで、評価期間（H1）にOKR期間（Q1, Q2）を紐付けます。',
        why: '紐付けにより、OKRの達成度が半期評価に自動反映されます。紐付けないとOKRと評価が別々のまま連動しません。',
        next: '次は財務データを入力します。',
      },
      {
        number: 8,
        title: '事業部の財務データを入力する',
        who: '代表（G5）/ 事業部長（G4）',
        where: '管理 > 財務データ',
        href: '/admin/financials',
        what: '事業部ごとの月次売上・原価・販管費を入力します。粗利と営業利益は自動計算されます。',
        why: 'このデータがダッシュボードのROI計算に使われます。また、評価作成時に事業部が黒字か赤字かを自動判定し、評価の配分比率を決めます。月1回、5分で終わります。',
        next: 'ここから全社員の出番です。OKRを設定しましょう。',
      },
      {
        number: 9,
        title: 'OKR（目標と成果指標）を設定する',
        who: '全社員',
        where: 'OKR',
        href: '/objectives',
        what: '「新規作成」から四半期の目標（Objective）を登録し、それを測るKey Result（数値指標）を2〜5個設定します。全社→事業部→個人の順で目標が連なるツリー構造になります。',
        why: 'OKRは「何を達成するか」の指針です。高い目標を掲げるのがポイント。達成率70%でも成功です。週次チェックインで毎週進捗を更新していきます。',
        next: '目標設定が終わったら、日常の運用フェーズに入ります。',
      },
    ],
  },

  // =========================================================================
  // Phase 2: 日常運用（四半期中）
  // =========================================================================
  {
    id: 'daily',
    title: '日常の活動',
    timing: '四半期を通じて毎週・毎月',
    color: 'border-[#3b82f6]',
    description: '評価期間中の日々の活動です。週次でOKRチェックイン、月次で1on1、随時でクロスセルやウィンセッションを行います。',
    steps: [
      {
        number: 10,
        title: '毎週OKRチェックインをする',
        who: '全社員',
        where: 'OKR > 週次チェックイン',
        href: '/checkin',
        what: '自分のKey Resultの今週の実績値と自信度（達成できそうか）を入力します。1回5分程度です。',
        why: '毎週の進捗が記録されることで、OKR詳細ページにグラフが蓄積されます。伸びが鈍いKRは早めに1on1で対策を話し合えます。',
        next: '入力した進捗はOKR詳細やダッシュボードに即反映されます。',
      },
      {
        number: 11,
        title: '1on1面談を記録する',
        who: 'マネージャー（G3以上）',
        where: '1on1 > 新規記録',
        href: '/one-on-one/new',
        what: '部下との1on1面談で話した内容（OKR進捗・障壁・アクションアイテム）を記録します。メンバーを選ぶとそのメンバーのOKR進捗が自動表示されます。',
        why: '記録を残すことで、前回決めたアクションの追跡ができます。評価時やフィードバック面談の参考資料としても活用されます。過去の記録は「1on1 > 履歴」で確認。',
        next: '定期的に続けることで、部下の成長を追跡できます。',
      },
      {
        number: 12,
        title: 'クロスセル（トスアップ）を登録する',
        who: '全社員',
        where: 'クロスセル',
        href: '/toss',
        what: '他の事業部に紹介できるお客様がいたら、紹介経路を選んで担当者にトスアップします。成約するとインセンティブ（ボーナス）がもらえます。',
        why: '事業部間の連携を促進し、全社の売上向上につなげます。トスの進捗は一覧で追跡でき、「進行中」→「受注」と更新していきます。成約時は粗利を入力するとボーナスが自動計算されます。',
        next: '成約実績はダッシュボードのクロスセルマップにも反映されます。',
      },
      {
        number: 13,
        title: 'ウィンセッションに投稿する',
        who: '全社員',
        where: 'ウィンセッション',
        href: '/win-session',
        what: '今週うまくいったこと、嬉しかったことを投稿して全社で共有します。大きな成果でも小さな成功でもOKです。',
        why: '成功体験の共有はチームの士気を上げます。他事業部の成功事例からクロスセルのヒントが見つかることもあります。',
        next: '毎週続けることでチーム文化が醸成されます。',
      },
    ],
  },

  // =========================================================================
  // Phase 3: 四半期レビュー
  // =========================================================================
  {
    id: 'review',
    title: '四半期OKRレビュー',
    timing: '四半期末（6月・9月・12月・3月）',
    color: 'border-[#a855f7]',
    description: '四半期が終わったら、OKRの最終結果を振り返ります。ここで確定したスコアが半期評価に反映されます。',
    steps: [
      {
        number: 14,
        title: 'OKRの最終達成度を入力する',
        who: '全社員',
        where: 'OKR > 四半期レビュー',
        href: '/review',
        what: '各Key Resultの最終達成度（0.0〜1.0）を入力します。週次チェックインの最終値を元に、実際の結果を確定させます。',
        why: 'ここで確定した達成度が「評価結果」の総合スコアに自動で組み込まれます。正直に振り返ることが大切です。',
        next: '半期末にはさらに自己評価が始まります。',
      },
    ],
  },

  // =========================================================================
  // Phase 4: 自己評価
  // =========================================================================
  {
    id: 'self-eval',
    title: '自己評価',
    timing: '半期末（9月・3月）/ 評価期間ステータスが「自己評価」の時',
    color: 'border-[#22d3ee]',
    description: '管理者が評価期間を「自己評価」フェーズに進めたら、全社員が自分の半期を振り返って自己評価を入力・提出します。',
    steps: [
      {
        number: 15,
        title: '定量KPI（数字の成果）を入力する',
        who: '全社員',
        where: '査定 > 自己評価 > 定量KPI',
        href: '/history',
        what: '事業部・職種ごとに設定されたKPI項目（例: 受注売上、新規契約数）の目標値と実績値を入力します。達成率とランクが自動計算されます。',
        why: '黒字事業部では評価全体の50%、投資中事業部では30%を占める最重要セクションです。正確な数字を入力しましょう。',
        next: '次は定性評価です。',
      },
      {
        number: 16,
        title: '定性評価（行動の振り返り）を入力する',
        who: '全社員',
        where: '査定 > 自己評価 > 定性評価',
        href: '/history',
        what: '行動評価項目ごとに4段階（期待超え/基準達成/やや不足/不十分）で自己評価し、具体的なエピソードをコメントに書きます。',
        why: '数字だけでは測れない日々の行動を評価します。「こういう場面でこう行動した結果、こうなった」と具体的に書くと上長が評価しやすくなります。',
        next: '次はバリュー評価です。',
      },
      {
        number: 17,
        title: 'バリュー評価を入力する',
        who: '全社員',
        where: '査定 > 自己評価 > バリュー評価',
        href: '/history',
        what: '会社のバリュー項目（例: Be Bold, Build Together, Own the Numbers）に対して、自分がどう体現したかをスコアとエビデンスで記入します。',
        why: '会社の価値観への貢献度を評価します。評価全体の20〜25%を占めます。',
        next: '3つ全て入力したら提出です。',
      },
      {
        number: 18,
        title: '自己評価を確認して提出する',
        who: '全社員',
        where: '査定 > 自己評価 > サマリー',
        href: '/history',
        what: '3カテゴリの入力内容を確認し、自己コメント（今期の振り返り）を書いて「自己評価を提出」します。提出後は変更できません。',
        why: '提出すると上長に通知が届き、上長評価のフェーズに進みます。全員が提出するのを待ってから次のステップに進むので、期限内に出しましょう。',
        next: '上長があなたの評価を開始します。',
      },
    ],
  },

  // =========================================================================
  // Phase 5: 上長評価
  // =========================================================================
  {
    id: 'manager-eval',
    title: '上長評価',
    timing: '自己評価提出後 / 評価期間ステータスが「上長評価」の時',
    color: 'border-[#a855f7]',
    description: 'マネージャーが部下の自己評価を参照しながら、上長としての評価スコアをつけます。',
    steps: [
      {
        number: 19,
        title: '部下の自己評価を確認して上長スコアをつける',
        who: 'マネージャー（G3以上）',
        where: '査定 > 上長評価',
        href: '/history',
        what: '部下一人ずつ、定量KPI（参照のみ）・定性行動（上長スコア入力）・バリュー（上長スコア入力）を評価します。「上位等級行動」フラグも判定します。',
        why: '自己評価だけでは甘めになりがちです。上長が客観的な視点でスコアをつけることで、公平な評価になります。上位等級行動フラグは、1〜2項目で+1ランク、3項目以上で+2ランクのボーナスが付きます。',
        next: '全セクション入力したら提出です。',
      },
      {
        number: 20,
        title: '上長評価を確認して提出する',
        who: 'マネージャー（G3以上）',
        where: '査定 > 上長評価 > サマリー',
        href: '/history',
        what: 'スコアサマリー・推定ランク・推定昇給額を確認し、上長コメントと次期アクションを書いて「上長評価を提出」します。',
        why: '提出すると総合スコアとランクが自動計算されます。全マネージャーの提出が揃ったら、キャリブレーションに進みます。',
        next: '次はキャリブレーションです。',
      },
    ],
  },

  // =========================================================================
  // Phase 6: キャリブレーション〜フィードバック
  // =========================================================================
  {
    id: 'calibration',
    title: 'キャリブレーションとフィードバック',
    timing: '上長評価完了後',
    color: 'border-[#22d3ee]',
    description: '事業部間の評価バランスを調整し、最終ランクを確定した後、全社員にフィードバック面談を実施します。',
    steps: [
      {
        number: 21,
        title: 'ランク分布を調整する（キャリブレーション）',
        who: '代表（G5）/ 事業部長（G4）',
        where: 'キャリブレーション',
        href: '/calibration',
        what: '全社員の総合スコア・提案ランクを一覧で確認し、事業部間でバラつきがないか調整します。目標分布（S:5-10%, A:20-25%, B:40-50%, C:15-20%, D:5-10%）と比較しながらランクを確定します。',
        why: '評価者によって甘い・厳しいの差が出るのを防ぎ、全社で公平な評価にします。ここで確定したランクが昇給額を決定します。',
        next: '確定したら、フィードバック面談を行います。',
      },
      {
        number: 22,
        title: 'フィードバック面談を実施する',
        who: 'マネージャー（G3以上）',
        where: 'フィードバック',
        href: '/feedback',
        what: '部下一人ずつと面談し、確定した評価結果（ランク・スコア・コメント）を直接伝えます。良かった点・改善点を話し合い、面談メモを記録します。',
        why: '評価は伝えてこそ意味があります。本人の感想も聞き、次期に向けたアクションを合意しましょう。面談完了を記録すると、本人が「評価結果」ページで結果を閲覧できるようになります。',
        next: '全員のフィードバックが終わったら評価を確定します。',
      },
      {
        number: 23,
        title: '評価を最終確定する',
        who: '代表（G5）/ 事業部長（G4）',
        where: 'フィードバック',
        href: '/feedback',
        what: 'フィードバック済みの評価に「評価確定」ボタンを押して、ステータスを最終確定（finalized）にします。',
        why: '確定すると変更できなくなります。今期の評価サイクルが正式に完了します。評価期間管理で「クローズ」に進めて終了です。',
        next: '社員が結果を確認できるようになります。',
      },
    ],
  },

  // =========================================================================
  // Phase 7: 結果確認と次期準備
  // =========================================================================
  {
    id: 'results',
    title: '結果確認と次のサイクルへ',
    timing: '評価確定後',
    color: 'border-[#22c55e]',
    description: '社員が自分の評価結果を確認し、C/Dランクのメンバーには改善計画を作成します。そして次の半期のサイクルが始まります。',
    steps: [
      {
        number: 24,
        title: '自分の評価結果を確認する',
        who: '全社員',
        where: '評価結果',
        href: '/results',
        what: '総合スコア・ランク（S〜D）・昇給額・カテゴリ別スコア・上長コメント・昇格適格性を確認します。印刷/PDF出力も可能です。',
        why: '自分の強み・弱みを客観的に把握できます。次期の目標設定に活かしましょう。Sランクは即昇格検討、2期連続Aは昇格候補になります。',
        next: 'C/Dランクの場合は改善計画が作られます。',
      },
      {
        number: 25,
        title: 'C/Dランクメンバーの改善計画を作成する',
        who: 'マネージャー（G3以上）',
        where: '改善計画',
        href: '/improvement-plans',
        what: 'C/Dランクのメンバーに対して、具体的な改善目標とマイルストーンを設定します。レビュー頻度（週次/月次）も決めます。',
        why: '改善計画なしにC/Dを放置すると、本人も上長も次期に何をすればいいかわかりません。マイルストーンにチェックを入れながら1on1で進捗をフォローし、次期の評価向上を目指します。',
        next: '改善計画のフォローは日常の1on1で行います。',
      },
      {
        number: 26,
        title: '四半期インセンティブを承認・支払する',
        who: '代表（G5）/ 事業部長（G4）',
        where: 'インセンティブ',
        href: '/quarterly-bonus',
        what: 'KPI達成・OKRストレッチ・特別の各インセンティブを確認し、「承認」→「支払確定」と処理します。',
        why: '評価とは別の報奨制度です。四半期ごとに処理することで、成果に対する即時フィードバックになります。',
        next: 'そして次の半期のサイクルが始まります。ステップ6に戻りましょう。',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// ページコンポーネント
// ---------------------------------------------------------------------------

export default async function GuidePage() {
  const member = await getCurrentMember();

  // 等級に応じたハイライト
  const isAdmin = member && ['G4', 'G5'].includes(member.grade);
  const isManager = member && ['G3', 'G4', 'G5'].includes(member.grade);

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* ヘッダー */}
        <div>
          <h1 className="text-2xl font-bold text-[#e5e5e5] tracking-wider">
            使い方ガイド
          </h1>
          <p className="text-sm text-[#737373] mt-2 leading-relaxed">
            評価制度システムの使い方を1から順番に説明します。
            初めて使う方はここを上から読み進めてください。
          </p>
          {member && (
            <div className="mt-3 flex items-center gap-2">
              <span className="px-2 py-0.5 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold">
                {member.grade}
              </span>
              <span className="text-xs text-[#737373]">
                {isAdmin
                  ? 'すべてのステップが対象です'
                  : isManager
                    ? '管理機能の一部と全社員向けステップが対象です'
                    : '「全社員」のステップが対象です（管理者向けは参考情報）'}
              </span>
            </div>
          )}
        </div>

        {/* 全体フロー図 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <div className="text-xs text-[#737373] uppercase tracking-wider mb-3">
            評価サイクル全体像
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {GUIDE_PHASES.map((phase, i) => (
              <div key={phase.id} className="flex items-center gap-2">
                <a
                  href={`#${phase.id}`}
                  className={`px-3 py-1.5 border ${phase.color} text-[#e5e5e5] hover:bg-[#111111] transition-colors`}
                >
                  {phase.title}
                </a>
                {i < GUIDE_PHASES.length - 1 && (
                  <span className="text-[#333333]">{'>'}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 各フェーズ */}
        {GUIDE_PHASES.map((phase) => (
          <div key={phase.id} id={phase.id} className="space-y-4">
            {/* フェーズヘッダー */}
            <div className={`border-l-2 ${phase.color} pl-4`}>
              <h2 className="text-lg font-bold text-[#e5e5e5] tracking-wider">
                {phase.title}
              </h2>
              <div className="text-xs text-[#737373] mt-1">{phase.timing}</div>
              <p className="text-sm text-[#a3a3a3] mt-2">{phase.description}</p>
            </div>

            {/* ステップカード */}
            {phase.steps.map((step) => {
              // 等級によるハイライト判定
              const isForMe =
                step.who === '全社員' ||
                (isManager && step.who.includes('G3')) ||
                (isAdmin && (step.who.includes('G4') || step.who.includes('G5')));

              return (
                <div
                  key={step.number}
                  className={`border bg-[#0a0a0a] ${
                    isForMe ? 'border-[#1a1a1a]' : 'border-[#111111] opacity-60'
                  }`}
                >
                  {/* ステップヘッダー */}
                  <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 flex items-center justify-center border border-[#3b82f6] text-xs text-[#3b82f6] font-bold">
                        {step.number}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-[#e5e5e5]">{step.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[#737373]">{step.who}</span>
                          <span className="text-[10px] text-[#404040]">/</span>
                          <span className="text-[10px] text-[#3b82f6]">{step.where}</span>
                        </div>
                      </div>
                    </div>
                    <Link
                      href={step.href}
                      className="px-3 py-1 border border-[#333333] text-[10px] text-[#a3a3a3] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors"
                    >
                      開く
                    </Link>
                  </div>

                  {/* ステップ内容 */}
                  <div className="px-4 py-3 space-y-3">
                    <div>
                      <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">
                        やること
                      </div>
                      <p className="text-sm text-[#a3a3a3] leading-relaxed">{step.what}</p>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">
                        なぜ必要か
                      </div>
                      <p className="text-sm text-[#a3a3a3] leading-relaxed">{step.why}</p>
                    </div>
                    <div className="border-t border-[#111111] pt-2">
                      <p className="text-xs text-[#22d3ee]">{step.next}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* フッター */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6 text-center">
          <p className="text-sm text-[#a3a3a3] mb-3">
            以上が評価サイクルの全ステップです。このサイクルが半期ごとに繰り返されます。
          </p>
          <p className="text-xs text-[#737373]">
            各ページの右下にある「?」ボタンからも、そのページの詳しい使い方を確認できます。
          </p>
        </div>
      </div>
    </div>
  );
}
